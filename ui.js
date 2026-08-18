/* ИНТЕРФЕЙС пульта «Ядро + Масло». Считает только движок (engine.js), тут — отрисовка. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (n) { return Math.round(n).toLocaleString('ru-RU'); };
  var fmt1 = function (n) { return n.toLocaleString('ru-RU', { maximumFractionDigits: 1 }); };
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); };

  var GROUPS = [
    { key: 'kernel', title: 'Завод ядра', open: true },
    { key: 'oil', title: 'Завод масла', open: true },
    { key: 'storage', title: 'Склады', open: true },
    { key: 'policy', title: 'Правила работы', open: true },
    { key: 'horizon', title: 'Горизонт', open: false },
    { key: 'priceParts', title: 'Цены: составляющие', open: false },
    { key: 'prices', title: 'Цены, ₽/т с НДС', open: false },
    { key: 'freight', title: 'Отгрузка, ₽/т с НДС', open: false },
    { key: 'finance', title: 'Финансы', open: false }
  ];
  var STEP = { 'доля': 0.01, 'коэф': 0.01, 'год': 0.005, '₽/т': 100, 'т': 100, 'т/сут': 5, 'мес': 0.5 };

  var DEFAULTS = JSON.parse(JSON.stringify(CONFIG));
  var model = null, curDay = 0;

  /* ---------------- рельса параметров ---------------- */
  function buildRail() {
    var html = '';
    GROUPS.forEach(function (g) {
      var grp = CONFIG[g.key]; if (!grp) return;
      html += '<div class="rgrp' + (g.open ? ' open' : '') + '" data-grp="' + g.key + '">' +
        '<h4><span class="chev">▸</span>' + g.title + '</h4><div class="body">';
      Object.keys(grp).forEach(function (k) {
        var p = grp[k], id = 'p_' + g.key + '_' + k, ctl;
        if (p.u === 'А/Б') {
          ctl = '<select id="' + id + '"><option value="A"' + (p.v === 'A' ? ' selected' : '') + '>А — рапсом</option>' +
            '<option value="Б"' + (p.v === 'Б' ? ' selected' : '') + '>Б — простой</option></select>';
        } else if (p.u === '0/1') {
          ctl = '<input type="checkbox" id="' + id + '"' + (p.v ? ' checked' : '') + '>';
        } else {
          ctl = '<input type="number" id="' + id + '" value="' + fmtVal(p) + '" step="' + (STEP[p.u] || 1) + '"' +
            (p.d ? ' readonly tabindex="-1"' : '') + '><i>' + esc(p.u) + '</i>';
        }
        html += '<label class="' + (p.d ? 'derived' : '') + '" title="' + (p.d ? 'Расчётное поле. ' : '') +
          'Источник: ' + esc(p.src) + '"><span>' + esc(p.label) + '</span>' + ctl + '</label>';
      });
      html += '</div></div>';
    });
    html += '<button class="rreset" id="resetBtn">↺ Вернуть значения из БДР</button>';
    $('rail').innerHTML = html;

    $('rail').querySelectorAll('.rgrp h4').forEach(function (h) {
      h.addEventListener('click', function () { h.parentNode.classList.toggle('open'); });
    });
    GROUPS.forEach(function (g) {
      var grp = CONFIG[g.key]; if (!grp) return;
      Object.keys(grp).forEach(function (k) {
        var el = $('p_' + g.key + '_' + k); if (!el || CONFIG[g.key][k].d) return;
        el.addEventListener('change', function () {
          var p = CONFIG[g.key][k];
          if (el.type === 'checkbox') p.v = el.checked ? 1 : 0;
          else if (el.tagName === 'SELECT') p.v = el.value;
          else { var n = parseFloat(el.value); if (!isFinite(n)) { el.value = p.v; return; } p.v = n; }
          recalc();
        });
      });
    });
    $('resetBtn').addEventListener('click', function () {
      GROUPS.forEach(function (g) {
        if (!CONFIG[g.key]) return;
        Object.keys(CONFIG[g.key]).forEach(function (k) { CONFIG[g.key][k].v = DEFAULTS[g.key][k].v; });
      });
      syncRail(); recalc();
    });
  }
  /* расчётные величины показываем округлённо, введённые — как есть */
  function fmtVal(p) {
    if (typeof p.v !== 'number') return p.v;
    return p.d ? Math.round(p.v * 10000) / 10000 : p.v;
  }
  function syncRail() {
    GROUPS.forEach(function (g) {
      if (!CONFIG[g.key]) return;
      Object.keys(CONFIG[g.key]).forEach(function (k) {
        var el = $('p_' + g.key + '_' + k), p = CONFIG[g.key][k]; if (!el) return;
        if (el.type === 'checkbox') el.checked = !!p.v; else el.value = fmtVal(p);
      });
    });
  }

  /* ---------------- пересчёт ---------------- */
  var lastGood = null;
  function snapshot() {
    var o = {};
    GROUPS.forEach(function (g) {
      if (!CONFIG[g.key]) return;
      o[g.key] = {};
      Object.keys(CONFIG[g.key]).forEach(function (k) { o[g.key][k] = CONFIG[g.key][k].v; });
    });
    return o;
  }
  function restore(s) {
    Object.keys(s).forEach(function (grp) {
      Object.keys(s[grp]).forEach(function (k) { CONFIG[grp][k].v = s[grp][k]; });
    });
  }
  function recalc() {
    var next;
    try {
      next = calcModel(CONFIG);
    } catch (err) {
      $('cfgErr').style.display = '';
      $('cfgErr').innerHTML = '<b>⚠ Так считать нельзя:</b>\n' + esc(err.message) + '\nЗначение возвращено к последнему рабочему.';
      if (lastGood) { restore(lastGood); syncRail(); }
      return;
    }
    $('cfgErr').style.display = 'none';
    lastGood = snapshot();
    model = next;
    if (curDay > model.days.length - 1) curDay = model.days.length - 1;
    renderTz(); renderCalendar(); renderWarn(); renderKpi(); renderChart();
    renderDaySelector(); renderDay(); renderFlow(); renderFinance();
    renderMonths(); renderDaily(); renderExport(); renderFoot();
  }

  /* ---------------- страховой запас и правило запуска ---------------- */
  function renderTz() {
    var sd = CONFIG.policy.safetyDays.v, wd = CONFIG.horizon.workDays.v, cap = CONFIG.oil.intakeKern.v;
    $('safeBig').value = sd; $('safeRange').value = sd;
    var perDay = CONFIG.kernel.intake.v * (CONFIG.kernel.yKern2.v + CONFIG.kernel.yKern3.v);
    var first = model.switches.filter(function (s) { return s.to === 'kern'; })[0];
    $('tzInfo').innerHTML =
      'Нужно на месяц: <b>' + fmt(cap) + ' × ' + fmt(wd) + (sd > 0 ? ' + ' + fmt(cap * sd) : '') +
      ' = ' + fmt(cap * (wd + sd)) + ' т</b><br>' +
      'Приход ядра: <b>' + fmt1(perDay) + ' т/сут</b> = <b>' + fmt(perDay * wd) + ' т/мес</b><br>' +
      'Первый запуск на семечке: <b>' + (first ? first.date : 'не наступает') + '</b>';
  }

  /* ---------------- календарь месяцев ---------------- */
  function renderCalendar() {
    var swMonths = {}; model.switches.forEach(function (s) { swMonths[s.month] = 1; });
    $('calendar').innerHTML = model.months.map(function (m) {
      var mult = m.need > 0 ? m.available / m.need : 0;
      var t = 'На 1-е число: остаток ' + fmt(m.stockAtStart) + ' т + приход за месяц ' + fmt(m.planned) +
        ' т = доступно ' + fmt(m.available) + ' т; нужно ' + fmt(m.need) + ' т → ' +
        (m.crop === 'kern' ? 'семечка' : 'рапс') +
        (m.failDay ? '; посуточно не хватило на ' + m.failDay + '-е сутки' : '');
      return '<div class="mchip ' + (m.crop === 'kern' ? 'kern' : 'raps') + (swMonths[m.idx] && m.idx > 0 ? ' sw' : '') + '" title="' + esc(t) + '">' +
        '<div class="mn">' + m.label + '</div><div class="mt">' + (m.crop === 'kern' ? 'семечка' : 'рапс') + '</div>' +
        '<div class="mt" style="opacity:.75">' + fmt1(mult) + '×</div></div>';
    }).join('');
    var sw = model.switches.filter(function (s) { return s.from; });
    $('calSum').innerHTML =
      '<span>Правило: доступное ядро (остаток + приход за месяц) ≥ <b>' + fmt(CONFIG.oil.intakeKern.v *
        (CONFIG.horizon.workDays.v + CONFIG.policy.safetyDays.v)) + ' т</b> и обеспеченность каждые сутки</span>' +
      '<span>Месяцев на семечке: <b>' + model.kpi.kernMonths + '</b></span>' +
      '<span>на рапсе: <b>' + model.kpi.rapeMonths + '</b></span>' +
      '<span>Смен культуры: <b>' + sw.length + '</b></span>' +
      '<span>Даты смен: <b>' + (sw.length ? sw.map(function (s) { return s.date; }).join(' · ') : '—') + '</b></span>';
  }

  /* ---------------- сигнал по вместимости ---------------- */
  function renderWarn() {
    var w = $('warn'), k = model.kpi;
    if (k.overPeak <= 0.5) { w.style.display = 'none'; return; }
    var bad = model.days.filter(function (d) { return d.over > 0.5; });
    w.style.display = '';
    w.innerHTML = '<b>⚠ Не хватает места на складах:</b> в пик не влезает <b>' + fmt(k.overPeak) + ' т</b> · ' +
      'таких суток <b>' + k.overDays + '</b> · период ' + bad[0].date + ' — ' + bad[bad.length - 1].date +
      '. Вместимость ' + fmt(model.capTotal) + ' т (' + CONFIG.storage.count.v + ' × ' + fmt(CONFIG.storage.capacity.v) + ' т), пик ' + fmt(k.peakStock) + ' т.';
  }

  /* ---------------- KPI ---------------- */
  function renderKpi() {
    var k = model.kpi, C = CONFIG;
    var perDay = C.kernel.intake.v * (C.kernel.yKern2.v + C.kernel.yKern3.v);
    var need = C.oil.intakeKern.v * (C.horizon.workDays.v + C.policy.safetyDays.v);
    var minDay = model.days.reduce(function (a, r) { return r.stKern2 + r.stKern3 < a.stKern2 + a.stKern3 ? r : a; });
    var first = model.switches.filter(function (s) { return s.to === 'kern'; })[0];
    var items = [
      { c: 'kern', l: 'Приход ядра 2 кат.', v: fmt1(perDay), u: 'т/сут', d: fmt(C.kernel.intake.v) + ' т × ' + (C.kernel.yKern2.v * 100).toFixed(0) + '%' },
      { c: 'kern', l: 'Нужно на месяц работы', v: fmt(need), u: 'т', d: fmt(C.oil.intakeKern.v) + ' т/сут × ' + fmt(C.horizon.workDays.v + C.policy.safetyDays.v) + ' дн' },
      { c: 'kern', l: 'Минимум ядра за сезон', v: fmt(minDay.stKern2 + minDay.stKern3), u: 'т', d: minDay.date },
      { c: 'kern', l: 'Первый переход на семечку', v: first ? first.date.slice(0, 5) : '—', u: '', d: first ? first.date : 'не наступает' },
      { c: 'raps', l: 'Закуп рапса за сезон', v: fmt(k.rapeBuy), u: 'т', d: 'семечки ' + fmt(k.seedBuy) + ' т' },
      { c: k.overPeak > 0.5 ? 'bad' : 'ok', l: 'Пик на складах', v: fmt(k.peakStock), u: 'т', d: 'вместимость ' + fmt(model.capTotal) + ' т' },
      { c: k.overPeak > 0.5 ? 'bad' : 'ok', l: 'Не хватает места', v: fmt(k.overPeak), u: 'т', d: k.overDays + ' сут за сезон' },
      { c: k.idle > 0.5 ? 'bad' : 'ok', l: 'Простой завода масла', v: fmt(k.idle), u: 'т', d: 'недоработано сырья' },
      { c: 'raps', l: 'Прибыль лежит в остатках', v: (k.endValue / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: 1 }), u: 'млн ₽',
        d: (k.profit > 0 ? (k.endValue / k.profit * 100).toFixed(0) : '0') + ' % фин. результата' }
    ];
    $('peakbar').innerHTML = items.map(function (i) {
      return '<div class="pb ' + i.c + '"><div class="l">' + i.l + '</div>' +
        '<div class="v">' + i.v + (i.u ? '<small>' + i.u + '</small>' : '') + '</div>' +
        '<div class="d">' + i.d + '</div></div>';
    }).join('');
  }

  /* ---------------- график загрузки ---------------- */
  var GEO = { W: 900, H: 320, pl: 58, pr: 14, pt: 14, pb: 30 };
  function renderChart() {
    var d = model.days, N = d.length, g = GEO, cap = model.capTotal;
    if (!N) return;
    var yMax = Math.max(cap, model.kpi.peakStock) * 1.08 || 1;
    var iw = g.W - g.pl - g.pr, ih = g.H - g.pt - g.pb;
    var X = function (i) { return g.pl + (N > 1 ? i * iw / (N - 1) : iw / 2); };
    var Y = function (v) { return g.pt + ih * (1 - v / yMax); };
    var s = '';

    /* сетка */
    var stepY = niceStep(yMax / 5);
    for (var v = 0; v <= yMax; v += stepY) {
      s += '<line x1="' + g.pl + '" y1="' + Y(v).toFixed(1) + '" x2="' + (g.W - g.pr) + '" y2="' + Y(v).toFixed(1) +
        '" stroke="#E4E8E1" stroke-width="1"/>' +
        '<text x="' + (g.pl - 8) + '" y="' + (Y(v) + 4).toFixed(1) + '" text-anchor="end" font-size="10" fill="#8A949B" font-family="IBM Plex Mono,monospace">' + fmt(v) + '</text>';
    }
    /* границы месяцев */
    d.forEach(function (r, i) {
      if (r.day !== 1) return;
      s += '<line x1="' + X(i).toFixed(1) + '" y1="' + g.pt + '" x2="' + X(i).toFixed(1) + '" y2="' + (g.H - g.pb) +
        '" stroke="' + (i ? '#D3D8D0' : '#B9C0B7') + '" stroke-width="1"/>' +
        '<text x="' + (X(i) + 3).toFixed(1) + '" y="' + (g.H - g.pb + 13) + '" font-size="9.5" fill="#8A949B" font-family="IBM Plex Mono,monospace">' + r.monthLabel + '</text>';
      s += '<rect x="' + X(i).toFixed(1) + '" y="' + g.pt + '" width="' + (iw / model.months.length).toFixed(1) + '" height="6" fill="' +
        (r.crop === 'kern' ? '#4E7E9B' : '#DDA017') + '" opacity=".85"/>';
    });

    /* площади: ядро снизу, рапс сверху. Берём ПИК суток — то, что должно поместиться. */
    var kern = d.map(function (r) { return r.pkKern; });
    var tot = d.map(function (r) { return r.pkTotal; });
    s += '<path d="' + areaPath(kern, null, X, Y, N, Y(0)) + '" fill="#4E7E9B" opacity=".82"/>';
    s += '<path d="' + areaPath(tot, kern, X, Y, N, Y(0)) + '" fill="#DDA017" opacity=".82"/>';

    /* превышение вместимости — красная шапка */
    var seg = [], run = null;
    d.forEach(function (r, i) {
      if (r.pkTotal > cap + 0.5) { if (!run) { run = [i, i]; } else run[1] = i; }
      else if (run) { seg.push(run); run = null; }
    });
    if (run) seg.push(run);
    seg.forEach(function (sg) {
      var a = sg[0], b = sg[1], p = 'M' + X(a).toFixed(1) + ',' + Y(cap).toFixed(1);
      for (var i = a; i <= b; i++) p += ' L' + X(i).toFixed(1) + ',' + Y(tot[i]).toFixed(1);
      p += ' L' + X(b).toFixed(1) + ',' + Y(cap).toFixed(1) + ' Z';
      s += '<path d="' + p + '" fill="#C23B2E" opacity=".92"/>';
    });

    /* линия вместимости */
    s += '<line x1="' + g.pl + '" y1="' + Y(cap).toFixed(1) + '" x2="' + (g.W - g.pr) + '" y2="' + Y(cap).toFixed(1) +
      '" stroke="#C23B2E" stroke-width="1.6" stroke-dasharray="7 4"/>' +
      '<text x="' + (g.W - g.pr - 4) + '" y="' + (Y(cap) - 5).toFixed(1) + '" text-anchor="end" font-size="10.5" fill="#C23B2E" font-weight="600" font-family="IBM Plex Mono,monospace">вместимость ' + fmt(cap) + ' т</text>';

    /* маркер выбранных суток */
    s += '<line id="dayMark" x1="' + X(curDay).toFixed(1) + '" y1="' + g.pt + '" x2="' + X(curDay).toFixed(1) + '" y2="' + (g.H - g.pb) + '" stroke="#222A30" stroke-width="1.2" stroke-dasharray="3 3"/>';
    s += '<line x1="' + g.pl + '" y1="' + (g.H - g.pb) + '" x2="' + (g.W - g.pr) + '" y2="' + (g.H - g.pb) + '" stroke="#B9C0B7" stroke-width="1"/>';

    $('chart').innerHTML = s;
    hookChart(X, N);
  }
  function areaPath(top, bottom, X, Y, N, y0) {
    var p = 'M' + X(0).toFixed(1) + ',' + (bottom ? Y(bottom[0]) : y0).toFixed(1);
    for (var i = 0; i < N; i++) p += ' L' + X(i).toFixed(1) + ',' + Y(top[i]).toFixed(1);
    if (bottom) { for (var j = N - 1; j >= 0; j--) p += ' L' + X(j).toFixed(1) + ',' + Y(bottom[j]).toFixed(1); }
    else p += ' L' + X(N - 1).toFixed(1) + ',' + y0.toFixed(1);
    return p + ' Z';
  }
  function niceStep(x) {
    var p = Math.pow(10, Math.floor(Math.log10(x || 1))), n = x / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  }
  function hookChart(X, N) {
    var svg = $('chart'), tip = $('tip'), wrap = $('chartWrap');
    var toIdx = function (ev) {
      var b = svg.getBoundingClientRect();
      var vx = (ev.clientX - b.left) / b.width * GEO.W;
      var i = Math.round((vx - GEO.pl) / ((GEO.W - GEO.pl - GEO.pr) / Math.max(1, N - 1)));
      return Math.max(0, Math.min(N - 1, i));
    };
    svg.onmousemove = function (ev) {
      var i = toIdx(ev), r = model.days[i], b = wrap.getBoundingClientRect();
      tip.style.opacity = 1;
      tip.innerHTML = '<b>' + r.date + '</b> · ' + (r.crop === 'kern' ? 'семечка' : 'рапс') + '<br>' +
        'пик суток — ядро: <b>' + fmt(r.pkKern) + ' т</b><br>пик суток — рапс: <b>' + fmt(r.pkRape) + ' т</b><br>' +
        'всего в пике: <b>' + fmt(r.pkTotal) + ' т</b><br>остаток на конец: <b>' + fmt(r.stTotal) + ' т</b>' +
        (r.over > 0.5 ? '<br><span class="tw">сверх вместимости: ' + fmt(r.over) + ' т</span>' : '');
      var x = ev.clientX - b.left + 14, y = ev.clientY - b.top - 10;
      if (x + 190 > b.width) x = ev.clientX - b.left - 190;
      tip.style.left = Math.max(0, x) + 'px'; tip.style.top = Math.max(0, y) + 'px';
    };
    svg.onmouseleave = function () { tip.style.opacity = 0; };
    svg.onclick = function (ev) { curDay = toIdx(ev); $('dayRange').value = curDay; renderDay(); moveMark(); };
  }
  function moveMark() {
    var mk = $('dayMark'); if (!mk) return;
    var N = model.days.length, g = GEO;
    var x = g.pl + (N > 1 ? curDay * (g.W - g.pl - g.pr) / (N - 1) : 0);
    mk.setAttribute('x1', x.toFixed(1)); mk.setAttribute('x2', x.toFixed(1));
  }

  /* ---------------- склады на выбранные сутки ---------------- */
  function renderDaySelector() {
    var r = $('dayRange');
    r.max = model.days.length - 1; r.value = curDay;
    $('dMax').textContent = model.days.length;
  }
  function renderDay() {
    var r = model.days[curDay]; if (!r) return;
    $('dDate').textContent = r.date; $('dNum').textContent = curDay + 1;
    var c = $('dCrop');
    c.textContent = r.crop === 'kern' ? 'жмём ядро' : 'жмём рапс';
    c.style.background = r.crop === 'kern' ? 'var(--kern)' : 'var(--raps)';
    var cap = CONFIG.storage.capacity.v;
    var html = r.wh.map(function (q, i) {
      var k = r.whK[i], rp = r.whR[i];
      var what = k > 0.5 && rp > 0.5 ? 'ядро ' + fmt(k) + ' · рапс ' + fmt(rp)
        : k > 0.5 ? 'ядро 2 кат.' : rp > 0.5 ? 'рапс' : 'пусто';
      return '<div class="wh"><div class="th"><h4>Склад ' + (i + 1) + '</h4><span class="cap">' + fmt(cap) + ' т</span></div>' +
        '<div class="tons">' + fmt(q) + '<small> т</small></div>' +
        '<div class="pct">заполнен на ' + (cap > 0 ? (q / cap * 100).toFixed(0) : 0) + '% · ' + what + '</div>' +
        '<div class="bar"><i class="seg k" style="width:' + (cap > 0 ? k / cap * 100 : 0) + '%"></i>' +
        '<i class="seg r" style="width:' + (cap > 0 ? rp / cap * 100 : 0) + '%"></i></div></div>';
    }).join('');
    if (r.over > 0.5) {
      html += '<div class="wh over"><div class="th"><h4>Не влезает</h4><span class="cap">нет места</span></div>' +
        '<div class="tons" style="color:var(--bad)">' + fmt(r.over) + '<small> т</small></div>' +
        '<div class="pct">нужен ещё склад или сокращение закупа</div>' +
        '<div class="bar"><i class="seg" style="width:100%;background:var(--bad)"></i></div></div>';
    }
    $('whs').innerHTML = html;
  }

  /* ---------------- потоки по месяцам ---------------- */
  function renderFlow() {
    var head = '<thead><tr>' +
      '<th rowspan="2">Месяц</th><th rowspan="2">Культура</th>' +
      '<th colspan="2">Приход сырья</th><th colspan="3">Завод ядра выдал</th>' +
      '<th colspan="3">Завод масла переработал</th><th colspan="4">Остаток на конец месяца</th></tr>' +
      '<tr><th>семечка</th><th>рапс</th><th>ядро 1 кат.</th><th>ядро 2 кат.</th><th>лузга</th>' +
      '<th>из ядра</th><th>из рапса</th><th>простой</th>' +
      '<th>ядро 2 кат.</th><th>рапс</th><th>всего</th><th>сверх</th></tr></thead>';
    var t = { seedBuy: 0, rapeBuy: 0, kern1: 0, kern2: 0, husk: 0, fk: 0, fr: 0, idle: 0 };
    var body = model.months.map(function (m) {
      var L = model.days[(m.idx + 1) * CONFIG.horizon.workDays.v - 1];
      t.seedBuy += m.seedBuy; t.rapeBuy += m.rapeBuy; t.kern1 += m.kern1; t.kern2 += m.kern2;
      t.husk += m.husk; t.fk += m.oilFromKern; t.fr += m.oilFromRape; t.idle += m.idle;
      return '<tr class="' + (m.crop === 'kern' ? 'k' : 'r') + '"><td>' + m.label + '</td>' +
        '<td style="text-align:left">' + (m.crop === 'kern' ? 'семечка' : 'рапс') + '</td>' +
        '<td class="g1">' + fmt(m.seedBuy) + '</td><td class="g1">' + fmt(m.rapeBuy) + '</td>' +
        '<td class="g2">' + fmt(m.kern1) + '</td><td class="g2">' + fmt(m.kern2) + '</td><td class="g2">' + fmt(m.husk) + '</td>' +
        '<td class="g3">' + fmt(m.oilFromKern) + '</td><td class="g3">' + fmt(m.oilFromRape) + '</td>' +
        '<td class="g3' + (m.idle > 0.5 ? ' bad' : '') + '">' + fmt(m.idle) + '</td>' +
        '<td>' + fmt(L.stKern2) + '</td><td>' + fmt(L.stRape) + '</td><td>' + fmt(L.stTotal) + '</td>' +
        '<td class="' + (m.overPeak > 0.5 ? 'bad' : '') + '">' + (m.overPeak > 0.5 ? fmt(m.overPeak) : '—') + '</td></tr>';
    }).join('');
    var foot = '<tfoot><tr><td>ИТОГО</td><td></td><td>' + fmt(t.seedBuy) + '</td><td>' + fmt(t.rapeBuy) + '</td>' +
      '<td>' + fmt(t.kern1) + '</td><td>' + fmt(t.kern2) + '</td><td>' + fmt(t.husk) + '</td>' +
      '<td>' + fmt(t.fk) + '</td><td>' + fmt(t.fr) + '</td><td>' + fmt(t.idle) + '</td>' +
      '<td colspan="4"></td></tr></tfoot>';
    $('flowTbl').innerHTML = head + '<tbody>' + body + '</tbody>' + foot;
  }

  /* ---------------- накопительно по месяцам ---------------- */
  function renderMonths() {
    var cumK = 0, cumR = 0;
    $('months').innerHTML = model.months.map(function (m) {
      var L = model.days[(m.idx + 1) * CONFIG.horizon.workDays.v - 1];
      cumK += m.kern2; cumR += m.rapeBuy;
      return '<div class="mo ' + (m.crop === 'kern' ? 'k' : 'r') + '">' +
        '<div class="mh">' + m.label + '<small>' + (m.crop === 'kern' ? 'семечка' : 'рапс') + '</small></div>' +
        '<div class="mr"><span>Ядро 2 кат. пришло</span><b>' + fmt(m.kern2) + '</b></div>' +
        '<div class="mr"><span>Ядро ушло на масло</span><b>' + fmt(m.oilFromKern) + '</b></div>' +
        '<div class="mr"><span>Рапс закуплен</span><b>' + fmt(m.rapeBuy) + '</b></div>' +
        '<div class="sep"></div>' +
        '<div class="mr"><span>Остаток на конец</span><b>' + fmt(L.stTotal) + '</b></div>' +
        '<div class="mr' + (m.overPeak > 0.5 ? ' bad' : '') + '"><span>Сверх вместимости</span><b>' + (m.overPeak > 0.5 ? fmt(m.overPeak) : '—') + '</b></div>' +
        '<div class="sep"></div>' +
        '<div class="mr"><span>Ядра накопительно</span><b>' + fmt(cumK) + '</b></div>' +
        '<div class="mr"><span>Рапса накопительно</span><b>' + fmt(cumR) + '</b></div>' +
        '</div>';
    }).join('');
  }

  /* ---------------- таблица по дням ---------------- */
  var DAILY_COLS = [
    ['Дата', function (r) { return r.date; }, ''],
    ['Культ.', function (r) { return r.crop === 'kern' ? 'семечка' : 'рапс'; }, 'dim'],
    ['Семечка', function (r) { return fmt(r.seedBuy); }, ''],
    ['Рапс', function (r) { return fmt(r.rapeBuy); }, ''],
    ['Ядро 1 кат.', function (r) { return fmt(r.kern1); }, ''],
    ['Ядро 2 кат.', function (r) { return fmt(r.kern2); }, ''],
    ['Лузга', function (r) { return fmt(r.husk); }, 'dim'],
    ['Вход', function (r) { return fmt(r.oilIntake); }, ''],
    ['Масло', function (r) { return fmt(r.oilSun + r.oilRape); }, ''],
    ['Шрот', function (r) { return fmt(r.mealSun + r.mealRape); }, ''],
    ['Простой', function (r) { return r.idle > 0.5 ? fmt(r.idle) : '—'; }, 'idle'],
    ['Ядро 2 кат.', function (r) { return fmt(r.stKern2); }, 'gk'],
    ['Рапс', function (r) { return fmt(r.stRape); }, 'gr'],
    ['На конец', function (r) { return fmt(r.stTotal); }, ''],
    ['Пик суток', function (r) { return fmt(r.pkTotal); }, ''],
    ['Склад 1', function (r) { return fmt(r.wh[0] || 0); }, ''],
    ['Склад 2', function (r) { return fmt(r.wh[1] || 0); }, ''],
    ['Сверх', function (r) { return r.over > 0.5 ? fmt(r.over) : '—'; }, 'over']
  ];
  function renderDaily() {
    var head = '<thead><tr class="grp"><th colspan="2"></th><th colspan="2">Приход сырья</th>' +
      '<th colspan="3">Завод ядра</th><th colspan="4">Завод масла</th>' +
      '<th colspan="4">Остатки на складах</th><th colspan="3">Раскладка по складам</th></tr><tr class="sub">' +
      DAILY_COLS.map(function (c) { return '<th>' + c[0] + '</th>'; }).join('') + '</tr></thead>';
    var body = model.days.map(function (r) {
      return '<tr class="' + (r.crop === 'kern' ? 'k' : 'r') + (r.over > 0.5 ? ' over' : '') + (r.day === 1 ? ' first' : '') + '">' +
        DAILY_COLS.map(function (c) {
          var cls = c[2] === 'idle' ? (r.idle > 0.5 ? 'bad' : 'dim') : c[2] === 'over' ? (r.over > 0.5 ? 'bad' : 'dim') : c[2];
          return '<td' + (cls ? ' class="' + cls + '"' : '') + '>' + c[1](r) + '</td>';
        }).join('') + '</tr>';
    }).join('');
    $('dailyTbl').innerHTML = head + '<tbody>' + body + '</tbody>';
  }

  /* ---------------- выгрузка ---------------- */
  function renderExport() {
    var sel = $('expScope');
    sel.innerHTML = '<option value="all">весь сезон</option>' +
      model.months.map(function (m) { return '<option value="' + m.idx + '">' + m.label + '</option>'; }).join('');
    $('expNote').textContent = 'три листа: БДР, по дням, параметры с источниками';
  }

  /* строки БДР — порядок и названия как в листе «Ядро+масло» (строки 9–33).
     u: t — тонны, m — тыс. руб, p — доля. c: sum — итоговая строка, sub — расшифровка. */
  var BDR_ROWS = [
    { l: 'Продажа (тонн), в т.ч.', u: 't', c: 'sum', f: function (m) { return m.kern1 + m.oilSun + m.mealSun + m.oilRape + m.mealRape; } },
    { l: 'Ядро 1 кат.', u: 't', c: 'sub', f: function (m) { return m.kern1; } },
    { l: 'Ядро 2 кат. (П/Ф) — весь на масло, не продаём', u: 't', c: 'sub', f: function () { return 0; } },
    { l: 'Ядро 3 кат.', u: 't', c: 'sub', f: function () { return 0; } },
    { l: 'Лузга', u: 't', c: 'sub', f: function () { return 0; } },
    { l: 'Масло подсолнечное', u: 't', c: 'sub', f: function (m) { return m.oilSun; } },
    { l: 'Жмых подсолнечный', u: 't', c: 'sub', f: function (m) { return m.mealSun; } },
    { l: 'Масло рапсовое', u: 't', c: 'sub', f: function (m) { return m.oilRape; } },
    { l: 'Жмых рапсовый', u: 't', c: 'sub', f: function (m) { return m.mealRape; } },
    { l: 'Выручка (тыс. руб), в т.ч.', u: 'm', c: 'sum', f: function (m) { return m.revenue / 1000; } },
    { l: 'Ядро 1 кат.', u: 'm', c: 'sub', f: function (m) { return m.revKern1 / 1000; } },
    { l: 'Масло подсолнечное', u: 'm', c: 'sub', f: function (m) { return m.revSunOil / 1000; } },
    { l: 'Жмых подсолнечный', u: 'm', c: 'sub', f: function (m) { return m.revSunMeal / 1000; } },
    { l: 'Масло рапсовое', u: 'm', c: 'sub', f: function (m) { return m.revRapeOil / 1000; } },
    { l: 'Жмых рапсовый', u: 'm', c: 'sub', f: function (m) { return m.revRapeMeal / 1000; } },
    { l: 'Лузга', u: 'm', c: 'sub', f: function (m) { return m.revHusk / 1000; } },
    { l: 'Себестоимость (тыс. руб)', u: 'm', c: 'sum', f: function (m) { return m.cost / 1000; } },
    { l: 'Списано ядро 1 кат. (закуп семечки + обрушка)', u: 'm', c: 'sub', f: function (m) { return m.costKern1 / 1000; } },
    { l: 'Списано сырьё маслоцеха (ядро 2 кат. / рапс)', u: 'm', c: 'sub', f: function (m) { return m.costOilRaw / 1000; } },
    { l: 'Переработка на маслоцехе', u: 'm', c: 'sub', f: function (m) { return m.costProcOil / 1000; } },
    { l: 'Отгрузка (тыс. руб)', u: 'm', c: 'sum', f: function (m) { return m.freight / 1000; } },
    { l: 'Ядро 1 кат.', u: 'm', c: 'sub', f: function (m) { return m.frKern1 / 1000; } },
    { l: 'Масло (флекситанк)', u: 'm', c: 'sub', f: function (m) { return m.frOil / 1000; } },
    { l: 'Жмых', u: 'm', c: 'sub', f: function (m) { return m.frMeal / 1000; } },
    { l: '% пользование деньгами (тыс. руб)', u: 'm', c: '', f: function (m) { return m.interest / 1000; } },
    { l: 'Налог на прибыль (тыс. руб)', u: 'm', c: '', f: function (m) { return m.tax / 1000; } },
    { l: 'Фин результат (тыс. руб)', u: 'm', c: 'res', f: function (m) { return m.profit / 1000; } },
    { l: 'Рентабельность', u: 'p', c: 'res', f: function (m) { return m.margin; } }
  ];
  function bdrTotal(row) {
    if (row.u === 'p') return model.kpi.revenue > 0 ? model.kpi.profit / model.kpi.revenue : 0;
    return model.months.reduce(function (a, m) { return a + row.f(m); }, 0);
  }

  /* ---------------- финансовый блок ---------------- */
  function renderFinance() {
    var k = model.kpi, mln = function (n) { return (n / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: 1 }); };
    var other = k.freight + k.interest + k.tax;
    var head = [
      { c: 'rev', l: 'Выручка за сезон', n: mln(k.revenue), u: 'млн ₽',
        sub: 'масло подс. ' + fmt(k.oilSun) + ' т · масло рапс. ' + fmt(k.oilRape) + ' т<br>ядро 1 кат. ' + fmt(k.kern1) + ' т' },
      { c: 'cost', l: 'Себестоимость', n: mln(k.cost), u: 'млн ₽',
        sub: 'отгрузка ' + mln(k.freight) + ' · % за деньги ' + mln(k.interest) + '<br>налог ' + mln(k.tax) + ' млн ₽' },
      { c: 'prof' + (k.profit < 0 ? ' neg' : ''), l: 'Фин. результат', n: mln(k.profit), u: 'млн ₽',
        sub: 'рентабельность ' + (k.revenue > 0 ? (k.profit / k.revenue * 100).toFixed(1) : '0') + ' %<br>' +
          'прочие расходы ' + mln(other) + ' млн ₽' },
      { c: 'stock', l: 'Прибыль в остатках', n: mln(k.endValue), u: 'млн ₽',
        sub: 'ядро ' + fmt(k.endKern2) + ' т · рапс ' + fmt(k.endRape) + ' т<br><b>' +
          (k.profit > 0 ? (k.endValue / k.profit * 100).toFixed(0) : '0') + ' % фин. результата не в деньгах</b>' }
    ];
    $('finHead').innerHTML = head.map(function (h) {
      return '<div class="hl ' + h.c + '"><div class="l">' + h.l + '</div>' +
        '<div class="n">' + h.n + '<small>' + h.u + '</small></div><div class="sub">' + h.sub + '</div></div>';
    }).join('');

    var val = function (row, v) {
      return row.u === 'p' ? (v * 100).toFixed(1) + ' %' : fmt(v);
    };
    var html = '<thead><tr><th>Показатель</th>' +
      model.months.map(function (m) { return '<th>' + m.label + '</th>'; }).join('') + '<th>ИТОГО</th></tr>' +
      '<tr><td style="font-weight:600">Культура месяца</td>' +
      model.months.map(function (m) {
        return '<td style="color:' + (m.crop === 'kern' ? 'var(--kern-d)' : 'var(--raps-d)') + ';font-weight:600">' +
          (m.crop === 'kern' ? 'семечка' : 'рапс') + '</td>';
      }).join('') + '<td></td></tr></thead><tbody>';
    BDR_ROWS.forEach(function (row) {
      html += '<tr class="' + row.c + '"><td>' + esc(row.l) + '</td>' +
        model.months.map(function (m) {
          var v = row.f(m);
          return '<td' + (v < 0 ? ' class="neg"' : '') + '>' + val(row, v) + '</td>';
        }).join('') +
        '<td>' + val(row, bdrTotal(row)) + '</td></tr>';
    });
    $('bdrTbl').innerHTML = html + '</tbody>';

    var perTon = model.days[0].unitKern;
    $('finNote').innerHTML =
      '<b>Как читать.</b> Строки и порядок — как в листе «Ядро+масло» файла БДР. Выручка и сырьё делятся на 1,1 (НДС товара), ' +
      'переработка и отгрузка — на 1,2 (НДС услуг), налог на прибыль ' + (CONFIG.finance.profitTax.v * 100).toFixed(0) + ' %, при убытке не начисляется. ' +
      '<b>Отличие от файла:</b> затраты на сырьё списываются в месяц переработки, а не закупа, поэтому переходящий остаток складов ' +
      'остаётся активом (' + mln(k.endValue) + ' млн ₽) и в себестоимость сезона не попадает. ' +
      'Затраты завода ядра ложатся на товарный выход пропорционально массе (лузга затрат не несёт): ' +
      'тонна ядра 2 кат. на складе стоит <b>' + fmt(perTon) + ' ₽</b>, сверху маслоцех добавляет ' +
      fmt(CONFIG.oil.procCost.v / CONFIG.finance.vatService.v) + ' ₽/т.';
  }

  function doExport() {
    var scope = $('expScope').value;
    var rows = scope === 'all' ? model.days : model.days.filter(function (r) { return r.month === +scope; });
    var r2 = function (x) { return Math.round(x * 100) / 100; };

    /* лист БДР: строки-показатели, колонки-месяцы, последняя колонка ИТОГО */
    var bdr = [['БДР'].concat(model.months.map(function (m) { return m.label; }), ['ИТОГО'])];
    bdr.push(['Культура месяца'].concat(model.months.map(function (m) { return m.crop === 'kern' ? 'семечка' : 'рапс'; }), ['']));
    BDR_ROWS.forEach(function (row) {
      var bold = row.c === 'sum' || row.c === 'res';
      var label = (row.c === 'sub' ? '   ' : '') + row.l;
      bdr.push([{ v: label, b: bold }].concat(
        model.months.map(function (m) { return { v: r2(row.f(m)), b: bold }; }),
        [{ v: r2(bdrTotal(row)), b: true }]));
    });
    var bdrSheet = { name: 'БДР', widths: [38].concat(model.months.map(function () { return 12; }), [13]), rows: bdr };

    /* лист по дням */
    var aoa = [DAILY_COLS.map(function (c) { return { v: c[0], b: true }; })];
    rows.forEach(function (r) {
      aoa.push([r.date, r.crop === 'kern' ? 'семечка' : 'рапс',
        r2(r.seedBuy), r2(r.rapeBuy), r2(r.kern1), r2(r.kern2), r2(r.husk),
        r2(r.oilIntake), r2(r.oilSun + r.oilRape), r2(r.mealSun + r.mealRape), r2(r.idle),
        r2(r.stKern2), r2(r.stRape), r2(r.stTotal), r2(r.pkTotal),
        r2(r.wh[0] || 0), r2(r.wh[1] || 0), r2(r.over)]);
    });
    var daySheet = { name: 'По дням', widths: [12, 10].concat(DAILY_COLS.slice(2).map(function () { return 11; })), rows: aoa };

    /* лист параметров с источниками */
    var pa = [[{ v: 'Группа', b: true }, { v: 'Параметр', b: true }, { v: 'Значение', b: true }, { v: 'Ед.', b: true }, { v: 'Источник', b: true }]];
    GROUPS.forEach(function (g) {
      if (!CONFIG[g.key]) return;
      Object.keys(CONFIG[g.key]).forEach(function (k) {
        var p = CONFIG[g.key][k]; pa.push([g.title, p.label, p.v, p.u, p.src]);
      });
    });
    var parSheet = { name: 'Параметры', widths: [22, 38, 14, 8, 52], rows: pa };

    XLSXLite.download('Ядро_Масло_' + (scope === 'all' ? 'сезон' : model.months[+scope].label) + '.xlsx',
      [bdrSheet, daySheet, parSheet]);
  }

  function renderFoot() {
    $('foot').innerHTML = 'Источник цифр — «БДР (мотивация).xlsx», листы «Ядро+масло» и «Масло (рапс, Китай)». ' +
      'Наведите курсор на подпись параметра слева — во всплывающей подсказке указан лист и ячейка. ' +
      'Правило переключения: на 1-е число месяца сравниваем накопленное ядро 2 кат. с потребностью (мощность маслоцеха × ТЗ); ' +
      'внутри месяца культура не меняется.';
  }

  /* ---------------- события ---------------- */
  function init() {
    buildRail();
    lastGood = snapshot();
    $('safeBig').addEventListener('input', function () {
      var n = parseFloat(this.value); if (!isFinite(n) || n < 0) return;
      CONFIG.policy.safetyDays.v = n; syncRail(); recalc();
    });
    $('safeRange').addEventListener('input', function () {
      CONFIG.policy.safetyDays.v = +this.value; syncRail(); recalc();
    });
    $('dayRange').addEventListener('input', function () { curDay = +this.value; renderDay(); moveMark(); });
    $('expBtn').addEventListener('click', doExport);
    document.querySelectorAll('.sect-h.tog').forEach(function (h) {
      h.addEventListener('click', function () { document.getElementById(h.dataset.sect).classList.toggle('open'); });
    });
    window.addEventListener('resize', function () { renderChart(); });
    recalc();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
