const assert = require('node:assert/strict');
const Core = require('../game.js');

for (const level of [1, 2, 3]) {
  const cfg = Core.LEVELS[level];
  const all = Core.enumerateTasks(level);
  assert.ok(all.length >= cfg.count, `Level ${level} muss genug Aufgaben besitzen`);
  for (let run = 0; run < 500; run++) {
    const block = Core.buildTaskBlock(level);
    assert.equal(block.length, cfg.count, `Level ${level}: Blockgröße`);
    const keys = block.map(Core.taskKey);
    assert.equal(new Set(keys).size, keys.length, `Level ${level}: keine Duplikate in Durchgang ${run}`);
    for (const task of block) {
      assert.ok(Core.isAllowedTask(task, level), `Level ${level}: unzulässige Aufgabe ${task.x}+${task.y}`);
      assert.equal(task.result, task.x + task.y);
      assert.ok(task.x >= 1 && task.y >= 1, '0 darf nicht vorkommen');
    }
  }
}
assert.equal(Core.enumerateTasks(1).length, 15);
assert.equal(Core.enumerateTasks(2).length, 35);
assert.equal(Core.enumerateTasks(3).length, 154);
assert.equal(Core.strategyValidity('double', 7, 8), true);
assert.equal(Core.strategyValidity('double', 7, 9), false);
assert.equal(Core.strategyValidity('hand', 5, 8), true);
assert.equal(Core.strategyValidity('hand', 4, 8), false);
assert.equal(Core.strategyValidity('nine', 9, 4), true);
assert.equal(Core.strategyValidity('nine', 8, 4), false);
assert.equal(Core.strategyValidity('ten', 7, 8), true);
assert.equal(Core.strategyValidity('ten', 3, 4), false);
assert.equal(Core.strategyValidity('giant', 13, 4), true);
assert.equal(Core.strategyValidity('giant', 8, 4), false);
console.log('OK: 1.500 Aufgabenblöcke, mathematische Bedingungen, Duplikate und Strategieregeln geprüft.');
