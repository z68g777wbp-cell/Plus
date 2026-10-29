# Plus-Lernspiel

Browserbasiertes Additions-Lernspiel für drei Zahlenräume mit Ziffernfeld, Strategiewahl und animiertem 20er-Feld.

## Start
`index.html` im aktuellen Browser öffnen oder alle Dateien direkt in ein GitHub-Repository laden und GitHub Pages aktivieren.

## Dateien
- `index.html` – Oberfläche und Bedienung
- `style.css` – responsive Gestaltung, Feld, Rahmen und Animationseffekte
- `game.js` – Aufgaben, Eingabe, Strategien, Plättchenbewegungen, Auswertung und Zeitmessung
- `tests/tasks.test.js` – Aufgaben- und Strategieregeln
- `tests/animation.test.js` – Prüfungen der Animationsstruktur und relevanter Zeit-/Darstellungsregeln

## Automatisierte Tests
Im Projektordner mit Node.js ausführen:

```sh
node --check game.js
node tests/tasks.test.js
node tests/animation.test.js
```

## Lernspielregeln
- Level 1: Summen bis 6; Level 2: Summen von 6 bis 10; Level 3: Summen von 11 bis 20.
- Jede Aufgabe kommt innerhalb eines Durchgangs höchstens einmal als Erstaufgabe vor. Vertauschte Summanden gelten als eigene Aufgabe.
- Das 20er-Feld bleibt als Raster aus 20 leeren Zellen unverändert; Plättchen liegen auf einer separaten Ebene.
- Plättchenbewegungen behalten Farbe und Anzahl bei und prüfen freie Zielzellen.
- In Level 1/2 werden Summanden mit kleinem Abstand untereinander dargestellt. Bei Abstand 2 wartet die Animation vor der Bewegung 1,5 Sekunden. Die Abdeckung folgt nach einer zweisekündigen Anzeige.
- Bei größerem Abstand wird der größere Summand zuerst dargestellt und der Teil oberhalb von fünf gemeinsam mit dem kleineren Summanden eingerahmt.
- In Level 3 beginnt die Darstellung erst nach Wahl einer passenden Strategie. Bei der Verdoppelung wird bei einem Abstand von eins das zusätzliche Plättchen mit „+1“ markiert.
- Die Hilfsrechnung zum 10er-Stopp erscheint erst nach einem falschen Erstversuch und unterhalb des Punktefelds.
- Nach der Animationsanzeige deckt ein undurchsichtiges gelbes Feld die Darstellung ab.
- Ergebnisse und Zeiten werden lokal im Browser während des Durchgangs erfasst und in `window.lastPlusSession` bereitgestellt. Es gibt keine Serverübertragung, Benutzerkonten oder Lehrer:innen-Dashboard.
