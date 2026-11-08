const assert = require('node:assert/strict');
const { FixedStrategy, AdaptiveStrategy, PersonalizedStrategy } = require('./reminders.js');

const state = (continuousActiveSeconds, currentCategory = 'other', extra = {}) => ({
    continuousActiveSeconds, currentCategory, categoryHistory: [], lastBreakTs: null, now: 1_000_000, ...extra
});

const fixed = new FixedStrategy();
assert.equal(fixed.shouldRemind(state(1799)), false);
assert.equal(fixed.shouldRemind(state(1800)), true);

const adaptive = new AdaptiveStrategy();
assert.equal(adaptive.shouldRemind(state(30 * 60, 'study')), false);
assert.equal(adaptive.shouldRemind(state(60 * 60, 'work')), true);
assert.equal(adaptive.shouldRemind(state(20 * 60, 'social')), true);
assert.equal(adaptive.shouldRemind(state(30 * 60, 'entertainment', { lastBreakTs: 950_000 })), false);

const personalized = new PersonalizedStrategy(Array.from({ length: 10 }, (_, i) => (i + 1) * 60));
assert.equal(personalized.thresholdSeconds, 330);
assert.equal(personalized.shouldRemind(state(329)), false);
assert.equal(personalized.shouldRemind(state(330)), true);
assert.equal(new PersonalizedStrategy([600]).thresholdSeconds, 1800);
console.log('Reminder strategy cases passed.');
