# Plus-Lernspiel

Öffne `index.html` in einem aktuellen Browser oder veröffentliche alle Dateien direkt im Repository-Root auf GitHub Pages.

## Tests

Mit Node.js aus diesem Verzeichnis ausführen:

```sh
node tasks.test.js
node animation.test.js
```

`tasks.test.js` prüft 1.500 zufällige Aufgabenblöcke sowie die Zulässigkeit der Aufgaben und Strategieregeln. `animation.test.js` prüft wichtige Animationsverträge statisch (unter anderem verzögerte Hilfsrechnung, Rahmenlogik und fehlendes Ergebnis in den Hilfsrechnungen). Diese Tests ersetzen keinen vollständigen visuellen Browser-Test.

## Animationsdetails

- Die 20 Hintergrundfelder bleiben statisch; Plättchen liegen auf einer getrennten Ebene.
- Level 1/2 ordnen den größeren Summanden zuerst an. Bei einem Unterschied von zwei wird ein Plättchen nach 1,5 Sekunden bewegt und die Verdoppelung in beiden Zeilen eingerahmt.
- Hilfsrechnungen zu Aufgaben mit größerem Unterschied werden erst nach einem falschen Erstversuch eingeblendet und zeigen kein Ergebnis.
- Der 9er-Trick bewegt sichtbar ein Plättchen des anderen Summanden auf das freie zehnte Feld.
- Bewegungsziele werden aus den tatsächlichen Zellen des Zwanzigerfelds ermittelt.
