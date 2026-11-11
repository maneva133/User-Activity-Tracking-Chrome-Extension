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
    updateButton: document.querySelector('#rangeForm button[type="submit"]'),
    exportButton: document.getElementById('exportButton'),
    deleteRangeButton: document.getElementById('deleteRangeButton'),
    siteSearch: document.getElementById('siteSearch'),
    domainSettingRows: document.getElementById('domainSettingRows'),
    settingsEmpty: document.getElementById('settingsEmpty')
};

let currentDeviceId = null;
let currentOverview = null;
let currentPreferences = [];

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

async function loadOverview(deviceId, range) {
    const url = makeApiUrl('/sessions/overview', {
        deviceId,
        from: range.start.toISOString(),
        to: range.end.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    });
    return fetchJson(url);
}

async function loadDomainPreferences(deviceId) {
    return fetchJson(makeApiUrl('/device-domains', { deviceId }));
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

function renderMetrics(overview, range) {
    elements.totalTime.textContent = formatDuration(overview.totalSeconds);
    elements.dailyAverage.textContent = formatDuration(overview.activeDays ? overview.totalSeconds / overview.activeDays : 0);
    elements.siteCount.textContent = String(overview.siteCount);
    elements.activeDays.textContent = String(overview.activeDays);
    elements.rangeLabel.textContent = `${formatDate(range.start)} – ${formatDate(range.end)}`;
    const byDay = new Map(overview.dailyTotals.map(item => [item.date, item.seconds]));
    renderTrend(byDay, range);
    renderSites(overview.siteTotals);
    renderRecentSessions(overview.recentSessions);
    renderDomainSettings(overview.siteTotals, currentPreferences);
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

function renderSites(siteTotals) {
    elements.siteList.replaceChildren();
    const sites = siteTotals.slice(0, 8);
    const maximum = Math.max(1, ...sites.map(site => site.seconds));
    sites.forEach((site, index) => {
        const row = document.createElement('li');
        row.className = 'site-row';
        const name = document.createElement('span');
        name.className = 'site-domain';
        name.textContent = site.domain;
        const track = document.createElement('span');
        track.className = 'site-track';
        track.setAttribute('role', 'meter');
        track.setAttribute('aria-label', `${site.domain} time`);
        track.setAttribute('aria-valuemin', '0');
        track.setAttribute('aria-valuemax', String(maximum));
        track.setAttribute('aria-valuenow', String(site.seconds));
        const fill = document.createElement('span');
        fill.className = 'site-fill';
        fill.style.setProperty('--bar-width', `${site.seconds / maximum * 100}%`);
        fill.style.setProperty('--site-color', SITE_COLORS[index % SITE_COLORS.length]);
        track.append(fill);
        const time = document.createElement('span');
        time.className = 'site-time';
        time.textContent = formatDuration(site.seconds);
        row.append(name, track, time);
        elements.siteList.append(row);
    });
    elements.sitesEmpty.hidden = sites.length > 0;
}

function renderDomainSettings(siteTotals, preferences) {
    const byDomain = new Map(siteTotals.map(site => [site.domain, { domain: site.domain, seconds: site.seconds, preference: null }]));
    for (const preference of preferences) {
        const current = byDomain.get(preference.domain) || { domain: preference.domain, seconds: 0, preference: null };
        current.preference = preference;
        byDomain.set(preference.domain, current);
    }
    const filter = elements.siteSearch.value.trim().toLowerCase();
    const domains = [...byDomain.values()].filter(site => site.domain.toLowerCase().includes(filter))
        .sort((a, b) => a.domain.localeCompare(b.domain));
    elements.domainSettingRows.replaceChildren();
    elements.settingsEmpty.hidden = domains.length > 0;

    for (const site of domains) {
        const row = document.createElement('tr');
        const domain = document.createElement('td');
        domain.textContent = site.domain;

        const categoryCell = document.createElement('td');
        const category = document.createElement('select');
        category.setAttribute('aria-label', `Category override for ${site.domain}`);
        const automatic = document.createElement('option');
        automatic.value = '';
        automatic.textContent = 'Automatic';
        category.append(automatic);
        for (const label of ['STUDY', 'WORK', 'ENTERTAINMENT', 'SOCIAL', 'OTHER']) {
            const option = document.createElement('option');
            option.value = label;
            option.textContent = label[0] + label.slice(1).toLowerCase();
            category.append(option);
        }
        category.value = site.preference?.categoryOverride || '';
        categoryCell.append(category);

        const excludedCell = document.createElement('td');
        const excludeLabel = document.createElement('label');
        excludeLabel.className = 'exclude-control';
        const excluded = document.createElement('input');
        excluded.type = 'checkbox';
        excluded.checked = Boolean(site.preference?.excluded);
        excluded.setAttribute('aria-label', `Exclude ${site.domain} and delete its stored sessions`);
        excludeLabel.append(excluded, document.createTextNode('Exclude'));
        excludedCell.append(excludeLabel);

        const actions = document.createElement('td');
        const save = document.createElement('button');
        save.type = 'button';
        save.textContent = 'Save';
        save.addEventListener('click', () => void saveDomainPreference(site, category.value || null, excluded.checked, save));
        const reset = document.createElement('button');
        reset.type = 'button';
        reset.className = 'reset-setting';
        reset.textContent = 'Reset';
        reset.disabled = !site.preference;
        reset.setAttribute('aria-label', `Reset category override and tracking exclusion for ${site.domain}`);
        reset.addEventListener('click', () => void resetDomainPreference(site.domain, reset));
        actions.append(save, reset);

        row.append(domain, categoryCell, excludedCell, actions);
        elements.domainSettingRows.append(row);
    }
}

async function saveDomainPreference(site, categoryOverride, excluded, button) {
    if (excluded && !site.preference?.excluded) {
        const confirmed = window.confirm(`Exclude ${site.domain}? This deletes its stored browsing sessions and stops future tracking for this domain.`);
        if (!confirmed) return;
    }
    button.disabled = true;
    try {
        const response = await fetch(makeApiUrl('/device-domains', {}), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ deviceId: currentDeviceId, domain: site.domain, excluded, categoryOverride })
        });
        if (!response.ok) throw new Error(`Could not save site controls (${response.status}): ${await response.text()}`);
        const saved = await response.json();
        currentPreferences = [...currentPreferences.filter(item => item.domain !== saved.domain), saved];
        setStatus(`Saved controls for ${site.domain}.`);
        await refreshDashboard(currentDeviceId);
    } catch (error) {
        console.error('Could not save site controls:', error);
        setStatus(error.message || 'Could not save site controls.', true);
    } finally {
        button.disabled = false;
    }
}

async function resetDomainPreference(domain, button) {
    if (!window.confirm(`Reset the category override and allow tracking for ${domain} again? Previously deleted sessions cannot be restored.`)) return;
    button.disabled = true;
    try {
        const url = makeApiUrl('/device-domains', { deviceId: currentDeviceId, domain });
        const response = await fetch(url, { method: 'DELETE' });
        if (!response.ok) throw new Error(`Could not reset site controls (${response.status}): ${await response.text()}`);
        currentPreferences = currentPreferences.filter(item => item.domain !== domain);
        await refreshDashboard(currentDeviceId);
        setStatus(`Reset controls for ${domain}.`);
    } catch (error) {
        console.error('Could not reset site controls:', error);
        setStatus(error.message || 'Could not reset site controls.', true);
    } finally {
        button.disabled = false;
    }
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
        const [overview, preferences] = await Promise.all([
            loadOverview(deviceId, range),
            loadDomainPreferences(deviceId)
        ]);
        if (classifier === 'llm' && overview.classificationPairCount) {
            const confirmed = window.confirm(`Gemini may classify up to ${overview.classificationPairCount} distinct domain and page title pairs in this range. Cached classifications can reduce API calls. Continue?`);
            if (!confirmed) {
                setStatus('Gemini analysis cancelled. Choose Rules or update the range to continue.');
                return;
            }
        }
        setStatus('Calculating category totals…');
        const analysis = await loadCategoryTotals(deviceId, range, classifier);
        currentOverview = overview;
        currentPreferences = preferences;
        renderMetrics(overview, range);
        renderCategories(analysis, classifier);
        setStatus(overview.totalSeconds ? `${overview.siteCount.toLocaleString()} sites and ${overview.activeDays} active days loaded.` : 'No saved sessions in this date range.');
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
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const deviceId = hashParams.get('deviceId')
        || new URLSearchParams(window.location.search).get('deviceId')
        || sessionStorage.getItem('deviceId');
    if (!deviceId) {
        elements.missingDevice.hidden = false;
        return;
    }

    currentDeviceId = deviceId;
    sessionStorage.setItem('deviceId', deviceId);
    history.replaceState(null, '', window.location.pathname);
    elements.dashboard.hidden = false;
    elements.exportButton.href = `/api/export/${encodeURIComponent(deviceId)}.csv`;
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
    elements.siteSearch.addEventListener('input', () => {
        if (currentOverview) renderDomainSettings(currentOverview.siteTotals, currentPreferences);
    });
    elements.deleteRangeButton.addEventListener('click', async () => {
        const range = getRange();
        const label = `${formatDate(range.start)} – ${formatDate(range.end)}`;
        if (!window.confirm(`Delete all browsing sessions and reminder events from ${label}? This cannot be undone.`)) return;
        elements.deleteRangeButton.disabled = true;
        try {
            const response = await fetch(makeApiUrl('/sessions', {
                deviceId,
                from: range.start.toISOString(),
                to: range.end.toISOString()
            }), { method: 'DELETE' });
            if (!response.ok) throw new Error(`Delete failed (${response.status}): ${await response.text()}`);
            const deleted = await response.json();
            await refreshDashboard(deviceId);
            setStatus(`Deleted ${deleted.sessions} sessions and ${deleted.reminderEvents} reminder events.`);
        } catch (error) {
            console.error('Could not delete selected data:', error);
            setStatus(error.message || 'Could not delete selected data.', true);
        } finally {
            elements.deleteRangeButton.disabled = false;
        }
    });
    void refreshDashboard(deviceId);
}

initializeDashboard();
