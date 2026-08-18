/* ИНТЕРФЕЙС пульта «Ядро + Масло». Считает только движок (engine.js), тут — отрисовка. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (n) { return Math.round(n).toLocaleString('ru-RU'); };
  var fmt1 = function (n) { return n.toLocaleString('ru-RU', { maximumFractionDigits: 1 }); };
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); };

  /* Группы рельсы. Наверху — то, что реально крутят; расчётные поля собраны отдельно. */
  var RAIL = [
    { title: 'Основные', open: true, f: ['kernel.intake', 'oil.intakeKern', 'oil.intakeRape', 'policy.safetyDays',
        'oil.procCost', 'kernel.procCost', 'storage.capacity', 'storage.count'] },
    { title: 'Выходы завода ядра', f: ['kernel.yKern1', 'kernel.yKern3', 'kernel.yHusk', 'kernel.yLoss'] },
    { title: 'Выходы завода масла', f: ['oil.kernOil', 'oil.kernTotal', 'oil.rapeOil', 'oil.rapeTotal'] },
    { title: 'Склады и правила', f: ['storage.startKern2', 'storage.startKern3', 'storage.startRape',
        'policy.buyWindow', 'policy.rapeBuffer', 'policy.emptyMonth'] },
    { title: 'Сценарии закрытия и сбыта', f: ['policy.kernStop', 'policy.minRunDays', 'policy.sellKern2', 'policy.rapeOnly',
        'policy.rapeLimit', 'policy.kern2Limit'] },
    { title: 'Горизонт', f: ['horizon.startYear', 'horizon.startMonth', 'horizon.months', 'horizon.workDays'] },
    { title: 'Цены: составляющие', f: ['priceParts.cnyRate', 'priceParts.coefOn', 'priceParts.coefNum', 'priceParts.coefDen',
        'priceParts.kern1Cny', 'priceParts.kern1Grade', 'priceParts.kern1Log', 'priceParts.sunOilCny',
        'priceParts.sunOilLog1', 'priceParts.sunOilLog2', 'priceParts.sunMealBase', 'priceParts.rapeOilCny',
        'priceParts.rapeOilLog', 'priceParts.rapeMealCny', 'priceParts.rapeMealLog',
        'prices.buySeed', 'prices.buyRape', 'prices.husk'] },
    { title: 'Отгрузка', f: ['freight.kern1', 'freight.oil', 'freight.meal'] },
    { title: 'Финансы', f: ['finance.vatGoods', 'finance.vatService', 'finance.moneyRate', 'finance.stockMonths',
        'finance.apMonths', 'finance.arMonths', 'finance.monthsYear', 'finance.profitTax'] },
    { title: 'Расчётные значения', f: ['kernel.yKern2', 'oil.kernMeal', 'oil.kernLoss', 'oil.rapeMeal', 'oil.rapeLoss',
        'prices.kern1', 'prices.sunOil', 'prices.sunMeal', 'prices.rapeOil', 'prices.rapeMeal'] }
  ];
  /* короткие подписи для узкой панели; полное название и источник — в подсказке */
  var SHORT = {
    'kernel.intake': 'Заход ядра 2 кат.', 'kernel.procCost': 'Переработка ядра',
    'kernel.yKern1': 'Ядро 1 кат.', 'kernel.yKern2': 'Ядро 2 кат. (расчёт)', 'kernel.yKern3': 'Ядро 3 кат.',
    'kernel.yHusk': 'Лузга', 'kernel.yLoss': 'Потери',
    'oil.intakeRape': 'Маслоцех на рапсе', 'oil.intakeKern': 'Маслоцех на ядре', 'oil.procCost': 'Переработка масла',
    'oil.kernOil': 'Масло из ядра', 'oil.kernTotal': 'Товарный выход ядра', 'oil.kernMeal': 'Жмых подсолн.',
    'oil.kernLoss': 'Потери на ядре', 'oil.rapeOil': 'Масло из рапса', 'oil.rapeTotal': 'Товарный выход рапса',
    'oil.rapeMeal': 'Жмых рапсовый', 'oil.rapeLoss': 'Потери на рапсе',
    'storage.count': 'Складов', 'storage.capacity': 'Ёмкость склада',
    'storage.startKern2': 'Остаток ядра 2', 'storage.startKern3': 'Остаток ядра 3', 'storage.startRape': 'Остаток рапса',
    'policy.safetyDays': 'Страховой запас', 'policy.buyWindow': 'Окно закупа',
    'policy.kernStop': 'Стоп обрушки', 'policy.minRunDays': 'Мин. объём для пуска', 'policy.sellKern2': 'Излишек ядра на сторону',
    'policy.rapeOnly': 'Только рапс', 'policy.rapeLimit': 'Лимит рапса за сезон',
    'policy.kern2Limit': 'Лимит продажи ядра',
    'policy.emptyMonth': 'Ядро кончилось', 'policy.rapeBuffer': 'Страховой рапс',
    'horizon.startYear': 'Год старта', 'horizon.startMonth': 'Месяц старта',
    'horizon.months': 'Месяцев', 'horizon.workDays': 'Рабочих суток',
    'priceParts.cnyRate': 'Курс юаня', 'priceParts.coefOn': 'Коэффициент вкл',
    'priceParts.coefNum': 'Коэф. числитель', 'priceParts.coefDen': 'Коэф. знаменатель',
    'priceParts.kern1Cny': 'Ядро 1 кат., ¥', 'priceParts.kern1Grade': 'Ядро 1 кат., качество',
    'priceParts.kern1Log': 'Ядро 1 кат., логистика', 'priceParts.sunOilCny': 'Масло подс., ¥',
    'priceParts.sunOilLog1': 'Масло подс., лог. 1', 'priceParts.sunOilLog2': 'Масло подс., лог. 2',
    'priceParts.sunMealBase': 'Жмых подс., база', 'priceParts.rapeOilCny': 'Масло рапс., ¥',
    'priceParts.rapeOilLog': 'Масло рапс., логистика', 'priceParts.rapeMealCny': 'Жмых рапс., ¥',
    'priceParts.rapeMealLog': 'Жмых рапс., логистика',
    'prices.buySeed': 'Закуп ядра 2 кат.', 'prices.buyRape': 'Закуп рапса', 'prices.husk': 'Продажа лузги',
    'prices.kern1': 'Ядро 1 кат.', 'prices.sunOil': 'Масло подсолн.', 'prices.sunMeal': 'Жмых подсолн.',
    'prices.rapeOil': 'Масло рапсовое', 'prices.rapeMeal': 'Жмых рапсовый',
    'freight.kern1': 'Ядро 1 кат.', 'freight.oil': 'Масло', 'freight.meal': 'Жмых',
    'finance.vatGoods': 'НДС товар', 'finance.vatService': 'НДС услуги', 'finance.moneyRate': '% за деньги',
    'finance.stockMonths': 'Запас сырья', 'finance.apMonths': 'КЗ', 'finance.arMonths': 'ДЗ',
    'finance.monthsYear': 'Месяцев в году', 'finance.profitTax': 'Налог на прибыль'
  };
  var GROUP_TITLES = {
    horizon: 'Горизонт', kernel: 'Завод ядра', oil: 'Завод масла', storage: 'Склады', policy: 'Правила работы',
    priceParts: 'Цены: составляющие', prices: 'Цены, ₽/т с НДС', freight: 'Отгрузка, ₽/т с НДС', finance: 'Финансы'
  };
  /* на чём завод масла работал по факту */
  var WORK_NAME = { kern: 'на ядре 2 кат.', rape: 'на рапсе', mix: 'на обеих', none: 'завод стоял' };
  function cropName(code) { return WORK_NAME[code] || '—'; }
  /* для месяца: при работе на обеих культурах показываем объёмы */
  function workOf(m) {
    if (m.cropFact !== 'mix') return cropName(m.cropFact);
    return 'на ядре 2 кат. ' + fmt(m.oilFromKern) + ' т + на рапсе ' + fmt(m.oilFromRape) + ' т';
  }

  function param(path) { var a = path.split('.'); return CONFIG[a[0]] && CONFIG[a[0]][a[1]]; }
  function eachParam(fn) {
    Object.keys(CONFIG).forEach(function (g) {
      if (!CONFIG[g] || typeof CONFIG[g] !== 'object') return;
      Object.keys(CONFIG[g]).forEach(function (k) { if (CONFIG[g][k] && CONFIG[g][k].label) fn(g, k, CONFIG[g][k]); });
    });
  }
  var STEP = { 'доля': 0.01, 'коэф': 0.01, 'год': 0.005, '₽/т': 100, 'т': 100, 'т/сут': 5, 'мес': 0.5 };

  var DEFAULTS = JSON.parse(JSON.stringify(CONFIG));
  var model = null, curDay = 0;

  /* ---------------- рельса параметров ---------------- */
  function buildRail() {
    var html = '';
    RAIL.forEach(function (g, gi) {
      html += '<div class="rgrp' + (g.open ? ' open' : '') + '"><h4><span class="chev">▸</span>' + g.title +
        '</h4><div class="body">';
      g.f.forEach(function (path) {
        var p = param(path); if (!p) return;
        var id = 'p_' + path.replace('.', '_'), ctl, wide = '';
        if (p.u === 'А/Б') {
          wide = ' wide';
          ctl = '<select id="' + id + '"><option value="A"' + (p.v === 'A' ? ' selected' : '') + '>А — добить рапсом</option>' +
            '<option value="Б"' + (p.v === 'Б' ? ' selected' : '') + '>Б — простой</option></select>';
        } else if (p.u === '0/1') {
          ctl = '<input type="checkbox" id="' + id + '"' + (p.v ? ' checked' : '') + '>';
        } else {
          ctl = '<input type="number" id="' + id + '" value="' + fmtVal(p) + '" step="' + (STEP[p.u] || 1) + '"' +
            (p.d ? ' readonly tabindex="-1"' : '') + '>' + (p.u ? '<i>' + esc(p.u) + '</i>' : '');
        }
        html += '<label class="fld' + wide + (p.d ? ' derived' : '') + '" title="' + (p.d ? 'Расчётное поле. ' : '') +
          esc(p.label) + '\nИсточник: ' + esc(p.src) + '"><span class="fl">' + esc(SHORT[path] || p.label) +
          '</span><span class="fi">' + ctl + '</span></label>';
      });
      html += '</div></div>';
    });
    html += '<button class="rreset" id="resetBtn">↺ Вернуть значения из БДР</button>';
    $('rail').innerHTML = html;

    $('rail').querySelectorAll('.rgrp h4').forEach(function (h) {
      h.addEventListener('click', function () { h.parentNode.classList.toggle('open'); });
    });
    RAIL.forEach(function (g) {
      g.f.forEach(function (path) {
        var p = param(path); if (!p || p.d) return;
        var el = $('p_' + path.replace('.', '_')); if (!el) return;
        el.addEventListener('change', function () {
          if (el.type === 'checkbox') p.v = el.checked ? 1 : 0;
          else if (el.tagName === 'SELECT') p.v = el.value;
          else { var n = parseFloat(el.value); if (!isFinite(n)) { el.value = p.v; return; } p.v = n; }
          recalc();
        });
      });
    });
    $('resetBtn').addEventListener('click', function () {
      eachParam(function (g, k) { CONFIG[g][k].v = DEFAULTS[g][k].v; });
      syncRail(); recalc();
    });
  }
  /* расчётные величины показываем округлённо, введённые — как есть */
  function fmtVal(p) {
    if (typeof p.v !== 'number') return p.v;
    return p.d ? Math.round(p.v * 10000) / 10000 : p.v;
  }
  function syncRail() {
    eachParam(function (g, k, p) {
      var el = $('p_' + g + '_' + k); if (!el) return;
      if (el.type === 'checkbox') el.checked = !!p.v; else el.value = fmtVal(p);
    });
  }

  /* ---------------- пересчёт ---------------- */
  var lastGood = null;
  function snapshot() {
    var o = {};
    eachParam(function (g, k, p) { (o[g] = o[g] || {})[k] = p.v; });
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
      showErr('Так считать нельзя', err.message + '\nЗначение возвращено к последнему рабочему.');
      if (lastGood) { restore(lastGood); syncRail(); }
      return;
    }
    hideErr();
    lastGood = snapshot();
    model = next;
    if (curDay > model.days.length - 1) curDay = model.days.length - 1;
    try {
      renderTz(); renderCalendar(); renderWarn(); renderKpi(); renderK2(); renderChart();
      renderDaySelector(); renderDay(); renderFlow(); renderFinance();
      renderCapital(); renderDaily(); renderExport(); renderFoot();
    } catch (err) {
      showErr('Не удалось отрисовать пульт', err.message +
        '\nОбычно это старая версия страницы в кэше браузера. Обновите страницу с очисткой кэша: ' +
        'Cmd+Shift+R (Mac) или Ctrl+F5 (Windows).');
    }
  }
  function showErr(head, body) {
    var el = $('cfgErr');
    if (!el) { alert(head + '\n' + body); return; }
    el.style.display = '';
    el.innerHTML = '<b>⚠ ' + esc(head) + ':</b>\n' + esc(body);
  }
  function hideErr() { var el = $('cfgErr'); if (el) el.style.display = 'none'; }

  /* ---------------- поле страхового запаса переехало в панель параметров ---------------- */
  function renderTz() { }

  /* ---------------- календарь месяцев ---------------- */
  function renderCalendar() {
    var swMonths = {}; model.switches.forEach(function (s) { swMonths[s.month] = 1; });
    $('calendar').innerHTML = model.months.map(function (m) {
      var t = 'На 1-е число: остаток ' + fmt(m.stockAtStart) + ' т + приход за месяц ' + fmt(m.planned) +
        ' т = доступно ' + fmt(m.available) + ' т; нужно ' + fmt(m.need) + ' т → правило назначило ' +
        (m.crop === 'kern' ? 'ядро 2 кат.' : 'рапс') + '. По факту переработано: ' + cropName(m.cropFact) +
        ' (ядро ' + fmt(m.oilFromKern) + ' т, рапс ' + fmt(m.oilFromRape) + ' т)' +
        (m.tailCut > 0.5 ? '; закуп рапса срезан на ' + fmt(m.tailCut) + ' т по правилу минимального пуска' : '');
      var cls = m.cropFact === 'kern' ? 'kern' : m.cropFact === 'rape' ? 'raps' : m.cropFact === 'mix' ? 'mix' : 'none';
      return '<div class="mchip ' + cls + (swMonths[m.idx] && m.idx > 0 ? ' sw' : '') + '" title="' + esc(t) + '">' +
        '<div class="mn">' + m.label + '</div><div class="mt">' + cropName(m.cropFact) + '</div></div>';
    }).join('');
    var sw = model.switches.filter(function (s) { return s.from; });
    var cap = CONFIG.oil.intakeKern.v, wd = CONFIG.horizon.workDays.v, sd = CONFIG.policy.safetyDays.v;
    $('calSum').innerHTML =
      '<span>Потребность завода: <b>' + fmt(cap) + ' т/сут × ' + fmt(wd) + ' дн = ' + fmt(cap * wd) + ' т</b></span>' +
      (sd > 0 ? '<span>Порог запуска: <b>' + fmt(cap * wd) + ' т + страховой запас ' + fmt(sd) + ' дн = ' +
        fmt(cap * (wd + sd)) + ' т</b></span>' : '') +
      '<span>Месяцев на ядре 2 кат.: <b>' + model.kpi.kernMonths + '</b></span>' +
      '<span>на рапсе: <b>' + model.kpi.rapeMonths + '</b></span>' +
      (model.kpi.mixMonths ? '<span>смешанных: <b>' + model.kpi.mixMonths + '</b></span>' : '') +
      '<span>Смен культуры: <b>' + sw.length + '</b></span>' +
      '<span>Даты смен: <b>' + (sw.length ? sw.map(function (s) { return s.date; }).join(' · ') : '—') + '</b></span>';
    /* простой завода — сигнал живёт здесь, при нуле его нет вовсе */
    var idle = model.kpi.idle;
    var bad = model.months.filter(function (m) { return m.idle > 0.5; });
    /* красным — только настоящая нехватка сырья; срезанный хвост это штатное решение */
    $('calIdle').innerHTML = idle > 0.5
      ? '⚠ <b>Простой завода масла: ' + fmt(idle) + ' т</b> за сезон — не хватило сырья: ' +
        bad.map(function (m) { return m.label + ' (' + fmt(m.idle) + ' т)'; }).join(', ')
      : '';
    var tail = model.kpi.tailCut || 0;
    $('calTail').innerHTML = tail > 0.5
      ? 'Закуп рапса срезан на <b>' + fmt(tail) + ' т</b> по правилу минимального пуска (' +
        fmt(CONFIG.policy.minRunDays.v) + ' дн = ' + fmt(CONFIG.oil.intakeRape.v * CONFIG.policy.minRunDays.v) +
        ' т): запускать завод ради меньшего объёма нецелесообразно.'
      : '';
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

  /* ---------------- KPI-полоса убрана: сигналы живут внутри своих блоков ---------------- */
  function renderKpi() { }

  /* ---------------- цена ядра 2 кат.: чувствительность ---------------- */
  function variantProfit(over) {
    var c = JSON.parse(JSON.stringify(CONFIG));
    Object.keys(over).forEach(function (path) { var a = path.split('.'); c[a[0]][a[1]].v = over[path]; });
    try { return calcModel(c).kpi.profit; } catch (e) { return NaN; }
  }
  var K2_RATES = [1500, 2500, 3500, 5000, 6500];
  var K2_PRICES = [0, -0.1, -0.2, -0.3];
  function renderK2() {
    var P0 = CONFIG.prices.kern2.v, parity = parityPrice();
    $('k2card').innerHTML =
      '<div class="k2row"><span class="k2lab">Цена ядра 2 кат. (П/Ф)</span>' +
      '<span class="k2price"><input type="number" id="k2price" step="500" value="' + Math.round(P0 * 100) / 100 + '"><small>₽/т с НДС</small></span>' +
      '<span class="k2warn">не подтверждена</span>' +
      '<span class="k2par">паритет <b>' + fmt(parity) + ' ₽/т</b> при ставке ' + fmt(CONFIG.oil.procCost.v) +
      ' ₽/т — выгоднее <b>' + (P0 > parity ? 'продать' : 'отжать') + '</b></span>' +
      '<span class="k2hint">сетка «цена × ставка» — в выгрузке, лист «Сценарный анализ»</span></div>';
    $('k2price').addEventListener('change', function () {
      var n = parseFloat(this.value); if (!isFinite(n) || n < 0) { this.value = CONFIG.prices.kern2.v; return; }
      CONFIG.prices.kern2.v = n; syncRail(); recalc();
    });
  }
  /* ставка второго передела, при которой отжать = продать */
  function flipRate() {
    var C = CONFIG, vg = C.finance.vatGoods.v, vs = C.finance.vatService.v;
    var gross = C.oil.kernOil.v * C.prices.sunOil.v / vg + C.oil.kernMeal.v * C.prices.sunMeal.v / vg -
      (C.oil.kernOil.v * C.freight.oil.v + C.oil.kernMeal.v * C.freight.meal.v) / vs;
    var sell = C.prices.kern2.v / vg - C.freight.kern1.v / vs;
    return (gross - sell) * vs;
  }
  function parityAt(rate) {
    var C = CONFIG, vg = C.finance.vatGoods.v, vs = C.finance.vatService.v;
    var press = C.oil.kernOil.v * C.prices.sunOil.v / vg + C.oil.kernMeal.v * C.prices.sunMeal.v / vg -
      rate / vs - (C.oil.kernOil.v * C.freight.oil.v + C.oil.kernMeal.v * C.freight.meal.v) / vs;
    return (press + C.freight.kern1.v / vs) * vg;
  }
  function pressValue() {
    var C = CONFIG, vg = C.finance.vatGoods.v, vs = C.finance.vatService.v;
    return C.oil.kernOil.v * C.prices.sunOil.v / vg + C.oil.kernMeal.v * C.prices.sunMeal.v / vg -
      C.oil.procCost.v / vs - (C.oil.kernOil.v * C.freight.oil.v + C.oil.kernMeal.v * C.freight.meal.v) / vs;
  }
  function parityPrice() { return parityAt(CONFIG.oil.procCost.v); }

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
        (model.months[r.month].cropFact === 'rape' ? '#DDA017' : '#4E7E9B') + '" opacity=".85"/>';
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
      tip.innerHTML = '<b>' + r.date + '</b> · ' + cropName(r.useCrop) + '<br>' +
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
      '<th rowspan="2">Месяц</th><th rowspan="2">Работа завода масла</th>' +
      '<th colspan="2">Приход сырья</th><th colspan="3">Завод ядра выдал</th>' +
      '<th colspan="2">Завод масла переработал</th><th colspan="4">Остаток на конец месяца</th>' +
      '<th colspan="2">Накопительно</th></tr>' +
      '<tr><th>ядро 2 кат.</th><th>рапс</th><th>ядро 1 кат.</th><th>ядро 2 кат.</th><th>лузга</th>' +
      '<th>из ядра</th><th>из рапса</th>' +
      '<th>ядро 2 кат.</th><th>рапс</th><th>всего</th><th>сверх</th>' +
      '<th>ядро 2 кат.</th><th>рапс закуплен</th></tr></thead>';
    var t = { seedBuy: 0, rapeBuy: 0, kern1: 0, kern2: 0, husk: 0, fk: 0, fr: 0, idle: 0 };
    var cumK = 0, cumR = 0;
    var body = model.months.map(function (m) {
      var L = model.days[(m.idx + 1) * CONFIG.horizon.workDays.v - 1];
      t.seedBuy += m.seedBuy; t.rapeBuy += m.rapeBuy; t.kern1 += m.kern1; t.kern2 += m.kern2;
      t.husk += m.husk; t.fk += m.oilFromKern; t.fr += m.oilFromRape; t.idle += m.idle;
      cumK += m.kern2; cumR += m.rapeBuy;
      return '<tr class="' + (m.crop === 'kern' ? 'k' : 'r') + '"><td>' + m.label + '</td>' +
        '<td style="text-align:left">' + workOf(m) + '</td>' +
        '<td class="g1">' + fmt(m.seedBuy) + '</td><td class="g1">' + fmt(m.rapeBuy) + '</td>' +
        '<td class="g2">' + fmt(m.kern1) + '</td><td class="g2">' + fmt(m.kern2) + '</td><td class="g2">' + fmt(m.husk) + '</td>' +
        '<td class="g3">' + fmt(m.oilFromKern) + '</td><td class="g3">' + fmt(m.oilFromRape) + '</td>' +
        '<td>' + fmt(L.stKern2) + '</td><td>' + fmt(L.stRape) + '</td><td>' + fmt(L.stTotal) + '</td>' +
        '<td class="' + (m.overPeak > 0.5 ? 'bad' : '') + '">' + (m.overPeak > 0.5 ? fmt(m.overPeak) : '—') + '</td>' +
        '<td class="g4">' + fmt(cumK) + '</td><td class="g4">' + fmt(cumR) + '</td></tr>';
    }).join('');
    var foot = '<tfoot><tr><td>ИТОГО</td><td></td><td>' + fmt(t.seedBuy) + '</td><td>' + fmt(t.rapeBuy) + '</td>' +
      '<td>' + fmt(t.kern1) + '</td><td>' + fmt(t.kern2) + '</td><td>' + fmt(t.husk) + '</td>' +
      '<td>' + fmt(t.fk) + '</td><td>' + fmt(t.fr) + '</td>' +
      '<td colspan="4"></td><td>' + fmt(cumK) + '</td><td>' + fmt(cumR) + '</td></tr></tfoot>';
    $('flowTbl').innerHTML = head + '<tbody>' + body + '</tbody>' + foot;
  }

  /* ---------------- оборотный капитал (B35–B41) ---------------- */
  var CAP_ROWS = [
    { l: 'Запас сырья (мес)', c: 'B35', f: function (m) { return m.stockRaw; } },
    { l: 'КЗ (½ мес)', c: 'B36', f: function (m) { return m.stockRaw * CONFIG.finance.apMonths.v; } },
    { l: 'ДЗ (мес)', c: 'B37', f: function (m) { return m.arRaw; } },
    { l: 'Вложенный капитал', c: 'B38', f: function (m) { return m.capital; }, b: 1 },
    { l: '% пользования (год)', c: 'B40', f: function (m) { return m.capital * CONFIG.finance.moneyRate.v; } },
    { l: '% пользования (мес)', c: 'B41', f: function (m) { return m.interest; }, b: 1 }
  ];
  function renderCapital() {
    var html = '<thead><tr><th>Показатель</th><th>Ячейка</th>' +
      model.months.map(function (m) { return '<th>' + m.label + '</th>'; }).join('') + '<th>ИТОГО</th></tr></thead><tbody>';
    CAP_ROWS.forEach(function (row) {
      var vals = model.months.map(row.f);
      var total = row.l.indexOf('%') === 0 ? vals.reduce(function (a, x) { return a + x; }, 0)
        : vals.reduce(function (a, x) { return a + x; }, 0) / model.months.length;
      html += '<tr' + (row.b ? ' class="tot"' : '') + '><td>' + esc(row.l) + '</td><td class="cell">' + row.c + '</td>' +
        vals.map(function (v) { return '<td>' + fmt(v / 1000) + '</td>'; }).join('') +
        '<td>' + fmt(total / 1000) + '</td></tr>';
    });
    $('capTbl').innerHTML = html + '</tbody>';
  }

  /* ---------------- таблица по дням ---------------- */
  var DAILY_COLS = [
    ['Дата', function (r) { return r.date; }, ''],
    ['Работа', function (r) { return r.useCrop === 'both' ? 'на обеих' : cropName(r.useCrop); }, 'dim'],
    ['Ядро 2 кат.', function (r) { return fmt(r.seedBuy); }, ''],
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
    { l: 'Продажа (тонн), в т.ч.', u: 't', c: 'sum', f: function (m) { return m.kern1 + m.sellKern2 + m.oilSun + m.mealSun + m.oilRape + m.mealRape; } },
    { l: 'Ядро 1 кат.', u: 't', c: 'sub', f: function (m) { return m.kern1; } },
    { l: 'Ядро 2 кат. (П/Ф) — излишек на сторону', u: 't', c: 'sub', f: function (m) { return m.sellKern2; } },
    { l: 'Ядро 3 кат.', u: 't', c: 'sub', f: function () { return 0; } },
    { l: 'Лузга', u: 't', c: 'sub', f: function () { return 0; } },
    { l: 'Масло подсолнечное', u: 't', c: 'sub', f: function (m) { return m.oilSun; } },
    { l: 'Жмых подсолнечный', u: 't', c: 'sub', f: function (m) { return m.mealSun; } },
    { l: 'Масло рапсовое', u: 't', c: 'sub', f: function (m) { return m.oilRape; } },
    { l: 'Жмых рапсовый', u: 't', c: 'sub', f: function (m) { return m.mealRape; } },
    { l: 'Выручка (тыс. руб), в т.ч.', u: 'm', c: 'sum', f: function (m) { return m.revenue / 1000; } },
    { l: 'Ядро 1 кат.', u: 'm', c: 'sub', f: function (m) { return m.revKern1 / 1000; } },
    { l: 'Ядро 2 кат. (П/Ф)', u: 'm', c: 'sub', f: function (m) { return m.revKern2 / 1000; } },
    { l: 'Масло подсолнечное', u: 'm', c: 'sub', f: function (m) { return m.revSunOil / 1000; } },
    { l: 'Жмых подсолнечный', u: 'm', c: 'sub', f: function (m) { return m.revSunMeal / 1000; } },
    { l: 'Масло рапсовое', u: 'm', c: 'sub', f: function (m) { return m.revRapeOil / 1000; } },
    { l: 'Жмых рапсовый', u: 'm', c: 'sub', f: function (m) { return m.revRapeMeal / 1000; } },
    { l: 'Лузга', u: 'm', c: 'sub', f: function (m) { return m.revHusk / 1000; } },
    { l: 'Себестоимость (тыс. руб)', u: 'm', c: 'sum', f: function (m) { return m.cost / 1000; } },
    { l: 'Списано ядро 1 кат. (закуп ядра 2 кат. + обрушка)', u: 'm', c: 'sub', f: function (m) { return m.costKern1 / 1000; } },
    { l: 'Списано ядро 2 кат., проданное на сторону', u: 'm', c: 'sub', f: function (m) { return m.costKern2Sold / 1000; } },
    { l: 'Списано сырьё маслоцеха (ядро 2 кат. / рапс)', u: 'm', c: 'sub', f: function (m) { return m.costOilRaw / 1000; } },
    { l: 'Переработка на маслоцехе', u: 'm', c: 'sub', f: function (m) { return m.costProcOil / 1000; } },
    { l: 'Отгрузка (тыс. руб)', u: 'm', c: 'sum', f: function (m) { return m.freight / 1000; } },
    { l: 'Ядро 1 кат.', u: 'm', c: 'sub', f: function (m) { return m.frKern1 / 1000; } },
    { l: 'Ядро 2 кат. (П/Ф)', u: 'm', c: 'sub', f: function (m) { return m.frKern2 / 1000; } },
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
          (k.profit > 0 ? (k.endValue / k.profit * 100).toFixed(0) : '0') + ' % фин. результата не в деньгах</b>' },
      { c: 'cost', l: 'Закрытие сезона', n: fmt(CONFIG.policy.kernStop.v * CONFIG.kernel.intake.v), u: 'т',
        sub: 'непереработано ядра 2 кат.<br>обрушка стоит <b>' + fmt(CONFIG.policy.kernStop.v) + ' сут</b>' +
          (CONFIG.policy.sellKern2.v ? '<br>продано ядра 2 кат. ' + fmt(k.sellKern2) + ' т' : '') }
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
      '<tr><td style="font-weight:600">Работа завода масла</td>' +
      model.months.map(function (m) {
        return '<td style="color:' + (m.cropFact === 'rape' ? 'var(--raps-d)' : 'var(--kern-d)') + ';font-weight:600">' +
          workOf(m) + '</td>';
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
      '<b>Это расчёт пульта, а не выгрузка из файла.</b> Структура строк повторяет лист «Ядро+масло», ' +
      'но итог с ним не совпадает и совпадать не должен: пульт считает сезон с накоплением, переключением ' +
      'культур и вторым переделом на маслоцехе, которого в формуле листа нет.<br>' +
      'Тонна ядра 2 кат. стоит <b>' + fmt(perTon) + ' ₽</b>. Сезон закрывается в ноль: обрушка стоит <b>' +
      fmt(CONFIG.policy.kernStop.v) + ' сут</b>, <b>' + fmt(CONFIG.policy.kernStop.v * CONFIG.kernel.intake.v) +
      ' т</b> ядра 2 кат. — перенос в следующий сезон, не потеря.<br>' +
      '<span style="color:var(--ink3)">Методика, сценарный анализ и чувствительность — в README и в листе ' +
      '«Сценарный анализ» выгрузки.</span>';
  }

  function bdrSheets() {
    var r2 = function (x) { return Math.round(x * 100) / 100; };
    var bdr = [['БДР'].concat(model.months.map(function (m) { return m.label; }), ['ИТОГО'])];
    bdr.push(['Работа завода масла'].concat(model.months.map(function (m) { return workOf(m); }), ['']));
    BDR_ROWS.forEach(function (row) {
      var bold = row.c === 'sum' || row.c === 'res';
      var label = (row.c === 'sub' ? '   ' : '') + row.l;
      bdr.push([{ v: label, b: bold }].concat(
        model.months.map(function (m) { return { v: r2(row.f(m)), b: bold }; }),
        [{ v: r2(bdrTotal(row)), b: true }]));
    });
    var cap = [[{ v: 'Оборотный капитал, тыс. руб', b: true }, { v: 'Ячейка', b: true }].concat(
      model.months.map(function (m) { return { v: m.label, b: true }; }), [{ v: 'ИТОГО', b: true }])];
    CAP_ROWS.forEach(function (row) {
      var vals = model.months.map(function (m) { return r2(row.f(m) / 1000); });
      var total = vals.reduce(function (a, x) { return a + x; }, 0);
      if (row.l.indexOf('%') !== 0) total = total / model.months.length;
      cap.push([{ v: row.l, b: !!row.b }, row.c].concat(
        vals.map(function (v) { return { v: v, b: !!row.b }; }), [{ v: r2(total), b: true }]));
    });
    return [
      { name: 'БДР', widths: [38].concat(model.months.map(function () { return 12; }), [13]), rows: bdr },
      { name: 'Оборотный капитал', widths: [26, 9].concat(model.months.map(function () { return 12; }), [13]), rows: cap }
    ];
  }
  /* ---------------- сценарный анализ: только в отчёт, на экране его нет ---------------- */
  var STRATEGIES = [
    { n: '1. Остановка обрушки', o: {} },
    { n: '2. Продажа излишка', o: { 'policy.kernStop': 0, 'policy.sellKern2': 1 } },
    { n: '3. Только рапс', o: { 'policy.kernStop': 0, 'policy.rapeOnly': 1, 'policy.rapeBuffer': 0 } },
    { n: '4. Маслоцех 60,3 — только ядро', o: { 'oil.intakeKern': 60.3, 'policy.kernStop': 0, 'policy.sellKern2': 1, 'policy.rapeBuffer': 0 } }
  ];
  function kpiOf(over) {
    var c = JSON.parse(JSON.stringify(CONFIG));
    Object.keys(over).forEach(function (path) { var a = path.split('.'); c[a[0]][a[1]].v = over[path]; });
    try { return calcModel(c).kpi; } catch (e) { return null; }
  }
  function mix(a, b) { var o = {}; Object.keys(a).forEach(function (k) { o[k] = a[k]; }); Object.keys(b).forEach(function (k) { o[k] = b[k]; }); return o; }
  function analyticsSheet() {
    var r2 = function (x) { return Math.round(x * 100) / 100; }, mlnR = function (x) { return Math.round(x / 1e5) / 10; };
    var C = CONFIG, vg = C.finance.vatGoods.v, vs = C.finance.vatService.v;
    var rows = [];
    var head = function (t) { rows.push([]); rows.push([{ v: t, b: true }]); };

    head('ПАРИТЕТ: отжать или продать тонну ядра 2 кат. (обрушка в сравнение не входит)');
    rows.push([{ v: 'Ставка 2-го передела, ₽/т', b: true }, { v: 'Отжать, ₽/т', b: true },
      { v: 'Продать, ₽/т', b: true }, { v: 'Выгоднее', b: true }, { v: 'Паритетная цена П/Ф, ₽/т', b: true }]);
    var sellNet = C.prices.kern2.v / vg - C.freight.kern1.v / vs;
    K2_RATES.forEach(function (rt) {
      var press = C.oil.kernOil.v * C.prices.sunOil.v / vg + C.oil.kernMeal.v * C.prices.sunMeal.v / vg -
        rt / vs - (C.oil.kernOil.v * C.freight.oil.v + C.oil.kernMeal.v * C.freight.meal.v) / vs;
      rows.push([rt, r2(press), r2(sellNet), press > sellNet ? 'отжать' : 'продать', r2(parityAt(rt))]);
    });
    rows.push(['Точка разворота по ставке, ₽/т', r2(flipRate())]);

    head('ЧЕТЫРЕ СТРАТЕГИИ × СТАВКА 2-го ПЕРЕДЕЛА, фин. результат млн ₽');
    rows.push([{ v: 'Вариант', b: true }].concat([2500, 5000, 6500].map(function (x) { return { v: x, b: true }; }), [{ v: 'Разброс', b: true }]));
    STRATEGIES.forEach(function (st) {
      var v = [2500, 5000, 6500].map(function (rt) { var k = kpiOf(mix(st.o, { 'oil.procCost': rt })); return k ? mlnR(k.profit) : null; });
      rows.push([st.n].concat(v, [r2(Math.max.apply(null, v) - Math.min.apply(null, v))]));
    });

    head('СЕЗОННЫЕ ЛИМИТЫ (вариант «только рапс»)');
    rows.push([{ v: 'Лимит закупа рапса, т', b: true }, { v: 'Закуп, т', b: true }, { v: 'Простой, т', b: true }, { v: 'Фин. результат, млн ₽', b: true }]);
    [0, 20000, 15000, 10000].forEach(function (L) {
      var k = kpiOf(mix(STRATEGIES[2].o, { 'policy.rapeLimit': L }));
      rows.push([L || 'без ограничения', Math.round(k.rapeBuy), Math.round(k.idle), mlnR(k.profit)]);
    });
    rows.push([{ v: 'Лимит продажи ядра 2 кат., т', b: true }, { v: 'Продано, т', b: true }, { v: 'Остаток ядра, т', b: true }, { v: 'Фин. результат, млн ₽', b: true }]);
    [0, 12000, 8000, 4000].forEach(function (L) {
      var k = kpiOf(mix(STRATEGIES[2].o, { 'policy.kern2Limit': L }));
      rows.push([L || 'без ограничения', Math.round(k.sellKern2), Math.round(k.endKern2 + k.endKern3), mlnR(k.profit)]);
    });

    head('ЧУВСТВИТЕЛЬНОСТЬ ПО РАПСУ, фин. результат млн ₽');
    [[2, 'вариант 3 «только рапс»'], [0, 'вариант 1 «остановка обрушки»']].forEach(function (pair) {
      rows.push([{ v: pair[1], b: true }, { v: 'масло −10 %', b: true }, { v: 'базовая', b: true }, { v: 'масло +10 %', b: true }]);
      [28000, 30000, 33000, 36000].forEach(function (buy) {
        rows.push(['закуп рапса ' + buy].concat([-0.1, 0, 0.1].map(function (d) {
          var k = kpiOf(mix(STRATEGIES[pair[0]].o, { 'prices.buyRape': buy, 'priceParts.rapeOilCny': C.priceParts.rapeOilCny.v * (1 + d) }));
          return k ? mlnR(k.profit) : null;
        })));
      });
    });

    head('РАНЖИРОВАНИЕ ПРИ ПОНИЖАЮЩЕМ КОЭФФИЦИЕНТЕ, млн ₽');
    rows.push([{ v: 'Вариант', b: true }, { v: 'коэффициент выключен', b: true }, { v: 'коэффициент включён', b: true }]);
    STRATEGIES.forEach(function (st) {
      rows.push([st.n, mlnR(kpiOf(mix(st.o, { 'priceParts.coefOn': 0 })).profit), mlnR(kpiOf(mix(st.o, { 'priceParts.coefOn': 1 })).profit)]);
    });

    head('СЕТКА: выгода продажи излишка против остановки обрушки, млн ₽');
    rows.push([{ v: 'Цена П/Ф, ₽/т', b: true }].concat(K2_RATES.map(function (rt) { return { v: 'ставка ' + rt, b: true }; })));
    K2_PRICES.forEach(function (k) {
      var price = C.prices.kern2.v * (1 + k);
      rows.push([r2(price)].concat(K2_RATES.map(function (rt) {
        var a = kpiOf({ 'oil.procCost': rt, 'policy.sellKern2': 0, 'policy.rapeOnly': 0 });
        var b = kpiOf({ 'oil.procCost': rt, 'policy.kernStop': 0, 'policy.sellKern2': 1, 'policy.rapeOnly': 0, 'prices.kern2': price });
        return mlnR(b.profit - a.profit);
      })));
    });
    return { name: 'Сценарный анализ', widths: [34, 16, 16, 16, 16, 16], rows: rows };
  }

  function doExportBdr() {
    XLSXLite.download('Ядро_Масло_БДР.xlsx', bdrSheets().concat([analyticsSheet()]));
  }

  function doExport() {
    var scope = $('expScope').value;
    var rows = scope === 'all' ? model.days : model.days.filter(function (r) { return r.month === +scope; });
    var r2 = function (x) { return Math.round(x * 100) / 100; };

    /* лист по дням */
    var aoa = [DAILY_COLS.map(function (c) { return { v: c[0], b: true }; })];
    rows.forEach(function (r) {
      aoa.push([r.date, cropName(r.useCrop),
        r2(r.seedBuy), r2(r.rapeBuy), r2(r.kern1), r2(r.kern2), r2(r.husk),
        r2(r.oilIntake), r2(r.oilSun + r.oilRape), r2(r.mealSun + r.mealRape), r2(r.idle),
        r2(r.stKern2), r2(r.stRape), r2(r.stTotal), r2(r.pkTotal),
        r2(r.wh[0] || 0), r2(r.wh[1] || 0), r2(r.over)]);
    });
    var daySheet = { name: 'По дням', widths: [12, 10].concat(DAILY_COLS.slice(2).map(function () { return 11; })), rows: aoa };

    /* лист параметров с источниками */
    var pa = [[{ v: 'Группа', b: true }, { v: 'Параметр', b: true }, { v: 'Значение', b: true }, { v: 'Ед.', b: true }, { v: 'Источник', b: true }]];
    eachParam(function (g, k, p) { pa.push([GROUP_TITLES[g] || g, p.label, p.v, p.u, p.src]); });
    var parSheet = { name: 'Параметры', widths: [22, 38, 14, 8, 52], rows: pa };

    XLSXLite.download('Ядро_Масло_' + (scope === 'all' ? 'сезон' : model.months[+scope].label) + '.xlsx',
      bdrSheets().concat([daySheet, parSheet, analyticsSheet()]));
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
    $('dayRange').addEventListener('input', function () { curDay = +this.value; renderDay(); moveMark(); });
    $('expBtn').addEventListener('click', doExport);
    if ($('expBdr')) $('expBdr').addEventListener('click', doExportBdr);
    document.querySelectorAll('.tab').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('is-on'); });
        b.classList.add('is-on');
        document.querySelectorAll('.tabpane').forEach(function (pane) {
          pane.hidden = (pane.id !== 'tab-' + b.dataset.tab);
        });
        if (b.dataset.tab === 'pult') renderChart();
      });
    });
    document.querySelectorAll('.sect-h.tog').forEach(function (h) {
      h.addEventListener('click', function () { document.getElementById(h.dataset.sect).classList.toggle('open'); });
    });
    window.addEventListener('resize', function () { renderChart(); });
    recalc();
  }
  function safeInit() {
    try { init(); }
    catch (err) {
      var el = document.getElementById('cfgErr');
      var msg = 'Пульт не запустился: ' + err.message +
        '\nЧаще всего это старая версия страницы в кэше браузера. Обновите с очисткой кэша: ' +
        'Cmd+Shift+R (Mac) или Ctrl+F5 (Windows).';
      if (el) { el.style.display = ''; el.textContent = '⚠ ' + msg; } else { alert(msg); }
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', safeInit); else safeInit();
})();
