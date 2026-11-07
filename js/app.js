(() => {
  const root = document.querySelector('.mtb');
  const tip = document.getElementById('mtb-tip');
  const nf0 = new Intl.NumberFormat('de-AT', {maximumFractionDigits: 0});
  const nf1 = new Intl.NumberFormat('de-AT', {maximumFractionDigits: 1});
  const MON = ['Jän', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const MONL = ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const UNIT = {km: 'km', hm: 'Hm', fahrten: 'Fahrten'};
  const STEIL = ['flach', 'hügelig', 'alpin'];
  const ACC = 'var(--mtb-acc)', STEILC = ['var(--mtb-forest)', 'var(--mtb-acc)', 'var(--mtb-rock)'];
  let metric = 'km', sortKey = 'datum', sortDir = -1, query = '', year = null;

  const showTip = (ev, html) => {
    tip.hidden = false; tip.replaceChildren(...html);
    const r = root.getBoundingClientRect(), w = tip.offsetWidth;
    let x = ev.clientX - r.left + 12; if (x + w > r.width) x = ev.clientX - r.left - w - 12;
    tip.style.left = Math.max(0, x) + 'px'; tip.style.top = (ev.clientY - r.top + 12) + 'px';
  };
  const line = (t, cls, color) => { const d = document.createElement('div'); if (cls) d.className = cls; if (color) { const i = document.createElement('span'); i.style.cssText = `display:inline-block;width:.5rem;height:.5rem;border-radius:50%;margin-right:.35rem;background:${color}`; d.appendChild(i); } d.appendChild(document.createTextNode(t)); return d; };
  const hideTip = () => { tip.hidden = true; };
  const bad = st => st === 'error' || st === 'connect' || st === 'declined';
  const fail = (el) => { el.replaceChildren(); const d = document.createElement('div'); d.className = 'mtb-fail'; d.textContent = 'Daten konnten nicht geladen werden'; el.appendChild(d); };
  const settle = (el, st) => { if (st !== 'loading') el.classList.remove('dash-skeleton'); };
  const tidyAxis = (g) => { g.attr('font-size', null).attr('font-family', null); g.selectAll('text').attr('fill', 'var(--color-fg-muted)').style('font-size', 'var(--cds-font-size-caption)'); g.selectAll('line').attr('stroke', 'var(--cds-chart-grid)'); g.select('.domain').remove(); };
  const dmy = d => d.slice(8, 10) + '.' + d.slice(5, 7) + '.';
  const yColor = (y, years) => y === years[0] ? ACC : y === years[1] ? dash.colors[1] : 'var(--cds-chart-muted)';

  root.querySelectorAll('#mtb-metric button').forEach(b => b.addEventListener('click', () => {
    metric = b.dataset.m;
    root.querySelectorAll('#mtb-metric button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    draw();
  }));
  document.getElementById('mtb-search').addEventListener('input', e => { tstate['mtb-table'].q = e.target.value.toLowerCase(); draw(); });

  function drawYears(jahre) {
    const el = document.getElementById('mtb-years');
    el.replaceChildren();
    if (jahre.status !== 'ok') return;
    jahre.data.forEach(r => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = String(r.jahr);
      b.setAttribute('aria-pressed', String(r.jahr === year));
      b.addEventListener('click', () => { year = r.jahr; draw(); });
      el.appendChild(b);
    });
  }

  function drawKum(d, years) {
    const el = document.getElementById('mtb-kum');
    settle(el, d.status);
    if (bad(d.status)) return fail(el);
    el.replaceChildren(); if (d.status !== 'ok') return;
    const doy = s => (Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) - Date.UTC(+s.slice(0, 4), 0, 1)) / 864e5;
    const W = el.clientWidth || 600, H = 280, m = {t: 12, r: 8, b: 26, l: 8};
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`);
    const series = years.slice().reverse().map(y => {
      const rs = d.data.filter(r => r.jahr === y);
      return {y, pts: [{x: rs.length ? Math.min(doy(rs[0].datum), 0) : 0, v: 0, datum: null}].concat(rs.map(r => ({x: doy(r.datum), v: r[metric], datum: r.datum})))};
    });
    const maxV = d3.max(d.data, r => r[metric]) || 1;
    const y = d3.scaleLinear([0, maxV], [H - m.b, m.t]).nice();
    const fmt = metric === 'hm' ? d3.format('~s') : d3.format(',');
    let lab = 0; const p = svg.append('g');
    series.forEach(s => { const t = p.append('text').style('font-size', 'var(--cds-font-size-caption)').text(s.y + ' ' + fmt(s.pts[s.pts.length - 1].v)); lab = Math.max(lab, t.node().getComputedTextLength()); });
    const pt = p.append('text').style('font-size', 'var(--cds-font-size-caption)').text(fmt(y.domain()[1])); m.l = pt.node().getComputedTextLength() + 10; p.remove();
    m.r = lab + 12;
    const x = d3.scaleLinear([0, 365], [m.l, W - m.r]);
    svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(W - m.l - m.r)).tickFormat(fmt)).call(tidyAxis);
    const mt = d3.range(12).map(i => (Date.UTC(2025, i, 1) - Date.UTC(2025, 0, 1)) / 864e5);
    const step = W < 500 ? 3 : W < 800 ? 2 : 1;
    svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).tickValues(mt.filter((_, i) => i % step === 0)).tickSize(0).tickPadding(8).tickFormat(v => MON[mt.indexOf(v)])).call(tidyAxis);
    const ln = d3.line().x(q => x(q.x)).y(q => y(q.v)).curve(d3.curveStepAfter);
    const ends = [];
    series.forEach(s => {
      const c = yColor(s.y, years), main = s.y === year;
      svg.append('path').datum(s.pts).attr('d', ln).attr('fill', 'none').attr('stroke', c).attr('stroke-width', main ? 2.5 : 1.75).attr('stroke-opacity', main ? 1 : .8).attr('stroke-linejoin', 'round').attr('stroke-linecap', 'round');
      const last = s.pts[s.pts.length - 1];
      ends.push({s, c, x: x(last.x), y: y(last.v), v: last.v});
    });
    ends.sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;
    ends.forEach(e => {
      svg.append('circle').attr('cx', e.x).attr('cy', y(e.v)).attr('r', 3).attr('fill', e.c);
      svg.append('text').attr('x', e.x + 6).attr('y', e.y + 4).attr('fill', e.c).style('font-size', 'var(--cds-font-size-caption)').style('font-weight', e.s.y === year ? 600 : 400).text(e.s.y + ' ' + fmt(e.v));
    });
    const rule = svg.append('line').attr('y1', m.t).attr('y2', H - m.b).attr('stroke', 'var(--cds-chart-reference)').attr('visibility', 'hidden');
    svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', W - m.l - m.r).attr('height', H - m.t - m.b).attr('fill', 'transparent')
      .on('mousemove', ev => {
        const [mx] = d3.pointer(ev); const dx = x.invert(mx); rule.attr('x1', mx).attr('x2', mx).attr('visibility', 'visible');
        const dt = new Date(Date.UTC(2025, 0, 1) + Math.round(dx) * 864e5);
        const lines = [line(dt.getUTCDate() + '. ' + MONL[dt.getUTCMonth()], 't')];
        years.forEach(yy => { const s = series.find(q => q.y === yy); const pnt = s.pts.filter(q => q.x <= dx).pop(); lines.push(line(yy + ': ' + nf0.format(pnt ? pnt.v : 0) + ' ' + UNIT[metric], null, yColor(yy, years))); });
        showTip(ev, lines);
      })
      .on('mouseleave', () => { rule.attr('visibility', 'hidden'); hideTip(); });
  }

  function drawYearTable(d) {
    const tb = document.querySelector('#mtb-years-table tbody');
    tb.replaceChildren(); if (d.status !== 'ok') return;
    for (const r of d.data) {
      const tr = document.createElement('tr'); tr.dataset.key = String(r.jahr);
      [String(r.jahr), String(r.fahrten), nf0.format(r.km), nf0.format(r.hm), nf0.format(r.stunden), nf0.format(r.prs), nf0.format(r.km_bis), nf0.format(r.hm_bis)]
        .forEach((c, i) => { const td = document.createElement('td'); td.textContent = c; if (i) td.className = 'num'; if (i === 4 || i === 5) td.classList.add('mtb-hide'); if (r.jahr === year) td.style.fontWeight = '600'; tr.appendChild(td); });
      tb.appendChild(tr);
    }
  }

  function drawMonths(d, years) {
    const el = document.getElementById('mtb-monat');
    settle(el, d.status);
    if (bad(d.status)) return fail(el);
    el.replaceChildren(); if (d.status !== 'ok') return;
    const prev = year - 1;
    const cur = d.data.filter(r => r.jahr === year), old = d.data.filter(r => r.jahr === prev);
    const mons = d3.range(1, 13);
    const W = el.clientWidth || 600, H = 240, m = {t: 18, r: 8, b: 26, l: 8};
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`);
    const y = d3.scaleLinear([0, d3.max(cur.concat(old), r => r[metric]) || 1], [H - m.b, m.t]).nice();
    const fmt = metric === 'hm' ? d3.format('~s') : d3.format(',');
    const probe = svg.append('text').style('font-size', 'var(--cds-font-size-caption)').text(fmt(y.domain()[1]));
    m.l = probe.node().getComputedTextLength() + 10; probe.remove();
    const x = d3.scaleBand(mons, [m.l, W - m.r]).padding(0.2);
    const bw = Math.min(16, x.bandwidth() / 2);
    svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4).tickSize(-(W - m.l - m.r)).tickFormat(fmt)).call(tidyAxis);
    const step = W < 420 ? 2 : 1;
    svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).tickValues(mons.filter((_, i) => i % step === 0)).tickSize(0).tickPadding(8).tickFormat(k => MON[k - 1])).call(tidyAxis);
    const mid = k => x(k) + x.bandwidth() / 2;
    svg.append('g').selectAll('rect').data(old).join('rect').attr('x', r => mid(r.mon) - bw).attr('width', bw - 1)
      .attr('y', r => y(r[metric])).attr('height', r => y(0) - y(r[metric])).attr('rx', 3).attr('fill', 'var(--cds-chart-muted)');
    svg.append('g').selectAll('rect').data(cur).join('rect').attr('x', r => mid(r.mon) + 1).attr('width', bw - 1)
      .attr('y', r => y(r[metric])).attr('height', r => y(0) - y(r[metric])).attr('rx', 3).attr('fill', ACC);
    svg.append('g').selectAll('rect').data(mons).join('rect').attr('x', k => x(k)).attr('width', x.bandwidth()).attr('y', m.t).attr('height', H - m.t - m.b).attr('fill', 'transparent')
      .on('mousemove', (ev, k) => {
        const a = cur.find(r => r.mon === k), b = old.find(r => r.mon === k);
        showTip(ev, [line(MONL[k - 1], 't'),
          line(year + ': ' + (a ? nf0.format(a.km) + ' km · ' + nf0.format(a.hm) + ' Hm · ' + a.fahrten + ' F.' : '–'), null, ACC),
          line(prev + ': ' + (b ? nf0.format(b.km) + ' km · ' + nf0.format(b.hm) + ' Hm · ' + b.fahrten + ' F.' : '–'), null, 'var(--cds-chart-muted)')]);
      }).on('mouseleave', hideTip);
  }

  function drawRegions(d) { drawRegionsInto(d, 'mtb-region', year); }
  function drawRegionsInto(d, eid, onlyYear) {
    const el = document.getElementById(eid);
    settle(el, d.status);
    if (bad(d.status)) return fail(el);
    el.replaceChildren(); if (d.status !== 'ok') return;
    const rows = d.data.filter(r => onlyYear == null || r.jahr === onlyYear).slice(0, 8);
    const W = el.clientWidth || 400, bh = 22, gap = 8, H = Math.max(1, rows.length) * (bh + gap) + 4;
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`);
    let lw = 0; const p = svg.append('g');
    rows.forEach(r => { const t = p.append('text').style('font-size', 'var(--cds-font-size-caption)').text(r.ort); lw = Math.max(lw, t.node().getComputedTextLength()); });
    p.remove(); lw += 10;
    const x = d3.scaleLinear([0, d3.max(rows, r => r.km) || 1], [0, Math.max(40, W - lw - 90)]);
    const g = svg.selectAll('g.r').data(rows).join('g').attr('transform', (r, i) => `translate(0,${i * (bh + gap)})`)
      .on('mousemove', (ev, r) => showTip(ev, [line(r.ort, 't'), line(nf0.format(r.km) + ' km · ' + nf0.format(r.hm) + ' Hm'), line(r.fahrten + (r.fahrten === 1 ? ' Fahrt' : ' Fahrten'))]))
      .on('mouseleave', hideTip);
    g.append('text').attr('x', 0).attr('y', bh / 2 + 4).attr('fill', 'var(--color-fg)').style('font-size', 'var(--cds-font-size-caption)').text(r => r.ort);
    g.append('rect').attr('x', lw).attr('y', 2).attr('height', bh - 4).attr('width', r => Math.max(2, x(r.km))).attr('rx', 4)
      .attr('fill', (r, i) => i < 2 ? ACC : 'var(--cds-chart-muted)');
    g.append('text').attr('x', r => lw + x(r.km) + 6).attr('y', bh / 2 + 4).attr('fill', 'var(--color-fg-muted)').style('font-size', 'var(--cds-font-size-caption)')
      .text(r => nf0.format(r.km) + ' km · ' + r.fahrten);
  }

  function drawScatter(d) {
    const el = document.getElementById('mtb-scatter'), lg = document.getElementById('mtb-legend');
    settle(el, d.status);
    lg.replaceChildren();
    STEIL.forEach((s, i) => { const sp = document.createElement('span'); const ic = document.createElement('i'); ic.style.background = STEILC[i]; sp.append(ic, document.createTextNode(s)); lg.appendChild(sp); });
    if (bad(d.status)) return fail(el);
    el.replaceChildren(); if (d.status !== 'ok') return;
    const rows = d.data.filter(r => r.jahr === year);
    const W = el.clientWidth || 600, H = 300, m = {t: 10, r: 14, b: 36, l: 8};
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`);
    const y = d3.scaleLinear([0, d3.max(rows, r => r.hm) || 1], [H - m.b, m.t]).nice();
    const pr = svg.append('text').style('font-size', 'var(--cds-font-size-caption)').text(d3.format(',')(y.domain()[1]));
    m.l = pr.node().getComputedTextLength() + 10; pr.remove();
    const x = d3.scaleLinear([0, d3.max(rows, r => r.km) || 1], [m.l, W - m.r]).nice();
    svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(W - m.l - m.r)).tickFormat(d3.format(','))).call(tidyAxis);
    svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(Math.max(3, Math.floor(W / 90))).tickSize(-(H - m.t - m.b))).call(tidyAxis);
    svg.append('text').attr('x', W - m.r).attr('y', H - 4).attr('text-anchor', 'end').attr('fill', 'var(--color-fg-muted)').style('font-size', 'var(--cds-font-size-caption)').text('Distanz in km →');
    svg.append('text').attr('x', m.l + 4).attr('y', m.t + 10).attr('fill', 'var(--color-fg-muted)').style('font-size', 'var(--cds-font-size-caption)').text('↑ Höhenmeter');
    svg.append('g').selectAll('circle').data(rows).join('circle')
      .attr('cx', r => x(r.km)).attr('cy', r => y(r.hm)).attr('r', 5)
      .attr('fill', r => STEILC[STEIL.indexOf(r.steilheit)]).attr('fill-opacity', .75)
      .attr('stroke', 'var(--color-panel)').attr('stroke-width', 1)
      .on('mousemove', (ev, r) => showTip(ev, [line(dmy(r.datum) + ' · ' + r.ort, 't'),
        line(nf1.format(r.km) + ' km · ' + nf0.format(r.hm) + ' Hm'), line(r.hm_pro_km + ' Hm/km · ' + r.fahrzeit + ' h')]))
      .on('mouseleave', hideTip);
  }

  const tstate = {'mtb-table': {k: 'datum', dir: -1, q: ''}, 'mtb-a-table': {k: 'datum', dir: -1, q: ''}};
  function drawTable(d, tid, onlyYear) {
    const st = tstate[tid];
    const tb = document.querySelector('#' + tid + ' tbody');
    tb.replaceChildren();
    if (d.status !== 'ok') return;
    let rows = d.data.filter(r => (onlyYear == null || r.jahr === onlyYear) && (!st.q || r.ort.toLowerCase().includes(st.q) || r.datum.startsWith(st.q)));
    const v = r => r[st.k] ?? -1;
    rows = rows.slice().sort((a, b) => (v(a) < v(b) ? -1 : v(a) > v(b) ? 1 : 0) * st.dir);
    document.querySelectorAll('#' + tid + ' th').forEach(th => {
      const k = th.querySelector('button').dataset.k;
      th.setAttribute('aria-sort', k === st.k ? (st.dir > 0 ? 'ascending' : 'descending') : 'none');
    });
    for (const r of rows) {
      const tr = document.createElement('tr'); tr.dataset.key = r.id;
      const cells = [dmy(r.datum) + r.datum.slice(0, 4), r.ort, nf1.format(r.km), nf0.format(r.hm), r.fahrzeit, nf1.format(r.kmh), r.vmax_kmh == null ? '–' : nf1.format(r.vmax_kmh), String(r.prs)];
      cells.forEach((c, i) => { const td = document.createElement('td'); td.textContent = c; if (i >= 2) td.className = 'num'; if (i >= 4 && i <= 6) td.classList.add('mtb-hide'); tr.appendChild(td); });
      tb.appendChild(tr);
    }
  }
  ['mtb-table', 'mtb-a-table'].forEach(tid => {
    document.querySelectorAll('#' + tid + ' th button').forEach(b => b.addEventListener('click', () => {
      const st = tstate[tid], k = b.dataset.k;
      if (st.k === k) st.dir = -st.dir; else { st.k = k; st.dir = k === 'ort' ? 1 : -1; }
      draw();
    }));
  });
  document.getElementById('mtb-a-search').addEventListener('input', e => { tstate['mtb-a-table'].q = e.target.value.toLowerCase(); draw(); });

  let ametric = 'km';
  root.querySelectorAll('#mtb-a-metric button').forEach(b => b.addEventListener('click', () => {
    ametric = b.dataset.m;
    root.querySelectorAll('#mtb-a-metric button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    draw();
  }));

  function drawTimeline(d) {
    const el = document.getElementById('mtb-a-monat');
    settle(el, d.status);
    if (bad(d.status)) return fail(el);
    el.replaceChildren(); if (d.status !== 'ok' || !d.data.length) return;
    // lückenlose Monatsfolge vom ersten bis zum letzten Monat
    const first = d.data[0].monat, last = d.data[d.data.length - 1].monat, keys = [];
    for (let y = +first.slice(0, 4), m = +first.slice(5); y * 12 + m <= +last.slice(0, 4) * 12 + +last.slice(5); m++) { if (m > 12) { m = 1; y++; } keys.push(y + '-' + String(m).padStart(2, '0')); }
    const byKey = Object.fromEntries(d.data.map(r => [r.monat, r]));
    const W = el.clientWidth || 600, H = 240, m = {t: 12, r: 8, b: 40, l: 8};
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`);
    const y = d3.scaleLinear([0, d3.max(d.data, r => r[ametric]) || 1], [H - m.b, m.t]).nice();
    const fmt = ametric === 'hm' ? d3.format('~s') : d3.format(',');
    const pr = svg.append('text').style('font-size', 'var(--cds-font-size-caption)').text(fmt(y.domain()[1])); m.l = pr.node().getComputedTextLength() + 10; pr.remove();
    const x = d3.scaleBand(keys, [m.l, W - m.r]).padding(0.2);
    const years = [...new Set(keys.map(k => +k.slice(0, 4)))].sort((a, b) => b - a);
    svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4).tickSize(-(W - m.l - m.r)).tickFormat(fmt)).call(tidyAxis);
    const every = x.bandwidth() < 14 ? 3 : x.bandwidth() < 22 ? 2 : 1;
    svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).tickValues(keys.filter((k, i) => i % every === 0)).tickSize(0).tickPadding(6).tickFormat(k => MON[+k.slice(5) - 1])).call(tidyAxis);
    // Jahresbeschriftung unter den Monaten
    years.forEach(yy => {
      const ks = keys.filter(k => +k.slice(0, 4) === yy); if (!ks.length) return;
      const x0 = x(ks[0]);
      svg.append('line').attr('x1', x0 - x.step() * x.paddingInner() / 2).attr('x2', x0 - x.step() * x.paddingInner() / 2).attr('y1', m.t).attr('y2', H - 6).attr('stroke', 'var(--cds-chart-axis)');
      svg.append('text').attr('x', x0 + 2).attr('y', H - 6).attr('fill', 'var(--color-fg-muted)').style('font-size', 'var(--cds-font-size-caption)').style('font-weight', 600).text(String(yy));
    });
    const bw = Math.min(28, x.bandwidth());
    svg.append('g').selectAll('rect').data(keys.filter(k => byKey[k])).join('rect')
      .attr('x', k => x(k) + (x.bandwidth() - bw) / 2).attr('width', bw)
      .attr('y', k => y(byKey[k][ametric])).attr('height', k => y(0) - y(byKey[k][ametric])).attr('rx', 3)
      .attr('fill', k => yColor(+k.slice(0, 4), years));
    svg.append('g').selectAll('rect').data(keys).join('rect').attr('x', k => x(k)).attr('width', x.bandwidth()).attr('y', m.t).attr('height', H - m.t - m.b).attr('fill', 'transparent')
      .on('mousemove', (ev, k) => { const r = byKey[k]; showTip(ev, [line(MONL[+k.slice(5) - 1] + ' ' + k.slice(0, 4), 't'), line(r ? nf0.format(r.km) + ' km · ' + nf0.format(r.hm) + ' Hm' : 'keine Fahrt'), line(r ? r.fahrten + ' Fahrten · ' + nf1.format(r.stunden) + ' h' : '')]); })
      .on('mouseleave', hideTip);
  }

  function drawAll() {
    const g = dash.data('mtb_gesamt'), rk = dash.data('mtb_rekorde_gesamt'), rg = dash.data('mtb_region_gesamt'), mo = dash.data('mtb_monat'), f = dash.data('mtb_fahrten');
    const page = document.getElementById('alle-jahre');
    page.querySelectorAll('[data-source="mtb_gesamt"]').forEach(el => {
      if (el.id === 'mtb-a-take') return;
      settle(el, g.status);
      const r = g.status === 'ok' ? g.data[0] : null, v = r ? r[el.dataset.field] : null;
      el.textContent = v == null ? '—' : typeof v === 'number' ? (el.dataset.field === 'everest' ? nf1.format(v) : nf0.format(v)) : v;
    });
    page.querySelectorAll('[data-source="mtb_rekorde_gesamt"]').forEach(el => {
      settle(el, rk.status);
      const r = rk.status === 'ok' ? rk.data.find(x => x.rekord === el.dataset.where.split('=')[1]) : null;
      el.textContent = !r || r.wert == null ? '—' : el.dataset.field === 'wert' ? nf1.format(r.wert) + ' ' + r.einheit : r.info;
    });
    const tk = document.getElementById('mtb-a-take'); settle(tk, g.status);
    const r = g.status === 'ok' ? g.data[0] : null;
    tk.textContent = r ? `Seit ${r.seit}: ${r.fahrten} Fahrten, ${nf0.format(r.km)} km und ${nf0.format(r.hm)} Höhenmeter – das ist ${nf1.format(r.everest)}-mal die Höhe des Mount Everest.` : '—';
    drawTimeline(mo);
    drawRegionsInto(rg, 'mtb-a-region', null);
    drawTable(f, 'mtb-a-table', null);
  }


  // ---------- Touren ----------
  const tf = {diff: '', done: '', region: '', q: ''};
  root.querySelectorAll('#mtb-t-diff button').forEach(b => b.addEventListener('click', () => {
    tf.diff = b.dataset.v; root.querySelectorAll('#mtb-t-diff button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); draw();
  }));
  root.querySelectorAll('#mtb-t-done button').forEach(b => b.addEventListener('click', () => {
    tf.done = b.dataset.v; root.querySelectorAll('#mtb-t-done button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); draw();
  }));
  document.getElementById('mtb-t-region').addEventListener('change', e => { tf.region = e.target.value; draw(); });
  document.getElementById('mtb-t-q').addEventListener('input', e => { tf.q = e.target.value.toLowerCase(); draw(); });
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const num = v => v == null || v === '' || isNaN(Number(v)) ? null : Number(v);

  // Eigene Angaben je Tour (Schwierigkeit, schon gefahren, Notizen) – im Speicher dieses Geräts
  let canWrite = true, noteFocus = null;
  const manualTours = () => store.state.manual;
  const editsOf = id => (store.state.edits || {})[id] || {};
  store.init().then(() => { document.getElementById('mtb-t-add').hidden = false; draw(); });
  const saveEdit = async (id, patch) => store.edit(id, patch);
  const eff = r => {
    const x = editsOf(r.id);
    return {
      farbe: x.farbe !== undefined ? x.farbe : (r.trail_farbe || ''),
      gefahren: x.gefahren !== undefined ? !!x.gefahren : r.status === 'gefahren',
      notiz: x.notiz !== undefined ? String(x.notiz) : (r.notiz || '')
    };
  };

  function drawTouren() {
    const d = dash.data('touren'), list = document.getElementById('mtb-t-list'), tk = document.getElementById('mtb-t-take');
    document.getElementById('mtb-t-ro').hidden = canWrite;
    list.replaceChildren();
    if (bad(d.status)) { fail(list); tk.textContent = '—'; return; }
    if (d.status !== 'ok') { tk.textContent = '—'; return; }
    const rows = (Array.isArray(d.data) ? d.data : []).concat(manualTours().filter(m => m && m.titel));
    const sel = document.getElementById('mtb-t-region'), regs = [...new Set(rows.map(r => r.region).filter(Boolean))].sort();
    if (sel.options.length - 1 !== regs.length) { sel.replaceChildren(el('option', null, 'Alle Regionen')); sel.options[0].value = ''; regs.forEach(r => { const o = el('option', null, r); o.value = r; sel.appendChild(o); }); sel.value = tf.region; }
    const shown = rows.filter(r => { const x = eff(r);
      return (!tf.diff || x.farbe === tf.diff) && (!tf.done || (tf.done === 'ja') === x.gefahren) && (!tf.region || r.region === tf.region) &&
        (!tf.q || [r.titel, r.region, r.start, r.einkehr, r.tourenbeschreibung, x.notiz].join(' ').toLowerCase().includes(tf.q)); });
    const done = rows.filter(r => eff(r).gefahren).length;
    tk.textContent = rows.length ? `${rows.length} ${rows.length === 1 ? 'Tour' : 'Touren'} gesammelt, davon ${done} schon gefahren.` : 'Noch keine Touren gesammelt – füge oben die erste hinzu.';
    if (!rows.length) { list.appendChild(el('div', 'mtb-empty', 'Hier erscheinen deine Touren, sobald du die erste hinzufügst.')); return; }
    if (!shown.length) { list.appendChild(el('div', 'mtb-empty', 'Keine Tour passt zu diesen Filtern.')); return; }
    for (const r of shown) {
      const x = eff(r);
      const c = el('article', 'mtb-tour' + (x.farbe ? ' f-' + x.farbe : '')); c.dataset.key = r.id;
      if (r.foto && /^\/_blob\/[0-9a-f]+$/.test(r.foto)) { const im = el('img'); im.src = r.foto; im.alt = r.titel || ''; c.appendChild(im); }
      c.appendChild(el('h3', null, r.titel || 'Ohne Titel'));
      const tags = el('div', 'mtb-tags');
      [r.region, r.bike, r.offiziell && 'offiziell: ' + r.offiziell, r.untergrund].filter(Boolean).forEach(v => tags.appendChild(el('span', 'mtb-tag', v)));
      c.appendChild(tags);
      // editierbar: Schwierigkeit + schon gefahren
      const ed = el('div', 'mtb-edit');
      const lab = el('label'); const dot = el('span', 'mtb-dot ' + x.farbe); lab.append(dot, document.createTextNode('Schwierigkeit'));
      const s = el('select'); s.setAttribute('aria-label', 'Schwierigkeit');
      [['', '–'], ['blau', 'blau'], ['rot', 'rot'], ['schwarz', 'schwarz']].forEach(([v, l]) => { const o = el('option', null, l); o.value = v; s.appendChild(o); });
      s.value = x.farbe; s.disabled = !canWrite;
      s.addEventListener('change', () => { dot.className = 'mtb-dot ' + s.value; c.className = 'mtb-tour' + (s.value ? ' f-' + s.value : ''); saveEdit(r.id, {farbe: s.value}); });
      lab.appendChild(s); ed.appendChild(lab);
      const cl = el('label'); const cb = el('input'); cb.type = 'checkbox'; cb.checked = x.gefahren; cb.disabled = !canWrite;
      cb.addEventListener('change', () => saveEdit(r.id, {gefahren: cb.checked}));
      cl.append(cb, document.createTextNode('schon gefahren')); ed.appendChild(cl);
      c.appendChild(ed);
      const f = el('div', 'mtb-facts');
      [['km', num(r.km), nf1], ['Hm ↑', num(r.hm_auf), nf0], ['Hm ↓', num(r.hm_ab), nf0], ['Stunden', num(r.dauer_h), nf1]].forEach(([l, v, nf]) => {
        const b = el('div'); b.append(el('b', null, v == null ? '–' : nf.format(v)), el('span', null, l)); f.appendChild(b);
      });
      c.appendChild(f);
      if (r.tourenbeschreibung) c.appendChild(el('p', null, r.tourenbeschreibung));
      const meta = [r.start && 'Start: ' + r.start, r.einkehr && 'Einkehr: ' + r.einkehr, r.beste_zeit && 'Beste Zeit: ' + r.beste_zeit].filter(Boolean);
      if (meta.length) c.appendChild(el('div', 'mtb-src', meta.join(' · ')));
      const steps = Array.isArray(r.wegbeschreibung) ? r.wegbeschreibung : (r.wegbeschreibung ? String(r.wegbeschreibung).split(/\n+/) : []);
      if (steps.length) { const det = el('details'); det.appendChild(el('summary', null, 'Wegbeschreibung')); const ol = el('ol'); steps.forEach(st => ol.appendChild(el('li', null, st))); det.appendChild(ol); c.appendChild(det); }
      // Bilder (Links zu Fotoseiten, max. 3)
      const pics = (Array.isArray(r.bilder) ? r.bilder : []).filter(b => b && /^https:\/\//.test(b.url)).slice(0, 3);
      if (pics.length) { const p = el('div', 'mtb-pics'); p.appendChild(el('span', 'mtb-src', 'Fotos:')); pics.forEach(b => { const a = el('a', null, b.titel || 'Fotos'); a.href = b.url; a.target = '_blank'; a.rel = 'noopener'; p.appendChild(a); }); c.appendChild(p); }
      // Notizen
      const nb = el('div', 'mtb-notes'); const nl = el('span', null, 'Notizen'); const ta = el('textarea');
      ta.value = x.notiz; ta.placeholder = canWrite ? 'z. B. Parkplatz früh voll, Abfahrt nach Regen rutschig …' : ''; ta.disabled = !canWrite; ta.setAttribute('aria-label', 'Notizen zu ' + (r.titel || 'Tour'));
      let tmr = null;
      const flush = () => { clearTimeout(tmr); if (ta.value !== eff(r).notiz) saveEdit(r.id, {notiz: ta.value}).then(ok => { nl.textContent = ok ? 'Notizen · gespeichert' : 'Notizen'; }); };
      ta.addEventListener('focus', () => { noteFocus = r.id; });
      ta.addEventListener('input', () => { nl.textContent = 'Notizen · …'; clearTimeout(tmr); tmr = setTimeout(flush, 1200); });
      ta.addEventListener('blur', () => { noteFocus = null; flush(); });
      nb.append(nl, ta); c.appendChild(nb);
      const src = el('div', 'mtb-src');
      src.append(document.createTextNode('Quelle: ' + (r.quelle || 'eigene Notiz') + (r.hinzugefuegt ? ' · ' + r.hinzugefuegt : '')));
      if (r.quelle_url && /^https:\/\//.test(r.quelle_url)) { src.append(document.createTextNode(' · ')); const a = el('a', null, 'Link'); a.href = r.quelle_url; a.target = '_blank'; a.rel = 'noopener'; src.appendChild(a); }
      if (r.eigene) { const del = el('button', 'mtb-ghost mtb-del', 'Tour löschen'); del.type = 'button';
        del.addEventListener('click', () => { if (confirm('„' + (r.titel || 'Tour') + '“ löschen?')) { store.removeTour(r.id); draw(); } });
        src.append(document.createTextNode(' · '), del); }
      c.appendChild(src);
      list.appendChild(c);
    }
  }

  // ---------- Trail-Duell ----------
  const df = {region: '', art: '', sort: 'ridden', cmp: true, q: ''};
  root.querySelectorAll('#mtb-d-art button').forEach(b => b.addEventListener('click', () => {
    df.art = b.dataset.v; root.querySelectorAll('#mtb-d-art button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); draw();
  }));
  document.getElementById('mtb-d-region').addEventListener('change', e => { df.region = e.target.value; draw(); });
  document.getElementById('mtb-d-sort').addEventListener('change', e => { df.sort = e.target.value; draw(); });
  document.getElementById('mtb-d-cmp').addEventListener('change', e => { df.cmp = e.target.checked; draw(); });
  document.getElementById('mtb-d-q').addEventListener('input', e => { df.q = e.target.value.toLowerCase(); draw(); });
  const fmtT = s => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`; };
  const fmtD = s => (s > 0 ? '+' : s < 0 ? '−' : '±') + fmtT(Math.abs(s));
  const dDate = iso => iso ? iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(2, 4) : '';

  function drawDuell() {
    const bi = dash.data('duell_bilanz'), fa = dash.data('duell_fakten'), ve = dash.data('duell_vergleich'), ze = dash.data('duell_zeiten'), sg = dash.data('duell_segmente');
    const riders = bi.status === 'ok' ? bi.data.map(r => r.fahrer) : [];
    const rc = f => dash.colors[1 + (riders.indexOf(f) % 7)];
    // Fakten
    document.querySelectorAll('#trail-duell [data-source="duell_fakten"][data-field]').forEach(e => {
      const r = fa.status === 'ok' ? fa.data[0] : null; e.textContent = r ? nf0.format(r[e.dataset.field]) : '—';
    });
    const tk = document.getElementById('mtb-d-take');
    if (fa.status === 'ok' && fa.data[0]) { const r = fa.data[0]; tk.textContent = `Auf ${r.mit_vergleich} von ${r.segmente} Segmenten gibt es Vergleichszeiten – auf ${r.platz1} davon bist du der Schnellste.`; } else tk.textContent = '—';
    // Duelle
    const du = document.getElementById('mtb-d-duels'); du.replaceChildren();
    if (bad(bi.status)) fail(du);
    else if (bi.status === 'ok') bi.data.forEach(r => {
      const c = el('div', 'mtb-duel');
      const who = el('div', 'who'); const dot = el('span', 'mtb-dot'); dot.style.background = rc(r.fahrer); who.append(dot, document.createTextNode('Du vs. ' + r.fahrer)); c.appendChild(who);
      const sc = el('div', 'sc'); sc.append(document.createTextNode(r.siege), el('span', 'mtb-sub', ':'), document.createTextNode(r.niederlagen), el('small', null, (r.gleich ? r.gleich + ' gleich · ' : '') + r.gemeinsam + ' Segmente')); c.appendChild(sc);
      const bar = el('div', 'mtb-bar2'); [[r.siege, ACC], [r.gleich, 'var(--color-fg-muted)'], [r.niederlagen, rc(r.fahrer)]].forEach(([n, col]) => { const i = el('i'); i.style.width = (r.gemeinsam ? n / r.gemeinsam * 100 : 0) + '%'; i.style.background = col; bar.appendChild(i); }); c.appendChild(bar);
      c.appendChild(el('div', 'mtb-sub', r.abfahrt_pct == null ? 'Keine gemeinsamen Abfahrten' : `Abfahrten (${r.abfahrten}): im Schnitt ${nf1.format(Math.abs(r.abfahrt_pct))} % ${r.abfahrt_pct < 0 ? 'schneller' : 'langsamer'} als ${r.fahrer}`));
      du.appendChild(c);
    });
    // Regionen
    const sel = document.getElementById('mtb-d-region');
    if (ve.status === 'ok' && sel.options.length === 1) {
      const cnt = {}; ve.data.forEach(s => { cnt[s.region] = (cnt[s.region] || 0) + 1; });
      Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]).forEach(r => { const o = el('option', null, r + ' (' + cnt[r] + ')'); o.value = r; sel.appendChild(o); });
    }
    // Liste
    const list = document.getElementById('mtb-d-list'); list.replaceChildren();
    if (bad(ve.status) || bad(ze.status)) return fail(list);
    if (ve.status !== 'ok' || ze.status !== 'ok') return;
    let rows = ve.data.filter(s => (!df.region || s.region === df.region) && (!df.art || s.art === df.art) && (!df.cmp || s.vergleiche > 0) && (!df.q || s.name.toLowerCase().includes(df.q)));
    const by = {
      ridden: (a, b) => b.gefahren - a.gefahren, name: (a, b) => a.name.localeCompare(b.name, 'de'),
      gap: (a, b) => (b.abstand_pct ?? -1e9) - (a.abstand_pct ?? -1e9), lead: (a, b) => (a.abstand_pct ?? 1e9) - (b.abstand_pct ?? 1e9),
      date: (a, b) => (b.mein_datum || '').localeCompare(a.mein_datum || '')
    }[df.sort];
    rows.sort(by);
    document.getElementById('mtb-d-count').textContent = rows.length + ' Segmente';
    if (!rows.length) { list.appendChild(el('div', 'mtb-empty', 'Keine Segmente für diese Auswahl.')); return; }
    for (const s of rows) {
      const art = el('article', 'mtb-sg'); art.dataset.key = s.id;
      const left = el('div'); const h = el('h3'); const a = el('a', null, s.name); a.href = 'https://www.strava.com/segments/' + encodeURIComponent(s.id); a.target = '_blank'; a.rel = 'noopener'; h.appendChild(a);
      if (s.vergleiche) h.appendChild(el('span', 'mtb-badge' + (s.platz === 1 ? ' p1' : ''), s.platz === 1 ? 'Platz 1' : 'Platz ' + s.platz + '/' + s.teilnehmer));
      left.appendChild(h);
      left.appendChild(el('div', 'mtb-src', [s.region, nf1.format(s.km) + ' km', (s.art === 'Abfahrt' ? '↘ ' : s.art === 'Anstieg' ? '↗ ' : '→ ') + s.art + ' ' + nf1.format(s.steigung) + ' %', s.gefahren + '× gefahren'].join(' · ')));
      art.appendChild(left);
      const times = el('div');
      const all = [{f: null, t: s.meine_zeit, d: s.mein_datum}].concat(ze.data.filter(z => z.segment_id === s.id).map(z => ({f: z.fahrer, t: z.zeit, d: z.datum}))).sort((x, y) => x.t - y.t);
      const worst = Math.max(...all.map(x => x.t));
      all.forEach(x => {
        const r = el('div', 'mtb-tr' + (x.f ? '' : ' me'));
        const tr = el('span', 'mtb-track'); const i = el('i'); i.style.width = Math.max(4, x.t / worst * 100) + '%'; i.style.background = x.f ? rc(x.f) : ACC; tr.appendChild(i);
        const diff = x.f ? s.meine_zeit - x.t : null;
        r.append(el('span', 'n', x.f || 'Du'), el('span', 'v', fmtT(x.t)), tr, el('span', 'd' + (diff == null ? '' : diff < 0 ? ' mtb-pos' : diff > 0 ? ' mtb-neg' : ''), diff == null ? dDate(x.d) : fmtD(diff)));
        times.appendChild(r);
      });
      art.appendChild(times);
      list.appendChild(art);
    }
  }

  // ---------- Tour hinzufügen (Dialog) ----------
  const modal = document.getElementById('mtb-t-modal'), merr = document.getElementById('mtb-t-merr'), submit = document.getElementById('mtb-t-submit');
  let mtab = 'link', files = [];
  const setErr = (msg, isBad) => { merr.textContent = msg || ''; merr.classList.toggle('bad', !!isBad); };
  const openModal = () => { modal.hidden = false; setErr(''); showTab('link'); document.getElementById('mtb-f-link').focus(); };
  const closeModal = () => { modal.hidden = true; files = []; pendingSource = null; document.getElementById('mtb-f-thumbs').replaceChildren();
    modal.querySelectorAll('input:not([type=file]),textarea').forEach(i => { i.value = ''; }); document.getElementById('mtb-f-foto').value = ''; document.getElementById('mtb-m-farbe').value = ''; };
  const showTab = id => { mtab = id;
    modal.querySelectorAll('.mtb-mtabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
    modal.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== id; });
    submit.textContent = id === 'manuell' ? 'Speichern' : 'Mit Claude erfassen'; setErr(''); };
  document.getElementById('mtb-t-add').addEventListener('click', openModal);
  document.getElementById('mtb-t-close').addEventListener('click', closeModal);
  document.getElementById('mtb-t-cancel').addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });
  modal.querySelectorAll('.mtb-mtabs button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
  document.getElementById('mtb-f-foto').addEventListener('change', e => {
    files = [...e.target.files].slice(0, 5);
    const th = document.getElementById('mtb-f-thumbs'); th.replaceChildren();
    files.forEach(f => { if (f.type.startsWith('image/')) { const im = el('img'); im.alt = f.name; im.src = URL.createObjectURL(f); th.appendChild(im); } else th.appendChild(el('span', 'mtb-tag', f.name)); });
    if (e.target.files.length > 5) setErr('Es werden nur die ersten 5 Dateien übernommen.');
  });
  const newId = p => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const nOrNull = v => { const x = parseFloat(String(v).replace(',', '.')); return isFinite(x) ? x : null; };

  // ---------- Speichern bzw. mit Claude erfassen ----------
  const PROMPT = `Du hilfst Gerald, Mountainbike-Touren zu sammeln (er fährt meist E-MTB in Österreich).
Lies das Material und beschreibe genau EINE Tour. Antworte NUR mit einem JSON-Objekt, ohne Erklärung davor oder danach:
{"titel":string,"region":string|null,"start":string|null (Ausgangspunkt/Parkplatz),"km":number|null,"hm_auf":number|null,"hm_ab":number|null,"dauer_h":number|null,
"trail_farbe":"blau"|"rot"|"schwarz"|null (blau leicht, rot mittel, schwarz schwer),"bike":"E-MTB"|"MTB"|null,"untergrund":string|null,"einkehr":string|null,"beste_zeit":string|null,
"tourenbeschreibung":string (3-5 Sätze auf Deutsch: Charakter, Highlights, Anspruch),"wegbeschreibung":[string] (Abschnitte in Fahrtrichtung)}
Werte, die nicht im Material stehen und sich nicht sicher ermitteln lassen, bleiben null – nicht schätzen.
Wenn das Material keine Tour enthält: {"error":"kurze Begründung"}.`;
  const FALLBACK_MODELS = ['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5-5'];

  const fileToBlock = f => new Promise((resolve, reject) => {
    if (f.type === 'application/pdf') {
      const r = new FileReader(); r.onerror = reject;
      r.onload = () => resolve({type: 'document', source: {type: 'base64', media_type: 'application/pdf', data: String(r.result).split(',')[1]}});
      r.readAsDataURL(f); return;
    }
    createImageBitmap(f).then(bmp => {
      const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height)), cv = document.createElement('canvas');
      cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
      cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
      resolve({type: 'image', source: {type: 'base64', media_type: 'image/jpeg', data: cv.toDataURL('image/jpeg', .85).split(',')[1]}});
    }).catch(reject);
  });

  async function askClaude(content, withWeb) {
    const key = store.setting('apiKey'), model = store.setting('model') || 'claude-opus-5-5';
    if (!key) throw new Error('Für „Mit Claude erfassen“ brauchst du einen API-Schlüssel – oben rechts bei ⚙ eintragen. Oder den Reiter „Manuell“ nehmen.');
    const headers = {'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true'};
    const body = {model, max_tokens: 16000, messages: [{role: 'user', content}]};
    if (FALLBACK_MODELS.includes(model)) { headers['anthropic-beta'] = 'server-side-fallback-2026-07-01'; body.fallbacks = 'default'; }
    if (withWeb) body.tools = [{type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 4}, {type: 'web_search_20260209', name: 'web_search', max_uses: 4}];
    for (let round = 0; round < 4; round++) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {method: 'POST', headers, body: JSON.stringify(body)});
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(res.status === 401 ? 'Der API-Schlüssel wurde abgelehnt.' : res.status === 429 ? 'Gerade zu viele Anfragen – bitte gleich noch einmal.' : 'Claude-Anfrage fehlgeschlagen' + (out.error && out.error.message ? ': ' + out.error.message : ' (' + res.status + ')'));
      if (out.stop_reason === 'refusal') throw new Error('Claude hat diese Anfrage abgelehnt.');
      if (out.stop_reason === 'pause_turn') { body.messages = body.messages.concat({role: 'assistant', content: out.content}); continue; }
      const text = (out.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
      const i = text.indexOf('{'), j = text.lastIndexOf('}');
      if (i < 0 || j < i) throw new Error('Claude hat keine Tourdaten geliefert.');
      return JSON.parse(text.slice(i, j + 1));
    }
    throw new Error('Claude ist nicht fertig geworden – bitte noch einmal versuchen.');
  }

  let pendingSource = null;
  const fill = (t) => {
    const set = (id, v) => { document.getElementById(id).value = v == null ? '' : String(v); };
    set('mtb-m-titel', t.titel); set('mtb-m-region', t.region); set('mtb-m-start', t.start); set('mtb-m-km', t.km);
    set('mtb-m-hmauf', t.hm_auf); set('mtb-m-hmab', t.hm_ab); set('mtb-m-dauer', t.dauer_h); set('mtb-m-einkehr', t.einkehr);
    set('mtb-m-beschr', t.tourenbeschreibung); set('mtb-m-weg', (Array.isArray(t.wegbeschreibung) ? t.wegbeschreibung : []).join('\n'));
    document.getElementById('mtb-m-farbe').value = ['blau', 'rot', 'schwarz'].includes(t.trail_farbe) ? t.trail_farbe : '';
    if (t.quelle_url) set('mtb-m-link', t.quelle_url);
  };

  submit.addEventListener('click', async () => {
    const v = id => document.getElementById(id).value.trim();
    submit.disabled = true;
    try {
      if (mtab === 'manuell') {
        if (!v('mtb-m-titel')) { setErr('Bitte einen Titel eingeben.', true); return; }
        const link = v('mtb-m-link'), extra = pendingSource || {};
        store.addTour({id: newId('m'), eigene: true, titel: v('mtb-m-titel'), region: v('mtb-m-region') || null, start: v('mtb-m-start') || null,
          km: nOrNull(v('mtb-m-km')), hm_auf: nOrNull(v('mtb-m-hmauf')), hm_ab: nOrNull(v('mtb-m-hmab')), dauer_h: nOrNull(v('mtb-m-dauer')),
          trail_farbe: v('mtb-m-farbe') || null, einkehr: v('mtb-m-einkehr') || null, tourenbeschreibung: v('mtb-m-beschr') || null,
          wegbeschreibung: v('mtb-m-weg').split(/\n+/).map(s => s.trim()).filter(Boolean),
          bike: extra.bike || null, untergrund: extra.untergrund || null, beste_zeit: extra.beste_zeit || null,
          quelle: extra.quelle || 'manuell eingetragen', quelle_url: /^https:\/\//.test(link) ? link : null,
          hinzugefuegt: new Date().toLocaleDateString('de-AT'), erstellt: new Date().toISOString()});
        pendingSource = null; closeModal(); draw(); return;
      }
      const content = []; let web = false, quelle = '';
      if (mtab === 'link') {
        const link = v('mtb-f-link'), txt = v('mtb-f-linktext');
        if (!/^https?:\/\//.test(link)) { setErr('Bitte einen vollständigen Link eingeben (mit https://).', true); return; }
        content.push({type: 'text', text: PROMPT + '\n\nLies diese Seite mit web_fetch und ergänze fehlende Eckdaten bei Bedarf mit web_search: ' + link + (txt ? '\n\nVom Nutzer eingefügter Text dazu:\n' + txt : '')});
        web = true; quelle = (link.match(/^https?:\/\/(?:www\.)?([^/]+)/) || [])[1] || 'Link';
      } else if (mtab === 'foto') {
        if (!files.length) { setErr('Bitte mindestens ein Foto auswählen.', true); return; }
        setErr('Bereite Fotos vor …');
        for (const f of files) content.push(await fileToBlock(f));
        const note = v('mtb-f-fotonote');
        content.push({type: 'text', text: PROMPT + '\n\nDas Material sind die Bilder/Dokumente oben.' + (note ? ' Hinweis von Gerald: ' + note : '')});
        quelle = 'Foto/Screenshot';
      } else {
        const txt = v('mtb-f-text'); if (!txt) { setErr('Bitte einen Text einfügen.', true); return; }
        content.push({type: 'text', text: PROMPT + '\n\nMaterial:\n' + txt}); quelle = 'eingefügter Text';
      }
      setErr('Claude erfasst die Tour … das kann eine Minute dauern.');
      const t = await askClaude(content, web);
      if (t.error) { setErr('Keine Tour gefunden: ' + t.error, true); return; }
      if (mtab === 'link') t.quelle_url = v('mtb-f-link');
      pendingSource = {quelle, bike: t.bike, untergrund: t.untergrund, beste_zeit: t.beste_zeit};
      fill(t); showTab('manuell');
      setErr('Claude hat die Tour erfasst. Bitte kurz prüfen und speichern.');
    } catch (err) {
      setErr(err && err.message ? err.message : 'Das hat nicht geklappt. Bitte noch einmal versuchen.', true);
    } finally { submit.disabled = false; }
  });

  // ---------- Einstellungen ----------
  const sm = document.getElementById('mtb-s-modal'), smsg = document.getElementById('mtb-s-msg');
  const openSettings = () => {
    document.getElementById('mtb-s-key').value = store.setting('apiKey') || '';
    document.getElementById('mtb-s-model').value = store.setting('model') || 'claude-opus-5-5';
    const m = dash.meta || {};
    document.getElementById('mtb-s-stand').textContent = m.stand ? 'Datenstand: ' + m.stand + (m.fahrten ? ' · ' + m.fahrten + ' Fahrten' : '') : '';
    smsg.textContent = ''; sm.hidden = false;
  };
  const closeSettings = () => { sm.hidden = true; };
  document.getElementById('mtb-settings').addEventListener('click', openSettings);
  document.getElementById('mtb-s-close').addEventListener('click', closeSettings);
  sm.addEventListener('click', e => { if (e.target === sm) closeSettings(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !sm.hidden) closeSettings(); });
  document.getElementById('mtb-s-save').addEventListener('click', () => {
    store.setting('apiKey', document.getElementById('mtb-s-key').value.trim());
    store.setting('model', document.getElementById('mtb-s-model').value.trim() || 'claude-opus-5-5');
    smsg.textContent = 'Gespeichert.';
  });
  document.getElementById('mtb-s-export').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([store.exportJSON()], {type: 'application/json'}));
    a.download = 'mountainbike-sicherung-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    smsg.textContent = 'Sicherung heruntergeladen.';
  });
  document.getElementById('mtb-s-import').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try { store.importJSON(await f.text()); smsg.textContent = 'Sicherung eingespielt.'; draw(); }
    catch (err) { smsg.textContent = 'Einspielen fehlgeschlagen: ' + err.message; }
    e.target.value = '';
  });

  // Seitenwechsel
  const pages = {'je-jahr': document.getElementById('je-jahr'), 'alle-jahre': document.getElementById('alle-jahre'), 'touren': document.getElementById('touren'), 'trail-duell': document.getElementById('trail-duell')};
  let pageId = 'je-jahr';
  const showPage = (id, link) => {
    if (!pages[id]) return;
    pageId = id;
    Object.entries(pages).forEach(([k, el]) => { el.hidden = k !== id; });
    root.querySelectorAll('.mtb-tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.page === id)));
    if (link) dash.setLink(id);
    window.scrollTo(0, 0);
    draw();
  };
  root.querySelectorAll('.mtb-tabs button').forEach(b => b.addEventListener('click', () => showPage(b.dataset.page, true)));

  function draw() {
    if (pageId === 'alle-jahre') return drawAll();
    if (pageId === 'touren') return drawTouren();
    if (pageId === 'trail-duell') return drawDuell();
    const s = dash.data('mtb_summe'), jh = dash.data('mtb_jahre'), dl = dash.data('mtb_ytd_delta'), mo = dash.data('mtb_monat'), ku = dash.data('mtb_kumuliert'),
      rg = dash.data('mtb_region'), rk = dash.data('mtb_rekorde'), f = dash.data('mtb_fahrten');
    const years = jh.status === 'ok' ? jh.data.map(r => r.jahr) : [];
    if (year == null && years.length) year = years[0];
    const latest = years[0];
    document.getElementById('mtb-yt').textContent = year == null ? '—' : String(year);
    root.querySelectorAll('.mtb-yl').forEach(el => { el.textContent = year == null ? '—' : String(year); });
    drawYears(jh);
    // Kennzahlen des gewählten Jahres
    root.querySelectorAll('[data-source="mtb_summe"]').forEach(el => {
      settle(el, s.status);
      if (year != null) el.setAttribute('data-where', 'jahr=' + year);
      const r = s.status === 'ok' ? s.data.find(x => x.jahr === year) : null;
      el.textContent = r && r[el.dataset.field] != null ? nf0.format(r[el.dataset.field]) : '—';
    });
    // Veränderung zum Vorjahr (nur neuestes Jahr, bis Stichtag)
    const cut = jh.status === 'ok' && jh.data[0] ? jh.data[0].stichtag : '';
    root.querySelectorAll('[data-source="mtb_ytd_delta"].mtb-d').forEach(el => {
      el.classList.remove('up', 'down');
      const r = dl.status === 'ok' ? dl.data.find(x => x.kennzahl === el.dataset.where.split('=')[1]) : null;
      if (year !== latest || !r || r.delta_pct == null) { el.textContent = year !== latest && year != null ? 'ganzes Jahr' : '—'; return; }
      el.textContent = (r.delta_pct > 0 ? '+' : r.delta_pct < 0 ? '−' : '±') + Math.abs(r.delta_pct) + ' % ggü. ' + r.vorjahr + ' bis ' + cut;
      el.classList.add(r.delta_pct > 0 ? 'up' : r.delta_pct < 0 ? 'down' : 'x');
    });
    // Bestwerte
    root.querySelectorAll('[data-source="mtb_rekorde"]').forEach(el => {
      settle(el, rk.status);
      const key = el.dataset.where.split('rekord=')[1];
      if (year != null) el.setAttribute('data-where', 'jahr=' + year + '&rekord=' + key);
      const r = rk.status === 'ok' ? rk.data.find(x => x.jahr === year && x.rekord === key) : null;
      if (!r || r.wert == null) { el.textContent = '—'; return; }
      el.textContent = el.dataset.field === 'wert' ? nf1.format(r.wert) + ' ' + r.einheit : r.info;
    });
    // Stichtag
    const ce = document.getElementById('mtb-cut'); ce.textContent = cut || '—';
    // Fazit
    const tk = document.getElementById('mtb-take');
    const okAll = s.status === 'ok' && dl.status === 'ok' && jh.status === 'ok';
    settle(tk, okAll ? 'ok' : s.status);
    if (okAll && year != null) {
      const r = s.data.find(x => x.jahr === year);
      const km = dl.data.find(x => x.kennzahl === 'km'), hm = dl.data.find(x => x.kennzahl === 'hm');
      let txt = r ? `${year}: ${nf0.format(r.km)} km und ${nf0.format(r.hm)} Höhenmeter in ${r.fahrten} Fahrten.` : '';
      if (year === latest && km && km.delta_pct != null) txt += ` Bis ${cut} sind das ${Math.abs(km.delta_pct)} % ${km.delta_pct >= 0 ? 'mehr' : 'weniger'} Kilometer und ${Math.abs(hm.delta_pct)} % ${hm.delta_pct >= 0 ? 'mehr' : 'weniger'} Höhenmeter als ${km.vorjahr} im selben Zeitraum.`;
      tk.textContent = txt || '—';
    } else tk.textContent = '—';
    drawKum(ku, years); drawYearTable(jh); drawMonths(mo, years); drawRegions(rg); drawScatter(f); drawTable(f, 'mtb-table', year);
  }
  dash.onData(draw);
  const named = location.hash.slice(1);
  if (pages[named] && named !== pageId) showPage(named, false);
})();
