/* Plus-Lernspiel. Core task generation is kept DOM-independent for automated tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PlusGameCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const LEVELS = {
    1: { label: 'ZR 6', count: 10, minSum: 2, maxSum: 6 },
    2: { label: 'ZR 10', count: 10, minSum: 6, maxSum: 10 },
    3: { label: 'ZR 20', count: 20, minSum: 11, maxSum: 20 },
    // Zahlenraum 100: Darstellung mit Zehnerstangen und Einerwürfeln (gelb/blau/grün).
    4: { label: 'ZR 100', sub: 'ZE+E · ZE+Z', count: 10, zr100: true },
    5: { label: 'ZR 100', sub: 'ZE+ZE oÜ', count: 10, zr100: true },
    6: { label: 'ZR 100', sub: 'ZE+ZE mÜ', count: 10, zr100: true }
  };
  const ones = (n) => n % 10, tens = (n) => Math.floor(n / 10);
  const isZE = (n) => n >= 11 && n <= 99 && ones(n) !== 0;
  // Level 4: ZE + E ohne Überschreitung (Einer zusammen höchstens 9) oder ZE + glatter Zehner.
  // Level 5: ZE + ZE, Einer zusammen höchstens 9.  Level 6: ZE + ZE, Einer zusammen mindestens 10.
  function isAllowedZR100(x, y, level) {
    if (!isZE(x)) return false;
    if (level === 4) {
      if (y >= 1 && y <= 9) return ones(x) + y <= 9;
      return y >= 10 && y <= 90 && y % 10 === 0 && x + y <= 99;
    }
    if (!isZE(y)) return false;
    if (level === 5) return ones(x) + ones(y) <= 9 && x + y <= 99;
    if (level === 6) return ones(x) + ones(y) >= 10 && x + y <= 100;
    return false;
  }
  function shuffle(list, random = Math.random) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function taskKey(t) { return `${t.x}+${t.y}`; } // Ordered pairs are intentionally distinct: 3+4 and 4+3 differ.
  function isAllowedTask(t, level) {
    const cfg = LEVELS[level];
    if (cfg && cfg.zr100) return Number.isInteger(t.x) && Number.isInteger(t.y) && isAllowedZR100(t.x, t.y, level);
    return !!cfg && Number.isInteger(t.x) && Number.isInteger(t.y) && t.x >= 1 && t.y >= 1 &&
      t.x + t.y >= cfg.minSum && t.x + t.y <= cfg.maxSum;
  }
  function enumerateTasks(level) {
    const cfg = LEVELS[level];
    if (!cfg) throw new Error(`Unbekanntes Level: ${level}`);
    const tasks = [];
    if (cfg.zr100) {
      for (let x = 11; x <= 99; x++) for (let y = 1; y <= 90; y++) if (isAllowedZR100(x, y, level)) tasks.push({ x, y, result: x + y });
      return tasks;
    }
    for (let x = 1; x <= cfg.maxSum - 1; x++) {
      for (let y = 1; y <= cfg.maxSum - x; y++) {
        const t = { x, y, result: x + y };
        if (isAllowedTask(t, level)) tasks.push(t);
      }
    }
    return tasks;
  }
  function buildTaskBlock(level, random = Math.random) {
    const cfg = LEVELS[level];
    if (!cfg) throw new Error(`Unbekanntes Level: ${level}`);
    const all = enumerateTasks(level);
    if (all.length < cfg.count) throw new Error(`Level ${level}: Nur ${all.length} zulässige Aufgaben für ${cfg.count} benötigte Aufgaben.`);
    let selected;
    if (level === 3) {
      // Jeder 20er-Block enthält 1 bis 5 Riesen-/Zwergenaufgaben.
      const giants = shuffle(all.filter(t => t.x >= 10 || t.y >= 10), random);
      const others = shuffle(all.filter(t => t.x < 10 && t.y < 10), random);
      const giantCount = 1 + Math.floor(random() * 5);
      selected = shuffle([...giants.slice(0, giantCount), ...others.slice(0, cfg.count - giantCount)], random);
    } else if (level === 4) {
      // Level 4: ungefähr je zur Hälfte ZE + E und ZE + Z.
      const plusOnes = shuffle(all.filter(t => t.y < 10), random), plusTens = shuffle(all.filter(t => t.y >= 10), random);
      const half = Math.floor(cfg.count / 2) + (random() < 0.5 ? 0 : cfg.count % 2);
      selected = shuffle([...plusOnes.slice(0, half), ...plusTens.slice(0, cfg.count - half)], random);
    } else {
      selected = shuffle(all, random).slice(0, cfg.count);
    }
    const seen = new Set();
    for (const t of selected) {
      if (!isAllowedTask(t, level)) throw new Error(`Unzulässige Aufgabe: ${taskKey(t)}`);
      if (seen.has(taskKey(t))) throw new Error(`Doppelte Aufgabe: ${taskKey(t)}`);
      seen.add(taskKey(t));
    }
    return selected;
  }
  function strategyValidity(strategy, x, y) {
    const larger = Math.max(x, y), smaller = Math.min(x, y), sum = x + y;
    switch (strategy) {
      case 'double': return Math.abs(x - y) <= 1;
      case 'hand': return x === 5 || y === 5 || (x > 5 && y > 5);
      // Bei 9 + 11 bzw. 11 + 9 ist das Zwanzigerfeld voll: Es gäbe keinen freien Platz für die sichtbare Bewegung.
      case 'nine': return (x === 9 || y === 9) && sum <= 19;
      case 'ten': return sum > 10 && smaller < 10 && larger < 10;
      case 'giant': return x >= 10 || y >= 10;
      default: return false;
    }
  }
  // ---- Rechenwege Level 5/6 -------------------------------------------------
  // Kinder rechnen auf unterschiedlichen Wegen. Zustand: noch nicht verwendete Teile
  // (AT/AE = Zehner/Einer des 1. Summanden, BT/BE = des 2. Summanden) und die
  // Zwischenergebnisse im grünen Feld. Jeder Rechenschritt verbindet zwei Zahlen.
  // sources: Felder, deren Einheiten der Schritt braucht (für die Rückmeldung bei Fehlwahl).
  const MOVE_TYPES = ['TT', 'EE', 'A_BE', 'A_ERG', 'A_BT', 'G_BE', 'G_ERG', 'G_BT', 'G_BREST', 'G_G'];
  const MOVE_SOURCES = { TT: ['yellow','blue'], EE: ['yellow','blue'], A_BE: ['yellow','blue'], A_ERG: ['yellow','blue'], A_BT: ['yellow','blue'],
    G_BE: ['blue'], G_ERG: ['blue'], G_BT: ['blue'], G_BREST: ['blue'], G_G: ['green'] };
  function initSteps(x, y) {
    return { x, y, rem: { AT: tens(x), AE: ones(x), BT: tens(y), BE: ones(y) }, green: [], done: [] };
  }
  function cloneState(st) { return { x: st.x, y: st.y, rem: { ...st.rem }, green: st.green.map(g => ({ ...g })), done: st.done.map(d => ({ ...d })) }; }
  function planStep(st, type) {
    const r = st.rem, g = st.green, x = st.x, n = cloneState(st), R = n.rem;
    const no = { invalid: true, type };
    const beFull = r.BE === ones(st.y), yellowUsed = !r.AT && !r.AE, oneG = g.length === 1;
    let terms, moves = [], consumesGreen = 0;
    switch (type) {
      case 'TT': if (!(r.AT && r.BT)) return no;
        terms = [r.AT * 10, r.BT * 10]; moves = [{ src: 'yellow', tens: r.AT, ones: 0 }, { src: 'blue', tens: r.BT, ones: 0 }]; R.AT = R.BT = 0; break;
      case 'EE': if (!(r.AE && r.BE && beFull)) return no;
        terms = [r.AE, r.BE]; moves = [{ src: 'yellow', tens: 0, ones: r.AE }, { src: 'blue', tens: 0, ones: r.BE }]; R.AE = R.BE = 0; break;
      case 'A_BE': if (!(r.AT && r.AE && r.BE && beFull)) return no;
        terms = [x, r.BE]; moves = [{ src: 'yellow', tens: r.AT, ones: r.AE }, { src: 'blue', tens: 0, ones: r.BE }]; R.AT = R.AE = R.BE = 0; break;
      case 'A_ERG': { if (!(r.AT && r.AE && r.BE && beFull)) return no;
        const c = 10 - r.AE; if (c >= r.BE) return no; // genau bis zum Zehner wäre A_BE
        terms = [x, c]; moves = [{ src: 'yellow', tens: r.AT, ones: r.AE }, { src: 'blue', tens: 0, ones: c }]; R.AT = R.AE = 0; R.BE -= c; break; }
      case 'A_BT': if (!(r.AT && r.AE && r.BT)) return no;
        terms = [x, r.BT * 10]; moves = [{ src: 'yellow', tens: r.AT, ones: r.AE }, { src: 'blue', tens: r.BT, ones: 0 }]; R.AT = R.AE = R.BT = 0; break;
      case 'G_BE': if (!(oneG && yellowUsed && r.BE)) return no;
        terms = [g[0].value, r.BE]; moves = [{ src: 'blue', tens: 0, ones: r.BE }]; R.BE = 0; consumesGreen = 1; break;
      case 'G_ERG': { const e = oneG ? ones(g[0].value) : 0;
        if (!(oneG && yellowUsed && !r.BT && r.BE && e)) return no;
        const c = 10 - e; if (c >= r.BE) return no;
        terms = [g[0].value, c]; moves = [{ src: 'blue', tens: 0, ones: c }]; R.BE -= c; consumesGreen = 1; break; }
      case 'G_BT': if (!(oneG && yellowUsed && r.BT)) return no;
        terms = [g[0].value, r.BT * 10]; moves = [{ src: 'blue', tens: r.BT, ones: 0 }]; R.BT = 0; consumesGreen = 1; break;
      case 'G_BREST': if (!(oneG && yellowUsed && r.BT && r.BE && !beFull)) return no;
        terms = [g[0].value, r.BT * 10 + r.BE]; moves = [{ src: 'blue', tens: r.BT, ones: r.BE }]; R.BT = R.BE = 0; consumesGreen = 1; break;
      case 'G_G': if (!(g.length === 2 && !r.AT && !r.AE && !r.BT && !r.BE)) return no;
        terms = [Math.max(g[0].value, g[1].value), Math.min(g[0].value, g[1].value)]; consumesGreen = 2; break;
      default: return no;
    }
    const result = terms[0] + terms[1];
    n.green = n.green.slice(consumesGreen); n.green.push({ value: result, from: type });
    const final = !R.AT && !R.AE && !R.BT && !R.BE && n.green.length === 1;
    n.done.push({ type, terms, result });
    return { invalid: false, type, terms, result, moves, final, next: n, label: `${terms[0]} + ${terms[1]}` };
  }
  function validSteps(st) { return MOVE_TYPES.map(t => planStep(st, t)).filter(p => !p.invalid); }
  // Alle Teilrechnungen, die im jeweiligen Schritt auf irgendeinem Weg vorkommen (ohne Doppelte).
  function stepButtonsForTask(x, y) {
    const steps = [];
    const walk = (st, i) => {
      for (const p of validSteps(st)) {
        steps[i] = steps[i] || [];
        let b = steps[i].find(e => e.label === p.label);
        if (!b) { b = { label: p.label, types: [], sources: [] }; steps[i].push(b); }
        if (!b.types.includes(p.type)) b.types.push(p.type);
        for (const src of MOVE_SOURCES[p.type]) if (!b.sources.includes(src)) b.sources.push(src);
        if (!p.final) walk(p.next, i + 1);
      }
    };
    walk(initSteps(x, y), 0);
    const rank = (b) => Math.min(...b.types.map(t => MOVE_TYPES.indexOf(t)));
    return steps.map(list => list.map((b, i) => ({ b, i })).sort((p, q) => rank(p.b) - rank(q.b) || p.i - q.i).map(e => e.b));
  }
  function planByLabel(st, label) { return validSteps(st).find(p => p.label === label) || null; }
  return { LEVELS, shuffle, taskKey, isAllowedTask, enumerateTasks, buildTaskBlock, strategyValidity,
    MOVE_TYPES, initSteps, planStep, validSteps, stepButtonsForTask, planByLabel };
});

(() => {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const Core = window.PlusGameCore;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const el = {
    app: $('#app'), game: $('#game'), pointsWrap: $('#pointsWrap'), pointsField: $('#pointsField'), redFrame: $('#redFrame'), greenFrame: $('#greenFrame'),
    fadeMask: $('#fadeMask'), labelTop: $('#labelTop'), labelBottom: $('#labelBottom'), strategyHint: $('#strategyHint'), taskText: $('#taskText'),
    answer: $('#answerInput'), keypad: $('#keypad'), strategyArea: $('#strategyArea'), progressText: $('#progressText'), progressDots: $('#progressDots'),
    feedback: $('#feedback'), next: $('#nextBtn'), leave: $('#leaveBtn'), result: $('#resultPanel'), resultScore: $('#resultScore'),
    resultTime: $('#resultTime'), resultDetails: $('#resultDetails'), celebration: $('#resultCelebration'), again: $('#againBtn'), resultLevel: $('#resultLevelBtn'),
    okCount: $('#okCount'), badCount: $('#badCount'), fullscreen: $('#fullscreenBtn'), home: $('#homeBtn'), anim: $('#animBtn'), direct: $('#directBtn'),
    placeBoard: $('#placeBoard'), zrSteps: $('#zrSteps'), zrChoice: $('#zrChoice'), zrButtons: $('#zrButtons'), zrChoiceTitle: $('#zrChoiceTitle'), equals: $('.equals')
  };
  let level = 1, tasks = [], index = 0, current = null, firstAttempts = 0, correct = 0, wrong = 0, startAt = 0, taskStartAt = 0;
  let taskRecords = [], retryQueue = [], checkTimer = null, animationToken = 0, lock = false;
  let starsTimer = null, lastChosenStrategy = null;
  const STRATEGIES = {
    double: { name: 'Verdoppeln', invalid: 'Die Zahlen dürfen höchstens 1 auseinander sein!' },
    hand: { name: 'Handaufgabe', invalid: 'Du brauchst zwei Fünfer.' },
    nine: { name: '9er-Trick', invalid: 'Du brauchst einen Neuner!' },
    ten: { name: '10er-Stopp', invalid: 'Diese Rechnung geht nicht über den Zehner!' },
    giant: { name: 'Riesen und Zwerg', invalid: 'Eine Zahl braucht einen Zehner!' }
  };
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  // Eingabeziel des Ziffernfelds: Ergebnisfeld der Rechnung oder ein Feld einer Hilfsrechnung.
  let activeInput = null, activeExpected = '';
  // Schalter wie im Minus-Spiel: Animation (Darstellung) ein/aus und „ohne Rechenschritte“
  // (direkte Ergebniseingabe in Level 3, 5 und 6; schaltet auch die Animation aus).
  let animationOn = true, directMode = false;
  const DIRECT_LEVELS = [3, 5, 6];
  const directActive = () => directMode && DIRECT_LEVELS.includes(level);
  function setActiveInput(input, expected) { activeInput = input; activeExpected = input ? String(expected) : ''; }
  function inputBlocked() { return Core.LEVELS[level].zr100 ? ZR.busy : (lock || el.answer.disabled); }
  // ---- Lernplattform-Brücke (DENKAVO) ----
  // Das Spiel sendet nur Ereignisse an die umgebende Plattform (gleicher Ursprung).
  // Es enthält keine Datenbankzugänge und kennt keine Schüler-IDs. Läuft das Spiel
  // eigenständig (z. B. GitHub Pages), wird nichts gesendet.
  const pendingLearningEvents = [];
  let platformBridgeReady = false, sessionActive = false, taskAttemptCount = 0, helpUsedThisTask = [];
  window.addEventListener('message', event => {
    if (event.origin !== window.location.origin || event.source !== window.parent) return;
    if (event.data?.source === 'denkavo-platform' && event.data?.type === 'ready') {
      platformBridgeReady = true;
      while (pendingLearningEvents.length) window.parent.postMessage(pendingLearningEvents.shift(), window.location.origin);
    }
  });
  function emitLearning(type, payload = {}) {
    if (!window.parent || window.parent === window) return;
    const event = { source: 'denkavo-plus', type, ...payload };
    if (platformBridgeReady) window.parent.postMessage(event, window.location.origin);
    else pendingLearningEvents.push(event);
  }
  function addHelp(name) { if (!helpUsedThisTask.includes(name)) helpUsedThisTask.push(name); }
  function taskInfo(task) { return { taskKey: `L${level}-${task.x}-${task.y}`, taskLabel: `${task.x} + ${task.y}`, expectedAnswer: String(task.x + task.y) }; }
  function endPlatformSession() { if (sessionActive) { emitLearning('session-end', { startedAt: startAt }); sessionActive = false; } }
  function updateCounters() { if (el.okCount) el.okCount.textContent = String(correct); if (el.badCount) el.badCount.textContent = String(wrong); }
  // ---- Vollbild ----
  function fullscreenElement() { return document.fullscreenElement || document.webkitFullscreenElement || null; }
  function fullscreenSupported() { return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled); }
  async function toggleFullscreen() {
    try {
      if (fullscreenElement()) await (document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen());
      else { const root = document.documentElement; await (root.requestFullscreen ? root.requestFullscreen() : root.webkitRequestFullscreen()); }
    } catch (_) { /* Browser hat Vollbild abgelehnt – Spiel läuft normal weiter. */ }
  }
  function updateFullscreenButton() {
    if (!el.fullscreen) return;
    el.fullscreen.hidden = !fullscreenSupported();
    const active = !!fullscreenElement();
    el.fullscreen.classList.toggle('active', active);
    el.fullscreen.setAttribute('aria-pressed', String(active));
    el.fullscreen.title = active ? 'Vollbild beenden' : 'Vollbild';
    requestAnimationFrame(fitAll);
  }
  function speak(text) {
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      el.feedback.textContent = text;
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'de-AT'; utterance.rate = 0.92;
      window.speechSynthesis.speak(utterance);
    } catch (_) { el.feedback.textContent = text; }
  }
  function clearTimers() { if (checkTimer) clearTimeout(checkTimer); checkTimer = null; if (starsTimer) clearTimeout(starsTimer); starsTimer = null; }
  function buildDots() {
    // The twenty empty cells are the static background. Counters are a separate overlay.
    el.pointsField.replaceChildren();
    for (let i = 0; i < 20; i++) {
      const cell = document.createElement('span');
      cell.className = 'field-cell';
      cell.setAttribute('aria-hidden', 'true');
      // The reference twenty-field has five cells, a double-width grey divider, then five cells.
      const row = Math.floor(i / 10) + 1;
      const col = (i % 10) + 1;
      cell.style.gridRow = String(row);
      cell.style.gridColumn = String(col <= 5 ? col : col + 1);
      el.pointsField.append(cell);
    }
    const layer = document.createElement('div');
    layer.id = 'pointsLayer';
    layer.className = 'points-layer';
    el.pointsWrap.append(layer);
    for (let i = 0; i < 20; i++) {
      const dot = document.createElement('span');
      dot.className = 'dot'; dot.dataset.index = String(i);
      layer.append(dot);
    }
  }
  function clearDotPlacement() { $$('.dot').forEach(d => { d.style.gridColumn = ''; d.style.gridRow = ''; }); }
  function placeDot(dotIndex, row, col) {
    const dot = $$('.dot')[dotIndex];
    if (!dot) return;
    dot.style.gridRow = String(row);
    dot.style.gridColumn = String(col <= 5 ? col : col + 1);
  }
  function groupIndices(x, y) {
    return { x: Array.from({length:x}, (_,i)=>i), y: Array.from({length:y}, (_,i)=>x+i),
      big: x >= y ? Array.from({length:x},(_,i)=>i) : Array.from({length:y},(_,i)=>x+i),
      small: x >= y ? Array.from({length:y},(_,i)=>x+i) : Array.from({length:x},(_,i)=>i) };
  }
  function setDotsForLevel(x, y, levelNumber = level, mode = 'intro') {
    resetBoard(); clearDotPlacement();
    const dots = $$('.dot');
    dots.forEach(d => d.classList.remove('red','blue','green'));
    const groups = groupIndices(x,y), placements = [];
    const near = levelNumber < 3 && Math.abs(x-y) <= 2;
    if (near) {
      // Keep the addends' colours, but show the larger addend in the first row.
      const first = x >= y ? groups.x : groups.y;
      const second = x >= y ? groups.y : groups.x;
      first.forEach((idx,i)=>placements.push({idx,row:1,col:i+1}));
      second.forEach((idx,i)=>placements.push({idx,row:2,col:i+1}));
    } else if (levelNumber < 3) {
      // Bei Abstand > 2 stehen beide Summanden nebeneinander in der ersten
      // Zeile: zuerst der größere Summand, danach der kleinere. Die Farben
      // bleiben an den ursprünglichen Summanden gebunden.
      const first = x >= y ? groups.x : groups.y;
      const second = x >= y ? groups.y : groups.x;
      [...first, ...second].forEach((idx,i)=>placements.push({idx,row:1,col:i+1}));
    } else {
      // Vertical addend layout. For a giant, its ten sits on row one and its
      // remainder is followed by the other addend on row two (analogy visible).
      const first = x >= y ? groups.x : groups.y;
      const second = x >= y ? groups.y : groups.x;
      first.forEach((idx,i)=>placements.push({idx,row:Math.floor(i/10)+1,col:(i%10)+1}));
      const remainder = Math.max(0, first.length-10);
      second.forEach((idx,i)=>placements.push({idx,row:2,col:remainder+i+1}));
    }
    // Level 1/2: Der größere Summand ist immer blau (obere Zeile), der kleinere rot –
    // unabhängig davon, an welcher Stelle er in der Rechnung steht.
    const isBlue = (idx) => levelNumber < 3 ? groups.big.includes(idx) : groups.x.includes(idx);
    placements.forEach(p => { placeDot(p.idx,p.row,p.col); dots[p.idx].classList.add(isBlue(p.idx) ? 'blue' : 'red'); });
  }
  function indexOfAddendDot(x, y, addend, offset) {
    const start = addend === 'x' ? 0 : x;
    return start + offset;
  }
  function indexesForLargerRemainder(x,y) {
    const big = Math.max(x,y), small = Math.min(x,y);
    const bigStart = x >= y ? 0 : x, smallStart = x >= y ? x : 0;
    return {big,small,bigStart,smallStart,excess:Array.from({length:Math.max(0,big-5)},(_,i)=>bigStart+5+i),smallIndexes:Array.from({length:small},(_,i)=>smallStart+i)};
  }
  function handGroups(x,y) {
    const g=groupIndices(x,y), five=[], rest=[];
    if (x === 5 || x > 5) five.push(...g.x.slice(0,5));
    if (y === 5 || y > 5) five.push(...g.y.slice(0,5));
    for (const i of [...g.x,...g.y]) if (!five.includes(i)) rest.push(i);
    return {five,rest};
  }
  function clearDotNotes() { $$('.dot').forEach(d=>{d.classList.remove('plus-one'); d.removeAttribute('data-note');}); }
  function markPlusOne(index) { const dot=$$('.dot')[index]; if(dot){dot.classList.add('plus-one');dot.dataset.note='+1';} }
  function arrangeNine(x,y) {
    clearDotPlacement();
    const g=groupIndices(x,y), nineGroup=x===9?g.x:g.y, otherGroup=x===9?g.y:g.x;
    nineGroup.forEach((idx,i)=>placeDot(idx,1,i+1));
    // Leave one counter from the other addend available to complete ten.
    const donor=otherGroup[otherGroup.length-1];
    const remaining=otherGroup.filter(i=>i!==donor);
    remaining.forEach((idx,i)=>placeDot(idx,2,i+1));
    // Der Spender ist vor dem Start der Bewegung sichtbar und liegt in einem
    // freien Feld; er darf nie im impliziten Grid außerhalb des Zwanzigerfeldes landen.
    placeDot(donor,2,remaining.length+1);
    return {nineGroup,donor};
  }
  async function moveCounterToCell(dotIndex, targetRow, targetCol, token, duration = 900) {
    const dots = $$('.dot'), dot = dots[dotIndex];
    if (!dot || token !== animationToken) return;
    // Never move a counter onto an occupied cell. If the requested cell is occupied,
    // choose the nearest free cell, scanning left-to-right, top-to-bottom.
    const allDots = $$('.dot');
    const occupied = new Set(allDots.filter((d,i)=>i!==dotIndex && d.style.gridRow && d.style.gridColumn)
      .map(d=>`${d.style.gridRow},${d.style.gridColumn}`));
    let actualTargetCol = targetCol <= 5 ? targetCol : targetCol + 1;
    let targetKey = `${targetRow},${actualTargetCol}`;
    if (occupied.has(targetKey)) {
      let found = null;
      // Grid columns 1–5 and 7–11 are cells; column 6 is the grey divider and never a target.
      const cellColumns = [1,2,3,4,5,7,8,9,10,11];
      for (let r=1;r<=2 && !found;r++) for(const c of cellColumns) if(!occupied.has(`${r},${c}`)){found={r,c};break;}
      if (!found) return;
      targetRow=found.r; targetCol=found.c <= 5 ? found.c : found.c - 1; actualTargetCol=found.c; targetKey=`${targetRow},${actualTargetCol}`;
    }
    // Measure the destination in the SAME CSS grid as the moving dots.
    // Measuring the underlying cells is unsafe when their gaps/padding differ
    // by even a few pixels: the transform can then push a counter beyond the frame.
    const oldRow = dot.style.gridRow, oldCol = dot.style.gridColumn;
    dot.style.gridRow = String(targetRow);
    dot.style.gridColumn = String(actualTargetCol);
    const targetRect = dot.getBoundingClientRect();
    const targetX = targetRect.left + targetRect.width / 2;
    const targetY = targetRect.top + targetRect.height / 2;
    dot.style.gridRow = oldRow;
    dot.style.gridColumn = oldCol;
    const from = dot.getBoundingClientRect();
    const dx = targetX - (from.left + from.width / 2);
    const dy = targetY - (from.top + from.height / 2);
    dot.style.zIndex = '6';
    let movementAnimation = null;
    if (dot.animate) {
      const anim = dot.animate(
        [{ transform: 'translate(0,0)' }, { transform: `translate(${dx}px,${dy}px)` }],
        { duration, easing: 'ease-in-out', fill: 'forwards' }
      );
      movementAnimation = anim;
      await anim.finished.catch(() => {});
      if (token !== animationToken) { anim.cancel(); dot.style.zIndex = ''; return; }
    } else {
      dot.style.transform = `translate(${dx}px,${dy}px)`;
      await sleep(duration);
    }
    if (token !== animationToken) return;
    // Commit the final grid cell before removing the animation effect.
    // Otherwise fill:'forwards' keeps the old transform and the counter appears
    // outside the 20-field even though its gridRow/gridColumn are correct.
    dot.style.gridRow = String(targetRow);
    dot.style.gridColumn = String(actualTargetCol);
    if (movementAnimation) movementAnimation.cancel();
    dot.style.zIndex = '';
    dot.style.transform = '';
  }
  async function coverAnimation(token) {
    await sleep(2000);
    if (token !== animationToken) return;
    // The yellow cover stays in place while the child solves the equation.
    el.fadeMask.style.opacity = '1';
  }
  function resetBoard() {
    clearDotNotes();
    // Laufende Bewegungen der vorigen Aufgabe vollständig abbrechen: Eine Web-Animation mit
    // fill:'forwards' würde sonst ihre Verschiebung behalten und Plättchen an falscher Stelle
    // (bis außerhalb des Zwanzigerfelds) zeigen, wenn schnell geantwortet wurde.
    $$('.dot').forEach(d => { if (d.getAnimations) d.getAnimations().forEach(a => a.cancel()); d.className = 'dot'; d.style.opacity = ''; d.style.transform = ''; d.style.zIndex = ''; });
    [el.redFrame, el.greenFrame].forEach(f => { f.style.opacity = '0'; f.style.left = ''; f.style.top = ''; f.style.width = ''; f.style.height = ''; });
    el.fadeMask.style.opacity = '0'; el.fadeMask.classList.toggle('green-cover', level === 3); el.labelTop.textContent = ''; el.labelBottom.textContent = ''; el.labelBottom.classList.remove('below-board');
  }
  function setDots(x, y, options = {}) {
    resetBoard();
    const dots = $$('.dot');
    for (let i = 0; i < Math.min(x, 20); i++) dots[i].classList.add('red');
    for (let i = 0; i < Math.min(y, 20 - x); i++) dots[x + i].classList.add('blue');
    if (options.fadedStart != null) {
      for (let i = options.fadedStart; i < Math.min(options.fadedStart + 10, 20); i++) dots[i].style.opacity = '.24';
    }
  }
  function frameDots(frame, start, count) {
    const dots = $$('.dot');
    if (!dots.length || count <= 0) return;
    const selected = dots.slice(Math.max(0, start), Math.min(20, start + count));
    const wrap = el.pointsWrap.getBoundingClientRect();
    const rects = selected.map(d => d.getBoundingClientRect());
    const left = Math.min(...rects.map(r => r.left)) - wrap.left - 3;
    const top = Math.min(...rects.map(r => r.top)) - wrap.top - 3;
    const right = Math.max(...rects.map(r => r.right)) - wrap.left + 3;
    const bottom = Math.max(...rects.map(r => r.bottom)) - wrap.top + 3;
    Object.assign(frame.style, { left: `${left}px`, top: `${top}px`, width: `${right-left}px`, height: `${bottom-top}px`, opacity: '1' });
  }
  function frameRow(frame, row) { frameDotIndexes(frame, $$('.dot').map((d,i)=>d.style.gridRow===String(row)?i:-1).filter(i=>i>=0)); }
  function frameDotIndexes(frame, indexes) {
    // Ein einzelnes Plättchen bekommt nie einen Rahmen.
    if (!indexes || indexes.length < 2) { frame.style.opacity = '0'; return; }
    const dots = $$('.dot');
    const selected = [...new Set(indexes)].map(i => dots[i]).filter(Boolean);
    if (!selected.length) return;
    const wrap = el.pointsWrap.getBoundingClientRect();
    const rects = selected.map(d => d.getBoundingClientRect());
    const left = Math.min(...rects.map(r => r.left)) - wrap.left - 3;
    const top = Math.min(...rects.map(r => r.top)) - wrap.top - 3;
    const right = Math.max(...rects.map(r => r.right)) - wrap.left + 3;
    const bottom = Math.max(...rects.map(r => r.bottom)) - wrap.top + 3;
    Object.assign(frame.style, { left: `${left}px`, top: `${top}px`, width: `${right-left}px`, height: `${bottom-top}px`, opacity: '1' });
  }
  function updateProgress() {
    const total = Core.LEVELS[level].count;
    el.progressText.textContent = `Aufgabe ${Math.min(firstAttempts + 1, total)} von ${total}`;
    el.progressDots.textContent = '●'.repeat(firstAttempts) + '○'.repeat(Math.max(0, total - firstAttempts));
  }
  function renderTask() {
    if (!current) return;
    resetBoard(); el.taskText.textContent = `${current.x} + ${current.y}`; el.answer.value = ''; el.answer.classList.remove('ok','bad','done');
    el.feedback.textContent = ''; el.strategyHint.textContent = ''; el.next.hidden = true; lock = false; lastChosenStrategy = null;
    taskAttemptCount = 0; helpUsedThisTask = current.isRetry ? ['wiederholung'] : [];
    el.answer.disabled = false; el.keypad.querySelectorAll('button').forEach(b => b.disabled = false);
    el.strategyArea.hidden = level !== 3 || directActive();
    el.game.classList.toggle('no-viz', !animationOn);
    if (directActive()) addHelp('ohne-rechenschritte');
    el.taskText.style.display = ''; $('.equals').style.display = ''; el.answer.style.display = '';
    const zr = !!Core.LEVELS[level].zr100;
    el.pointsWrap.hidden = zr; el.placeBoard.hidden = !zr; el.zrSteps.hidden = true; el.zrChoice.hidden = true;
    setActiveInput(el.answer, current.x + current.y);
    if (zr) {
      animationToken++;
      zrStart(current);
    } else if (!animationOn) {
      animationToken++; clearDotPlacement();
    } else if (level === 3 && directActive()) {
      // Ohne Rechenschritte: Aufgabe zeigen, nach 1,5 s grün abdecken.
      showLevel3Direct(++animationToken);
    } else if (level === 3) {
      // Keep the static 20-cell field empty until a strategy button is selected.
      animationToken++;
      clearDotPlacement();
      $$('.dot').forEach(d => { d.className = 'dot'; d.style.opacity = ''; });
    } else animateIntro(current);
    taskStartAt = Date.now(); updateProgress();
  }
  async function animateIntro(task, showHelp = false) {
    const token = ++animationToken, x=task.x, y=task.y, diff=Math.abs(x-y);
    setDotsForLevel(x,y,level);
    if (level === 1 || level === 2) {
      if (diff <= 2) {
        if (diff === 2) {
          await sleep(1500); if(token!==animationToken) return;
          // Move one counter from the larger group into the next EMPTY red-row cell.
          // The original blue/red counts remain constant throughout the animation.
          const big=Math.max(x,y), small=Math.min(x,y);
          const groups = groupIndices(x,y);
          const movedIndex = groups.big[big-1];
          await moveCounterToCell(movedIndex, 2, small + 1, token, 900);
          if(token!==animationToken) return;
          // After moving one counter, both rows represent the same doubled
          // quantity. Frame all three (or more) counters in BOTH rows, not only
          // the receiving row. Use actual dot indices so x/y order is irrelevant.
          const doubled = small + 1;
          const topRowGroup = groups.big.slice(0, doubled).filter(i => i !== movedIndex);
          const bottomRowGroup = [...groups.small.slice(0, small), movedIndex];
          frameDotIndexes(el.redFrame, [...topRowGroup, ...bottomRowGroup]);
        } else {
          // For equal numbers or a difference of one, show the vertical grouping.
          { const groups=groupIndices(x,y); const paired=Math.min(x,y); frameDotIndexes(el.redFrame, [...groups.big.slice(0,paired), ...groups.small.slice(0,paired)]); }
        }
      } else {
        // Bigger addend first. Frame the part above five AND the smaller addend.
        const {big,small,excess,smallIndexes} = indexesForLargerRemainder(x,y);
        const extra=Math.max(0,big-5);
        // Roter Rahmen nur um den Teil über 5 (6 + 2 → 1 + 2); liegt nichts über 5, gibt es keinen Rahmen.
        if (big >= 5) frameDotIndexes(el.redFrame, [...excess, ...smallIndexes]);
        // The auxiliary calculation is deliberately hidden on the first display.
        // It is shown only after a wrong first answer, and never reveals the result.
        // Strategie „Zuerst den 5er weglassen“: erst den Rahmen (z. B. 6 + 2 → 1 + 2), dann + 5.
        if (showHelp) {
          if (big > 5) {
            el.labelTop.textContent = `${extra} + ${small}`;
            el.labelBottom.textContent = `${extra} + ${small} + 5`;
          } else if (big === 5) {
            // 5 + 2: Im Rahmen liegt nur der kleinere Summand, danach kommt der Fünfer dazu.
            el.labelTop.textContent = `${small}`;
            el.labelBottom.textContent = `${small} + 5`;
          } else {
            el.labelTop.textContent = `${big} + ${small}`;
            el.labelBottom.textContent = '';
          }
        }
      }
    }
    // Die gelbe Abdeckung folgt 2 s nach dem Ende der Darstellung bzw. Bewegung.
    if (token === animationToken) await coverAnimation(token);
    if (token===animationToken) {
      el.redFrame.style.opacity='0'; el.greenFrame.style.opacity='0';
      // Eine nach einem Fehlversuch gezeigte Hilfsrechnung bleibt sichtbar (sie liegt
      // außerhalb der Abdeckung und verrät das Ergebnis nicht).
      if (!showHelp) { el.labelTop.textContent=''; el.labelBottom.textContent=''; }
    }
  }
  function pickNext() {
    if (firstAttempts >= Core.LEVELS[level].count) return finishSession(false);
    // Retry queue is inserted after two further first-attempt tasks.
    const retry = retryQueue.shift();
    if (retry && retry.dueAt <= firstAttempts) {
      current = { ...retry.task, isRetry: true, sourceRecord: retry.record, firstErrorRecorded: true, record: retry.record };
    } else {
      if (retry) retryQueue.unshift(retry);
      if (index >= tasks.length) return finishSession(false);
      current = { ...tasks[index++], isRetry: false };
    }
    renderTask();
  }
  function scheduleCheck() {
    if (checkTimer) clearTimeout(checkTimer);
    if (!current || !activeInput || !activeInput.value || inputBlocked()) return;
    // Check only once every digit of the expected answer has been entered.
    if (activeInput.value.length !== activeExpected.length) return;
    // Level 1–3: 0,25 s; Level 4–6: automatische Prüfung nach 0,3 s.
    checkTimer = setTimeout(checkAnswer, Core.LEVELS[level].zr100 ? 300 : 250);
  }
  // Zählung (richtig/falsch/Zeit) läuft wie beim Minus-Spiel nur im Hintergrund.
  function bookkeepSolved(calculationSteps = []) {
    if (!current.isRetry) {
      firstAttempts++;
      if (!current.firstErrorRecorded) {
        correct++;
        taskRecords.push({ x: current.x, y: current.y, correct: true, firstAttemptWrong: false, seconds: (Date.now()-taskStartAt)/1000 });
      } else if (current.record) {
        current.record.seconds = (Date.now()-taskStartAt)/1000;
      }
    } else if (current.sourceRecord) current.sourceRecord.retrySolved = true;
    el.next.hidden = true; updateProgress(); updateCounters();
    emitLearning('task-complete', { ...taskInfo(current), isCorrect: !current.firstErrorRecorded && !current.isRetry, attemptNumber: taskAttemptCount,
      durationMs: Math.max(0, Date.now() - taskStartAt), calculationSteps, helpUsed: [...helpUsedThisTask] });
  }
  function bookkeepWrong() {
    if (!current.isRetry && !current.firstErrorRecorded) {
      current.firstErrorRecorded = true; wrong++;
      const rec = { x: current.x, y: current.y, correct: false, firstAttemptWrong: true, retrySolved: false, seconds: (Date.now()-taskStartAt)/1000 };
      taskRecords.push(rec);
      retryQueue.push({ task: { x: current.x, y: current.y }, record: rec, dueAt: firstAttempts + 3 });
    }
    updateCounters();
  }
  function goToNextTask() {
    if (firstAttempts >= Core.LEVELS[level].count) finishSession(false); else pickNext();
  }
  function checkAnswer() {
    checkTimer = null;
    if (Core.LEVELS[level].zr100) return zrCheck();
    if (!current || lock || !el.answer.value) return;
    const value = Number(el.answer.value);
    const isRight = value === current.x + current.y;
    taskAttemptCount++;
    emitLearning('attempt', { ...taskInfo(current), givenAnswer: String(value), isCorrect: isRight, attemptNumber: taskAttemptCount,
      durationMs: Math.max(0, Date.now() - taskStartAt), calculationSteps: [], helpUsed: [...helpUsedThisTask] });
    if (isRight) {
      el.answer.classList.remove('bad'); el.answer.classList.add('ok'); lock = true; el.answer.disabled = true;
      el.feedback.textContent = level === 3 ? '' : 'Richtig!';
      bookkeepSolved();
      // The next task (or the result) appears automatically after a short pause.
      const token = ++animationToken;
      setTimeout(() => {
        if (token !== animationToken || !lock) return;
        if (firstAttempts >= Core.LEVELS[level].count) finishSession(false);
        else pickNext();
      }, 250);
    } else {
      el.answer.classList.remove('ok'); el.answer.classList.add('bad');
      bookkeepWrong();
      el.answer.value = '';
      addHelp(level === 3 ? 'hilfe-strategie' : 'hilfsrechnung');
      el.feedback.textContent = level === 3 ? '' : 'Versuche es noch einmal.';
      const token = ++animationToken;
      if (!animationOn) { /* keine Darstellung */ }
      else if (level === 3) { if (directActive()) showLevel3Direct(token); else runStrategyHelp(current, token); }
      else animateIntro(current, true);
    }
  }
  // Level 3: Strategie-Animation ohne Hilfsrechnungen und Kommentare. 1,5 s nach dem Ende
  // der Animation wird das Zwanzigerfeld grün abgedeckt (wie die Felder in Level 4–6).
  async function runStrategyAnimation(name, token) {
    const x = current.x, y = current.y;
    el.fadeMask.classList.add('green-cover'); el.fadeMask.style.opacity = '0';
    el.labelTop.textContent = ''; el.labelBottom.textContent = ''; el.strategyHint.textContent = '';
    setDotsForLevel(x, y, 3); if (token !== animationToken) return;
    if (name === 'double') {
      const smaller = Math.min(x,y); const groups = groupIndices(x,y);
      frameDotIndexes(el.redFrame, [...groups.big.slice(0,smaller), ...groups.small.slice(0,smaller)]);
      if (Math.abs(x-y) === 1) markPlusOne(groups.big[smaller]);
    } else if (name === 'hand') {
      const {five:fiveIndices,rest:restIndices} = handGroups(x,y);
      frameDotIndexes(el.redFrame, fiveIndices); frameDotIndexes(el.greenFrame, restIndices);
    } else if (name === 'nine') {
      const {nineGroup,donor:donorIndex}=arrangeNine(x,y);
      await moveCounterToCell(donorIndex, 1, 10, token, 900);
      if(token!==animationToken) return;
      frameDotIndexes(el.redFrame, [...nineGroup, donorIndex]);
    } else if (name === 'ten') {
      // 10er-Stopp: Alle ergänzenden Plättchen bewegen sich gleichzeitig in die erste Zeile.
      const big = Math.max(x,y), transfer = 10-big, groups = groupIndices(x,y);
      const moves = [];
      // Reihenfolge bleibt erhalten (linkes Plättchen → linkes Ziel), damit sich die Wege nicht kreuzen.
      const sources = groups.small.slice(groups.small.length - transfer);
      sources.forEach((src, i) => moves.push(moveCounterToCell(src, 1, big+i+1, token, 900)));
      await Promise.all(moves);
      if(token!==animationToken) return;
      frameRow(el.redFrame, 1);
    } else if (name === 'giant') {
      groupIndices(x,y).big.slice(0,10).forEach(i => { $$('.dot')[i].style.opacity='.24'; });
    }
    await sleep(1500);
    if (token !== animationToken) return;
    el.fadeMask.style.opacity = '1';
  }
  async function runStrategyHelp(task, token) {
    // Nach einem falschen Erstversuch: Abdeckung weg, gewählte Strategie noch einmal zeigen.
    if (!lastChosenStrategy) return;
    await runStrategyAnimation(lastChosenStrategy, token);
  }
  async function chooseStrategy(name, button) {
    if (level !== 3 || !current || lock) return;
    if (!Core.strategyValidity(name, current.x, current.y)) {
      // Unpassende Strategie: Button wird kurz rot, ohne Text.
      const b = button || document.querySelector(`.strategy-btn[data-strategy="${name}"]`);
      if (b) { b.classList.remove('wrong'); void b.offsetWidth; b.classList.add('wrong'); setTimeout(() => b.classList.remove('wrong'), 1000); }
      addHelp('fehlwahl'); return;
    }
    lastChosenStrategy = name; addHelp(`strategie-${name}`);
    const token = ++animationToken;
    await runStrategyAnimation(name, token);
  }
  function formatTime(seconds) { const s = Math.max(0, Math.floor(seconds)); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; }
  function makeStars() {
    const rain = document.createElement('div'); rain.className = 'star-rain'; rain.setAttribute('aria-hidden','true');
    for (let i=0; i<36; i++) { const star = document.createElement('span'); star.textContent = '★'; star.style.left = `${(i*37)%100}%`; star.style.animationDelay = `${(i%9)*.08}s`; rain.append(star); }
    document.body.append(rain); starsTimer = setTimeout(() => { rain.remove(); starsTimer = null; }, 3000);
  }
  function finishSession(early) {
    clearTimers(); animationToken++; ZR.token++; window.speechSynthesis?.cancel(); endPlatformSession();
    const elapsed = (Date.now()-startAt)/1000;
    el.game.hidden = true; el.result.hidden = false; el.resultScore.textContent = `${correct} von ${firstAttempts} (${Core.LEVELS[level].count}) Aufgaben richtig.`;
    // If completed normally, firstAttempts equals the configured number; for early exit show the actual assessed count.
    el.resultTime.textContent = `Zeit: ${formatTime(elapsed)}`;
    el.resultDetails.textContent = `${wrong} beim ersten Versuch falsch · ${taskRecords.length} bewertete Erstversuche${early ? ' · vorzeitig beendet' : ''}`;
    el.celebration.textContent = ''; el.celebration.className = 'celebration';
    const blockSize = Core.LEVELS[level].count;
    if (!early && firstAttempts >= blockSize && correct >= blockSize - 1) {
      makeStars(); el.celebration.textContent = '★ ★ ★';
    } else if (!early && firstAttempts >= blockSize && correct >= blockSize - 3 && correct <= blockSize - 2) {
      el.celebration.innerHTML = '<span class="thumb">👍</span>';
    }
    // Expose a session payload for future authenticated platform integration; nothing is sent externally.
    window.lastPlusSession = { level, startedAt: new Date(startAt).toISOString(), durationSeconds: elapsed, firstAttempts, correct, wrong, tasks: taskRecords.map(t => ({...t})) };
  }
  function startSession(newLevel = level) {
    clearTimers(); ZR.token++; window.speechSynthesis?.cancel(); endPlatformSession(); level = newLevel;
    tasks = Core.buildTaskBlock(level); index = 0; current = null; firstAttempts = 0; correct = 0; wrong = 0; taskRecords = []; retryQueue = []; startAt = Date.now(); taskStartAt = startAt;
    sessionActive = true; updateCounters();
    emitLearning('session-start', { level, roundTaskCount: Core.LEVELS[level].count, startedAt: startAt });
    el.result.hidden = true; el.game.hidden = false; el.strategyArea.hidden = level !== 3; el.next.hidden = true;
    $$('.level-btn').forEach(b => b.classList.toggle('active', Number(b.dataset.level) === level));
    updateModeButtons(); pickNext(); fitToScreen();
  }
  async function showLevel3Direct(token) {
    setDotsForLevel(current.x, current.y, 3); el.fadeMask.classList.add('green-cover');
    await sleep(1500); if (token !== animationToken) return;
    el.fadeMask.style.opacity = '1';
  }
  function updateModeButtons() {
    if (el.anim) { el.anim.classList.toggle('active', animationOn); el.anim.setAttribute('aria-pressed', String(animationOn)); }
    if (el.direct) {
      const available = DIRECT_LEVELS.includes(level);
      el.direct.disabled = !available;
      el.direct.classList.toggle('active', available && directMode);
      el.direct.setAttribute('aria-pressed', String(available && directMode));
    }
  }
  // Die laufende Rechnung beginnt in der neuen Form von vorne (keine neue Rechnung).
  function restartCurrentTask() {
    updateModeButtons();
    if (!current || el.game.hidden) return;
    clearTimers(); if (checkTimer) { clearTimeout(checkTimer); checkTimer = null; }
    ZR.token++; animationToken++;
    renderTask(); requestAnimationFrame(fitAll);
  }
  function toggleAnimation() { animationOn = !animationOn; restartCurrentTask(); }
  function toggleDirect() {
    if (!DIRECT_LEVELS.includes(level)) return;
    directMode = !directMode;
    if (directMode) animationOn = false;
    restartCurrentTask();
  }
  function leaveSession() { if (firstAttempts === 0 && !current) return; finishSession(true); }
  function fitToScreen() {
    // Responsive CSS uses dynamic viewport units; this function only adjusts dot sizing to the actual board.
    const rect = el.pointsWrap.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dotSize = Math.max(5, Math.min(24, Math.min(rect.width/13, rect.height/2.7)));
    document.documentElement.style.setProperty('--dot', `${dotSize}px`);
  }
  function fitAll() { fitToScreen(); if (Core.LEVELS[level].zr100) { zrLayoutAll(); zrFitButtons(); } }
  function bind() {
    $$('.level-btn').forEach(b => b.addEventListener('click', () => startSession(Number(b.dataset.level))));
    el.keypad.addEventListener('click', e => {
      const btn = e.target.closest('[data-key]'); if (!btn || !current || !activeInput || inputBlocked()) return;
      const key = btn.dataset.key, input = activeInput;
      if (key === 'clear') input.value = '';
      else if (key === 'back') input.value = input.value.slice(0,-1);
      else if (input.value.length < activeExpected.length && /^\d$/.test(key)) input.value += key;
      input.classList.remove('ok','bad'); scheduleCheck();
    });
    $$('.strategy-btn').forEach(b => b.addEventListener('click', () => chooseStrategy(b.dataset.strategy, b)));
    el.next.addEventListener('click', () => { if (firstAttempts >= Core.LEVELS[level].count) finishSession(false); else pickNext(); });
    el.leave.addEventListener('click', leaveSession);
    el.anim?.addEventListener('click', toggleAnimation);
    el.direct?.addEventListener('click', toggleDirect);
    // Haus-Knopf (wie im Minus-Spiel): nur in der Plattform sichtbar. Sitzung beenden,
    // die Plattform speichert offene Ereignisse und wechselt zur Lern-Übersicht.
    if (el.home) {
      if (window.parent === window) el.home.hidden = true;
      el.home.addEventListener('click', () => {
        clearTimers(); animationToken++; ZR.token++; window.speechSynthesis?.cancel();
        endPlatformSession(); emitLearning('exit', {});
      });
    }
    if (el.fullscreen) {
      el.fullscreen.addEventListener('click', toggleFullscreen);
      document.addEventListener('fullscreenchange', updateFullscreenButton);
      document.addEventListener('webkitfullscreenchange', updateFullscreenButton);
      updateFullscreenButton();
    }
    el.again.addEventListener('click', () => startSession(level));
    el.resultLevel.addEventListener('click', () => { el.result.hidden = true; el.game.hidden = false; el.taskText.textContent = 'Wähle oben ein Level.'; el.answer.value = ''; });
    window.addEventListener('resize', () => requestAnimationFrame(fitAll), {passive:true});
    window.addEventListener('orientationchange', () => setTimeout(fitAll,100), {passive:true});
    if (window.visualViewport) window.visualViewport.addEventListener('resize', () => requestAnimationFrame(fitAll), {passive:true});
  }
  // ======================================================================
  // Level 4–6 (Zahlenraum 100): gelbes Feld = 1. Summand, blaues Feld = 2. Summand,
  // grünes Feld unten = Summe. Zehnerstangen und Einerwürfel wie im Minus-Spiel.
  // Abdeckungen liegen über Gelb/Blau; bewegte Blöcke laufen UNTER der Abdeckung
  // hervor (z-Ebene zwischen Feld und Abdeckung) und behalten ihre Farbe.
  // ======================================================================
  const ZR = { token: 0, busy: false, items: [], state: null, stepIndex: 0, steps: [], pending: null, buttons: [], green: { rods: 0, ones: 0 }, covered: { yellow: false, blue: false, green: false }, shown: { yellow: false, blue: false } };
  const ZR_MOVE_MS = 1300, ZR_GREEN_ROD_COLS = 9;
  const zrTens = (n) => Math.floor(n / 10), zrOnes = (n) => n % 10;
  function zrBuildBoard() {
    const b = el.placeBoard; b.innerHTML = '';
    for (const f of ['yellow', 'blue', 'green']) { const d = document.createElement('div'); d.className = `pf pf-${f}`; d.dataset.field = f; b.append(d); }
    for (const f of ['yellow', 'blue', 'green']) { const c = document.createElement('div'); c.className = `pf-cover pf-cover-${f}`; c.dataset.cover = f; b.append(c); }
    ZR.items = []; ZR.green = { rods: 0, ones: 0 }; ZR.covered = { yellow: false, blue: false, green: false }; ZR.shown = { yellow: false, blue: false };
  }
  function zrGeom() {
    const W = el.placeBoard.clientWidth, H = el.placeBoard.clientHeight;
    const gap = Math.max(8, Math.min(18, W * 0.03));
    // Oben je Feld: bis 9 Stangen + 1 Einerspalte; unten: 9 Stangen + 2 Einerspalten.
    // Spalten: Stangen bzw. Einer, nach der 5. Spalte ein zusätzlicher Abstand (0,7 c).
    const byTop = ((W - gap) / 2) / (10 * 1.5 + 0.7 + 0.7);
    const byGreen = W / ((ZR_GREEN_ROD_COLS + 2) * 1.5 + 0.7 + 1.2);
    const byH = (H - gap) / (2 * (10 * 1.12 + 0.5 + 1.2));
    const c = Math.max(6, Math.min(byTop, byGreen, byH, 26));
    const pad = c * 0.6, pitch = c * 1.5, vPitch = c * 1.12, gap5 = c * 0.5, colGap5 = c * 0.7;
    const fieldH = 9 * vPitch + c + gap5 + 2 * pad;
    const topW = (W - gap) / 2;
    const totalH = 2 * fieldH + gap, oy = Math.max(0, (H - totalH) / 2);
    const gW = Math.min(W, (ZR_GREEN_ROD_COLS + 2) * pitch + colGap5 + 2 * pad);
    return { c, pad, pitch, vPitch, gap5, colGap5, fields: {
      yellow: { x: 0, y: oy, w: topW, h: fieldH },
      blue: { x: topW + gap, y: oy, w: topW, h: fieldH },
      green: { x: (W - gW) / 2, y: oy + fieldH + gap, w: gW, h: fieldH } } };
  }
  function zrSlotPos(g, item) {
    const f = g.fields[item.field], s = item.slot;
    let col, row = 0;
    if (item.kind === 'rod') col = s.i;
    else { col = s.col + (item.field === 'green' ? Math.floor(s.k / 10) : 0); row = s.k % 10; }
    const x = f.x + g.pad + col * g.pitch + (col >= 5 ? g.colGap5 : 0);
    const y = f.y + g.pad + row * g.vPitch + (row >= 5 ? g.gap5 : 0);
    return { x, y };
  }
  function zrPlace(item, g, animate) {
    const p = zrSlotPos(g, item), st = item.el.style;
    st.transition = animate ? `left ${ZR_MOVE_MS}ms ease-in-out, top ${ZR_MOVE_MS}ms ease-in-out` : 'none';
    st.left = `${p.x}px`; st.top = `${p.y}px`;
    st.width = `${item.kind === 'rod' ? g.c * 1.1 : g.c}px`;
    st.height = `${item.kind === 'rod' ? 9 * g.vPitch + g.c + g.gap5 : g.c}px`;
    if (item.kind === 'rod') { st.setProperty('--cube', `${g.c * 0.78}px`); st.setProperty('--gap', `${g.vPitch - g.c * 0.78}px`); st.setProperty('--gap5', `${g.gap5 + g.vPitch - g.c * 0.78}px`); }
  }
  function zrLayoutAll() {
    if (el.placeBoard.hidden || !el.placeBoard.clientWidth) return;
    const g = zrGeom();
    for (const f of ['yellow', 'blue', 'green']) {
      const r = g.fields[f], d = el.placeBoard.querySelector(`[data-field="${f}"]`); if (!d) continue;
      // (Abdeckungen liegen deckungsgleich über allen drei Feldern.)
      Object.assign(d.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
      const c = el.placeBoard.querySelector(`[data-cover="${f}"]`);
      if (c) Object.assign(c.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
    }
    ZR.items.forEach(it => zrPlace(it, g, false));
  }
  function zrMakeItem(kind, field, slot) {
    const d = document.createElement('div');
    d.className = `pv-${kind} pv-from-${field}`;
    if (kind === 'rod') for (let i = 0; i < 10; i++) d.append(document.createElement('span'));
    el.placeBoard.append(d);
    const item = { el: d, kind, origin: field, field, slot };
    ZR.items.push(item); return item;
  }
  function zrShowSummand(field, value) {
    const t = zrTens(value), e = zrOnes(value);
    for (let i = 0; i < t; i++) zrMakeItem('rod', field, { i });
    for (let k = 0; k < e; k++) zrMakeItem('cube', field, { col: t, k });
    ZR.shown[field] = true; zrLayoutAll();
  }
  function zrCoverEl(field) { return el.placeBoard.querySelector(`[data-cover="${field}"]`); }
  function zrCover(field) { ZR.covered[field] = true; const c = zrCoverEl(field); if (c) c.classList.add('on'); }
  function zrUncover(field) { ZR.covered[field] = false; const c = zrCoverEl(field); if (c) c.classList.remove('on'); }
  // Fehlwahl: betroffene Felder 1 s aufdecken, damit das Kind sieht, welche Einheiten noch da sind.
  function zrPeek(fields) {
    const token = ZR.token;
    const toPeek = fields.filter(f => ZR.covered[f]);
    toPeek.forEach(f => { const c = zrCoverEl(f); if (c) c.classList.remove('on'); });
    setTimeout(() => { if (token !== ZR.token) return; toPeek.forEach(f => { if (ZR.covered[f]) { const c = zrCoverEl(f); if (c) c.classList.add('on'); } }); }, 1000);
  }
  // Ein Block (Zehner und/oder Einer eines Feldes) wandert gemeinsam ins grüne Feld.
  async function zrMoveBlock(move, token) {
    if (!move.tens && !move.ones) return true;
    const g = zrGeom();
    const rods = ZR.items.filter(it => it.field === move.src && it.kind === 'rod').slice(0, move.tens);
    // Bei einer Ergänzung werden die untersten Einerwürfel genommen; die übrigen bleiben liegen.
    const cubes = ZR.items.filter(it => it.field === move.src && it.kind === 'cube').sort((a, b) => b.slot.k - a.slot.k).slice(0, move.ones).reverse();
    if (rods.length !== move.tens || cubes.length !== move.ones) throw new Error('Material fehlt für die Bewegung');
    for (const it of rods) { it.field = 'green'; it.slot = { i: ZR.green.rods++ }; }
    for (const it of cubes) { it.field = 'green'; it.slot = { col: ZR_GREEN_ROD_COLS, k: ZR.green.ones++ }; }
    [...rods, ...cubes].forEach(it => { it.el.classList.add('moving'); zrPlace(it, g, true); });
    await sleep(ZR_MOVE_MS + 60);
    [...rods, ...cubes].forEach(it => it.el.classList.remove('moving'));
    return token === ZR.token;
  }
  async function zrRunMoves(moves, token) {
    // Die größere Anzahl bewegt sich zuerst – egal, ob sie zum 1. oder 2. Summanden gehört.
    moves = moves.map((m, i) => ({ m, i, v: m.tens * 10 + m.ones })).sort((a, b) => b.v - a.v || a.i - b.i).map(e => e.m);
    for (let i = 0; i < moves.length; i++) {
      if (!(await zrMoveBlock(moves[i], token))) return false;
      if (i < moves.length - 1) { await sleep(300); if (token !== ZR.token) return false; }
    }
    return true;
  }
  function zrPulseGreen() {
    // Signal nach richtiger Eingabe: die grüne Abdeckung wird 1 s durchsichtig.
    const gEl = ZR.covered.green ? zrCoverEl('green') : el.placeBoard.querySelector('[data-field="green"]'); if (!gEl) return;
    gEl.classList.remove('pulse'); void gEl.offsetWidth; gEl.classList.add('pulse');
    setTimeout(() => gEl.classList.remove('pulse'), 1000);
  }
  function zrShowMainAnswer(show) {
    el.equals.style.display = show ? '' : 'none'; el.answer.style.display = show ? '' : 'none';
  }
  async function zrStart(task) {
    const token = ++ZR.token; ZR.busy = true;
    ZR.direct = directActive(); const simple = level === 4 || ZR.direct;
    ZR.state = Core.initSteps(task.x, task.y); ZR.stepIndex = 0; ZR.steps = []; ZR.pending = null;
    el.zrSteps.innerHTML = ''; el.zrSteps.hidden = level === 4; el.zrChoice.hidden = true; el.zrButtons.innerHTML = '';
    zrShowMainAnswer(false); setActiveInput(null);
    zrBuildBoard(); zrLayoutAll();
    if (!animationOn) {
      // Ohne Animation: keine Darstellung, sofort rechnen.
      if (simple) { zrShowMainAnswer(true); setActiveInput(el.answer, task.x + task.y); }
      else { ZR.buttons = Core.stepButtonsForTask(task.x, task.y); zrShowChoices(); }
      ZR.busy = false; return;
    }
    // 1. Summand zeigen, nach 1,5 s abdecken; dann 2. Summand zeigen, nach 1,5 s abdecken.
    zrShowSummand('yellow', task.x); await sleep(1500); if (token !== ZR.token) return; zrCover('yellow');
    await sleep(400); if (token !== ZR.token) return;
    zrShowSummand('blue', task.y); await sleep(1500); if (token !== ZR.token) return; zrCover('blue');
    await sleep(400); if (token !== ZR.token) return;
    if (simple) {
      const ok = await zrRunMoves([{ src: 'yellow', tens: zrTens(task.x), ones: zrOnes(task.x) }, { src: 'blue', tens: zrTens(task.y), ones: zrOnes(task.y) }], token);
      if (!ok) return;
      // Erst die Animation, nach 1,5 s grün abdecken; dann erscheint das Ergebnisfeld.
      await sleep(1500); if (token !== ZR.token) return; zrCover('green');
      zrShowMainAnswer(true); setActiveInput(el.answer, task.x + task.y); ZR.busy = false;
    } else { ZR.buttons = Core.stepButtonsForTask(task.x, task.y); zrShowChoices(); ZR.busy = false; }
  }
  function zrShowChoices() {
    el.zrChoice.hidden = false; el.zrButtons.innerHTML = '';
    el.zrChoiceTitle.textContent = `${ZR.stepIndex + 1}. Rechenschritt:`;
    // Alle Teilrechnungen, die in diesem Schritt auf irgendeinem Weg vorkommen – nur die Rechnung, keine Erklärung.
    for (const btn of (ZR.buttons[ZR.stepIndex] || [])) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'zr-step-btn'; b.dataset.label = btn.label; b.textContent = btn.label;
      b.addEventListener('click', () => zrChoose(btn, b));
      el.zrButtons.append(b);
    }
    zrFitButtons();
  }
  // Alle Buttons stehen in einer Zeile: Schrift so groß wie möglich, aber ohne abgeschnittene Rechnungen.
  function zrFitButtons() {
    const btns = [...el.zrButtons.children]; if (!btns.length || el.zrChoice.hidden) return;
    let size = 18; el.zrButtons.style.setProperty('--zr-font', `${size}px`);
    while (size > 9 && btns.some(b => b.scrollWidth > b.clientWidth + 1)) { size -= 1; el.zrButtons.style.setProperty('--zr-font', `${size}px`); }
  }
  async function zrChoose(btn, button) {
    if (ZR.busy || !current) return;
    const plan = Core.planByLabel(ZR.state, btn.label);
    if (!plan) {
      // Weg funktioniert nicht: Button rot, betroffene Felder 1 s aufdecken. Kein Fehler in der Wertung.
      addHelp('fehlwahl');
      button.classList.remove('wrong'); void button.offsetWidth; button.classList.add('wrong');
      setTimeout(() => button.classList.remove('wrong'), 1000);
      if (animationOn) zrPeek(btn.sources);
      return;
    }
    const token = ZR.token; ZR.busy = true; el.feedback.textContent = '';
    addHelp(`weg-${plan.type}`); el.zrChoice.hidden = true;
    // Führt der Schritt zum Endergebnis, erscheint auch bei der Startrechnung ein Ergebnisfeld.
    if (plan.final) zrShowMainAnswer(true);
    // Grün aufdecken, Blöcke bewegen, nach 1,5 s wieder abdecken (nur mit Animation).
    if (animationOn) {
      if (ZR.covered.green) { zrUncover('green'); await sleep(350); if (token !== ZR.token) return; }
      if (!(await zrRunMoves(plan.moves, token))) return;
      await sleep(1500); if (token !== ZR.token) return;
      zrCover('green');
    }
    ZR.pending = plan;
    const row = document.createElement('div'); row.className = 'zr-step';
    row.innerHTML = `<span class="zr-step-calc">${plan.label} =</span>`;
    const input = document.createElement('input');
    Object.assign(input, { className: 'answer-input zr-step-input', readOnly: true, inputMode: 'none', autocomplete: 'off' });
    input.setAttribute('aria-label', `Ergebnis von ${plan.label}`);
    row.append(input); el.zrSteps.append(row); el.zrSteps.hidden = false;
    setActiveInput(input, plan.result); ZR.busy = false;
  }
  function zrCalcSteps() { return ZR.steps.map((p, i) => ({ step: i + 1, delta: p.terms[1], label: p.label })); }
  function zrCheck() {
    const input = activeInput; if (!input || ZR.busy || !current) return;
    const token = ZR.token, expected = activeExpected, given = input.value, right = given === expected;
    ZR.busy = true; taskAttemptCount++;
    const stepNo = (level === 4 || ZR.direct) ? null : ZR.stepIndex + 1;
    const stepsForLog = right && ZR.pending ? [...zrCalcSteps(), { step: ZR.steps.length + 1, delta: ZR.pending.terms[1], label: ZR.pending.label }] : zrCalcSteps();
    emitLearning('attempt', { ...taskInfo(current), givenAnswer: given, expectedAnswer: expected, isCorrect: right, attemptNumber: taskAttemptCount,
      durationMs: Math.max(0, Date.now() - taskStartAt), calculationSteps: stepsForLog, helpUsed: [...helpUsedThisTask], stepIndex: stepNo });
    // Feld wird grün (richtig) oder rot (falsch) und nach 0,5 s zurückgesetzt.
    input.classList.add(right ? 'ok' : 'bad');
    if (!right) {
      bookkeepWrong(); el.feedback.textContent = 'Versuche es noch einmal.';
      setTimeout(() => { if (token !== ZR.token) return; input.classList.remove('bad'); input.value = ''; el.feedback.textContent = ''; ZR.busy = false; }, 500);
      return;
    }
    const finalStep = level === 4 || ZR.direct || (ZR.pending && ZR.pending.final);
    if (ZR.pending) { ZR.steps.push(ZR.pending); ZR.state = ZR.pending.next; }
    setTimeout(async () => {
      if (token !== ZR.token) return;
      input.classList.remove('ok'); input.classList.add('done');
      // Grünes Feld wird als Signal 1 s durchsichtig.
      zrPulseGreen();
      if (finalStep) {
        if (level !== 4 && !ZR.direct) { el.answer.value = String(current.x + current.y); el.answer.classList.add('done'); }
        bookkeepSolved(zrCalcSteps());
        await sleep(1000); if (token !== ZR.token) return;
        goToNextTask(); // neue Rechnung nach insgesamt 1,5 s
      } else {
        ZR.pending = null; ZR.stepIndex++; setActiveInput(null);
        await sleep(1000); if (token !== ZR.token) return;
        zrShowChoices(); ZR.busy = false;
      }
    }, 500);
  }
  // Small read-only test hook for automated QA; no gameplay state is changed.
  window.__plusLernspielQA = {
    async runIntroForTest(x, y, levelNumber = 1, showHelp = false) {
      level = levelNumber;
      current = { x, y };
      animationToken++;
      await animateIntro({ x, y }, showHelp);
    },
    async runStrategyForTest(x, y, strategy) {
      level = 3; lock = false;
      current = { x, y };
      await chooseStrategy(strategy);
    },
    async runStrategyHelpForTest(x, y, strategy) {
      level = 3; current = { x, y }; lastChosenStrategy = strategy;
      await runStrategyHelp(current, ++animationToken);
    },
    startTaskForTest(levelNumber, x, y) {
      startSession(levelNumber); ZR.token++;
      current = { x, y, isRetry: false }; renderTask();
    },
    zr() {
      const b = el.placeBoard.getBoundingClientRect(), rect = (n) => { const r = n.getBoundingClientRect(); return { l: r.left - b.left, t: r.top - b.top, r: r.right - b.left, b: r.bottom - b.top }; };
      const fields = {}; for (const f of ['yellow','blue','green']) { const n = el.placeBoard.querySelector(`[data-field="${f}"]`); if (n) fields[f] = rect(n); }
      const covers = {}; for (const f of ['yellow','blue','green']) { const n = el.placeBoard.querySelector(`[data-cover="${f}"]`); if (n) covers[f] = { ...rect(n), op: getComputedStyle(n).opacity }; }
      return { busy: ZR.busy, stepIndex: ZR.stepIndex, state: ZR.state && JSON.parse(JSON.stringify(ZR.state)), fields, covers,
        items: ZR.items.map(it => ({ kind: it.kind, origin: it.origin, field: it.field, cls: it.el.className, ...rect(it.el) })),
        remNow: ZR.pending ? { ...ZR.pending.next.rem } : ZR.state ? { ...ZR.state.rem } : null,
        expected: activeExpected, active: activeInput === el.answer ? 'main' : activeInput ? 'step' : null,
        buttons: [...el.zrButtons.querySelectorAll('button')].map(b => ({ label: b.dataset.label, wrong: b.classList.contains('wrong') })), choiceVisible: !el.zrChoice.hidden,
        mainVisible: el.answer.style.display !== 'none', mainValue: el.answer.value, task: current && { x: current.x, y: current.y } };
    },
    labels() { return { top: el.labelTop.textContent, bottom: el.labelBottom.textContent, hint: el.strategyHint.textContent, mask: el.fadeMask.style.opacity }; },
    inspectBoard() {
      const dots = $$('.dot').filter(d => d.classList.contains('red') || d.classList.contains('blue') || d.classList.contains('green'));
      const items = dots.map(d => ({index:Number(d.dataset.index), color:d.classList.contains('red')?'red':d.classList.contains('blue')?'blue':'green', row:Number(d.style.gridRow), col:Number(d.style.gridColumn), rect:(()=>{const r=d.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};})()}));
      const board=el.pointsField.getBoundingClientRect();
      return {count:items.length, items, board:{left:board.left,top:board.top,right:board.right,bottom:board.bottom}, outside:items.filter(d=>!d.row||!d.col||d.row<1||d.row>2||d.col<1||d.col>11||d.col===6||d.rect.left<board.left-2||d.rect.right>board.right+2||d.rect.top<board.top-2||d.rect.bottom>board.bottom+2).map(d=>d.index)};
    }
  };
  buildDots(); bind(); startSession(1);
})();
