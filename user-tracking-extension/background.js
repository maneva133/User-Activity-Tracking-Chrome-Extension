const SESSION_KEY = 'trackingSession';
const QUEUE_KEY = 'pendingActivitySessions';
const API_BASE = 'http://localhost:8080/api';

function normalizeDomain(hostname) {
    return hostname.replace(/^www\./, '');
}

function extractDomainFromUrl(url) {
    try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) return null;
        return normalizeDomain(parsed.hostname);
    } catch {
        return null;
    }
}

async function getSession() {
    const data = await chrome.storage.session.get(SESSION_KEY);
    return data[SESSION_KEY] || null;
}

async function storeSession(session) {
    if (session) await chrome.storage.session.set({ [SESSION_KEY]: session });
    else await chrome.storage.session.remove(SESSION_KEY);
}

async function getDeviceId() {
    const { deviceId } = await chrome.storage.local.get('deviceId');
    if (deviceId) return deviceId;
    const created = crypto.randomUUID();
    await chrome.storage.local.set({ deviceId: created });
    return created;
}

async function enqueueSession(session, endTs = Date.now()) {
    const durationSeconds = Math.floor((endTs - session.startTime) / 1000);
    if (durationSeconds <= 0) return;
    const item = {
        deviceId: await getDeviceId(),
        domain: session.domain,
        pageTitle: session.title || '',
        startTs: new Date(session.startTime).toISOString(),
        endTs: new Date(endTs).toISOString(),
        durationSeconds
    };
    const { [QUEUE_KEY]: queue = [] } = await chrome.storage.local.get(QUEUE_KEY);
    queue.push(item);
    await chrome.storage.local.set({ [QUEUE_KEY]: queue });
}

async function flushQueue() {
    const { [QUEUE_KEY]: queue = [] } = await chrome.storage.local.get(QUEUE_KEY);
    const remaining = [];
    for (let i = 0; i < queue.length; i++) {
        try {
            const response = await fetch(`${API_BASE}/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(queue[i])
            });
            if (!response.ok && response.status !== 409) {
                throw new Error(`Session upload failed (${response.status})`);
            }
        } catch (error) {
            console.warn('Could not upload activity session; keeping it queued.', error);
            remaining.push(...queue.slice(i));
            break;
        }
    }
    await chrome.storage.local.set({ [QUEUE_KEY]: remaining });
}

async function activeTabSession() {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const tab = tabs[0];
    if (!tab || tab.incognito || !tab.url) return null;
    const domain = extractDomainFromUrl(tab.url);
    return domain ? { domain, title: tab.title || '', tabId: tab.id } : null;
}

async function transitionTo(next) {
    const previous = await getSession();
    if (previous && next && previous.domain === next.domain && previous.tabId === next.tabId) {
        if (previous.title !== next.title) await storeSession({ ...previous, title: next.title });
        return;
    }
    if (previous) await enqueueSession(previous);
    if (next) await storeSession({ ...next, startTime: Date.now() });
    else await storeSession(null);
    await flushQueue();
}

async function syncActiveTab() {
    const state = await chrome.idle.queryState(60);
    if (state !== 'active') return transitionTo(null);
    await transitionTo(await activeTabSession());
}

async function heartbeat() {
    await flushQueue();
    const session = await getSession();
    const active = await activeTabSession();
    const idleState = await chrome.idle.queryState(60);
    if (session && (idleState !== 'active' || !active || active.domain !== session.domain
            || active.tabId !== session.tabId)) {
        await transitionTo(idleState === 'active' ? active : null);
        return;
    }
    if (session && idleState === 'active') {
        if (active.title !== session.title) await storeSession({ ...session, title: active.title });
        const now = Date.now();
        const current = await getSession();
        await enqueueSession(current, now);
        await storeSession({ ...current, startTime: now });
        await flushQueue();
    } else if (!session && idleState === 'active' && active) {
        await transitionTo(active);
    }
}

chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create('tracking-heartbeat', { periodInMinutes: 1 });
});
chrome.runtime.onStartup.addListener(() => {
    chrome.alarms.create('tracking-heartbeat', { periodInMinutes: 1 });
    void syncActiveTab();
});
chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === 'tracking-heartbeat') void heartbeat();
});
chrome.idle.setDetectionInterval(60);
chrome.idle.onStateChanged.addListener(state => {
    if (state === 'active') void syncActiveTab();
    else void transitionTo(null);
});
chrome.tabs.onActivated.addListener(() => void syncActiveTab());
chrome.tabs.onRemoved.addListener(() => void syncActiveTab());
chrome.tabs.onReplaced.addListener(() => void syncActiveTab());
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab.active && (changeInfo.url || changeInfo.status === 'complete' || changeInfo.title)) {
        void syncActiveTab();
    }
});
chrome.windows.onFocusChanged.addListener(windowId => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) void transitionTo(null);
    else void syncActiveTab();
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'getLiveTracking') {
        void getSession().then(session => sendResponse(session ? {
            domain: session.domain,
            elapsedTime: Math.floor((Date.now() - session.startTime) / 1000)
        } : { domain: null, elapsedTime: 0 }));
        return true;
    }
});

void syncActiveTab();
