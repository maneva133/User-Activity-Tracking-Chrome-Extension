const API_BASE = '/api';
const CATEGORY_FIELDS = [
    { key: 'studyTime', label: 'Study', className: 'category-study' },
    { key: 'workTime', label: 'Work', className: 'category-work' },
    { key: 'entertainmentTime', label: 'Entertainment', className: 'category-entertainment' },
    { key: 'socialTime', label: 'Social', className: 'category-social' },
    { key: 'otherTime', label: 'Other', className: 'category-other' }
];
const SITE_COLORS = ['#6558e8', '#149675', '#4276e8', '#d98936', '#d65b8c', '#8b62d9', '#526176'];

const elements = {
    dashboard: document.getElementById('dashboard'),
    missingDevice: document.getElementById('missingDevice'),
    form: document.getElementById('rangeForm'),
    fromDate: document.getElementById('fromDate'),
    toDate: document.getElementById('toDate'),
    classifier: document.getElementById('classifier'),
    status: document.getElementById('status'),
    totalTime: document.getElementById('totalTime'),
    dailyAverage: document.getElementById('dailyAverage'),
    siteCount: document.getElementById('siteCount'),
    activeDays: document.getElementById('activeDays'),
    rangeLabel: document.getElementById('rangeLabel'),
    trendChart: document.getElementById('trendChart'),
    trendSummary: document.getElementById('trendSummary'),
    trendEmpty: document.getElementById('trendEmpty'),
    categoryMode: document.getElementById('categoryMode'),
    categoryList: document.getElementById('categoryList'),
    categoryEmpty: document.getElementById('categoryEmpty'),
    siteList: document.getElementById('siteList'),
    sitesEmpty: document.getElementById('sitesEmpty'),
    sessionRows: document.getElementById('sessionRows'),
    sessionsEmpty: document.getElementById('sessionsEmpty'),
    updateButton: document.querySelector('#rangeForm button[type="submit"]')
};

function localDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseLocalDate(value) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
}

function dateToInputValue(date) {
    return localDateKey(date);
}

function formatDuration(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${total}s`;
}

function formatDate(date) {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

function setStatus(message, isError = false) {
    elements.status.textContent = message;
    elements.status.dataset.state = isError ? 'error' : 'info';
}

function makeApiUrl(path, params) {
    const url = new URL(`${API_BASE}${path}`, window.location.origin);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return url;
}

async function fetchJson(url) {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Request failed (${response.status})${detail ? `: ${detail}` : ''}`);
    }
    return response.json();
}

function getRange() {
    const start = parseLocalDate(elements.fromDate.value);
    const endDay = parseLocalDate(elements.toDate.value);
    const end = new Date(endDay.getFullYear(), endDay.getMonth(), endDay.getDate() + 1);
    end.setMilliseconds(end.getMilliseconds() - 1);
    return { start, end };
}

async function loadSessions(deviceId, range) {
    const url = makeApiUrl('/sessions', {
        deviceId,
        from: range.start.toISOString(),
        to: range.end.toISOString()
    });
    return fetchJson(url);
}

async function loadCategoryTotals(deviceId, range, classifier) {
    const url = makeApiUrl('/sessions/analyze', {
        deviceId,
        from: range.start.toISOString(),
        to: range.end.toISOString(),
        classifier
    });
    return fetchJson(url);
}

function aggregateSessions(sessions) {
    const bySite = new Map();
    const byDay = new Map();
    const activeDays = new Set();
    let total = 0;

    for (const session of sessions) {
        const seconds = Math.max(0, Number(session.durationSeconds) || 0);
        if (!seconds) continue;
        const site = session.domain || 'Unknown site';
        const day = localDateKey(new Date(session.endTs));
        bySite.set(site, (bySite.get(site) || 0) + seconds);
        byDay.set(day, (byDay.get(day) || 0) + seconds);
        activeDays.add(day);
        total += seconds;
    }

    return { bySite, byDay, activeDays, total };
}

function renderMetrics(sessions, aggregate, range) {
    elements.totalTime.textContent = formatDuration(aggregate.total);
    elements.dailyAverage.textContent = formatDuration(aggregate.activeDays.size ? aggregate.total / aggregate.activeDays.size : 0);
    elements.siteCount.textContent = String(aggregate.bySite.size);
    elements.activeDays.textContent = String(aggregate.activeDays.size);
    elements.rangeLabel.textContent = `${formatDate(range.start)} – ${formatDate(range.end)}`;
    renderTrend(aggregate.byDay, range);
    renderSites(aggregate.bySite);
    renderRecentSessions(sessions);
}

function renderTrend(byDay, range) {
    elements.trendChart.replaceChildren();
    elements.trendSummary.replaceChildren();
    const days = [];
    const cursor = new Date(range.start);
    const final = new Date(range.end.getFullYear(), range.end.getMonth(), range.end.getDate());
    while (cursor <= final) {
        const day = new Date(cursor);
        days.push({ date: day, seconds: byDay.get(localDateKey(day)) || 0 });
        cursor.setDate(cursor.getDate() + 1);
    }
    const max = Math.max(1, ...days.map(item => item.seconds));
    for (const item of days) {
        const column = document.createElement('div');
        column.className = 'trend-item';
        column.setAttribute('aria-hidden', 'true');

        const value = document.createElement('span');
        value.className = 'trend-value';
        value.textContent = item.seconds ? formatDuration(item.seconds) : '—';

        const track = document.createElement('span');
        track.className = 'trend-track';
        const bar = document.createElement('span');
        bar.className = 'trend-bar';
        bar.style.setProperty('--bar-height', `${item.seconds ? Math.max(3, item.seconds / max * 100) : 0}%`);
        track.append(bar);

        const label = document.createElement('span');
        label.className = 'trend-date';
        label.textContent = new Intl.DateTimeFormat(undefined, { day: 'numeric' }).format(item.date);

        column.append(value, track, label);
        elements.trendChart.append(column);

        const summary = document.createElement('li');
        summary.textContent = `${formatDate(item.date)}: ${formatDuration(item.seconds)}`;
        elements.trendSummary.append(summary);
    }
    elements.trendEmpty.hidden = days.some(item => item.seconds > 0);
}

function renderCategories(analysis, classifier) {
    const categories = CATEGORY_FIELDS.map(item => ({
        ...item,
        seconds: Math.max(0, Number(analysis[item.key]) || 0)
    }));
    const maximum = Math.max(1, ...categories.map(item => item.seconds));
    elements.categoryList.replaceChildren();
    elements.categoryMode.textContent = classifier === 'llm' ? 'Gemini' : 'Rules';
    for (const category of categories) {
        const row = document.createElement('div');
        row.className = `category-row ${category.className}`;

        const meta = document.createElement('div');
        meta.className = 'category-meta';
        const name = document.createElement('span');
        name.className = 'category-name';
        const dot = document.createElement('span');
        dot.className = 'category-dot';
        dot.setAttribute('aria-hidden', 'true');
        name.append(dot, document.createTextNode(category.label));
        const value = document.createElement('span');
        value.className = 'category-value';
        value.textContent = formatDuration(category.seconds);
        meta.append(name, value);

        const track = document.createElement('div');
        track.className = 'category-track';
        track.setAttribute('role', 'meter');
        track.setAttribute('aria-label', `${category.label} time`);
        track.setAttribute('aria-valuemin', '0');
        track.setAttribute('aria-valuemax', String(maximum));
        track.setAttribute('aria-valuenow', String(category.seconds));
        const fill = document.createElement('div');
        fill.className = 'category-fill';
        fill.style.setProperty('--bar-width', `${category.seconds / maximum * 100}%`);
        track.append(fill);
        row.append(meta, track);
        elements.categoryList.append(row);
    }
    elements.categoryEmpty.hidden = categories.some(category => category.seconds > 0);
}

function renderSites(bySite) {
    elements.siteList.replaceChildren();
    const sites = [...bySite.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const maximum = Math.max(1, ...sites.map(([, seconds]) => seconds));
    sites.forEach(([domain, seconds], index) => {
        const row = document.createElement('li');
        row.className = 'site-row';
        const name = document.createElement('span');
        name.className = 'site-domain';
        name.textContent = domain;
        const track = document.createElement('span');
        track.className = 'site-track';
        track.setAttribute('role', 'meter');
        track.setAttribute('aria-label', `${domain} time`);
        track.setAttribute('aria-valuemin', '0');
        track.setAttribute('aria-valuemax', String(maximum));
        track.setAttribute('aria-valuenow', String(seconds));
        const fill = document.createElement('span');
        fill.className = 'site-fill';
        fill.style.setProperty('--bar-width', `${seconds / maximum * 100}%`);
        fill.style.setProperty('--site-color', SITE_COLORS[index % SITE_COLORS.length]);
        track.append(fill);
        const time = document.createElement('span');
        time.className = 'site-time';
        time.textContent = formatDuration(seconds);
        row.append(name, track, time);
        elements.siteList.append(row);
    });
    elements.sitesEmpty.hidden = sites.length > 0;
}

function renderRecentSessions(sessions) {
    elements.sessionRows.replaceChildren();
    const recent = [...sessions].sort((a, b) => new Date(b.endTs) - new Date(a.endTs)).slice(0, 20);
    for (const session of recent) {
        const row = document.createElement('tr');
        const domain = document.createElement('td');
        domain.textContent = session.domain || 'Unknown site';
        const page = document.createElement('td');
        page.textContent = session.pageTitle || '—';
        const category = document.createElement('td');
        const tag = document.createElement('span');
        tag.className = 'category-tag';
        tag.textContent = String(session.category || 'OTHER').toLowerCase();
        category.append(tag);
        const when = document.createElement('td');
        when.textContent = formatDateTime(session.startTs);
        const time = document.createElement('td');
        time.textContent = formatDuration(session.durationSeconds);
        row.append(domain, page, category, when, time);
        elements.sessionRows.append(row);
    }
    elements.sessionsEmpty.hidden = recent.length > 0;
}

async function refreshDashboard(deviceId) {
    const start = parseLocalDate(elements.fromDate.value);
    const endDay = parseLocalDate(elements.toDate.value);
    if (Number.isNaN(start.getTime()) || Number.isNaN(endDay.getTime()) || start > endDay) {
        setStatus('Choose a valid date range. The start date must be on or before the end date.', true);
        return;
    }
    const dayCount = Math.round((endDay - start) / 86_400_000) + 1;
    if (dayCount > 366) {
        setStatus('Choose a range of one year or less.', true);
        return;
    }

    const end = new Date(endDay.getFullYear(), endDay.getMonth(), endDay.getDate() + 1);
    end.setMilliseconds(end.getMilliseconds() - 1);
    const range = { start, end };
    const classifier = elements.classifier.value;
    elements.updateButton.disabled = true;
    elements.updateButton.textContent = 'Loading…';
    setStatus('Loading saved activity…');

    try {
        const sessions = await loadSessions(deviceId, range);
        if (classifier === 'llm' && sessions.length) {
            const pairs = new Set(sessions.map(session => `${session.domain}\u0000${session.pageTitle || ''}`)).size;
            const confirmed = window.confirm(`Gemini will classify up to ${pairs} distinct domain and page title pairs in this range. Cached classifications may reduce API calls. Continue?`);
            if (!confirmed) {
                setStatus('Gemini analysis cancelled. Choose Rules or update the range to continue.');
                return;
            }
        }
        setStatus('Calculating category totals…');
        const analysis = await loadCategoryTotals(deviceId, range, classifier);
        const aggregate = aggregateSessions(sessions);
        renderMetrics(sessions, aggregate, range);
        renderCategories(analysis, classifier);
        setStatus(sessions.length ? `${sessions.length.toLocaleString()} sessions loaded.` : 'No saved sessions in this date range.');
    } catch (error) {
        console.error('Dashboard update failed:', error);
        setStatus(error.message || 'Could not load activity. Check that the backend is running.', true);
    } finally {
        elements.updateButton.disabled = false;
        elements.updateButton.textContent = 'Update dashboard';
    }
}

function setPreset(days) {
    const today = new Date();
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1));
    elements.fromDate.value = dateToInputValue(from);
    elements.toDate.value = dateToInputValue(today);
    document.querySelectorAll('.range-presets button').forEach(button => {
        button.setAttribute('aria-pressed', String(Number(button.dataset.days) === days));
    });
}

function initializeDashboard() {
    const deviceId = new URLSearchParams(window.location.search).get('deviceId');
    if (!deviceId) {
        elements.missingDevice.hidden = false;
        return;
    }

    elements.dashboard.hidden = false;
    setPreset(7);
    elements.form.addEventListener('submit', event => {
        event.preventDefault();
        document.querySelectorAll('.range-presets button').forEach(button => button.setAttribute('aria-pressed', 'false'));
        void refreshDashboard(deviceId);
    });
    document.querySelectorAll('.range-presets button').forEach(button => {
        button.addEventListener('click', () => {
            setPreset(Number(button.dataset.days));
            void refreshDashboard(deviceId);
        });
    });
    void refreshDashboard(deviceId);
}

initializeDashboard();
