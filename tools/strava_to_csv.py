#!/usr/bin/env python3
"""Schreibt data/fahrten.csv und data/meta.json aus Strava-Aktivitäten.

Eingabe: eine oder mehrere JSON-Dateien mit Antworten von Stravas "list_activities"
(Feld "activities", Werte in Metern, Sekunden und m/s – wie sie der Strava-Connector liefert).

  python3 tools/strava_to_csv.py seite1.json seite2.json ...

Übernommen werden nur (E-)Mountainbike-Fahrten mit Distanz. Doppelte IDs zählen einmal.
"""
import csv, json, os, sys
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORT = [(", Austria", ""), ("Saalbach-Hinterglemm", "Saalbach"), ("Sankt Gallen", "St. Gallen"),
       (" am Wechsel", ""), (" an der Ybbs", "")]


def ort(s):
    s = s or "unbekannt"
    if s.startswith("Gemeinde "):
        s = s[len("Gemeinde "):]
    for a, b in ORT:
        s = s.replace(a, b)
    return s.replace(",", " ")


def main(paths):
    rows = {}
    for p in paths:
        with open(p, encoding="utf-8") as fh:
            d = json.load(fh)
        for a in d.get("activities", []):
            s = a.get("summary") or {}
            if "MountainBike" not in (a.get("sport_type") or "") or not s.get("distance"):
                continue
            rows[str(a["id"])] = [str(a["id"]), a["start_local"][:10], ort(a.get("location_summary")), s["distance"],
                                  s.get("moving_time", 0), s.get("elevation_gain", 0), s.get("max_speed", 0),
                                  s.get("total_calories") or 0, s.get("pr_count", 0)]
    if not rows:
        sys.exit("Keine MTB-Fahrten gefunden – nichts geschrieben.")
    out = sorted(rows.values(), key=lambda r: (r[1], r[0]))
    with open(os.path.join(ROOT, "data", "fahrten.csv"), "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh, lineterminator="\n")
        w.writerow(["id", "start", "ort", "distanz_m", "fahrzeit_s", "hm", "vmax_ms", "kcal", "prs"])
        w.writerows(out)
    with open(os.path.join(ROOT, "data", "meta.json"), "w", encoding="utf-8") as fh:
        json.dump({"stand": date.today().strftime("%d.%m.%Y"), "fahrten": len(out),
                   "quelle": "Strava (MTB- und E-MTB-Fahrten)"}, fh, ensure_ascii=False)
        fh.write("\n")
    print(f"{len(out)} Fahrten geschrieben.")


if __name__ == "__main__":
    main(sys.argv[1:] or sys.exit(__doc__))
