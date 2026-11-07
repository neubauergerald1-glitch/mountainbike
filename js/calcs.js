dash.calc('mtb_fahrten', {
  title: 'MTB-Fahrten',
  description: 'Nur (E-)Mountainbike-Fahrten mit Distanz, in km, Hm, Minuten und km/h; Höchstgeschwindigkeit über 90 km/h als GPS-Fehler verworfen.',
  inputs: ['aktivitaeten'],
  fn: (aktivitaeten) => aktivitaeten
    .filter(a => /MountainBike/.test(a.sport_type) && Number(a.distance) > 0)
    .map(a => {
      const km = Number(a.distance) / 1000, hm = Number(a.elevation_gain), min = Number(a.moving_time) / 60, v = Number(a.max_speed) * 3.6;
      const hpk = hm / km;
      return {
        id: a.id, datum: a.start_local.slice(0, 10), jahr: Number(a.start_local.slice(0, 4)),
        ort: (a.location_summary || 'unbekannt').replace(/^Gemeinde /, '').replace(/, Austria$/, '').replace('Saalbach-Hinterglemm', 'Saalbach').replace('Sankt Gallen', 'St. Gallen').replace(' am Wechsel', '').replace(' an der Ybbs', ''),
        km: Math.round(km * 10) / 10, hm: Math.round(hm),
        fahrzeit_min: Math.round(min), fahrzeit: Math.floor(min / 60) + ':' + String(Math.round(min % 60)).padStart(2, '0'),
        kmh: Math.round(km / (min / 60) * 10) / 10, vmax_kmh: v > 90 ? null : Math.round(v * 10) / 10,
        kcal: Number(a.total_calories) || 0, prs: Number(a.pr_count) || 0,
        hm_pro_km: Math.round(hpk), steilheit: hpk < 15 ? 'flach' : hpk < 40 ? 'hügelig' : 'alpin'
      };
    })
});

dash.calc('mtb_summe', {
  title: 'MTB-Summen je Jahr',
  description: 'Summen und Schnitte aller MTB-Fahrten je Kalenderjahr.',
  inputs: ['mtb_fahrten'],
  fn: (mtb_fahrten) => {
    const g = {};
    for (const r of mtb_fahrten) (g[r.jahr] = g[r.jahr] || []).push(r);
    return Object.keys(g).sort().map(j => {
      const rs = g[j], s = k => rs.reduce((t, r) => t + r[k], 0), n = rs.length, km = s('km'), hm = s('hm');
      return {jahr: Number(j), fahrten: n, km: Math.round(km), hm: Math.round(hm), stunden: Math.round(s('fahrzeit_min') / 60),
        kcal: Math.round(s('kcal')), prs: s('prs'), km_schnitt: Math.round(km / n), hm_pro_km: Math.round(hm / km)};
    });
  }
});

dash.calc('mtb_jahre', {
  title: 'Jahre bis Stichtag',
  description: 'Je Jahr: ganzes Jahr und Summen bis zum Kalendertag der neuesten Fahrt (Stichtag).',
  inputs: ['mtb_fahrten'],
  fn: (mtb_fahrten) => {
    const last = mtb_fahrten.reduce((m, r) => r.datum > m ? r.datum : m, '');
    const cut = last.slice(5);
    const g = {};
    for (const r of mtb_fahrten) {
      const x = g[r.jahr] = g[r.jahr] || {jahr: r.jahr, fahrten: 0, km: 0, hm: 0, stunden: 0, prs: 0, fahrten_bis: 0, km_bis: 0, hm_bis: 0, stunden_bis: 0, prs_bis: 0};
      x.fahrten++; x.km += r.km; x.hm += r.hm; x.stunden += r.fahrzeit_min / 60; x.prs += r.prs;
      if (r.datum.slice(5) <= cut) { x.fahrten_bis++; x.km_bis += r.km; x.hm_bis += r.hm; x.stunden_bis += r.fahrzeit_min / 60; x.prs_bis += r.prs; }
    }
    return Object.values(g).sort((a, b) => b.jahr - a.jahr).map(x => ({...x, stichtag: cut.slice(3) + '.' + cut.slice(0, 2) + '.',
      km: Math.round(x.km), hm: Math.round(x.hm), stunden: Math.round(x.stunden), km_bis: Math.round(x.km_bis), hm_bis: Math.round(x.hm_bis), stunden_bis: Math.round(x.stunden_bis)}));
  }
});

dash.calc('mtb_ytd_delta', {
  title: 'Neuestes Jahr gegen Vorjahr',
  description: 'Veränderung in Prozent bis zum Stichtag: neuestes Jahr gegen das Jahr davor.',
  inputs: ['mtb_jahre'],
  fn: (mtb_jahre) => {
    const [a, b] = mtb_jahre;
    if (!a || !b) return [];
    return ['fahrten', 'km', 'hm', 'stunden', 'prs'].map(k => ({
      kennzahl: k, jahr: a.jahr, vorjahr: b.jahr, aktuell: a[k + '_bis'], vorjahr_wert: b[k + '_bis'],
      delta_pct: b[k + '_bis'] ? Math.round((a[k + '_bis'] / b[k + '_bis'] - 1) * 100) : null
    }));
  }
});

dash.calc('mtb_monat', {
  title: 'MTB pro Monat',
  description: 'Fahrten, km, Höhenmeter und Stunden je Jahr und Monat.',
  inputs: ['mtb_fahrten'],
  fn: (mtb_fahrten) => {
    const m = {};
    for (const r of mtb_fahrten) {
      const k = r.datum.slice(0, 7);
      m[k] = m[k] || {monat: k, jahr: r.jahr, mon: Number(k.slice(5)), fahrten: 0, km: 0, hm: 0, stunden: 0};
      m[k].fahrten++; m[k].km += r.km; m[k].hm += r.hm; m[k].stunden += r.fahrzeit_min / 60;
    }
    return Object.values(m).sort((a, b) => a.monat < b.monat ? -1 : 1)
      .map(x => ({...x, km: Math.round(x.km), hm: Math.round(x.hm), stunden: Math.round(x.stunden * 10) / 10}));
  }
});

dash.calc('mtb_kumuliert', {
  title: 'Aufsummiert übers Jahr',
  description: 'Laufende Summe von km, Hm und Fahrten je Jahr nach Kalendertag.',
  inputs: ['mtb_fahrten'],
  fn: (mtb_fahrten) => {
    const rs = mtb_fahrten.slice().sort((a, b) => a.datum < b.datum ? -1 : 1), acc = {};
    return rs.map(r => {
      const a = acc[r.jahr] = acc[r.jahr] || {km: 0, hm: 0, fahrten: 0};
      a.km += r.km; a.hm += r.hm; a.fahrten++;
      return {id: r.id, jahr: r.jahr, datum: r.datum, km: Math.round(a.km), hm: Math.round(a.hm), fahrten: a.fahrten};
    });
  }
});

dash.calc('mtb_region', {
  title: 'MTB nach Startort',
  description: 'Fahrten, km und Höhenmeter je Jahr und Startort.',
  inputs: ['mtb_fahrten'],
  fn: (mtb_fahrten) => {
    const m = {};
    for (const r of mtb_fahrten) {
      const k = r.jahr + '|' + r.ort;
      m[k] = m[k] || {jahr: r.jahr, ort: r.ort, fahrten: 0, km: 0, hm: 0};
      m[k].fahrten++; m[k].km += r.km; m[k].hm += r.hm;
    }
    return Object.values(m).map(x => ({...x, km: Math.round(x.km), hm: Math.round(x.hm)})).sort((a, b) => b.km - a.km);
  }
});

dash.calc('mtb_gesamt', {
  title: 'MTB-Summen alle Jahre',
  description: 'Summen über alle MTB-Fahrten seit Beginn der Aufzeichnungen; Everest = Höhenmeter geteilt durch 8.849 m.',
  inputs: ['mtb_fahrten'],
  fn: (mtb_fahrten) => {
    const s = k => mtb_fahrten.reduce((t, r) => t + r[k], 0), n = mtb_fahrten.length, km = s('km'), hm = s('hm');
    const first = mtb_fahrten.reduce((m, r) => !m || r.datum < m ? r.datum : m, '');
    return [{fahrten: n, km: Math.round(km), hm: Math.round(hm), stunden: Math.round(s('fahrzeit_min') / 60), kcal: Math.round(s('kcal')),
      prs: s('prs'), km_schnitt: n ? Math.round(km / n) : 0, everest: Math.round(hm / 8849 * 10) / 10,
      seit: first ? first.slice(8, 10) + '.' + first.slice(5, 7) + '.' + first.slice(0, 4) : ''}];
  }
});

dash.calc('mtb_region_gesamt', {
  title: 'Startorte alle Jahre',
  description: 'Fahrten, km und Höhenmeter je Startort über alle Jahre.',
  inputs: ['mtb_fahrten'],
  fn: (mtb_fahrten) => {
    const m = {};
    for (const r of mtb_fahrten) { m[r.ort] = m[r.ort] || {ort: r.ort, fahrten: 0, km: 0, hm: 0}; m[r.ort].fahrten++; m[r.ort].km += r.km; m[r.ort].hm += r.hm; }
    return Object.values(m).map(x => ({...x, km: Math.round(x.km), hm: Math.round(x.hm)})).sort((a, b) => b.km - a.km);
  }
});

dash.calc('mtb_rekorde_gesamt', {
  title: 'Bestwerte aller Zeiten',
  description: 'Längste Fahrt, meiste Höhenmeter, höchste plausible Geschwindigkeit und meiste PRs über alle Jahre.',
  inputs: ['mtb_fahrten'],
  fn: (mtb_fahrten) => {
    const best = k => mtb_fahrten.reduce((b, r) => (r[k] != null && (!b || r[k] > b[k])) ? r : b, null);
    const d = r => r ? r.datum.slice(8, 10) + '.' + r.datum.slice(5, 7) + '.' + r.datum.slice(0, 4) + ' · ' + r.ort : '';
    const a = best('km'), b = best('hm'), c = best('vmax_kmh'), e = best('prs');
    return [
      {rekord: 'distanz', wert: a ? a.km : null, einheit: 'km', info: d(a)},
      {rekord: 'hoehe', wert: b ? b.hm : null, einheit: 'Hm', info: d(b)},
      {rekord: 'vmax', wert: c ? c.vmax_kmh : null, einheit: 'km/h', info: d(c)},
      {rekord: 'prs', wert: e ? e.prs : null, einheit: 'PRs', info: d(e)}
    ];
  }
});

dash.calc('duell_vergleich', {
  title: 'Trail-Duell je Segment',
  description: 'Je Segment: deine Bestzeit, deine Platzierung unter allen Vergleichszeiten und dein Abstand zur besten Zeit der anderen.',
  inputs: ['duell_segmente', 'duell_zeiten'],
  fn: (duell_segmente, duell_zeiten) => duell_segmente.map(s => {
    const o = duell_zeiten.filter(z => z.segment_id === s.id);
    const best = o.length ? Math.min(...o.map(z => z.zeit)) : null;
    return {id: s.id, name: s.name, region: s.region, art: s.art, km: s.km, steigung: s.steigung, gefahren: s.gefahren,
      meine_zeit: s.meine_zeit, mein_datum: s.mein_datum, vergleiche: o.length,
      platz: 1 + o.filter(z => z.zeit < s.meine_zeit).length, teilnehmer: o.length + 1,
      abstand_s: best == null ? null : s.meine_zeit - best, abstand_pct: best == null ? null : Math.round((s.meine_zeit - best) / best * 1000) / 10};
  })
});

dash.calc('duell_bilanz', {
  title: 'Duell-Bilanz je Fahrer',
  description: 'Je Fahrer: gemeinsame Segmente, Siege, Niederlagen, Gleichstände und dein mittlerer Abstand auf Abfahrten in Prozent.',
  inputs: ['duell_segmente', 'duell_zeiten'],
  fn: (duell_segmente, duell_zeiten) => {
    const seg = Object.fromEntries(duell_segmente.map(s => [s.id, s]));
    const out = {};
    for (const z of duell_zeiten) {
      const s = seg[z.segment_id]; if (!s) continue;
      const r = out[z.fahrer] = out[z.fahrer] || {fahrer: z.fahrer, gemeinsam: 0, siege: 0, niederlagen: 0, gleich: 0, abfahrten: 0, summe_pct: 0};
      r.gemeinsam++;
      if (s.meine_zeit < z.zeit) r.siege++; else if (s.meine_zeit > z.zeit) r.niederlagen++; else r.gleich++;
      if (s.art === 'Abfahrt') { r.abfahrten++; r.summe_pct += (s.meine_zeit - z.zeit) / z.zeit * 100; }
    }
    return Object.values(out).map(r => ({fahrer: r.fahrer, gemeinsam: r.gemeinsam, siege: r.siege, niederlagen: r.niederlagen, gleich: r.gleich,
      abfahrten: r.abfahrten, abfahrt_pct: r.abfahrten ? Math.round(r.summe_pct / r.abfahrten * 10) / 10 : null})).sort((a, b) => b.gemeinsam - a.gemeinsam);
  }
});

dash.calc('duell_fakten', {
  title: 'Trail-Duell Überblick',
  description: 'Anzahl Segmente, davon mit Vergleich, mit Platz 1 und mit noch fehlender Bestenliste.',
  inputs: ['duell_segmente', 'duell_vergleich'],
  fn: (duell_segmente, duell_vergleich) => [{
    segmente: duell_segmente.length,
    mit_vergleich: duell_vergleich.filter(v => v.vergleiche > 0).length,
    platz1: duell_vergleich.filter(v => v.vergleiche > 0 && v.platz === 1).length,
    ausstehend: duell_segmente.filter(s => s.ausstehend).length
  }]
});

dash.calc('mtb_rekorde', {
  title: 'MTB-Bestwerte je Jahr',
  description: 'Je Jahr: längste Fahrt, meiste Höhenmeter, höchste plausible Geschwindigkeit, meiste PRs.',
  inputs: ['mtb_fahrten'],
  fn: (mtb_fahrten) => {
    const out = [], jahre = [...new Set(mtb_fahrten.map(r => r.jahr))];
    const d = r => r ? r.datum.slice(8, 10) + '.' + r.datum.slice(5, 7) + '. · ' + r.ort : '';
    for (const j of jahre) {
      const rs = mtb_fahrten.filter(r => r.jahr === j);
      const best = k => rs.reduce((b, r) => (r[k] != null && (!b || r[k] > b[k])) ? r : b, null);
      const a = best('km'), b = best('hm'), c = best('vmax_kmh'), e = best('prs');
      out.push({jahr: j, rekord: 'distanz', wert: a ? a.km : null, einheit: 'km', info: d(a)},
        {jahr: j, rekord: 'hoehe', wert: b ? b.hm : null, einheit: 'Hm', info: d(b)},
        {jahr: j, rekord: 'vmax', wert: c ? c.vmax_kmh : null, einheit: 'km/h', info: d(c)},
        {jahr: j, rekord: 'prs', wert: e ? e.prs : null, einheit: 'PRs', info: d(e)});
    }
    return out;
  }
});
