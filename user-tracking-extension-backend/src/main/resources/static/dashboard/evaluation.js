const CATEGORIES = ['STUDY', 'WORK', 'ENTERTAINMENT', 'SOCIAL', 'OTHER'];
const fileInput = document.getElementById('csvFile');
const runButton = document.getElementById('runEvaluation');
const statusNode = document.getElementById('evalStatus');
let labeledRows = [];
let savedUrl = null;

function parseCsv(text) {
    const rows = [];
    let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quoted) {
            if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
            else if (ch === '"') quoted = false;
            else cell += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ',') { row.push(cell); cell = ''; }
        else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && text[i + 1] === '\n') i++;
            row.push(cell); cell = '';
            if (row.some(value => value.trim())) rows.push(row);
            row = [];
        } else cell += ch;
    }
    row.push(cell);
    if (row.some(value => value.trim())) rows.push(row);
    if (quoted) throw new Error('The CSV contains an unterminated quoted field.');
    if (rows.length < 2) throw new Error('The CSV needs a header row and at least one labeled site.');
    const headers = rows.shift().map(value => value.trim().toLowerCase().replace(/^\uFEFF/, ''));
    const indexes = ['domain', 'title', 'true_category'].map(name => headers.indexOf(name));
    if (indexes.some(index => index < 0)) throw new Error('Required CSV headers are domain,title,true_category.');
    const parsed = rows.map((values, index) => {
        const domain = (values[indexes[0]] || '').trim();
        const title = (values[indexes[1]] || '').trim();
        const category = (values[indexes[2]] || '').trim().toUpperCase();
        if (!domain || !CATEGORIES.includes(category)) throw new Error(`Invalid domain or category on CSV row ${index + 2}.`);
        return { domain, title, trueCategory: category };
    });
    if (parsed.length > 500) throw new Error('Limit this browser evaluation to 500 labeled rows.');
    return parsed;
}

fileInput.addEventListener('change', async () => {
    if (savedUrl) URL.revokeObjectURL(savedUrl);
    savedUrl = null; labeledRows = []; runButton.disabled = true;
    try {
        const file = fileInput.files[0];
        if (!file) return;
        labeledRows = parseCsv(await file.text());
        document.getElementById('fileSummary').textContent = `${file.name}: ${labeledRows.length} labeled rows.`;
        runButton.disabled = false;
        statusNode.textContent = '';
    } catch (error) {
        document.getElementById('fileSummary').textContent = 'Could not read the selected file.';
        statusNode.textContent = error.message;
        statusNode.dataset.state = 'error';
    }
});

async function predict(row, classifier) {
    const url = new URL('/api/classify', window.location.origin);
    url.searchParams.set('domain', row.domain);
    url.searchParams.set('title', row.title);
    url.searchParams.set('classifier', classifier);
    url.searchParams.set('useCache', 'false');
    const started = performance.now();
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    const latencyMs = performance.now() - started;
    if (!response.ok) throw new Error(`Classifier request failed (${response.status}): ${await response.text()}`);
    const result = await response.json();
    return { category: CATEGORIES.includes(result.category) ? result.category : 'OTHER', latencyMs, apiCalls: Number(result.apiCalls) || 0 };
}

async function mapLimit(items, limit, fn) {
    const output = new Array(items.length); let next = 0;
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) { const index = next++; output[index] = await fn(items[index], index); }
    }));
    return output;
}

function metrics(rows, predictions) {
    const matrix = CATEGORIES.map(() => CATEGORIES.map(() => 0));
    rows.forEach((row, i) => matrix[CATEGORIES.indexOf(row.trueCategory)][CATEGORIES.indexOf(predictions[i])]++);
    const report = CATEGORIES.map((category, index) => {
        const tp = matrix[index][index];
        const support = matrix[index].reduce((sum, value) => sum + value, 0);
        const predicted = matrix.reduce((sum, line) => sum + line[index], 0);
        const precision = predicted ? tp / predicted : 0;
        const recall = support ? tp / support : 0;
        const f1 = precision + recall ? 2 * precision * recall / (precision + recall) : 0;
        return { category, precision, recall, f1, support };
    });
    return { accuracy: rows.length ? matrix.reduce((sum, line, i) => sum + line[i], 0) / rows.length : 0, report, matrix };
}

function table(headers, bodyRows) {
    const t = document.createElement('table');
    const thead = document.createElement('thead'), tr = document.createElement('tr');
    headers.forEach(label => { const th = document.createElement('th'); th.scope = 'col'; th.textContent = label; tr.append(th); });
    thead.append(tr); t.append(thead);
    const tbody = document.createElement('tbody');
    bodyRows.forEach(values => { const line = document.createElement('tr'); values.forEach(value => { const td = document.createElement('td'); td.textContent = value; line.append(td); }); tbody.append(line); });
    t.append(tbody); return t;
}

function renderReport(targetId, result) {
    const rows = result.report.map(item => [item.category, item.precision.toFixed(3), item.recall.toFixed(3), item.f1.toFixed(3), String(item.support)]);
    const host = document.getElementById(targetId); host.replaceChildren(table(['Class', 'Precision', 'Recall', 'F1', 'Support'], rows));
}

function renderMatrix(targetId, matrix) {
    const rows = matrix.map((line, index) => [CATEGORIES[index], ...line.map(String)]);
    const host = document.getElementById(targetId); host.replaceChildren(table(['True ↓ / Predicted →', ...CATEGORIES], rows));
}

function renderResults(ruleResults, llmRuns) {
    const ruleMetrics = metrics(labeledRows, ruleResults.map(result => result.category));
    const votes = labeledRows.map((_, index) => {
        const counts = new Map(); llmRuns.forEach(run => counts.set(run[index].category, (counts.get(run[index].category) || 0) + 1));
        return CATEGORIES.find(category => counts.has(category)) ? [...counts].sort((a, b) => b[1] - a[1] || CATEGORIES.indexOf(a[0]) - CATEGORIES.indexOf(b[0]))[0][0] : 'OTHER';
    });
    const llmMetrics = metrics(labeledRows, votes);
    const allAgree = labeledRows.filter((_, index) => new Set(llmRuns.map(run => run[index].category)).size === 1).length;
    const majorityAgreement = labeledRows.length ? labeledRows.reduce((sum, _, index) => {
        const counts = llmRuns.map(run => run[index].category);
        return sum + Math.max(...CATEGORIES.map(category => counts.filter(value => value === category).length)) / 3;
    }, 0) / labeledRows.length : 0;
    const llmCalls = llmRuns.flat().reduce((sum, result) => sum + result.apiCalls, 0);
    const llmLatency = llmRuns.flat().map(result => result.latencyMs);
    const rulesCalls = ruleResults.reduce((sum, result) => sum + result.apiCalls, 0);
    const rulesLatency = ruleResults.map(result => result.latencyMs);
    const cards = [
        ['Rows', String(labeledRows.length)], ['Rules accuracy', `${(ruleMetrics.accuracy * 100).toFixed(1)}%`],
        ['Gemini majority accuracy', `${(llmMetrics.accuracy * 100).toFixed(1)}%`], ['Gemini API calls', String(llmCalls)],
        ['Mean Gemini latency', `${(llmLatency.reduce((a, b) => a + b, 0) / Math.max(1, llmLatency.length)).toFixed(0)} ms`],
        ['Rules API calls', String(rulesCalls)],
        ['Mean rules latency', `${(rulesLatency.reduce((a, b) => a + b, 0) / Math.max(1, rulesLatency.length)).toFixed(0)} ms`]
    ];
    const host = document.getElementById('metricCards'); host.replaceChildren(...cards.map(([label, value]) => {
        const card = document.createElement('article'); card.className = 'metric-card';
        const title = document.createElement('p'); title.className = 'metric-label'; title.textContent = label;
        const output = document.createElement('p'); output.className = 'metric-value'; output.textContent = value;
        card.append(title, output); return card;
    }));
    renderReport('rulesReport', ruleMetrics); renderReport('llmReport', llmMetrics);
    renderMatrix('rulesMatrix', ruleMetrics.matrix); renderMatrix('llmMatrix', llmMetrics.matrix);
    document.getElementById('consistencySummary').textContent = `${allAgree} of ${labeledRows.length} rows received the same category in all three Gemini runs (${(allAgree / labeledRows.length * 100).toFixed(1)}%). Mean agreement with the majority label was ${(majorityAgreement * 100).toFixed(1)}%.`;
    const csv = [['domain', 'title', 'true_category', 'rules_prediction', 'llm_prediction_1', 'llm_prediction_2', 'llm_prediction_3'],
        ...labeledRows.map((row, i) => [row.domain, row.title, row.trueCategory, ruleResults[i].category, ...llmRuns.map(run => run[i].category)])]
        .map(line => line.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n');
    if (savedUrl) URL.revokeObjectURL(savedUrl);
    savedUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    document.getElementById('downloadPredictions').href = savedUrl;
    document.getElementById('evalResults').hidden = false;
}

runButton.addEventListener('click', async () => {
    if (!labeledRows.length) return;
    const maxCalls = labeledRows.length * 3;
    if (!window.confirm(`Run rules and three uncached Gemini predictions for ${labeledRows.length} rows? This can make up to ${maxCalls} Gemini API calls and sends each domain and title to Gemini.`)) return;
    runButton.disabled = true; document.getElementById('evalResults').hidden = true;
    try {
        statusNode.dataset.state = 'info'; statusNode.textContent = 'Running rules…';
        const rules = await mapLimit(labeledRows, 5, row => predict(row, 'rules'));
        const runs = [];
        for (let run = 0; run < 3; run++) {
            statusNode.textContent = `Running Gemini pass ${run + 1} of 3…`;
            runs.push(await mapLimit(labeledRows, 3, row => predict(row, 'llm')));
        }
        renderResults(rules, runs);
        const calls = runs.flat().reduce((sum, result) => sum + result.apiCalls, 0);
        statusNode.textContent = calls ? 'Evaluation complete.' : 'Evaluation complete. Gemini reported zero API calls; predictions may be fallback OTHER because the Gemini key or service is unavailable.';
    } catch (error) {
        statusNode.dataset.state = 'error'; statusNode.textContent = error.message || 'Evaluation failed.';
    } finally { runButton.disabled = false; }
});
