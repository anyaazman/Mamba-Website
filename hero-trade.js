/* Illustrative MT5 trade only. No account, market feed or order API is used. */
(() => {
  'use strict';

  // Integer pipettes keep the chart, prices and pip calculations in agreement.
  const rules = { entry: 108420, tp: 108620, sl: 108320, breakeven: 100, trail: 50 };
  const entryAt = 900;
  const candleDuration = 800;
  const duration = 9000;
  const history = [
    { open: 108380, high: 108414, low: 108370, close: 108405 },
    { open: 108405, high: 108415, low: 108383, close: 108392 },
    { open: 108392, high: 108430, low: 108388, close: rules.entry },
  ];
  // Each row is one candle, with intrabar ticks: the body and wick form together.
  const ticks = [
    [108420, 108412, 108450, 108438, 108450],
    [108450, 108460, 108434, 108441, 108438],
    [108438, 108432, 108490, 108475, 108488],
    [108488, 108480, 108522, 108518, 108524],
    [108524, 108518, 108550, 108539, 108548],
    [108548, 108560, 108575, 108560, 108572],
    [108572, 108582, 108590, 108579, 108586],
    [108586, 108589, 108569, 108563, 108568],
    [108568, 108573, 108552, 108540, 108540],
  ];

  const priceText = value => (value / 100000).toFixed(5);
  const pipText = value => `${value >= 0 ? '+' : '−'}${(Math.abs(value) / 10).toFixed(1)}`;
  const y = value => 24 + (108660 - value) * 268 / 380;
  const x = index => 28 + index * 37;

  function frameAt(time) {
    const elapsed = Math.max(0, time);
    const entered = elapsed >= entryAt;
    const candles = history.map(candle => ({ ...candle }));
    let price = rules.entry;
    let stop = rules.sl;
    let peak = rules.entry;
    let breakevenAt = null;
    let closed = false;

    function acceptTick(value, at) {
      if (closed) return;
      price = value;
      peak = Math.max(peak, price);
      if (breakevenAt === null && price >= rules.entry + rules.breakeven) {
        breakevenAt = at;
        stop = rules.entry;
      }
      // Leave breakeven visible before illustrating the next configured rule.
      if (breakevenAt !== null && at >= breakevenAt + 500) {
        stop = Math.max(stop, peak - rules.trail);
      }
      if (price <= stop || price >= rules.tp) {
        price = price <= stop ? stop : rules.tp;
        closed = true;
      }
    }

    if (entered) {
      for (let index = 0; index < ticks.length; index++) {
        const start = entryAt + index * candleDuration;
        if (elapsed < start || closed) break;
        const values = ticks[index];
        const progress = Math.min((elapsed - start) / candleDuration, 1) * (values.length - 1);
        const fullTicks = Math.floor(progress);
        const seen = [values[0]];
        for (let tick = 1; tick <= fullTicks; tick++) {
          acceptTick(values[tick], start + tick * candleDuration / 4);
          seen.push(price);
          if (closed) break;
        }
        if (!closed && fullTicks < values.length - 1) {
          const value = values[fullTicks] + (values[fullTicks + 1] - values[fullTicks]) * (progress - fullTicks);
          acceptTick(value, elapsed);
          seen.push(price);
        }
        candles.push({ open: values[0], high: Math.max(...seen), low: Math.min(...seen), close: price });
      }
    }

    let phase = 'ready';
    if (entered) phase = 'entry';
    if (breakevenAt !== null) phase = 'breakeven';
    if (stop > rules.entry) phase = 'trailing';
    if (phase === 'trailing' && peak - price > 15) phase = 'pullback';
    if (closed) phase = 'closed';
    return { elapsed, entered, candles, price, stop, peak, phase, closed };
  }

  // The same deterministic sequence can be checked without a browser or server.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { frameAt, rules, entryAt, duration, y, priceText, pipText };
  }
  if (typeof document === 'undefined') return;
  const demo = document.querySelector('[data-trade-demo]');
  if (!demo) return;
  const get = name => demo.querySelector(`[data-${name}]`);
  const candleLayer = get('candles');
  const candleNodes = [];
  const ns = 'http://www.w3.org/2000/svg';
  for (let index = 0; index < history.length + ticks.length; index++) {
    const group = document.createElementNS(ns, 'g');
    const wick = document.createElementNS(ns, 'line');
    const body = document.createElementNS(ns, 'rect');
    group.setAttribute('class', 'trade-candle');
    wick.setAttribute('x1', x(index));
    wick.setAttribute('x2', x(index));
    body.setAttribute('x', x(index) - 9);
    body.setAttribute('width', 18);
    body.setAttribute('rx', 1.5);
    group.append(wick, body);
    candleLayer.append(group);
    candleNodes.push({ group, wick, body });
  }

  const levels = { entry: get('entry-level'), tp: get('tp-level'), sl: get('sl-level') };
  const stopName = get('sl-name');
  const stopPrice = get('sl-price');
  const quote = get('quote');
  const change = get('change');
  const priceLine = get('price-line');
  const priceDot = get('price-dot');
  const entryMarker = get('entry-marker');
  const protectedArea = get('protected-area');
  const title = get('story-title');
  const caption = get('story-caption');
  const phaseNumber = get('phase-number');
  const progressBar = get('progress');
  const play = get('play');
  const replay = get('replay');
  const steps = [...demo.querySelectorAll('[data-step]')];
  const phaseCopy = {
    ready: [0, 'You choose the entry.', 'Watch a buy trade open in MT5. Mamba handles the exit rules.'],
    entry: [0, 'You enter. Mamba adds TP + SL.', 'Take profit sets the target. Stop loss sets the initial exit below entry.'],
    breakeven: [1, 'At +10 pips, SL moves to entry.', 'The stop is now at the entry price: this is breakeven.'],
    trailing: [2, 'Price rises. Your stop follows.', 'The trailing SL moves up, staying 5 pips behind the highest price.'],
    pullback: [2, 'Price dips. Your stop stays put.', 'The trailing SL holds its highest level. It never moves back down.'],
    closed: [3, 'Price meets SL. The trade closes.', 'This example exits at +12 pips before costs. Take profit stayed fixed.'],
  };
  let lastPhase;

  function render(elapsed) {
    const frame = frameAt(elapsed);
    demo.dataset.phase = frame.phase;
    for (let index = 0; index < candleNodes.length; index++) {
      const { group, wick, body } = candleNodes[index];
      const candle = frame.candles[index];
      group.setAttribute('visibility', candle ? 'visible' : 'hidden');
      if (!candle) continue;
      group.setAttribute('class', `trade-candle ${candle.close >= candle.open ? 'is-up' : 'is-down'}`);
      wick.setAttribute('y1', y(candle.high));
      wick.setAttribute('y2', y(candle.low));
      body.setAttribute('y', y(Math.max(candle.open, candle.close)));
      body.setAttribute('height', Math.max(2, Math.abs(y(candle.open) - y(candle.close))));
    }
    for (const [name, group] of Object.entries(levels)) {
      group.setAttribute('visibility', frame.entered ? 'visible' : 'hidden');
      group.setAttribute('transform', `translate(0 ${y(name === 'sl' ? frame.stop : rules[name])})`);
    }
    // At breakeven both levels coincide, so combine their labels.
    get('entry-tag').setAttribute('visibility', frame.entered && Math.abs(y(frame.stop) - y(rules.entry)) > 30 ? 'visible' : 'hidden');
    stopName.textContent = frame.stop === rules.entry ? 'SL · Entry' : frame.stop > rules.entry ? 'Trailing SL' : 'Stop loss';
    stopPrice.textContent = priceText(frame.stop);
    levels.sl.classList.toggle('is-protected', frame.stop >= rules.entry);
    quote.textContent = priceText(frame.price);
    change.textContent = frame.entered ? `${pipText(frame.price - rules.entry)} pips${frame.closed ? ' · closed' : ''}` : 'Waiting for entry';
    change.classList.toggle('is-negative', frame.price < rules.entry);
    const currentX = x(frame.candles.length - 1);
    const currentY = y(frame.price);
    priceLine.setAttribute('d', `M${currentX} ${currentY}H440`);
    priceDot.setAttribute('cx', currentX);
    priceDot.setAttribute('cy', currentY);
    entryMarker.setAttribute('visibility', frame.entered ? 'visible' : 'hidden');
    entryMarker.setAttribute('transform', `translate(${x(history.length)} ${y(rules.entry) + 12})`);
    protectedArea.setAttribute('y', y(Math.max(frame.stop, rules.entry)));
    protectedArea.setAttribute('height', Math.max(0, y(rules.entry) - y(frame.stop)));
    progressBar.style.transform = `scaleX(${Math.min(elapsed / duration, 1)})`;
    if (lastPhase !== frame.phase) {
      const [step, heading, detail] = phaseCopy[frame.phase];
      title.textContent = heading;
      caption.textContent = detail;
      phaseNumber.textContent = String(step + 1).padStart(2, '0');
      steps.forEach((element, index) => {
        element.classList.toggle('is-active', step === index);
        element.classList.toggle('is-complete', step > index);
        if (step === index) element.setAttribute('aria-current', 'step');
        else element.removeAttribute('aria-current');
      });
      lastPhase = frame.phase;
    }
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reducedMotion.matches;
  let elapsed = paused ? 6300 : 0;
  let inView = true;
  let previous = null;
  let request = null;
  function updatePlay() {
    play.textContent = paused ? 'Play' : 'Pause';
    play.setAttribute('aria-label', paused ? 'Play trade animation' : 'Pause trade animation');
  }
  function animate(timestamp) {
    request = null;
    if (previous !== null) elapsed = (elapsed + timestamp - previous) % duration;
    previous = timestamp;
    render(elapsed);
    request = window.requestAnimationFrame(animate);
  }
  function syncPlayback() {
    if (request !== null) window.cancelAnimationFrame(request);
    request = null;
    previous = null;
    if (!paused && inView && !document.hidden) request = window.requestAnimationFrame(animate);
    updatePlay();
  }
  play.addEventListener('click', () => { paused = !paused; syncPlayback(); });
  replay.addEventListener('click', () => { elapsed = 0; paused = false; render(elapsed); syncPlayback(); });
  reducedMotion.addEventListener('change', event => {
    paused = event.matches;
    if (paused) { elapsed = 6300; render(elapsed); }
    syncPlayback();
  });
  document.addEventListener('visibilitychange', syncPlayback);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting;
      syncPlayback();
    }, { threshold: 0.1 }).observe(demo);
  }
  render(elapsed);
  get('controls').hidden = false;
  syncPlayback();
})();
