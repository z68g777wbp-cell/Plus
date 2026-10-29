# Plus-Lernspiel – Rechenstrategien

Statische HTML/CSS/JavaScript-Anwendung für GitHub Pages. Keine Build-Schritte und keine externen Bibliotheken erforderlich.

## Starten / GitHub

Die ZIP-Datei enthält `index.html`, `style.css` und `game.js` direkt im Stammverzeichnis (ohne übergeordneten Projektordner). Dateien in ein Repository hochladen und GitHub Pages auf den gewünschten Branch/Ordner einstellen. Lokal `index.html` im Browser öffnen.

## Spielumfang

- Level 1: Zahlenraum 6, 10 Aufgaben pro Block.
- Level 2: Zahlenraum 10, Summen von 6 bis 10, 10 Aufgaben pro Block.
- Level 3: Zahlenraum 20, Summen von 10 bis 20, 20 Aufgaben pro Block und fünf Rechenstrategien.
- Summanden sind immer mindestens 1. Umgekehrte Aufgaben gelten als verschieden (`3 + 4` und `4 + 3`). Innerhalb eines Blocks gibt es keine doppelten Aufgaben.
- Eingabe über das Ziffernfeld. Die Prüfung wartet auf die erforderliche Anzahl Ziffern und erfolgt dann nach 250 ms.
- Eine falsche erste Eingabe bleibt als falsch gewertet, auch wenn das Kind die Aufgabe später richtig löst. Falsch gelöste Aufgaben werden später erneut vorgelegt.
- Zeit pro Aufgabe und Sitzungsverlauf werden lokal im Arbeitsspeicher erfasst. `window.lastPlusSession` stellt nach Ende eine strukturierte Zusammenfassung bereit. Es werden keine Daten an einen Server übertragen oder dauerhaft gespeichert.

## Automatisierte Tests

Voraussetzung: Node.js 18 oder neuer. Im Projektordner ausführen:

```bash
node tests/tasks.test.js
node --check game.js
```

Der Test prüft 500 Durchgänge je Level (insgesamt 1.500 Blöcke), Aufgabenzahl, mathematische Zulässigkeit, Duplikate und Strategieregeln.

## Grenzen der aktuellen statischen Version

Kinderkonten, dauerhafte Speicherung und ein Lehrpersonen-Dashboard benötigen eine spätere authentifizierte Backend-Integration.
