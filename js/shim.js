/* Datenbasis der App: lädt die Dateien aus data/, rechnet die Auswertungen (js/calcs.js)
   und stellt sie über ein kleines "dash"-Objekt bereit, wie es das Dashboard auf claude.ai hatte. */
(() => {
  const calcs = [];
  const results = {};
  const listeners = [];
  let status = 'loading';
  let errorMsg = '';

  const dash = {
    colors: ['#e8641b', '#3b82c4', '#2f8a50', '#9b59b6', '#d4a017', '#c0392b', '#16a085', '#7f8c8d'],
    calc(id, def) { calcs.push({id, ...def}); },
    loader() {},
    data(id) {
      if (status === 'ok' && results[id]) return {status: 'ok', data: results[id], message: ''};
      return {status: status === 'error' ? 'error' : 'loading', data: [], message: errorMsg};
    },
    onData(fn) { listeners.push(fn); fn(); },
    setLink(id) { try { history.replaceState(null, '', '#' + id); } catch (e) {} },
    meta: {}
  };
  window.dash = dash;

  const emit = () => listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
  let rt = null;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(emit, 150); });

  function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    const head = lines.shift().split(',');
    return lines.filter(Boolean).map(l => {
      const c = l.split(',');
      return Object.fromEntries(head.map((h, i) => [h, c[i]]));
    });
  }

  // Zeilen im selben Aufbau wie die Strava-Aktivitäten des Dashboards
  const toActivity = r => ({
    id: r.id, sport_type: 'EMountainBikeRide', start_local: r.start + 'T00:00:00',
    location_summary: r.ort, distance: Number(r.distanz_m), moving_time: Number(r.fahrzeit_s),
    elevation_gain: Number(r.hm), max_speed: Number(r.vmax_ms), total_calories: Number(r.kcal), pr_count: Number(r.prs)
  });

  async function get(path, asText) {
    const res = await fetch(path, {cache: 'no-cache'});
    if (!res.ok) throw new Error(path + ': ' + res.status);
    return asText ? res.text() : res.json();
  }

  dash.ready = (async () => {
    try {
      const [csv, touren, segs, zeiten, meta] = await Promise.all([
        get('data/fahrten.csv', true), get('data/touren.json'), get('data/duell_segmente.json'),
        get('data/duell_zeiten.json'), get('data/meta.json').catch(() => ({}))
      ]);
      results.aktivitaeten = parseCSV(csv).map(toActivity);
      results.touren = touren;
      results.duell_segmente = segs;
      results.duell_zeiten = zeiten;
      dash.meta = meta || {};
      for (const c of calcs) results[c.id] = c.fn(...c.inputs.map(i => results[i] || []));
      status = 'ok';
    } catch (e) {
      console.error(e); status = 'error';
      errorMsg = location.protocol === 'file:' ? 'Bitte über einen Webserver öffnen (siehe README).' : 'Daten konnten nicht geladen werden.';
    }
    emit();
  })();
})();

/* Eigene Angaben (Schwierigkeit, gefahren, Notizen, eigene Touren, Einstellungen) – nur auf diesem Gerät. */
window.store = (() => {
  const KEY = 'mtb.v1';
  let state = {edits: null, manual: [], settings: {}};
  try { const raw = localStorage.getItem(KEY); if (raw) state = {...state, ...JSON.parse(raw)}; } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch (e) { return false; } };
  return {
    get state() { return state; },
    async init() {
      // Beim ersten Start die Angaben aus dem Dashboard übernehmen
      if (state.edits == null) {
        try { state.edits = await (await fetch('data/touren_edits.json')).json(); } catch (e) { state.edits = {}; }
        save();
      }
    },
    edit(id, patch) { state.edits[id] = {...(state.edits[id] || {}), ...patch}; return save(); },
    addTour(t) { state.manual.push(t); return save(); },
    removeTour(id) { state.manual = state.manual.filter(t => t.id !== id); delete state.edits[id]; return save(); },
    setting(k, v) { if (v === undefined) return state.settings[k]; state.settings[k] = v; save(); },
    exportJSON() { return JSON.stringify({app: 'mountainbike', version: 1, exportiert: new Date().toISOString(), edits: state.edits, manual: state.manual}, null, 1); },
    importJSON(text) {
      const d = JSON.parse(text);
      if (!d || d.app !== 'mountainbike') throw new Error('Keine Sicherung der Mountainbike-App');
      state.edits = d.edits || {}; state.manual = Array.isArray(d.manual) ? d.manual : []; save();
    }
  };
})();
