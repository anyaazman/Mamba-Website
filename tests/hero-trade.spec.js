#!/usr/bin/env node
/* Focused coverage for the deterministic, illustrative hero trade sequence. */
'use strict';

const assert = require('assert');
const { frameAt, rules, y, duration } = require('../hero-trade.js');

function check(name, condition) {
  assert.ok(condition, name);
  console.log(`  ✓ ${name}`);
}

const before = frameAt(899);
const opened = frameAt(1000);
const breakeven = frameAt(3900);
const trailing = frameAt(6500);
const pullback = frameAt(6900);
const closed = frameAt(8000);

check('levels stay hidden before entry', !before.entered && before.candles.length === 3);
check('entry adds the next candle', opened.entered && opened.candles.length === 4);
check('initial stop starts below entry', opened.stop === rules.sl && rules.sl < rules.entry);
check('breakeven moves stop to entry', breakeven.phase === 'breakeven' && breakeven.stop === rules.entry);
check('trailing stop moves above entry', trailing.phase === 'trailing' && trailing.stop > rules.entry);
check('pullback cannot lower the stop', pullback.phase === 'pullback' && pullback.stop === trailing.stop);
check('trade closes at the protected stop', closed.closed && closed.price === closed.stop);
check('take profit remains a fixed target', rules.tp === 108620 && y(rules.tp) < y(rules.entry));
check('loop fits the ten-second clarity goal', duration <= 10000);
