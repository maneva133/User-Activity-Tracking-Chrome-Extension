importScripts('reminders.js');

const SESSION_KEY = 'trackingSession';
const QUEUE_KEY = 'pendingActivitySessions';
const API_BASE = 'http://localhost:8080/api';
const REMINDER_KEY = 'pendingReminder';
const SNOOZE_KEY = 'reminderSnoozeUntil';
const REMINDER_COOLDOWN_KEY = 'reminderCooldownUntil';
const BREAK_KEY = 'lastBreakTs';
const BREAK_START_KEY = 'breakStartTs';
const CONTINUOUS_START_KEY = 'continuousActiveSince';
const PERSONALIZED_HISTORY_KEY = 'personalizedSessionHistory';
const DOMAIN_PREFERENCES_CACHE_KEY = 'domainPreferencesCache';
const DOMAIN_PREFERENCES_CACHE_TTL_MS = 15 * 1000;
const CATEGORY_KEYWORDS = {
    study: ['wikipedia.org', 'coursera.org', 'edx.org', 'khanacademy.org'],
    work: ['github.com', 'gitlab.com', 'linear.app', 'atlassian.net'],
    social: ['facebook.com', 'instagram.com', 'x.com', 'twitter.com', 'reddit.com'],
    entertainment: ['youtube.com', 'netflix.com', 'twitch.tv', 'tiktok.com']
};
const NOTIFICATION_ID = 'break-reminder';

function runSafely(task, label) {
    void task().catch(error => console.error(`${label} failed.`, error));
}

let trackingQueue = Promise.resolve();
function runTrackingSafely(task, label) {
    trackingQueue = trackingQueue.then(task).catch(error => {
        console.error(`${label} failed.`, error);
    });
    return trackingQueue;
}

function categoryFor(domain) {
    for (const [category, domains] of Object.entries(CATEGORY_KEYWORDS)) {
        if (domains.some(item => domain === item || domain.endsWith(`.${item}`))) return category;
    }
    return 'other';
}

async function recordReminderResponse(reminder, response) {
    try {
        await fetch(`${API_BASE}/reminders`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId: await getDeviceId(), ts: new Date(reminder.ts).toISOString(),
                strategy: reminder.strategy, sessionLengthSecondsAtTrigger: reminder.sessionLengthSeconds,
                userResponse: response })
        });
    } catch (error) { console.warn('Could not record reminder response.', error); }
}

async function closeReminder(response) {
    const { [REMINDER_KEY]: reminder } = await chrome.storage.local.get(REMINDER_KEY);
    if (!reminder) return;
    await chrome.storage.local.remove(REMINDER_KEY);
    if (response === 'DISMISSED' || response === 'IGNORED') {
        await chrome.storage.local.set({ [REMINDER_COOLDOWN_KEY]: Date.now() + 30 * 60 * 1000 });
    }
    await recordReminderResponse(reminder, response);
}

chrome.notifications.onButtonClicked.addListener((id, buttonIndex) => {
    if (id !== NOTIFICATION_ID) return;
    runSafely(async () => {
        if (buttonIndex === 0) {
            await chrome.storage.local.set({ [SNOOZE_KEY]: Date.now() + 5 * 60 * 1000 });
            await closeReminder('SNOOZED');
        } else await closeReminder('DISMISSED');
        await chrome.notifications.clear(id);
    }, 'Handling reminder button');
});
chrome.notifications.onClosed.addListener((id, byUser) => {
    if (id === NOTIFICATION_ID && byUser) runSafely(() => closeReminder('IGNORED'), 'Handling reminder close');
});

async function showBreakReminder(session, settings, continuousActiveSeconds) {
    const { [SNOOZE_KEY]: snoozeUntil = 0, [REMINDER_COOLDOWN_KEY]: cooldownUntil = 0,
        [REMINDER_KEY]: pending } = await chrome.storage.local.get([SNOOZE_KEY, REMINDER_COOLDOWN_KEY, REMINDER_KEY]);
    if (settings.doNotDisturb || Date.now() < snoozeUntil || Date.now() < cooldownUntil || pending) return;
    const reminder = { ts: Date.now(), strategy: settings.strategy, sessionLengthSeconds: continuousActiveSeconds };
    await chrome.storage.local.set({ [REMINDER_KEY]: reminder });
    await chrome.notifications.create(NOTIFICATION_ID, {
        type: 'basic', iconUrl: 'icons/icon48.png', title: 'Time for a short break?',
        message: `You have been active for ${Math.round(continuousActiveSeconds / 60)} minutes. Take a 3 minute break.`,
        buttons: [{ title: 'Snooze 5 min' }, { title: 'Dismiss' }], priority: 1
    });
}

async function maybeRemind(session) {
    const { reminderSettings = { strategy: 'FIXED', doNotDisturb: false }, [BREAK_KEY]: lastBreakTs = null } = await chrome.storage.local.get(['reminderSettings', BREAK_KEY]);
    const continuousActiveSeconds = Math.floor((Date.now() - (session.continuousStartTime || session.startTime)) / 1000);
    let strategy;
    if (reminderSettings.strategy === 'ADAPTIVE') strategy = new ReminderStrategies.AdaptiveStrategy();
    else if (reminderSettings.strategy === 'PERSONALIZED') {
        let lengths = [];
        try {
            const { [PERSONALIZED_HISTORY_KEY]: cached } = await chrome.storage.local.get(PERSONALIZED_HISTORY_KEY);
            if (cached && Date.now() - cached.fetchedAt < 60 * 60 * 1000) lengths = cached.lengths;
            else {
                const deviceId = await getDeviceId();
                const from = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
                const to = new Date().toISOString();
                const response = await fetch(`${API_BASE}/sessions?deviceId=${encodeURIComponent(deviceId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
                if (response.ok) {
                    lengths = (await response.json()).map(item => item.durationSeconds).filter(Number.isFinite);
                    await chrome.storage.local.set({ [PERSONALIZED_HISTORY_KEY]: { fetchedAt: Date.now(), lengths } });
                }
            }
        } catch (error) { console.warn('Could not load session history for personalized reminders.', error); }
        strategy = new ReminderStrategies.PersonalizedStrategy(lengths, 0.5);
    } else strategy = new ReminderStrategies.FixedStrategy();
    const category = categoryFor(session.domain);
    if (strategy.shouldRemind({ continuousActiveSeconds, currentCategory: category,
        categoryHistory: session.categoryHistory || [], lastBreakTs, now: Date.now() })) {
        await showBreakReminder(session, reminderSettings, continuousActiveSeconds);
    }
}

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

async function getDomainPreferences() {
    const { [DOMAIN_PREFERENCES_CACHE_KEY]: cached } = await chrome.storage.local.get(DOMAIN_PREFERENCES_CACHE_KEY);
    if (cached && Date.now() - cached.fetchedAt < DOMAIN_PREFERENCES_CACHE_TTL_MS) return cached.items;
    try {
        const deviceId = await getDeviceId();
        const url = new URL(`${API_BASE}/device-domains`);
        url.searchParams.set('deviceId', deviceId);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Preferences request failed (${response.status})`);
        const items = await response.json();
        await chrome.storage.local.set({ [DOMAIN_PREFERENCES_CACHE_KEY]: { fetchedAt: Date.now(), items } });
        return items;
    } catch (error) {
        console.warn('Could not refresh domain preferences; using the last cached settings.', error);
        return cached?.items || [];
    }
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
    if (domain && (await getDomainPreferences()).some(item => item.domain === domain && item.excluded)) return null;
    return domain ? { domain, title: tab.title || '', tabId: tab.id } : null;
}

async function transitionTo(next) {
    const previous = await getSession();
    if (previous && next && previous.domain === next.domain && previous.tabId === next.tabId) {
        if (previous.title !== next.title) await storeSession({ ...previous, title: next.title });
        return;
    }
    if (previous) await enqueueSession(previous);
    if (!next && previous) await chrome.storage.local.set({ [BREAK_START_KEY]: Date.now() });
    let continuousStartTime = previous?.continuousStartTime;
    if (next) {
        const { [BREAK_START_KEY]: breakStart = null, [REMINDER_KEY]: pendingReminder = null } = await chrome.storage.local.get([BREAK_START_KEY, REMINDER_KEY]);
        if (breakStart) {
            const breakSeconds = Math.floor((Date.now() - breakStart) / 1000);
            if (breakSeconds >= ReminderStrategies.BREAK_SECONDS) {
                await chrome.storage.local.set({ [BREAK_KEY]: Date.now() });
                continuousStartTime = Date.now();
                if (pendingReminder && Date.now() - pendingReminder.ts <= 10 * 60 * 1000) {
                    await closeReminder('ACCEPTED');
                    chrome.notifications.clear(NOTIFICATION_ID);
                }
            }
            await chrome.storage.local.remove(BREAK_START_KEY);
        }
        if (pendingReminder && Date.now() - pendingReminder.ts > 10 * 60 * 1000) {
            await closeReminder('IGNORED');
            chrome.notifications.clear(NOTIFICATION_ID);
        }
        if (!continuousStartTime) {
            const stored = await chrome.storage.local.get(CONTINUOUS_START_KEY);
            continuousStartTime = stored[CONTINUOUS_START_KEY] || Date.now();
        }
        await chrome.storage.local.set({ [CONTINUOUS_START_KEY]: continuousStartTime });
    }
    if (next) await storeSession({ ...next, startTime: Date.now(), continuousStartTime, categoryHistory: previous?.categoryHistory || [] });
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
        await maybeRemind(current);
    } else if (!session && idleState === 'active' && active) {
        await transitionTo(active);
    }
}

chrome.runtime.onInstalled.addListener(() => {
    runSafely(() => chrome.alarms.create('tracking-heartbeat', { periodInMinutes: 1 }), 'Creating tracking alarm');
});
chrome.runtime.onStartup.addListener(() => {
    runSafely(() => chrome.alarms.create('tracking-heartbeat', { periodInMinutes: 1 }), 'Creating tracking alarm');
    runTrackingSafely(syncActiveTab, 'Syncing active tab');
});
chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === 'tracking-heartbeat') runTrackingSafely(heartbeat, 'Tracking heartbeat');
});
chrome.idle.setDetectionInterval(60);
chrome.idle.onStateChanged.addListener(state => {
    if (state === 'active') runTrackingSafely(syncActiveTab, 'Syncing active tab');
    else runTrackingSafely(async () => {
        const session = await getSession();
        if (session) {
            const awayAt = Date.now();
            const duration = Math.floor((awayAt - session.startTime) / 1000);
            await transitionTo(null);
            if (duration >= ReminderStrategies.BREAK_SECONDS) await chrome.storage.local.set({ [BREAK_KEY]: awayAt });
        } else await transitionTo(null);
    }, 'Handling idle state');
});
chrome.tabs.onActivated.addListener(() => runTrackingSafely(syncActiveTab, 'Handling tab activation'));
chrome.tabs.onRemoved.addListener(() => runTrackingSafely(syncActiveTab, 'Handling tab removal'));
chrome.tabs.onReplaced.addListener(() => runTrackingSafely(syncActiveTab, 'Handling tab replacement'));
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab.active && (changeInfo.url || changeInfo.status === 'complete' || changeInfo.title)) {
        runTrackingSafely(syncActiveTab, 'Handling tab update');
    }
});
chrome.windows.onFocusChanged.addListener(windowId => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) runTrackingSafely(() => transitionTo(null), 'Handling window blur');
    else runTrackingSafely(syncActiveTab, 'Handling window focus');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'getLiveTracking') {
        void (async () => {
            try {
                const session = await getSession();
                sendResponse(session ? {
                    domain: session.domain,
                    elapsedTime: Math.floor((Date.now() - session.startTime) / 1000)
                } : { domain: null, elapsedTime: 0 });
            } catch (error) {
                console.error('Could not read live tracking state.', error);
                sendResponse({ domain: null, elapsedTime: 0, error: true });
            }
        })();
        return true;
    }
});

runTrackingSafely(syncActiveTab, 'Initial active tab sync');
