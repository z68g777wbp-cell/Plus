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
    3: { label: 'ZR 20', count: 20, minSum: 11, maxSum: 20 }
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
    // The twenty empty cells are the static background. Counters are a separate overlay.
    el.pointsField.replaceChildren();
    for (let i = 0; i < 20; i++) {
      const cell = document.createElement('span');
      cell.className = 'field-cell';
      cell.setAttribute('aria-hidden', 'true');
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
    dot.style.gridColumn = String(col);
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
    placements.forEach(p => { placeDot(p.idx,p.row,p.col); dots[p.idx].classList.add(groups.x.includes(p.idx) ? 'blue' : 'red'); });
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
    let targetKey = `${targetRow},${targetCol}`;
    if (occupied.has(targetKey)) {
      let found = null;
      for (let r=1;r<=2 && !found;r++) for(let c=1;c<=10;c++) if(!occupied.has(`${r},${c}`)){found={r,c};break;}
      if (!found) return;
      targetRow=found.r; targetCol=found.c; targetKey=`${targetRow},${targetCol}`;
    }
    const layer = $('#pointsLayer');
    // Der tatsächliche Zielpunkt wird aus der entsprechenden Zelle des statischen
    // Zwanzigerfeldes gelesen. So stimmen Bewegung und CSS-Abstände exakt überein.
    const cell = el.pointsField.children[(targetRow - 1) * 10 + (targetCol - 1)];
    if (!cell) return;
    const targetRect = cell.getBoundingClientRect();
    const targetX = targetRect.left + targetRect.width / 2;
    const targetY = targetRect.top + targetRect.height / 2;
    const from = dot.getBoundingClientRect();
    const dx = targetX - (from.left + from.width / 2);
    const dy = targetY - (from.top + from.height / 2);
    dot.style.zIndex = '6';
    if (dot.animate) {
      const anim = dot.animate(
        [{ transform: 'translate(0,0)' }, { transform: `translate(${dx}px,${dy}px)` }],
        { duration, easing: 'ease-in-out', fill: 'forwards' }
      );
      await anim.finished.catch(() => {});
    } else {
      dot.style.transform = `translate(${dx}px,${dy}px)`;
      await sleep(duration);
    }
    if (token !== animationToken) return;
    dot.style.zIndex = '';
    dot.style.transform = '';
    dot.style.gridRow = String(targetRow);
    dot.style.gridColumn = String(targetCol);
  }
  async function coverAnimation(token) {
    await sleep(2000);
    if (token !== animationToken) return;
    // The yellow cover stays in place while the child solves the equation.
    el.fadeMask.style.opacity = '1';
  }
  function resetBoard() {
    clearDotNotes();
    $$('.dot').forEach(d => { d.className = 'dot'; d.style.opacity = ''; d.style.transform = ''; });
    [el.redFrame, el.greenFrame].forEach(f => { f.style.opacity = '0'; f.style.left = ''; f.style.top = ''; f.style.width = ''; f.style.height = ''; });
    el.fadeMask.style.opacity = '0'; el.labelTop.textContent = ''; el.labelBottom.textContent = ''; el.labelBottom.classList.remove('below-board');
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
    resetBoard(); el.taskText.textContent = `${current.x} + ${current.y}`; el.answer.value = ''; el.answer.classList.remove('ok','bad');
    el.feedback.textContent = ''; el.strategyHint.textContent = ''; el.next.hidden = true; lock = false; lastChosenStrategy = null;
    el.answer.disabled = false; el.keypad.querySelectorAll('button').forEach(b => b.disabled = false);
    el.strategyArea.hidden = level !== 3;
    el.taskText.style.display = ''; $('.equals').style.display = ''; el.answer.style.display = '';
    if (level === 3) {
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
        const indices = [...excess, ...smallIndexes];
        frameDotIndexes(el.redFrame, indices);
        // The auxiliary calculation is deliberately hidden on the first display.
        // It is shown only after a wrong first answer, and never reveals the result.
        if (showHelp) {
          if (big > 5) {
            el.labelTop.textContent = `${small} + ${extra}`;
            el.labelBottom.textContent = `${small} + ${extra} + 5`;
          } else {
            // With a five as the larger addend, no decomposition above five exists.
            el.labelTop.textContent = `${big} + ${small}`;
            el.labelBottom.textContent = '';
          }
        }
        await sleep(2000);
      }
    }
    if (token === animationToken) await coverAnimation(token);
    if (token===animationToken) {
      el.redFrame.style.opacity='0'; el.greenFrame.style.opacity='0';
      el.labelTop.textContent=''; el.labelBottom.textContent='';
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
      else animateIntro(current, true);
    }
  }
  async function runStrategyHelp(task, token) {
    const x = task.x, y = task.y, sum = x + y;
    setDotsForLevel(x, y, 3);
    await sleep(250);
    if (token !== animationToken) return;
    const strategy = lastChosenStrategy;
    // Nach einem falschen Erstversuch wird die gewählte Strategie als konkrete Rechenhilfe gezeigt.
    if (strategy === 'double' && Core.strategyValidity('double', x, y)) {
      const smaller = Math.min(x, y);
      const groups = groupIndices(x,y); frameDotIndexes(el.redFrame, [...groups.big.slice(0,smaller), ...groups.small.slice(0,smaller)]);
      el.labelTop.textContent = `${smaller} + ${smaller}`;
      if (Math.abs(x-y) === 1) markPlusOne(groupIndices(x,y).big[smaller]); el.labelBottom.textContent = '';
    } else if (strategy === 'hand' && Core.strategyValidity('hand', x, y)) {
      const {five:fiveIndices,rest:restIndices} = handGroups(x,y);
      frameDotIndexes(el.redFrame, fiveIndices);
      frameDotIndexes(el.greenFrame, restIndices);
      el.labelTop.textContent = '5 + 5';
      el.labelBottom.textContent = `${Math.max(0, x - 5)} + ${Math.max(0, y - 5)}`;
    } else if (strategy === 'nine' && Core.strategyValidity('nine', x, y)) {
      const other = x === 9 ? y : x;
      const {nineGroup,donor}=arrangeNine(x,y);
      await moveCounterToCell(donor,1,10,token,700);
      if(token!==animationToken) return;
      frameDotIndexes(el.redFrame,[...nineGroup,donor]);
      el.labelTop.textContent = '9 + 1';
      el.labelBottom.textContent = `10 + ${other - 1}`;
    } else if (strategy === 'ten' && Core.strategyValidity('ten', x, y)) {
      el.labelBottom.classList.add('below-board');
      const big = Math.max(x, y), small = Math.min(x, y), transfer = 10 - big;
      const groups=groupIndices(x,y);
      for(let i=0;i<transfer;i++){ await moveCounterToCell(groups.small[groups.small.length-1-i],1,big+i+1,token,550); if(token!==animationToken)return; }
      frameRow(el.redFrame, 1);
      el.labelTop.textContent = `${big} + ${transfer}`;
      el.labelBottom.textContent = `10 + ${small - transfer}`;
    } else if (strategy === 'giant' && Core.strategyValidity('giant', x, y)) {
      const big = Math.max(x, y), small = Math.min(x, y);
      el.labelTop.textContent = `${big - 10} + ${small}`;
      el.labelBottom.textContent = `${big} + ${small}`;
      groupIndices(x,y).big.slice(0,10).forEach(i => { $$('.dot')[i].style.opacity = '.3'; });
    } else {
      el.labelBottom.textContent = `${x} + ${y}`;
    }
    await sleep(2000);
    if (token !== animationToken) return;
    el.fadeMask.style.opacity = '1';
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
    setDotsForLevel(x,y,3); if (token !== animationToken) return;
    if (name === 'double') {
      const smaller = Math.min(x,y); const groups = groupIndices(x,y); frameDotIndexes(el.redFrame, [...groups.big.slice(0,smaller), ...groups.small.slice(0,smaller)]); el.labelTop.textContent = `${smaller} + ${smaller}`;
      if (Math.abs(x-y) === 1) markPlusOne(groupIndices(x,y).big[smaller]);
      await sleep(2000);
      if (token !== animationToken) return;
      
    } else if (name === 'hand') {
      const {five:fiveIndices,rest:restIndices} = handGroups(x,y);
      frameDotIndexes(el.redFrame, fiveIndices); frameDotIndexes(el.greenFrame, restIndices);
      el.labelTop.textContent = '5 + 5'; el.labelBottom.textContent = `${Math.max(0,x-5)} + ${Math.max(0,y-5)}`;
      await sleep(2000);
    } else if (name === 'nine') {
      const other = x === 9 ? y : x;
      const {nineGroup,donor:donorIndex}=arrangeNine(x,y);
      await moveCounterToCell(donorIndex, 1, 10, token, 900);
      if(token!==animationToken) return;
      frameDotIndexes(el.redFrame, [...nineGroup, donorIndex]); el.labelTop.textContent = '9 + 1'; el.labelBottom.textContent = `10 + ${other-1}`;
      await sleep(2000);
    } else if (name === 'ten') {
      const big = Math.max(x,y), small = Math.min(x,y), transfer = 10-big;
      const groups=groupIndices(x,y);
      const bigRow = 1;
      const bigCount = big;
      for(let i=0;i<transfer;i++) {
        const sourceIndex = groups.small[groups.small.length - 1 - i];
        await moveCounterToCell(sourceIndex, bigRow, bigCount+i+1, token, 650);
        if(token!==animationToken) return;
      }
      frameRow(el.redFrame, 1);
      // The 10er-Stopp auxiliary calculation is intentionally withheld until a wrong first attempt.
      el.labelTop.textContent = ''; el.labelBottom.textContent = '';
      await sleep(2000);
    } else if (name === 'giant') {
      const big = Math.max(x,y), small = Math.min(x,y); setDotsForLevel(x,y,3); groupIndices(x,y).big.slice(0,10).forEach(i => { $$('.dot')[i].style.opacity='.24'; });
      el.labelTop.textContent = `${big-10} + ${small}`; el.labelBottom.textContent = `${big} + ${small}`;
      await sleep(2000);
    }
    if (token !== animationToken) return;
    el.fadeMask.style.opacity = '1';
    el.strategyHint.textContent = `${cfg.name}: Jetzt rechne ${x} + ${y}.`;
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
  // Small read-only test hook for automated QA; no gameplay state is changed.
  window.__plusLernspielQA = {
    inspectBoard() {
      const dots = $$('.dot').filter(d => d.classList.contains('red') || d.classList.contains('blue') || d.classList.contains('green'));
      const items = dots.map(d => ({index:Number(d.dataset.index), color:d.classList.contains('red')?'red':d.classList.contains('blue')?'blue':'green', row:Number(d.style.gridRow), col:Number(d.style.gridColumn), rect:(()=>{const r=d.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};})()}));
      const board=el.pointsField.getBoundingClientRect();
      return {count:items.length, items, board:{left:board.left,top:board.top,right:board.right,bottom:board.bottom}, outside:items.filter(d=>!d.row||!d.col||d.row<1||d.row>2||d.col<1||d.col>10||d.rect.left<board.left-2||d.rect.right>board.right+2||d.rect.top<board.top-2||d.rect.bottom>board.bottom+2).map(d=>d.index)};
    }
  };
  buildDots(); bind(); startSession(1);
})();
