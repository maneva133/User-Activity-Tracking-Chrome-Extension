(function (root) {
    const MINUTE = 60;
    const BREAK_SECONDS = 3 * MINUTE;
    const RECENT_BREAK_SECONDS = 30 * MINUTE;

    class FixedStrategy {
        constructor(thresholdMinutes = 30) { this.name = 'FIXED'; this.thresholdSeconds = thresholdMinutes * MINUTE; }
        shouldRemind(state) { return state.continuousActiveSeconds >= this.thresholdSeconds; }
    }

    class AdaptiveStrategy {
        constructor() { this.name = 'ADAPTIVE'; }
        shouldRemind(state) {
            if (hadRecentBreak(state)) return false;
            const category = String(state.currentCategory || '').toLowerCase();
            const threshold = ['study', 'work', 'productivity'].includes(category) ? 60 * MINUTE
                : ['social', 'social media', 'entertainment'].includes(category) ? 20 * MINUTE : 30 * MINUTE;
            return state.continuousActiveSeconds >= threshold;
        }
    }

    class PersonalizedStrategy {
        constructor(sessionLengths = [], percentile = 0.5, fallback = new FixedStrategy()) {
            this.name = 'PERSONALIZED';
            this.sessionLengths = sessionLengths;
            this.percentile = Math.min(1, Math.max(0, percentile));
            this.fallback = fallback;
        }
        get thresholdSeconds() {
            if (this.sessionLengths.length < 10) return this.fallback.thresholdSeconds;
            const sorted = this.sessionLengths.filter(Number.isFinite).slice().sort((a, b) => a - b);
            if (sorted.length < 10) return this.fallback.thresholdSeconds;
            const position = this.percentile * (sorted.length - 1);
            const lower = Math.floor(position);
            const upper = Math.ceil(position);
            return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
        }
        shouldRemind(state) { return state.continuousActiveSeconds >= this.thresholdSeconds; }
    }

    function hadRecentBreak(state) {
        if (state.lastBreakTs == null) return false;
        const ts = typeof state.lastBreakTs === 'number' ? state.lastBreakTs : Date.parse(state.lastBreakTs);
        return Number.isFinite(ts) && state.now - ts >= 0 && state.now - ts <= RECENT_BREAK_SECONDS * 1000;
    }

    const api = { FixedStrategy, AdaptiveStrategy, PersonalizedStrategy, hadRecentBreak, BREAK_SECONDS };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.ReminderStrategies = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
