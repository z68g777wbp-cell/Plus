# Plus-Lernspiel

Browserbasiertes Additions-Lernspiel mit drei Zahlenräumen, Ziffernfeld, Strategiekarten und Zwanziger-Feld.

## Start
`index.html` direkt im Browser öffnen oder die Dateien in ein GitHub-Repository hochladen und GitHub Pages aktivieren.

## Dateien
- `index.html` – Oberfläche
- `style.css` – responsive Darstellung
- `game.js` – Aufgabenerzeugung, Spiellogik und Animationen
- `tests/tasks.test.js` – automatisierte Tests der Aufgaben- und Strategieregeln

## Test
Mit Node.js im Projektordner ausführen:

```sh
node tests/tasks.test.js
node --check game.js
```

## Hinweise
Aufgaben, Zeit und Ergebnisse werden während des Durchgangs lokal im Arbeitsspeicher erfasst und in `window.lastPlusSession` bereitgestellt. Es gibt noch keine Benutzerkonten, Serverübertragung oder Lehrer:innen-Dashboard. Browser-/Gerätekompatibilität hängt von der Zielumgebung ab.


## Ergänzte Darstellungsregeln

- In Level 1/2 bei einem Unterschied von mehr als 2 wird der größere Summand zuerst angeordnet. Rot eingerahmt werden nur der Teil oberhalb von 5 und der kleinere Summand (z. B. 6+2: 1+2). Die Hilfe zeigt zuerst 2+1=3 und danach 3+5=8.
- Bei der Strategie „Handaufgabe“ erhält der Fünfer einen roten Rahmen und der Rest einen grünen Rahmen.


## Korrigierte Plättchenanimation (Version 2)

- In Level 1 und 2 werden die Plättchen für die visuelle Darstellung nach Größe sortiert: größere Zahl blau, kleinere Zahl rot.
- Bei einem Summandenunterschied von genau 2 wandert ein blaues Plättchen aus der größeren Gruppe in einen freien Platz der kleineren Gruppe. Es wird kein belegter Platz überdeckt und die Anzahl der roten und blauen Plättchen bleibt konstant.
- Bei einem Unterschied von mehr als 2 wird der rote Rahmen um den Teil der größeren Zahl oberhalb von fünf sowie um die kleinere Zahl gelegt.

## Animationsregeln und technische Prüfung

- Das 20er-Feld wird als statisches Raster aus 20 Zellen aufgebaut. Die farbigen Plättchen liegen in einer separaten Ebene darüber.
- Eine Bewegung verschiebt dasselbe Plättchen auf eine freie Rasterzelle; die Anzahl und Farbe der Plättchen bleiben dabei erhalten.
- In Level 3 bleibt das Raster zunächst leer. Erst nach Auswahl einer Strategie startet deren Animation.
- Nach der 1,5-Sekunden-Anzeige wird die Animation durch ein gelbes Feld abgedeckt. Die Abdeckung bleibt bis zur nächsten Aufgabe sichtbar.
- Automatisierte Prüfungen starten mit `node tests/tasks.test.js` und `node tests/animation.test.js`.

## Durchgeführte Browserprüfung

Die interaktive Browserprüfung mit Chromium/Playwright wurde erfolgreich ausgeführt. Dabei wurden geprüft: 20 statische Feldzellen, separate Plättchenebene, Level-3-Start erst nach Strategieauswahl, gelbe Abdeckung nach Abschluss der Strategieanimation und Wartezeit, Plättchenanzahl/Farben, vollständige zweistellige Eingabe, automatische Prüfung erst nach vollständiger Eingabe, automatischer Aufgabenwechsel nach 0,25 Sekunden, vier Viewport-Größen ohne Scrollüberlauf und keine JavaScript-Laufzeitfehler.

Die Browserprüfung ersetzt keinen separaten physischen iPad-Test. Benutzerkonten, dauerhafte Server-Speicherung und Lehrer:innen-Dashboard sind nicht Teil dieser Version.
