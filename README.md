# Geralds Mountainbike App

Die Mountainbike-App aus claude.ai als eigenständige Web-App (PWA). Läuft offline, lässt sich am
iPhone/Android auf den Home-Bildschirm legen und braucht keinen Server außer einem einfachen Webhosting.

## Funktionen
- **Pro Jahr**: Kennzahlen mit Vergleich zum Vorjahr bis zum selben Stichtag, Jahresvergleich (aufsummiert),
  Saisonverlauf pro Monat, Saison-Highlights, Startorte, Tourenprofil (Distanz gegen Höhenmeter), alle Fahrten sortierbar
- **Alle Jahre**: Summen seit Beginn, alle Monate, Bestwerte aller Zeiten, Lieblingsreviere, alle Fahrten
- **Touren**: 25 gesammelte Touren mit Filtern; Schwierigkeit, „schon gefahren“ und Notizen änderbar;
  eigene Touren hinzufügen – von Hand oder mit Claude aus Link, Foto/Screenshot oder Text
  (dafür unter ⚙ einen eigenen API-Schlüssel von console.anthropic.com eintragen)
- **Trail-Duell**: Segment-Bestzeiten gegen die Leute, denen du auf Strava folgst
- **Datensicherung**: eigene Angaben und Touren als JSON-Datei sichern und wieder einspielen (⚙)

Beim ersten Start werden Schwierigkeit und „schon gefahren“ aus dem Dashboard übernommen (Stand 7.11.2026).

## Daten
| Datei | Inhalt |
|---|---|
| `data/fahrten.csv` | MTB- und E-MTB-Fahrten aus Strava (seit 15.12.2024) |
| `data/meta.json` | Datenstand |
| `data/touren.json` | Tourensammlung |
| `data/touren_edits.json` | Startwerte für Schwierigkeit / gefahren |
| `data/duell_segmente.json`, `data/duell_zeiten.json` | Trail-Duell (Stand 29.10.2026) |

Die Strava-Fahrten sind ein Abzug, keine Live-Verbindung. Neuen Stand einspielen:
Strava-Aktivitäten (Antworten von `list_activities`) als JSON speichern und

```bash
python3 tools/strava_to_csv.py seite1.json seite2.json
```

ausführen; danach in `sw.js` die `VERSION` erhöhen.

## Lokal starten
```bash
python3 -m http.server 8000
```
Dann http://localhost:8000 öffnen. (`index.html` doppelklicken funktioniert nicht, weil der Browser
dann die Daten nicht laden darf.)

## Aufbau
| Datei | Inhalt |
|---|---|
| `index.html` | Seitengerüst |
| `css/base.css` | Farben (hell/dunkel automatisch), Schriften, Abstände |
| `css/dashboard.css` | Gestaltung der Seiten |
| `js/shim.js` | lädt die Daten, Speicherung auf dem Gerät, Export/Import |
| `js/calcs.js` | alle Auswertungen (Summen, Rekorde, Duell-Bilanz …) |
| `js/app.js` | Darstellung, Diagramme, Touren, Einstellungen |
| `js/d3.min.js` | Diagramm-Bibliothek d3 7.9.0 (lokal, damit es offline geht) |
| `sw.js` | Offline-Cache (bei Änderungen `VERSION` erhöhen) |

## Aufs Handy
1. Ordner auf ein HTTPS-Hosting legen, z. B. GitHub Pages (Settings → Pages → Branch `main`)
   oder Netlify Drop (app.netlify.com/drop: Ordner ins Browserfenster ziehen).
2. Adresse in Safari öffnen → Teilen → „Zum Home-Bildschirm“.

Eigene Angaben liegen nur auf dem jeweiligen Gerät. Regelmäßig unter ⚙ sichern.
