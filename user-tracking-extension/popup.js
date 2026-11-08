const FIVE_HOURS_IN_SECONDS = 18000;

async function initializeReminderSettings() {
    try {
        const { reminderSettings = { strategy: 'FIXED', doNotDisturb: false } } = await chrome.storage.local.get('reminderSettings');
        const strategy = document.getElementById('reminderStrategy');
        const dnd = document.getElementById('doNotDisturb');
        strategy.value = reminderSettings.strategy;
        dnd.checked = reminderSettings.doNotDisturb;
        const save = async () => {
            try { await chrome.storage.local.set({ reminderSettings: { strategy: strategy.value, doNotDisturb: dnd.checked } }); }
            catch (error) { setStatus('Could not save reminder settings.'); console.error(error); }
        };
        strategy.addEventListener('change', save);
        dnd.addEventListener('change', save);
    } catch (error) { setStatus('Could not load reminder settings.'); console.error(error); }
}
void initializeReminderSettings();

const API_BASE = 'http://localhost:8080/api';
function setStatus(message) {
    const status = document.getElementById('analysisStatus');
    if (status) status.textContent = message;
}


// utility functions
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
}
function secondsToHours(seconds) {
    return seconds / 3600;
}


function showError(message, error) {
    console.error('Error details:', error);
    document.getElementById('daily').textContent = message;
    document.getElementById('weekly').textContent = message;
    document.getElementById('monthly').textContent = message;
}

function checkTimeWarning(seconds) {
    const warningElement = document.getElementById('timeWarning');
    if (seconds > FIVE_HOURS_IN_SECONDS) {
        warningElement.hidden = false;
    } else {
        warningElement.hidden = true;
    }
}


// chart update
let usageChartInstance = null;
function updateChart(dataArray) {
    const ctx = document.getElementById('usageChart').getContext('2d');

    if (usageChartInstance !== null) {
        usageChartInstance.destroy();
    }

    const sorted = [...dataArray]
        .sort((a, b) => b.dailyTimeSpentSeconds - a.dailyTimeSpentSeconds)
        .slice(0, 5);

    const labels = ['Today', 'This week (avg/day)', 'This month (avg/day)'];
    const chartSummary = document.getElementById('chartSummary');
    chartSummary.replaceChildren(...sorted.map(entry => {
        const item = document.createElement('li');
        item.textContent = `${entry.domain}: today ${formatTime(entry.dailyTimeSpentSeconds)}, this week ${formatTime(entry.weeklyTimeSpentSeconds)}, this month ${formatTime(entry.monthlyTimeSpentSeconds)}.`;
        return item;
    }));
    const domainColors = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c'];

    const chartData = {
        labels: labels,
        datasets: sorted.map((entry, index) => ({
            label: entry.domain,
            data: [
                secondsToHours(entry.dailyTimeSpentSeconds),
                secondsToHours(entry.weeklyTimeSpentSeconds) / 7,
                secondsToHours(entry.monthlyTimeSpentSeconds) / 30
            ],
            backgroundColor: domainColors[index],
            borderColor: domainColors[index],
            borderWidth: 1
        }))
    };

    usageChartInstance = new Chart(ctx, {
        type: 'bar',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'category',
                    title: {
                        display: true,
                        text: 'Period'
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 0,
                        autoSkip: false
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Hours'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Top 5 Sites by Usage'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const hours = context.parsed.y.toFixed(2);
                            return `${context.dataset.label}: ${hours} hours`;
                        }
                    }
                }
            }
        }
    });
}

let currentDomain;
let usageSessions = [];
let usageDeviceId;

function localStartOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getUsageRanges(now = new Date()) {
    const today = localStartOfDay(now);
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const month = new Date(now.getFullYear(), now.getMonth(), 1);
    const from = monday < month ? monday : month;
    return { today, monday, month, from, now };
}

function summarizeSessions(sessions, ranges) {
    const totals = new Map();
    for (const session of sessions) {
        const seconds = Number(session.durationSeconds) || 0;
        if (seconds <= 0 || !session.domain) continue;
        const item = totals.get(session.domain) || { domain: session.domain, dailyTimeSpentSeconds: 0, weeklyTimeSpentSeconds: 0, monthlyTimeSpentSeconds: 0 };
        const end = new Date(session.endTs);
        if (end >= ranges.today) item.dailyTimeSpentSeconds += seconds;
        if (end >= ranges.monday) item.weeklyTimeSpentSeconds += seconds;
        if (end >= ranges.month) item.monthlyTimeSpentSeconds += seconds;
        totals.set(session.domain, item);
    }
    return [...totals.values()];
}

async function loadUsageSessions(deviceId, ranges) {
    const url = new URL(`${API_BASE}/sessions`);
    url.searchParams.set('deviceId', deviceId);
    url.searchParams.set('from', ranges.from.toISOString());
    url.searchParams.set('to', ranges.now.toISOString());
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not load sessions (${response.status}): ${await response.text()}`);
    return response.json();
}

// domain utils
function normalizeDomain(hostname) {
    return hostname.replace(/^www\./, '');
}

// popup
void (async () => {
 try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const stored = await chrome.storage.local.get('deviceId');
    const deviceId = stored.deviceId || crypto.randomUUID();
    if (!stored.deviceId) await chrome.storage.local.set({ deviceId });
    usageDeviceId = deviceId;
    const ranges = getUsageRanges();
    usageSessions = await loadUsageSessions(deviceId, ranges);
    const allStats = summarizeSessions(usageSessions, ranges);
    updateChart(allStats);
    if (tabs[0]?.url) {
      try { currentDomain = normalizeDomain(new URL(tabs[0].url).hostname); }
      catch { currentDomain = null; }
        
        // Skip tracking for chrome://, chrome-extension://, and other browser-internal URLs
        if (!currentDomain || tabs[0].url.startsWith('chrome://') ||
            tabs[0].url.startsWith('chrome-extension://') || 
            tabs[0].url.startsWith('about:') ||
            tabs[0].url.startsWith('moz-extension://') ||
            tabs[0].url.startsWith('edge://')) {
            
            document.getElementById('daily').textContent = 'Not tracked';
            document.getElementById('weekly').textContent = 'Not tracked';
            document.getElementById('monthly').textContent = 'Not tracked';
            return;
        }
        
        try {
            const stats = allStats.find(entry => entry.domain === currentDomain) || { dailyTimeSpentSeconds: 0, weeklyTimeSpentSeconds: 0, monthlyTimeSpentSeconds: 0 };
            document.getElementById('daily').textContent = formatTime(stats.dailyTimeSpentSeconds);
            document.getElementById('weekly').textContent = formatTime(stats.weeklyTimeSpentSeconds);
            document.getElementById('monthly').textContent = formatTime(stats.monthlyTimeSpentSeconds);
            checkTimeWarning(stats.dailyTimeSpentSeconds);

        } catch (error) {
            if (error.message.includes('Failed to fetch')) {
                showError('Server not running. Start the backend server.', error);
            } else {
                showError(`Error: ${error.message}`, error);
            }
        }
    } else {
        showError('No active tab found');
    }
 } catch (error) { showError('Could not load usage. Check that the backend is running.', error); }
})();

// AI Analysis functionality
async function analyzeUsage() {
    const analyzeBtn = document.getElementById('analyzeBtn');
    const aiAnalysis = document.getElementById('aiAnalysis');
    analyzeBtn.textContent = 'Analyzing...';
    analyzeBtn.disabled = true;
    aiAnalysis.hidden = true;
    setStatus('Analyzing your usage...');
    
    try {
        const deviceId = usageDeviceId;
        if (!deviceId) throw new Error('No device ID found. Close and reopen the popup.');
        const classifier = document.getElementById('analysisClassifier').value;
        const ranges = getUsageRanges();
        const url = new URL(`${API_BASE}/sessions/analyze`);
        url.searchParams.set('deviceId', deviceId);
        url.searchParams.set('from', ranges.today.toISOString());
        url.searchParams.set('to', ranges.now.toISOString());
        url.searchParams.set('classifier', classifier);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Analysis failed (${response.status}): ${await response.text()}`);
        const analysis = await response.json();
        
        // Display the analysis
        document.getElementById('otherTime').textContent = formatTime(analysis.otherTime || 0);
        document.getElementById('studyTime').textContent = formatTime(analysis.studyTime || 0);
        document.getElementById('entertainmentTime').textContent = formatTime(analysis.entertainmentTime || 0);
        document.getElementById('workTime').textContent = formatTime(analysis.workTime || 0);
        document.getElementById('socialTime').textContent = formatTime(analysis.socialTime || 0);
        document.getElementById('analysisText').textContent = analysis.analysis || 'No analysis available';
        document.getElementById('recommendationText').textContent = analysis.recommendation || 'No recommendation available';
        
        aiAnalysis.hidden = false;
        setStatus('Analysis complete.');
        
    } catch (error) {
        console.error('Error analyzing usage:', error);
        setStatus(error.message.startsWith('No device ID') ? error.message : 'Could not analyze usage. Check that the backend is running and try again.');
    } finally {
        // Reset button state
        analyzeBtn.textContent = 'Analyze my usage';
        analyzeBtn.disabled = false;
    }
}

// Add event listener for analyze button
document.getElementById('analyzeBtn').addEventListener('click', analyzeUsage);

document.getElementById('openDashboardBtn').addEventListener('click', async () => {
    try {
        const { deviceId } = await chrome.storage.local.get('deviceId');
        if (!deviceId) throw new Error('No device ID found. Close and reopen the popup.');
        const dashboardUrl = new URL('http://localhost:8080/dashboard/index.html');
        dashboardUrl.searchParams.set('deviceId', deviceId);
        await chrome.tabs.create({ url: dashboardUrl.toString() });
    } catch (error) {
        console.error('Could not open dashboard:', error);
        setStatus(error.message || 'Could not open the dashboard. Check that the backend is running.');
    }
});
