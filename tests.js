/* Инварианты модели «Ядро + Масло». Запуск: node tests.js
   Каждый инвариант — из блока САМОПРОВЕРКА технического задания. */
var fs = require('fs');
var CONFIG = require('./config.js').CONFIG;
var calcModel = require('./engine.js').calcModel;

var EPS = 1e-6;

/* ЭТАЛОН. Конкретные величины на исходных параметрах — чтобы тест краснел при любом
   изменении поведения модели, а не только при логической поломке. Меняются осознанно. */
var BASELINE = {
  peakStock: 3793,     // пик хранения, т
  overDays: 0,         // суток с превышением вместимости
  overPeak: 0,         // максимум сверх вместимости, т
  minKern: 0,          // минимальный остаток ядра за сезон, т (0 — сезон закрывается в ноль)
  kernMonths: 5,       // месяцев на семечке
  rapeMonths: 5        // месяцев на рапсе
};
var results = [];
function check(id, name, ok, where, detail) {
  results.push({ id: id, name: name, ok: ok, where: where, detail: detail || '' });
}
function clone(c) { return JSON.parse(JSON.stringify(c)); }
var f = function (n) { return Math.round(n).toLocaleString('ru-RU'); };

var m = calcModel(CONFIG);
var C = CONFIG, cap = m.capTotal;

/* --- 1. Баланс склада --- */
(function () {
  var bad = null, pk2 = C.storage.startKern2.v, pk3 = C.storage.startKern3.v, pr = C.storage.startRape.v;
  m.days.forEach(function (r) {
    var e2 = pk2 + r.kern2 - r.useKern2, e3 = pk3 + r.kern3 - r.useKern3, er = pr + r.rapeBuy - r.useRape;
    if (!bad && (Math.abs(e2 - r.stKern2) > EPS || Math.abs(e3 - r.stKern3) > EPS || Math.abs(er - r.stRape) > EPS))
      bad = r.date;
    pk2 = r.stKern2; pk3 = r.stKern3; pr = r.stRape;
  });
  check('1а', 'Остаток(день) = остаток(день−1) + приход − расход по каждому виду', !bad,
    'engine.js, посуточный цикл', bad ? 'первое расхождение ' + bad : 'сошлось во все ' + m.days.length + ' суток');

  var neg = m.days.filter(function (r) { return r.stKern2 < -EPS || r.stKern3 < -EPS || r.stRape < -EPS; });
  check('1б', 'Остаток ни в один день не отрицательный', neg.length === 0,
    'пульт, таблица «Итоги по дням»', neg.length ? 'отрицательных суток ' + neg.length : 'минимум по ядру ' +
      f(Math.min.apply(null, m.days.map(function (r) { return r.stKern2; }))) + ' т');

  /* Переполнение складов — осознанное решение владельца: закуп не режем, показываем сигналом.
     Проверяем конкретные величины против эталона: изменились цифры — тест обязан покраснеть. */
  var over = m.days.filter(function (r) { return r.pkTotal > cap + EPS; });
  var wrong = m.days.filter(function (r) { return Math.abs(r.over - Math.max(0, r.pkTotal - cap)) > EPS; });
  var diff = [];
  if (Math.abs(m.kpi.peakStock - BASELINE.peakStock) > 1) diff.push('пик хранения ' + m.kpi.peakStock.toFixed(1) + ' вместо ' + BASELINE.peakStock);
  if (over.length !== BASELINE.overDays) diff.push('суток превышения ' + over.length + ' вместо ' + BASELINE.overDays);
  if (Math.abs(m.kpi.overPeak - BASELINE.overPeak) > 1) diff.push('максимум сверх ' + m.kpi.overPeak.toFixed(1) + ' вместо ' + BASELINE.overPeak);
  if (wrong.length) diff.push('превышение посчитано неверно в ' + wrong.length + ' сут');
  check('1в', 'Вместимость: пик и суточное превышение совпадают с эталоном', diff.length === 0,
    'пульт, красная шапка на графике; эталон — BASELINE в tests.js',
    diff.length ? 'РАСХОЖДЕНИЕ С ЭТАЛОНОМ: ' + diff.join('; ') + ' — если изменение осознанное, обновите BASELINE'
      : 'пик ' + f(m.kpi.peakStock) + ' т при вместимости ' + f(cap) + ' т, суток превышения ' + over.length +
        ', максимум сверх ' + f(m.kpi.overPeak) + ' т — как в эталоне');

  var minK = Math.min.apply(null, m.days.map(function (r) { return r.stKern2 + r.stKern3; }));
  var minDay = m.days.filter(function (r) { return Math.abs(r.stKern2 + r.stKern3 - minK) < EPS; })[0];
  check('1г', 'Минимальный остаток ядра за сезон совпадает с эталоном', Math.abs(minK - BASELINE.minKern) < 1 && minK >= -EPS,
    'пульт, плитка «Минимум ядра за сезон»',
    'минимум ' + minK.toFixed(2) + ' т (' + minDay.date + '), эталон ' + BASELINE.minKern + ' т');
})();

/* --- 2. Выходы завода ядра --- */
(function () {
  var K = C.kernel, s = K.yKern1.v + K.yKern2.v + K.yKern3.v + K.yHusk.v + K.yLoss.v;
  check('2', 'Ядро 1 + ядро 2 + ядро 3 + лузга + потери = 100 % входа', Math.abs(s - 1) < EPS,
    'config.js, группа «Завод ядра»',
    (K.yKern1.v * 100) + ' + ' + (K.yKern2.v * 100) + ' + ' + (K.yKern3.v * 100) + ' + ' + (K.yHusk.v * 100) +
    ' + ' + (K.yLoss.v * 100) + ' = ' + (s * 100).toFixed(2) + ' %');
  /* та же проверка на тоннах */
  var tot = m.kpi.kern1 + m.kpi.kern2 + m.kpi.husk;
  /* вход считаем по факту: обрушка останавливается перед концом горизонта */
  var inp = m.days.reduce(function (a, r) { return a + r.seedIn; }, 0);
  var full = C.kernel.intake.v * C.horizon.workDays.v * C.horizon.months.v;
  check('2б', 'То же на тоннах за сезон', Math.abs(tot - inp) < 1e-6 * Math.max(1, inp),
    'пульт, таблица «Потоки»', f(tot) + ' т выхода при ' + f(inp) + ' т входа (из ' + f(full) +
    ' т при непрерывной работе; обрушка стоит ' + C.policy.kernStop.v + ' сут)');
})();

/* --- 3. Завод масла не берёт больше, чем лежит --- */
(function () {
  var bad = m.days.filter(function (r) {
    return (r.useKern2 + r.useKern3) > r.pkKern + EPS || r.useRape > r.pkRape + EPS;
  });
  check('3', 'Завод масла ни в один день не перерабатывает больше, чем есть на складе', bad.length === 0,
    'engine.js, шаг 3 посуточного цикла',
    bad.length ? 'нарушений ' + bad.length : 'проверено ' + m.days.length + ' суток, простой за сезон ' + f(m.kpi.idle) + ' т');
})();

/* --- 4. Смена культуры только 1-го числа --- */
(function () {
  var bad = [], prev = null, dates = [];
  m.days.forEach(function (r) {
    if (prev !== null && r.crop !== prev && r.day !== 1) bad.push(r.date);
    if (prev !== null && r.crop !== prev) dates.push(r.date + ' ' + prev + '→' + r.crop);
    prev = r.crop;
  });
  check('4', 'Смена культуры происходит только 1-го числа месяца', bad.length === 0,
    'пульт, календарь работы завода масла',
    'точки смены: ' + (dates.length ? dates.join('; ') : 'нет') + (bad.length ? ' | вне 1-го числа: ' + bad.join(', ') : ''));
})();

/* --- 5. Ядро 1 кат. не попадает на склады --- */
(function () {
  var st = C.storage.startKern2.v + C.storage.startKern3.v;
  var inK = m.days.reduce(function (a, r) { return a + r.kern2 + r.kern3; }, 0);
  var outK = m.days.reduce(function (a, r) { return a + r.useKern2 + r.useKern3; }, 0);
  var end = m.kpi.endKern2 + m.kpi.endKern3;
  var ok = Math.abs(st + inK - outK - end) < 1e-6 * Math.max(1, inK);
  check('5', 'Ядро 1 кат. нигде не попадает на склады', ok,
    'engine.js: stK2/stK3 пополняются только row.kern2/kern3',
    'на склад пришло ' + f(inK) + ' т = ровно ядро 2+3 кат.; ядро 1 кат. за сезон ' + f(m.kpi.kern1) +
    ' т ушло сразу на продажу');
})();

/* --- 6. Баланс рапса --- */
(function () {
  var buy = m.kpi.rapeBuy + C.storage.startRape.v;
  var use = m.days.reduce(function (a, r) { return a + r.useRape; }, 0);
  var end = m.kpi.endRape;
  var ok = Math.abs(buy - use - end) < 1e-6 * Math.max(1, buy);
  check('6', 'Закуп рапса = переработка рапса + переходящий остаток', ok,
    'пульт, таблица «Потоки», колонки «рапс»',
    f(buy) + ' т закупа = ' + f(use) + ' т переработки + ' + f(end) + ' т остатка');
})();

/* --- 7. Правило переключения и страховой запас --- */
(function () {
  var pattern = function (r) { return r.months.map(function (x) { return x.crop === 'kern' ? 'С' : 'Р'; }).join(''); };
  var runs = [0, 3, 5].map(function (sd) {
    var c = clone(CONFIG); c.policy.safetyDays.v = sd;
    var r = calcModel(c);
    return { sd: sd, p: pattern(r), kern: r.kpi.kernMonths, idle: r.kpi.idle };
  });
  var uniq = {}; runs.forEach(function (r) { uniq[r.p] = 1; });
  check('7', 'Страховой запас сдвигает календарь работы завода', Object.keys(uniq).length > 1,
    'пульт, поле «Страховой запас ядра»',
    runs.map(function (r) { return r.sd + ' дн → ' + r.p + ' (семечка ' + r.kern + ' мес)'; }).join('; ') +
    ' | С — семечка, Р — рапс');

  var base = calcModel(CONFIG);
  check('7б', 'Календарь совпадает с эталоном по числу месяцев',
    base.kpi.kernMonths === BASELINE.kernMonths && base.kpi.rapeMonths === BASELINE.rapeMonths,
    'пульт, календарь работы завода масла',
    'семечка ' + base.kpi.kernMonths + ' / рапс ' + base.kpi.rapeMonths +
    ' (эталон ' + BASELINE.kernMonths + ' / ' + BASELINE.rapeMonths + ')');

  /* баланс масс: больше, чем позволяет приход ядра, месяцев семечки быть не может */
  var K = CONFIG.kernel, H = CONFIG.horizon;
  var kernSeason = K.intake.v * (K.yKern2.v + K.yKern3.v) * H.workDays.v * H.months.v;
  var monthNorm = CONFIG.oil.intakeKern.v * H.workDays.v;
  var ceiling = Math.floor(kernSeason / monthNorm);
  check('7в', 'Месяцев на семечке не больше, чем позволяет приход ядра', base.kpi.kernMonths <= ceiling,
    'баланс масс: приход ядра ÷ месячная норма маслоцеха',
    'ядра за сезон ' + f(kernSeason) + ' т ÷ ' + f(monthNorm) + ' т = ' +
    (kernSeason / monthNorm).toFixed(2) + ' → потолок ' + ceiling + ' мес, в модели ' + base.kpi.kernMonths);

  var badIdle = base.months.filter(function (x) { return x.crop === 'kern' && x.idle > EPS; });
  check('7г', 'В месяцы семечки маслоцех обеспечен каждые сутки', badIdle.length === 0,
    'engine.js, посуточная проверка перед запуском месяца',
    badIdle.length ? 'простой в месяцах: ' + badIdle.map(function (x) { return x.label; }).join(', ')
      : 'простоя нет ни в одном из ' + base.kpi.kernMonths + ' месяцев семечки');
})();

/* --- 8. Числа вне CONFIG --- */
(function () {
  var src = fs.readFileSync(__dirname + '/engine.js', 'utf8');
  /* гасим блочные комментарии по всему файлу, сохраняя нумерацию строк */
  var blank = src.replace(/\/\*[\s\S]*?\*\//g, function (t) { return t.replace(/[^\n]/g, ' '); });
  var lines = src.split('\n'), noComment = blank.split('\n');
  var inLabel = false, hits = [];
  lines.forEach(function (raw, i) {
    /* подписи дат и тексты сообщений об ошибках — не расчёт */
    if (/^function (monthLabel|dayLabel|monthOf|validate)/.test(raw) || /^var EPS_T/.test(raw)) inLabel = true;
    else if (/^(function|var|if )/.test(raw)) inLabel = false;
    var line = noComment[i].replace(/\/\/.*$/, '').replace(/'[^']*'/g, "''");
    var re = /(?<![\w.$])(\d+(?:\.\d+)?)/g, mm;
    while ((mm = re.exec(line))) {
      var n = mm[1];
      if (n === '0' || n === '1') continue;
      hits.push({ n: n, line: i + 1, label: inLabel, code: raw.trim() });
    }
  });
  var calc = hits.filter(function (h) { return !h.label; });
  check('8', 'Ни одного числа в формулах вне CONFIG', calc.length === 0,
    'engine.js, построчный поиск /(?<![\\w.$])\\d+/',
    calc.length ? 'в расчёте найдены литералы: ' + calc.map(function (h) { return h.n + ' (стр. ' + h.line + ')'; }).join(', ')
      : 'в расчётных формулах литералов нет; вне расчёта остались только ' +
      hits.map(function (h) { return h.n + ' (стр. ' + h.line + ', ' + h.code.slice(0, 40) + ')'; }).join('; ') +
      ' — это подписи дат, тексты ошибок и допуск сравнения, не параметры модели');
})();

/* --- 9. Цены собираются формулой из составляющих --- */
(function () {
  var derive = require('./engine.js').derive;
  var c = clone(CONFIG);
  c.priceParts.coefOn.v = 1; derive(c);
  var on = { kern1: c.prices.kern1.v, oil: c.prices.sunOil.v, meal: c.prices.sunMeal.v, ro: c.prices.rapeOil.v, rm: c.prices.rapeMeal.v };
  c.priceParts.coefOn.v = 0; derive(c);
  var off = { kern1: c.prices.kern1.v, oil: c.prices.sunOil.v, meal: c.prices.sunMeal.v, ro: c.prices.rapeOil.v, rm: c.prices.rapeMeal.v };
  var near = function (a, b) { return Math.abs(a - b) < 0.01; };
  var okOn = near(on.kern1, 55396.6875) && near(on.oil, 72508.75) && near(on.meal, 10363.6364) &&
    near(on.ro, 88000) && near(on.rm, 17545);
  check('9а', 'С коэффициентом формулы дают цены листа', okOn, 'config.js, группа «Цены: составляющие»',
    'ядро ' + on.kern1.toFixed(2) + ' (B1 55 396,69) · масло ' + on.oil.toFixed(2) + ' (B5 72 508,75) · жмых ' +
    on.meal.toFixed(2) + ' (B6 10 363,64) · рапс. масло ' + on.ro.toFixed(0) + ' (B5 88 000) · рапс. жмых ' + on.rm.toFixed(0) + ' (B6 17 545)');
  var okOff = near(off.kern1, 65880.375) && near(off.oil, 87257.5) && near(off.meal, 12000) &&
    near(off.ro, 88000) && near(off.rm, 17545);
  check('9б', 'Без коэффициента база единая по всем ценам', okOff, 'пульт, поле «Понижающий коэффициент включён»',
    'ядро ' + off.kern1.toFixed(2) + ' · масло ' + off.oil.toFixed(2) + ' · жмых ' + off.meal.toFixed(2) +
    ' · рапс. масло ' + off.ro.toFixed(0) + ' · рапс. жмых ' + off.rm.toFixed(0) + ' (в рапсовых формулах коэффициента нет)');
})();

/* --- 10. Валидация ввода вместо NaN и падения --- */
(function () {
  var cases = [
    ['рабочие сутки дробные', function (c) { c.horizon.workDays.v = 27.5; }],
    ['месяцев ноль', function (c) { c.horizon.months.v = 0; }],
    ['складов дробное число', function (c) { c.storage.count.v = 2.5; }],
    ['выходы завода ядра больше 100 %', function (c) { c.kernel.yHusk.v = 0.9; }],
    ['масла больше товарного выхода', function (c) { c.oil.kernOil.v = 1.2; }]
  ];
  var bad = [];
  cases.forEach(function (t) {
    var c = clone(CONFIG); t[1](c);
    var caught = null;
    try { calcModel(c); } catch (err) { caught = err.message; }
    if (!caught) bad.push(t[0]);
  });
  check('10', 'Недопустимый ввод даёт понятную ошибку, а не NaN', bad.length === 0,
    'пульт, красная плашка над параметрами',
    bad.length ? 'без ошибки прошли: ' + bad.join(', ') : 'проверено ' + cases.length + ' случаев, все отклонены с текстом');
})();

/* --- 11. Закрытие сезона: остатки выработаны в ноль --- */
(function () {
  var TOL = 0.01;
  var ok = Math.abs(m.kpi.endKern2) < TOL && Math.abs(m.kpi.endKern3) < TOL && Math.abs(m.kpi.endRape) < TOL;
  check('11', 'Конечный запас обеих культур ровно ноль (допуск 0,01 т)', ok,
    'пульт, плитка «Прибыль лежит в остатках»',
    'ядро ' + m.kpi.endKern2.toFixed(4) + ' т, рапс ' + m.kpi.endRape.toFixed(4) +
    ' т, стоимость запаса ' + (m.kpi.endValue / 1e6).toFixed(3) + ' млн руб');
})();

/* --- 12. Смена культуры внутри месяца — только в последнем месяце и один раз --- */
(function () {
  var bad = [], lastIdx = m.months.length - 1;
  m.months.forEach(function (mo) {
    var seq = m.days.filter(function (r) { return r.month === mo.idx && r.useCrop !== 'none'; })
      .map(function (r) { return r.useCrop; });
    var sw = 0;
    for (var i = 0; i < seq.length; i++) {
      if (seq[i] === 'both') sw++;
      else if (i && seq[i - 1] !== 'both' && seq[i] !== seq[i - 1]) sw++;
    }
    if (mo.idx === lastIdx ? sw > 1 : sw > 0) bad.push(mo.label + ': ' + sw);
  });
  check('12', 'Переключение внутри месяца — ровно один раз и только в последнем месяце', bad.length === 0,
    'пульт, таблица «Итоги по дням» последнего месяца',
    bad.length ? 'нарушения: ' + bad.join(', ')
      : 'переходов внутри месяца: ' + m.months.map(function (x) { return x.mixDays; }).join(' / ') +
        ' — единственный в ' + m.months[lastIdx].label);
})();

/* --- 13. Баланс масс замкнут: закуплено = переработано, остатка нет --- */
(function () {
  var S = CONFIG.storage, inSeed = m.kpi.seedBuy + 0, inRape = m.kpi.rapeBuy + S.startRape.v;
  var procSeed = m.days.reduce(function (a, r) { return a + r.seedIn; }, 0);
  var usedRape = m.days.reduce(function (a, r) { return a + r.useRape; }, 0);
  var kernIn = m.days.reduce(function (a, r) { return a + r.kern2 + r.kern3; }, 0) + S.startKern2.v + S.startKern3.v;
  var kernUsed = m.days.reduce(function (a, r) { return a + r.useKern2 + r.useKern3 + r.sellKern2; }, 0);
  var d1 = Math.abs(inSeed - procSeed), d2 = Math.abs(inRape - usedRape), d3 = Math.abs(kernIn - kernUsed);
  check('13', 'Всё закупленное переработано или продано, остатка нет', d1 < 0.01 && d2 < 0.01 && d3 < 0.01,
    'пульт, таблица «Потоки»',
    'семечка: закуп ' + f(inSeed) + ' = обрушено ' + f(procSeed) + ' (Δ ' + d1.toFixed(4) + '); ' +
    'рапс: закуп ' + f(inRape) + ' = переработано ' + f(usedRape) + ' (Δ ' + d2.toFixed(4) + '); ' +
    'ядро: на склад ' + f(kernIn) + ' = в маслоцех и на сторону ' + f(kernUsed) + ' (Δ ' + d3.toFixed(4) + ')');
})();

/* --- 14. Все три режима закрытия сезона дают нулевой остаток --- */
(function () {
  var modes = [
    { n: 'остановка обрушки (по умолчанию)', stop: CONFIG.policy.kernStop.v, sell: 0 },
    { n: 'продажа излишка', stop: 0, sell: 1 },
    { n: 'остановка + продажа', stop: CONFIG.policy.kernStop.v, sell: 1 }
  ];
  var bad = [], info = [];
  modes.forEach(function (mo) {
    var c = clone(CONFIG); c.policy.kernStop.v = mo.stop; c.policy.sellKern2.v = mo.sell;
    var r = calcModel(c), k = r.kpi;
    var rest = Math.abs(k.endKern2) + Math.abs(k.endKern3) + Math.abs(k.endRape);
    if (rest > 0.01) bad.push(mo.n + ': остаток ' + rest.toFixed(3) + ' т');
    if (k.idle > 0.01) bad.push(mo.n + ': простой ' + k.idle.toFixed(1) + ' т');
    info.push(mo.n + ' → ' + (k.profit / 1e6).toFixed(1) + ' млн, продано ядра 2 кат. ' + f(k.sellKern2) + ' т');
  });
  check('14', 'Любой режим закрытия сезона обнуляет остаток и не даёт простоя', bad.length === 0,
    'пульт, поля «Остановка обрушки» и «Излишек ядра 2 кат. продаём»',
    bad.length ? bad.join('; ') : info.join('; '));
})();

/* --- 15. Продажа ядра 2 кат. считается по цене из CONFIG --- */
(function () {
  var c = clone(CONFIG); c.policy.kernStop.v = 0; c.policy.sellKern2.v = 1;
  var r = calcModel(c), k = r.kpi;
  var rev = r.months.reduce(function (a, m) { return a + m.revKern2; }, 0);
  var want = k.sellKern2 * CONFIG.prices.kern2.v / CONFIG.finance.vatGoods.v;
  check('15', 'Выручка от ядра 2 кат. = тонны × цена ÷ НДС', Math.abs(rev - want) < 1,
    'вкладка БДР, строка «Ядро 2 кат. (П/Ф)»',
    f(k.sellKern2) + ' т × ' + CONFIG.prices.kern2.v + ' ÷ ' + CONFIG.finance.vatGoods.v +
    ' = ' + (rev / 1e6).toFixed(2) + ' млн руб (цена с листа «Ядро », требует подтверждения)');
})();

/* --- 16. Режим «только рапс»: переключений нет, ядро целиком на сторону --- */
(function () {
  var c = clone(CONFIG); c.policy.rapeOnly.v = 1; c.policy.kernStop.v = 0; c.policy.rapeBuffer.v = 0;
  var r = calcModel(c), k = r.kpi;
  var kernIn = r.days.reduce(function (a, x) { return a + x.kern2 + x.kern3; }, 0);
  var used = r.days.reduce(function (a, x) { return a + x.useKern2 + x.useKern3; }, 0);
  var ok = k.kernMonths === 0 && used < 0.01 && Math.abs(k.sellKern2 - kernIn) < 0.01 &&
    Math.abs(k.endKern2) < 0.01 && Math.abs(k.endRape) < 0.01;
  check('16', 'Режим «только рапс»: ядро не жмут, продают целиком, остаток ноль', ok,
    'пульт, поле «Только рапс: ядро 2 кат. целиком на сторону»',
    'месяцев на семечке ' + k.kernMonths + ', ядра в маслоцех ' + used.toFixed(2) + ' т, продано ' +
    f(k.sellKern2) + ' из ' + f(kernIn) + ' т, остаток ' + k.endKern2.toFixed(3) + ' т');
})();

/* --- 17. Паритет цены ядра 2 кат.: отжать против продать --- */
(function () {
  var C = CONFIG, vg = C.finance.vatGoods.v, vs = C.finance.vatService.v;
  var press = C.oil.kernOil.v * C.prices.sunOil.v / vg + C.oil.kernMeal.v * C.prices.sunMeal.v / vg -
    C.oil.procCost.v / vs - (C.oil.kernOil.v * C.freight.oil.v + C.oil.kernMeal.v * C.freight.meal.v) / vs;
  var sell = C.prices.kern2.v / vg - C.freight.kern1.v / vs;
  var parity = (press + C.freight.kern1.v / vs) * vg;
  /* проверяем, что знак разницы согласован с моделью: если продавать выгоднее,
     режим продажи излишка обязан давать результат не хуже остановки обрушки */
  var base = calcModel(clone(CONFIG)).kpi.profit;
  var cSale = clone(CONFIG); cSale.policy.kernStop.v = 0; cSale.policy.sellKern2.v = 1;
  var saleProfit = calcModel(cSale).kpi.profit;
  var ok = (sell > press) === (saleProfit > base);
  check('17', 'Выгода продажи ядра 2 кат. согласована с моделью', ok,
    'пульт, карточка «Цена ядра 2 кат.»',
    'отжать ' + f(press) + ' ₽/т, продать ' + f(sell) + ' ₽/т, паритет ' + f(parity) +
    ' ₽/т с НДС; продажа излишка ' + (saleProfit / 1e6).toFixed(1) + ' против остановки ' + (base / 1e6).toFixed(1) + ' млн');
})();

/* --- вывод --- */
var pad = function (s, n) { s = String(s); return s + ' '.repeat(Math.max(0, n - s.length)); };
console.log('\nИНВАРИАНТЫ МОДЕЛИ «ЯДРО + МАСЛО»\n');
console.log(pad('№', 4) + pad('Инвариант', 66) + pad('Итог', 12) + 'Где смотреть');
console.log('-'.repeat(140));
results.forEach(function (r) {
  console.log(pad(r.id, 4) + pad(r.name, 66) + pad(r.ok ? 'пройден' : 'НЕ ПРОЙДЕН', 12) + r.where);
  console.log(pad('', 4) + r.detail);
});
var failed = results.filter(function (r) { return !r.ok; });
console.log('\nПройдено ' + (results.length - failed.length) + ' из ' + results.length +
  (failed.length ? '. НЕ ПРОЙДЕНО: ' + failed.map(function (r) { return r.id; }).join(', ') : '.'));
process.exit(failed.length ? 1 : 0);
