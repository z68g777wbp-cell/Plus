// Level 4–6: Aufgabenbedingungen und vollständige Prüfung aller Rechenwege.
const assert = require('node:assert/strict');
const Core = require('../game.js');
for (const level of [4, 5, 6]) {
  const all = Core.enumerateTasks(level);
  assert.ok(all.length >= 10);
  for (let run = 0; run < 300; run++) {
    const block = Core.buildTaskBlock(level);
    assert.equal(block.length, 10);
    assert.equal(new Set(block.map(Core.taskKey)).size, 10);
  }
  for (const t of all) {
    const ex = t.x % 10, ey = t.y % 10;
    assert.ok(t.x >= 11 && t.x <= 99 && ex !== 0, 'erster Summand ist ZE');
    if (level === 4) assert.ok((t.y <= 9 && ex + t.y <= 9) || (t.y % 10 === 0 && t.x + t.y <= 99));
    if (level === 5) assert.ok(ey !== 0 && ex + ey <= 9 && t.x + t.y <= 99);
    if (level === 6) assert.ok(ey !== 0 && ex + ey >= 10 && t.x + t.y <= 100);
  }
}
assert.ok(Core.isAllowedTask({ x: 34, y: 5 }, 4) && !Core.isAllowedTask({ x: 34, y: 6 }, 4) && Core.isAllowedTask({ x: 34, y: 20 }, 4));
assert.ok(Core.isAllowedTask({ x: 38, y: 42 }, 6) && !Core.isAllowedTask({ x: 38, y: 42 }, 5));
// Alle Wege: Jede Aufgabe aus Level 5/6 wird über alle Teilrechnungen durchgespielt.
// Jeder Weg endet nach höchstens 3 Schritten mit dem richtigen Ergebnis, es gibt keine Sackgasse,
// und jeder Button eines Schritts passt in mindestens einem erreichbaren Zustand.
let paths = 0;
for (const level of [5, 6]) {
  for (const t of Core.enumerateTasks(level)) {
    const buttons = Core.stepButtonsForTask(t.x, t.y);
    assert.ok(buttons.length >= 2 && buttons.length <= 3, `L${level} ${t.x}+${t.y}: ${buttons.length} Schritte`);
    const walk = (st, i) => {
      const valid = Core.validSteps(st);
      assert.ok(valid.length > 0, `L${level} ${t.x}+${t.y}: Sackgasse nach ${st.done.map(d => d.terms.join('+')).join(', ')}`);
      for (const p of valid) {
        assert.equal(p.result, p.terms[0] + p.terms[1]);
        assert.ok(buttons[i].some(b => b.label === p.label), `L${level} ${t.x}+${t.y}: ${p.label} fehlt als Button in Schritt ${i + 1}`);
        assert.ok(Core.planByLabel(st, p.label));
        if (p.final) { assert.equal(p.result, t.x + t.y); paths++; }
        else { assert.ok(i < 2, `L${level} ${t.x}+${t.y}: mehr als 3 Schritte`); walk(p.next, i + 1); }
      }
    };
    walk(Core.initSteps(t.x, t.y), 0);
  }
}
const labels = (x, y) => Core.stepButtonsForTask(x, y).map(s => s.map(b => b.label).sort());
// Beispiele aus der Vorgabe
assert.deepEqual(labels(38, 37), [
  ['30 + 30', '38 + 2', '38 + 30', '38 + 7', '8 + 7'],
  ['30 + 30', '40 + 30', '40 + 35', '40 + 5', '45 + 30', '68 + 2', '68 + 7', '8 + 7'],
  ['45 + 30', '60 + 15', '70 + 5']]);
assert.deepEqual(labels(34, 25), [['30 + 20', '34 + 20', '34 + 5', '4 + 5'], ['30 + 20', '39 + 20', '4 + 5', '54 + 5'], ['50 + 9']]);
const s1 = Core.planByLabel(Core.initSteps(38, 37), '38 + 2');
assert.ok(Core.planByLabel(s1.next, '40 + 35').final);
assert.equal(Core.planByLabel(s1.next, '30 + 30'), null);
console.log(`OK: Level 4–6 Aufgaben und ${paths} vollständige Rechenwege geprüft (alle Teilrechnungen als Buttons, max. 3 Schritte).`);
