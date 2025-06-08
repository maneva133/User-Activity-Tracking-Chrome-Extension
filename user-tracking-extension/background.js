let startTime;
let currentDomain;
let isTracking = false;

function startTracking(domain) {
    currentDomain = domain;
    startTime = Date.now();
    isTracking = true;
}

async function stopTracking() {
    if (!isTracking) return;

    isTracking = false;
    const endTime = Date.now();
    const timeSpentSeconds = Math.round((endTime - startTime) / 1000);

    if (timeSpentSeconds > 0) {
        await sendTrackingData(currentDomain, timeSpentSeconds);
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'getSessionInfo') {
        sendResponse({
            startTime: isTracking ? startTime : null,
            domain: currentDomain
        });
    }
    return true;
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    await stopTracking();

    chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (tab.url) {
            const domain = normalizeDomain(new URL(tab.url).hostname);
            startTracking(domain);
        }
    });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.active && tab.url) {
        const domain = normalizeDomain(new URL(tab.url).hostname);
        startTracking(domain);
    }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
        await stopTracking();
    } else {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0] && tabs[0].url) {
                const domain = normalizeDomain(new URL(tabs[0].url).hostname);
                startTracking(domain);
            }
        });
    }
});

async function sendTrackingData(domain, timeSpentSeconds) {
    try {
        const response = await fetch('http://localhost:8080/api/tracking', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                domain: domain,
                timeSpentSeconds: timeSpentSeconds
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    } catch (error) {
        console.error('Error saving tracking data:', error);
    }
}

async function getStatistics(domain) {
    try {
        const response = await fetch(`http://localhost:8080/api/tracking/statistics/${domain}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const stats = await response.json();
        return stats;
    } catch (error) {
        console.error('Error fetching statistics:', error);
        return null;
    }
}

async function displayStatistics(domain) {
    const stats = await getStatistics(domain);
    if (stats) {
        document.getElementById('daily').textContent = formatTime(stats.dailyTimeSpentSeconds);
        document.getElementById('weekly').textContent = formatTime(stats.weeklyTimeSpentSeconds);
        document.getElementById('monthly').textContent = formatTime(stats.monthlyTimeSpentSeconds);
    }
}

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    return `${hours}h ${minutes}m ${remainingSeconds}s`;
}

function normalizeDomain(hostname) {
    return hostname.replace(/^www\./, ''); // Remove "www."
}
