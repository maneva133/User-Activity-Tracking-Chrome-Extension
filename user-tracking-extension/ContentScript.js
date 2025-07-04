window.addEventListener('beforeunload', async () => {
    try {
        const data = await chrome.storage.local.get('trackingSession');
        const session = data.trackingSession;
        if (session && session.domain && session.startTime) {
            const now = Date.now();
            const timeSpentSeconds = Math.round((now - session.startTime) / 1000);
            if (timeSpentSeconds > 0) {
                // Send message to background script to save data
                chrome.runtime.sendMessage({
                    type: 'sendTrackingData',
                    domain: session.domain,
                    timeSpentSeconds
                });
            }
        }
    } catch (e) {
        // Ignore errors during unload
    }
});
