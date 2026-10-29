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
    3: { label: 'ZR 20', count: 20, minSum: 10, maxSum: 20 }
  };
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
    return !!cfg && Number.isInteger(t.x) && Number.isInteger(t.y) && t.x >= 1 && t.y >= 1 &&
      t.x + t.y >= cfg.minSum && t.x + t.y <= cfg.maxSum;
  }
  function enumerateTasks(level) {
    const cfg = LEVELS[level];
    if (!cfg) throw new Error(`Unbekanntes Level: ${level}`);
    const tasks = [];
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
    const selected = shuffle(all, random).slice(0, cfg.count);
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
      case 'nine': return x === 9 || y === 9;
      case 'ten': return sum > 10 && smaller < 10 && larger < 10;
      case 'giant': return x >= 10 || y >= 10;
      default: return false;
    }
  }
  return { LEVELS, shuffle, taskKey, isAllowedTask, enumerateTasks, buildTaskBlock, strategyValidity };
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
    resultTime: $('#resultTime'), resultDetails: $('#resultDetails'), celebration: $('#resultCelebration'), again: $('#againBtn'), resultLevel: $('#resultLevelBtn')
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
    el.pointsField.replaceChildren();
    for (let i = 0; i < 20; i++) {
      const dot = document.createElement('span'); dot.className = 'dot'; dot.dataset.index = String(i); el.pointsField.append(dot);
    }
  }
  function resetBoard() {
    $$('.dot').forEach(d => { d.className = 'dot'; d.style.opacity = ''; d.style.transform = ''; });
    [el.redFrame, el.greenFrame].forEach(f => { f.style.opacity = '0'; f.style.left = ''; f.style.top = ''; f.style.width = ''; f.style.height = ''; });
    el.fadeMask.style.opacity = '0'; el.labelTop.textContent = ''; el.labelBottom.textContent = '';
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
  function updateProgress() {
    const total = Core.LEVELS[level].count;
    el.progressText.textContent = `Aufgabe ${Math.min(firstAttempts + 1, total)} von ${total}`;
    el.progressDots.textContent = '●'.repeat(firstAttempts) + '○'.repeat(Math.max(0, total - firstAttempts));
  }
  function renderTask() {
    if (!current) return;
    resetBoard(); el.taskText.textContent = `${current.x} + ${current.y}`; el.answer.value = ''; el.answer.classList.remove('ok','bad');
    el.feedback.textContent = ''; el.strategyHint.textContent = ''; el.next.hidden = true; lock = false; lastChosenStrategy = null;
    el.answer.disabled = false; el.keypad.querySelectorAll('button').forEach(b => b.disabled = false);
    el.strategyArea.hidden = level !== 3;
    el.taskText.style.display = ''; $('.equals').style.display = ''; el.answer.style.display = '';
    if (level === 3) {
      setDots(current.x, current.y);
      // Strategies are always available; applicability is explained with spoken feedback.
    } else animateIntro(current);
    taskStartAt = Date.now(); updateProgress();
  }
  async function animateIntro(task) {
    const token = ++animationToken; setDots(task.x, task.y); await sleep(120);
    if (token !== animationToken) return;
    if (level === 1) {
      if (Math.abs(task.x-task.y) <= 1) {
        frameDots(el.redFrame, 0, Math.min(task.x,task.y)); await sleep(850);
      } else if (Math.abs(task.x-task.y) === 2) {
        const big = Math.max(task.x,task.y), small = Math.min(task.x,task.y);
        const dots = $$('.dot');
        const bigIsRed = task.x > task.y;
        const movingDot = dots[(bigIsRed ? task.x : task.x + task.y) - 1];
        if (movingDot) { movingDot.classList.add('moving'); movingDot.style.transform = 'translate(0,-8px)'; }
        el.labelTop.textContent = `${big} → ${big-1} + ${small+1}`; await sleep(650);
        if (movingDot) { movingDot.classList.remove('moving'); movingDot.style.transform = ''; }
        frameDots(el.redFrame, 0, small+1); await sleep(850);
      }
    } else if (level === 2) {
      if (task.x === 5 || task.y === 5) {
        el.labelTop.textContent = '5'; el.labelBottom.textContent = String(task.x === 5 ? task.y : task.x); await sleep(800);
      } else if (task.x > 5 || task.y > 5) {
        frameDots(el.redFrame, 5, 5); await sleep(850);
      } else if (Math.abs(task.x-task.y) <= 2) {
        frameDots(el.redFrame, 0, Math.min(task.x,task.y)); await sleep(850);
      }
    }
    if (token === animationToken) { el.redFrame.style.opacity = '0'; el.labelTop.textContent = ''; el.labelBottom.textContent = ''; }
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
    if (!el.answer.value || lock || el.answer.disabled || !current) return;
    // Check only once every digit of the expected answer has been entered.
    const requiredDigits = String(current.x + current.y).length;
    if (el.answer.value.length !== requiredDigits) return;
    checkTimer = setTimeout(checkAnswer, 250);
  }
  function checkAnswer() {
    checkTimer = null;
    if (!current || lock || !el.answer.value) return;
    const value = Number(el.answer.value);
    if (value === current.x + current.y) {
      el.answer.classList.remove('bad'); el.answer.classList.add('ok'); lock = true; el.answer.disabled = true;
      el.feedback.textContent = 'Richtig!';
      if (!current.isRetry) {
        firstAttempts++;
        if (!current.firstErrorRecorded) {
          correct++;
          taskRecords.push({ x: current.x, y: current.y, correct: true, firstAttemptWrong: false, seconds: (Date.now()-taskStartAt)/1000 });
        } else if (current.record) {
          current.record.seconds = (Date.now()-taskStartAt)/1000;
        }
      } else if (current.sourceRecord) current.sourceRecord.retrySolved = true;
      el.next.hidden = true; updateProgress();
      // The next task (or the result) appears automatically after a short pause.
      const token = ++animationToken;
      setTimeout(() => {
        if (token !== animationToken || !lock) return;
        if (firstAttempts >= Core.LEVELS[level].count) finishSession(false);
        else pickNext();
      }, 250);
    } else {
      el.answer.classList.remove('ok'); el.answer.classList.add('bad');
      if (!current.isRetry && !current.firstErrorRecorded) {
        current.firstErrorRecorded = true; wrong++;
        const rec = { x: current.x, y: current.y, correct: false, firstAttemptWrong: true, retrySolved: false, seconds: (Date.now()-taskStartAt)/1000 };
        taskRecords.push(rec);
        retryQueue.push({ task: { x: current.x, y: current.y }, record: rec, dueAt: firstAttempts + 3 });
      }
      el.answer.value = '';
      el.feedback.textContent = 'Versuche es noch einmal.';
      const token = ++animationToken;
      if (level === 3) runStrategyHelp(current, token);
      else animateIntro(current);
    }
  }
  async function runStrategyHelp(task, token) {
    const x = task.x, y = task.y, sum = x + y;
    setDots(x, y);
    await sleep(250);
    if (token !== animationToken) return;
    const strategy = lastChosenStrategy;
    // Nach einem falschen Erstversuch wird die gewählte Strategie als konkrete Rechenhilfe gezeigt.
    if (strategy === 'double' && Core.strategyValidity('double', x, y)) {
      const smaller = Math.min(x, y);
      frameDots(el.redFrame, 0, smaller);
      el.labelTop.textContent = `${smaller} + ${smaller}`;
      el.labelBottom.textContent = Math.abs(x-y) === 1 ? `+ 1 = ${sum}` : `= ${sum}`;
    } else if (strategy === 'hand' && Core.strategyValidity('hand', x, y)) {
      frameDots(el.redFrame, 0, 5);
      if (sum > 10) frameDots(el.greenFrame, 5, sum - 10);
      el.labelTop.textContent = '5 + 5 = 10';
      el.labelBottom.textContent = `${Math.max(0, x - 5)} + ${Math.max(0, y - 5)} = ${sum - 10}`;
    } else if (strategy === 'nine' && Core.strategyValidity('nine', x, y)) {
      const other = x === 9 ? y : x;
      el.labelTop.textContent = '9 + 1 = 10';
      el.labelBottom.textContent = `10 + ${other - 1} = ${sum}`;
    } else if (strategy === 'ten' && Core.strategyValidity('ten', x, y)) {
      const big = Math.max(x, y), small = Math.min(x, y), transfer = 10 - big;
      frameDots(el.redFrame, 0, 10);
      el.labelTop.textContent = `${big} + ${transfer} = 10`;
      el.labelBottom.textContent = `10 + ${small - transfer} = ${sum}`;
    } else if (strategy === 'giant' && Core.strategyValidity('giant', x, y)) {
      const big = Math.max(x, y), small = Math.min(x, y);
      el.labelTop.textContent = `${big - 10} + ${small} = ${big - 10 + small}`;
      el.labelBottom.textContent = `${big} + ${small} = ${sum}`;
      $$('.dot').slice(0, Math.min(10, big)).forEach(dot => dot.style.opacity = '.3');
    } else {
      el.labelBottom.textContent = `${x} + ${y} = ${sum}`;
    }
    await sleep(1500);
    if (token !== animationToken) return;
    resetBoard(); setDots(x, y);
    el.strategyHint.textContent = `Rechne: ${x} + ${y}.`;
  }
  async function chooseStrategy(name) {
    if (level !== 3 || !current || lock) return;
    const cfg = STRATEGIES[name];
    if (!Core.strategyValidity(name, current.x, current.y)) {
      el.strategyHint.textContent = cfg.invalid; el.feedback.textContent = cfg.invalid; speak(cfg.invalid); return;
    }
    el.strategyHint.textContent = cfg.name;
    lastChosenStrategy = name;
    const token = ++animationToken;
    const x = current.x, y = current.y, sum = x+y;
    setDots(x,y); await sleep(250); if (token !== animationToken) return;
    if (name === 'double') {
      const smaller = Math.min(x,y); frameDots(el.redFrame, 0, smaller); el.labelTop.textContent = `${smaller} + ${smaller}`;
      if (Math.abs(x-y) === 1) el.labelBottom.textContent = '+ 1';
      await sleep(1500);
      if (token !== animationToken) return;
      el.fadeMask.style.opacity = '.96'; await sleep(250); el.fadeMask.style.opacity = '0';
    } else if (name === 'hand') {
      frameDots(el.redFrame, 0, 5); frameDots(el.greenFrame, 5, Math.max(0,sum-10));
      el.labelTop.textContent = '5 + 5 = 10'; el.labelBottom.textContent = `${Math.max(0,x-5)} + ${Math.max(0,y-5)}`;
      await sleep(1500);
    } else if (name === 'nine') {
      const nine = x === 9 ? x : y, other = x === 9 ? y : x;
      setDots(10, Math.max(0,other-1)); el.labelTop.textContent = '10'; el.labelBottom.textContent = `${other} − 1`;
      await sleep(1500);
    } else if (name === 'ten') {
      const big = Math.max(x,y), small = Math.min(x,y), transfer = 10-big;
      setDots(Math.min(10,big+transfer), Math.max(0,small-transfer)); frameDots(el.redFrame, 0, 10); el.labelBottom.textContent = `${big} + ${transfer} + ${small-transfer}`;
      await sleep(1500);
    } else if (name === 'giant') {
      const big = Math.max(x,y), small = Math.min(x,y); setDots(big-10, small, { fadedStart: 0 });
      el.labelTop.textContent = `${big-10} + ${small}`; el.labelBottom.textContent = `${big} + ${small} = ${sum}`;
      await sleep(1500);
    }
    if (token !== animationToken) return;
    resetBoard(); setDots(x,y); el.strategyHint.textContent = `${cfg.name}: Jetzt rechne ${x} + ${y}.`;
  }
  function formatTime(seconds) { const s = Math.max(0, Math.floor(seconds)); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; }
  function makeStars() {
    const rain = document.createElement('div'); rain.className = 'star-rain'; rain.setAttribute('aria-hidden','true');
    for (let i=0; i<36; i++) { const star = document.createElement('span'); star.textContent = '★'; star.style.left = `${(i*37)%100}%`; star.style.animationDelay = `${(i%9)*.08}s`; rain.append(star); }
    document.body.append(rain); starsTimer = setTimeout(() => { rain.remove(); starsTimer = null; }, 3000);
  }
  function finishSession(early) {
    clearTimers(); animationToken++; window.speechSynthesis?.cancel();
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
    clearTimers(); window.speechSynthesis?.cancel(); level = newLevel;
    tasks = Core.buildTaskBlock(level); index = 0; current = null; firstAttempts = 0; correct = 0; wrong = 0; taskRecords = []; retryQueue = []; startAt = Date.now(); taskStartAt = startAt;
    el.result.hidden = true; el.game.hidden = false; el.strategyArea.hidden = level !== 3; el.next.hidden = true;
    $$('.level-btn').forEach(b => b.classList.toggle('active', Number(b.dataset.level) === level));
    pickNext(); fitToScreen();
  }
  function leaveSession() { if (firstAttempts === 0 && !current) return; finishSession(true); }
  function fitToScreen() {
    // Responsive CSS uses dynamic viewport units; this function only adjusts dot sizing to the actual board.
    const rect = el.pointsWrap.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dotSize = Math.max(5, Math.min(24, Math.min(rect.width/13, rect.height/2.7)));
    document.documentElement.style.setProperty('--dot', `${dotSize}px`);
  }
  function bind() {
    $$('.level-btn').forEach(b => b.addEventListener('click', () => startSession(Number(b.dataset.level))));
    el.keypad.addEventListener('click', e => {
      const btn = e.target.closest('[data-key]'); if (!btn || lock || el.answer.disabled) return;
      const key = btn.dataset.key;
      if (key === 'clear') el.answer.value = '';
      else if (key === 'back') el.answer.value = el.answer.value.slice(0,-1);
      else if (el.answer.value.length < String(current.x + current.y).length && /^\d$/.test(key)) el.answer.value += key;
      el.answer.classList.remove('ok','bad'); scheduleCheck();
    });
    $$('.strategy-btn').forEach(b => b.addEventListener('click', () => chooseStrategy(b.dataset.strategy)));
    el.next.addEventListener('click', () => { if (firstAttempts >= Core.LEVELS[level].count) finishSession(false); else pickNext(); });
    el.leave.addEventListener('click', leaveSession);
    el.again.addEventListener('click', () => startSession(level));
    el.resultLevel.addEventListener('click', () => { el.result.hidden = true; el.game.hidden = false; el.taskText.textContent = 'Wähle oben ein Level.'; el.answer.value = ''; });
    window.addEventListener('resize', () => requestAnimationFrame(fitToScreen), {passive:true});
    window.addEventListener('orientationchange', () => setTimeout(fitToScreen,100), {passive:true});
    if (window.visualViewport) window.visualViewport.addEventListener('resize', () => requestAnimationFrame(fitToScreen), {passive:true});
  }
  buildDots(); bind(); startSession(1);
})();
