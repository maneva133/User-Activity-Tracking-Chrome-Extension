const FIVE_HOURS_IN_SECONDS = 18000;


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
    document.getElementById('current-session').textContent = message;
}

function checkTimeWarning(seconds) {
    const warningElement = document.getElementById('timeWarning');
    if (seconds > FIVE_HOURS_IN_SECONDS) {
        warningElement.style.display = 'block';
    } else {
        warningElement.style.display = 'none';
    }
}


// chart update
let usageChartInstance = null;
function updateChart(dataArray) {
    const ctx = document.getElementById('usageChart').getContext('2d');

    if (usageChartInstance !== null) {
        usageChartInstance.destroy();
    }

    const sorted = dataArray
        .sort((a, b) => b.dailyTimeSpentSeconds - a.dailyTimeSpentSeconds)
        .slice(0, 5);

    const labels = sorted.map(entry => entry.domain);
    const dailyData = sorted.map(entry => secondsToHours(entry.dailyTimeSpentSeconds));
    const weeklyData = sorted.map(entry => secondsToHours(entry.weeklyTimeSpentSeconds) / 7);
    const monthlyData = sorted.map(entry => secondsToHours(entry.monthlyTimeSpentSeconds) / 30);

    const chartData = {
        labels: labels,
        datasets: [
            {
                label: 'Daily',
                data: dailyData,
                backgroundColor: 'rgba(23,171,255,0.55)',
                borderColor: 'rgba(34,1,101,0.5)',
                borderWidth: 1
            },
            {
                label: 'Weekly',
                data: weeklyData,
                backgroundColor: 'rgba(0,40,128,0.48)',
                borderColor: 'rgb(5,0,0)',
                borderWidth: 1
            },
            {
                label: 'Monthly',
                data: monthlyData,
                backgroundColor: 'rgba(5,147,26,0.54)',
                borderColor: 'rgba(153, 102, 255, 1)',
                borderWidth: 1
            }
        ]
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
                        text: 'Domain'
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
                        text: 'Hours per Day (Average)'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Top 5 Sites Usage Statistics'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const hours = context.parsed.y.toFixed(2);
                            return `${context.dataset.label}: ${hours} hours/day`;
                        }
                    }
                }
            }
        }
    });
}

let updateInterval;
let currentDomain;
let currentStats = {
    dailyTimeSpentSeconds: 0,
    weeklyTimeSpentSeconds: 0,
    monthlyTimeSpentSeconds: 0
};

// TIMER
function updateDisplayedTime() {
    currentStats.dailyTimeSpentSeconds++;
    currentStats.weeklyTimeSpentSeconds++;
    currentStats.monthlyTimeSpentSeconds++;

    document.getElementById('daily').textContent = formatTime(currentStats.dailyTimeSpentSeconds);
    document.getElementById('weekly').textContent = formatTime(currentStats.weeklyTimeSpentSeconds);
    document.getElementById('monthly').textContent = formatTime(currentStats.monthlyTimeSpentSeconds);

    checkTimeWarning(currentStats.dailyTimeSpentSeconds);
}


// popup
chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
    const stored = await chrome.storage.local.get('deviceId');
    let deviceId = stored.deviceId;
    if (tabs[0] && tabs[0].url) {
        currentDomain = new URL(tabs[0].url).hostname;
        try {
            console.log('Fetching statistics for domain:', currentDomain);
            const response = await fetch(`http://localhost:8080/api/tracking/statistics/${currentDomain}?deviceId=${deviceId}`);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server error (${response.status}): ${errorText}`);
            }

            const stats = await response.json();
            console.log('Received statistics:', stats);

            currentStats = stats;

            document.getElementById('daily').textContent = formatTime(stats.dailyTimeSpentSeconds || 0);
            document.getElementById('weekly').textContent = formatTime(stats.weeklyTimeSpentSeconds || 0);
            document.getElementById('monthly').textContent = formatTime(stats.monthlyTimeSpentSeconds || 0);

            checkTimeWarning(stats.dailyTimeSpentSeconds || 0);

            updateInterval = setInterval(updateDisplayedTime, 1000);

            const allStatsResponse = await fetch(`http://localhost:8080/api/tracking/statistics/daily/all?deviceId=${deviceId}`);
            if (!allStatsResponse.ok) {
                throw new Error(`Error fetching all statistics: ${allStatsResponse.status}`);
            }
            const allStats = await allStatsResponse.json();
            console.log(allStats);
            updateChart(allStats);

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
});

// cleanup
window.addEventListener('unload', () => {
    if (updateInterval) {
        clearInterval(updateInterval);
    }
});