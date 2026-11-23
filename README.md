# Plus-Lernspiel (DENKAVO)

Eigenständige Version des Plus-Lernspiels (GitHub Pages: https://z68g777wbp-cell.github.io/Plus/).
Dieselben Spieldateien liegen in der Lernplattform unter `public/plus/` und werden dort unter `/lernen/plus`
eingebettet. Eigenständig werden keine Lernereignisse gesendet, und der Haus-Knopf ist ausgeblendet.
Änderungen bitte in beiden Repositories gleich halten.

## Plattform-Anbindung (nur in der Lernplattform)

- Ereignisquelle `denkavo-plus`, Spielkennung `plus` (siehe `app/api/learning-events/route.ts`).
- Ereignisse: `session-start` (level, roundTaskCount), `attempt`, `task-complete`, `session-end`, `exit` (Haus-Knopf, nur in der Plattform sichtbar).
- `helpUsed` enthält z. B. `strategie-double`, `hilfsrechnung`, `hilfe-strategie`, `wiederholung`.
- Das Spiel kennt keine Schüler-IDs und hat keinen Datenbankzugang.

## Verbindliche Vorgaben (Auszug)

- Level 1/2: Der größere Summand steht immer blau in der oberen Zeile, der kleinere rot – egal, welcher
  Summand in der Rechnung zuerst steht. Differenz ≤ 2: untereinander, sonst in der oberen Zeile weiter.
- Ein einzelnes Plättchen bekommt nie einen Rahmen. Roter Rahmen: Verdoppelung oder Teil über 5.
- Differenz 2: nach 1,5 s wird ein Plättchen sichtbar zum kleineren Summanden bewegt.
- 6 + 2: Rahmen um 1 + 2; Hilfsrechnung „1 + 2“, dann „+ 5“. 5 + 2: Rahmen um 2, dann „+ 5“.
- Gelbe Abdeckung 2 s nach Ende der Darstellung/Animation, vollständig über dem Zwanzigerfeld.
- Level 3: Animation erst nach Strategiewahl, keine Hilfsrechnungen und Kommentare; 1,5 s nach der Animation
  grüne Abdeckung. Nach falschem Erstversuch läuft die gewählte Strategie noch einmal ab. Unpassende
  Strategie: Button kurz rot. 10er-Stopp: Plättchen bewegen sich gleichzeitig.
- 9er-Trick nur, wenn im Zwanzigerfeld ein freier Platz für die Bewegung existiert (nicht bei 9 + 11 / 11 + 9).
- Zwanzigerfeld statisch; Plättchen nur auf freien Zellen, nie auf dem Mittelsteg.
- Prüfung erst nach vollständiger Eingabe; nächste Aufgabe nach 0,25 s.
- Vollbild-Taste in der Kopfleiste (Fullscreen-API, auf dem iPhone nicht verfügbar → Taste ausgeblendet).

## Level 4–6 (Zahlenraum 100)

- Level 4: ZE + E (Einer zusammen ≤ 9) oder ZE + Z, Ergebnis ≤ 99. Level 5: ZE + ZE, Einer zusammen ≤ 9.
  Level 6: ZE + ZE, Einer zusammen ≥ 10 (auch genau 10), Ergebnis ≤ 100.
- Gelbes Feld = 1. Summand, blaues Feld = 2. Summand (Zehnerstangen und Einerwürfel), grünes Feld = Summe.
- Ablauf: 1. Summand zeigen → 1,5 s → abdecken; 2. Summand zeigen → 1,5 s → abdecken. Die Blöcke
  wandern unter der Abdeckung hervor ins grüne Feld (erst Gelb, dann Blau) und behalten ihre Farbe.
- Nach jeder Bewegung ins grüne Feld wird Grün nach 1,5 s abgedeckt (vor der nächsten Bewegung wieder aufgedeckt).
- Level 4: nach dem Abdecken erscheint das Ergebnisfeld.
- Level 5/6: Kinder wählen ihren eigenen Rechenweg. In jedem Schritt stehen alle Teilrechnungen zur Auswahl,
  die in diesem Schritt auf irgendeinem Weg vorkommen (Core.stepButtonsForTask), nur als Rechnung beschriftet.
  Beispiel 38 + 37: 30 + 30 · 8 + 7 · 38 + 7 · 38 + 2 · 38 + 30 → … → 60 + 15 · 45 + 30 · 70 + 5.
  Passt ein Schritt nicht: Button rot, betroffene Felder 1 s aufgedeckt (kein Fehler in der Wertung).
- Prüfung 0,3 s nach vollständiger Eingabe; grün/rot; nach 0,5 s zurücksetzen; grüne Abdeckung 1 s durchsichtig;
  neue Rechnung nach insgesamt 1,5 s. Beim letzten Schritt wird das Ergebnis auch in die Startrechnung eingetragen.
- Zählung richtig/falsch und Zeit nur im Hintergrund (wie Minus); Ergebnis am Rundenende.

## Tests

```sh
node tests/tasks.test.js
node tests/animation.test.js
node tests/zr100.test.js         # alle Rechenwege Level 5/6
python3 tests/browser_check.py   # Playwright + Chromium, alle Aufgaben von Level 1–3
python3 tests/browser_zr100.py   # Level 4–6 im Browser, alle Wegtypen
```
