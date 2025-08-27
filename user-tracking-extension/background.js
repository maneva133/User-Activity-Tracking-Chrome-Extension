let startTime;
let currentDomain;
let isTracking = false;
let accumulatedTime = 0;

function startTracking(domain) {
    if (isTracking && domain === currentDomain) return;

    currentDomain = domain;
    startTime = Date.now();
    isTracking = true;
    accumulatedTime = 0;

    chrome.storage.local.set({
        trackingSession: {
            domain: currentDomain,
            startTime: startTime
        }
    });
}

async function stopTracking() {
    if (!isTracking) return;

    isTracking = false;
    const endTime = Date.now();
    const timeSpentSeconds = Math.round((endTime - startTime) / 1000);

    if (timeSpentSeconds > 0) {
        accumulatedTime += timeSpentSeconds;
        await sendTrackingData(currentDomain, accumulatedTime);
    }

    startTime = null;
    currentDomain = null;
    accumulatedTime = 0;

    chrome.storage.local.remove('trackingSession');
}

async function sendTrackingData(domain, timeSpentSeconds) {
    try {
        const stored = await chrome.storage.local.get('deviceId');
        let deviceId = stored.deviceId;

        const response = await fetch('http://localhost:8080/api/tracking', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain, timeSpentSeconds, deviceId })
        });

        const result = await response.json();

        if (!deviceId && result.deviceId) {
            await chrome.storage.local.set({ deviceId: result.deviceId });
        }

        startTime = Date.now();
        accumulatedTime = 0;

    } catch (error) {
        console.error('Error saving tracking data:', error);
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'getLiveTracking') {
        if (isTracking && startTime && currentDomain) {
            const now = Date.now();
            const elapsed = Math.floor((now - startTime) / 1000);

            startTime = now;

            sendResponse({
                domain: currentDomain,
                elapsedTime: elapsed
            });
        } else {
            sendResponse({ domain: null, elapsedTime: 0 });
        }
        return true;
    }
});



chrome.tabs.onActivated.addListener(async (activeInfo) => {
    await stopTracking();

    chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (chrome.runtime.lastError || !tab.url) return;

        const domain = extractDomainFromUrl(tab.url);
        if (domain) startTracking(domain);
    });
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.active && tab.url) {
        await stopTracking();

        const domain = extractDomainFromUrl(tab.url);
        if (domain) startTracking(domain);
    }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
        await stopTracking();
    } else {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (chrome.runtime.lastError || !tabs.length) return;

            const tab = tabs[0];
            if (tab.url) {
                const domain = extractDomainFromUrl(tab.url);
                if (domain) startTracking(domain);
            }
        });
    }
});

chrome.runtime.onStartup.addListener(() => {
    chrome.storage.local.get('trackingSession', (data) => {
        const session = data.trackingSession;
        if (session && session.startTime && session.domain) {
            currentDomain = session.domain;
            startTime = session.startTime;
            isTracking = true;
            accumulatedTime = 0;
            console.log('Resumed tracking session:', currentDomain, new Date(startTime));
        }
    });
});

setInterval(async () => {
    if (isTracking && currentDomain && startTime) {
        const now = Date.now();
        const timeSpentSeconds = Math.round((now - startTime) / 1000);
        if (timeSpentSeconds > 0) {
            accumulatedTime += timeSpentSeconds;
            await sendTrackingData(currentDomain, accumulatedTime);
            startTime = Date.now();
            accumulatedTime = 0;
        }
    }
}, 1000);

function normalizeDomain(hostname) {
    return hostname.replace(/^www\./, '');
}

function extractDomainFromUrl(url) {
    try {
        // Skip browser-internal URLs
        if (url.startsWith('chrome://') || 
            url.startsWith('chrome-extension://') || 
            url.startsWith('about:') ||
            url.startsWith('moz-extension://') ||
            url.startsWith('edge://')) {
            return null;
        }
        return normalizeDomain(new URL(url).hostname);
    } catch (e) {
        return null;
    }
}
