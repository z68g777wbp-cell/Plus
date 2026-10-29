# Plus-Lernspiel – Rechenstrategien

Statische HTML/CSS/JavaScript-Anwendung für GitHub Pages. Keine Build-Schritte und keine externen Bibliotheken erforderlich.

## Starten

`index.html` im Browser öffnen oder den Ordner als Repository zu GitHub hochladen und in **Settings → Pages** veröffentlichen.

## Spielumfang

- Level 1: Zahlenraum 6, 10 Aufgaben pro Block.
- Level 2: Zahlenraum 10, Summen von 6 bis 10, 10 Aufgaben pro Block.
- Level 3: Zahlenraum 20, Summen von 10 bis 20, 20 Aufgaben pro Block und fünf Rechenstrategien.
- Die Zahlen 0 sind ausgeschlossen. Umgekehrte Aufgaben gelten gemäß Vorgabe als verschieden: `3 + 4` und `4 + 3` können beide vorkommen.
- Aufgaben werden aus einem vollständigen zulässigen Pool gezogen; der Generator füllt nicht durch Duplikate auf.
- Eingabe über das Ziffernfeld, automatische Kontrolle nach 250 ms, farbige Rückmeldung.
- Eine falsche erste Eingabe bleibt als falsch gewertet, auch wenn die Aufgabe anschließend richtig gelöst wird.
- Die Zeit pro Aufgabe und der Sitzungsverlauf werden lokal im Arbeitsspeicher erfasst. `window.lastPlusSession` stellt nach Ende eine strukturierte Zusammenfassung für eine spätere Plattformintegration bereit. Daten werden derzeit nicht an einen Server übertragen oder dauerhaft gespeichert.

## Tests

Voraussetzung: Node.js 18 oder neuer. Im Projektordner ausführen:

```bash
node tests/tasks.test.js
```

Der Test prüft 500 Durchgänge je Level (insgesamt 1.500 Blöcke), Aufgabenzahl, mathematische Zulässigkeit, Duplikate und Strategieregeln.

## Plattformintegration

Die Sitzung wird als strukturiertes Objekt in `window.lastPlusSession` bereitgestellt. Für Kinderkonten, dauerhafte Speicherung und Lehrpersonen-Dashboard braucht es später eine authentifizierte Backend-API; in dieser statischen Version werden keine personenbezogenen Daten abgefragt.
