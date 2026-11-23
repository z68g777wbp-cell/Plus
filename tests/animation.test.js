const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
assert.match(html, /id="pointsField"/);
assert.match(js, /function groupIndices\(x, y\)/);
assert.match(js, /function setDotsForLevel\(/);
assert.match(js, /const occupied = new Set/);
assert.match(js, /if \(occupied\.has\(targetKey\)\)/);
assert.match(js, /await sleep\(1500\); if\(token!==animationToken\) return;/);
assert.match(js, /async function coverAnimation\(token\)[\s\S]*?await sleep\(2000\)/);
assert.match(js, /function handGroups\(x,y\)/);
assert.match(js, /frameDotIndexes\(el\.redFrame, \[\.\.\.groups\.big\.slice\(0,smaller\)/);
assert.match(js, /markPlusOne\(groups\.big\[smaller\]\)/);
// Level 3: keine Hilfsrechnungen/Kommentare, 10er-Stopp gleichzeitig, grüne Abdeckung nach 1,5 s.
const l3 = js.slice(js.indexOf('async function runStrategyAnimation'), js.indexOf('async function runStrategyHelp'));
assert.doesNotMatch(l3, /label(Top|Bottom)\.textContent = `/);
assert.match(l3, /await Promise\.all\(moves\)/);
assert.match(l3, /await sleep\(1500\);[\s\S]*el\.fadeMask\.style\.opacity = '1'/);
assert.match(css, /\.fade-mask\.green-cover\{background:#4ade80/);
// Ein einzelnes Plättchen bekommt nie einen Rahmen.
assert.match(js, /if \(!indexes \|\| indexes\.length < 2\)/);
assert.match(css, /\.points-layer \.dot\.plus-one::after\{content:attr\(data-note\)/);
assert.match(css, /#labelBottom\.below-board\{top:auto;bottom:-2\.1em/);
assert.match(css, /\.fade-mask\{background:#facc15/);
console.log('OK: Animationsstruktur, freie Zielplätze, Zeitregeln, Gruppierung, +1-Plättchen und 10er-Stopp-Hilfe geprüft.');
// Vorgaben: Hilfsrechnung „zuerst den 5er weglassen“ (6 + 2 → 1 + 2, dann + 5), Mittelsteg nie als Ziel,
// Plattform-Brücke und Vollbild-Taste vorhanden.
assert.match(js, /el\.labelTop\.textContent = `\$\{extra\} \+ \$\{small\}`/);
assert.match(js, /el\.labelBottom\.textContent = `\$\{small\} \+ 5`/);
assert.match(js, /const cellColumns = \[1,2,3,4,5,7,8,9,10,11\]/);
assert.match(js, /source: 'denkavo-plus'/);
assert.match(html, /id="fullscreenBtn"/);
console.log('OK: Hilfsrechnungen, Mittelsteg, Plattform-Brücke und Vollbild geprüft.');
