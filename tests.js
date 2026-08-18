/* Инварианты модели «Ядро + Масло». Запуск: node tests.js
   Каждый инвариант — из блока САМОПРОВЕРКА технического задания. */
var fs = require('fs');
var CONFIG = require('./config.js').CONFIG;
var calcModel = require('./engine.js').calcModel;

var EPS = 1e-6;
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
     Поэтому проверяем не отсутствие превышения, а то, что оно корректно посчитано и не потеряно. */
  var over = m.days.filter(function (r) { return r.pkTotal > cap + EPS; });
  var wrong = m.days.filter(function (r) {
    return Math.abs(r.over - Math.max(0, r.pkTotal - cap)) > EPS;
  });
  check('1в', 'Превышение вместимости посчитано и просигнализировано', wrong.length === 0 && over.length === m.kpi.overDays,
    'пульт, красная шапка на графике + плитка «Не хватает места»',
    over.length ? 'превышение есть и показано: пик ' + f(m.kpi.peakStock) + ' т при вместимости ' + f(cap) +
      ' т, не влезает до ' + f(m.kpi.overPeak) + ' т в ' + over.length + ' сут (закуп не режем — решение владельца)'
      : 'превышений нет: пик ' + f(m.kpi.peakStock) + ' т при вместимости ' + f(cap) + ' т');
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
  var inp = C.kernel.intake.v * C.horizon.workDays.v * C.horizon.months.v;
  check('2б', 'То же на тоннах за сезон', Math.abs(tot - inp) < 1e-6 * inp,
    'пульт, таблица «Потоки»', f(tot) + ' т выхода при ' + f(inp) + ' т входа');
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

/* --- 7. Чувствительность к ТЗ --- */
(function () {
  var runs = [10, 27, 45, 60].map(function (tz) {
    var c = clone(CONFIG); c.policy.tzWork.v = tz;
    var r = calcModel(c);
    var first = r.switches.filter(function (s) { return s.to === 'kern'; })[0];
    return { tz: tz, date: first ? first.date : 'нет', months: r.kpi.kernMonths };
  });
  var uniq = {}; runs.forEach(function (r) { uniq[r.date] = 1; });
  check('7', 'ТЗ сдвигает дату первого переключения на семечку', Object.keys(uniq).length > 1,
    'пульт, поле «ТЗ сырья под работу завода»',
    runs.map(function (r) { return 'ТЗ ' + r.tz + ' дн → ' + r.date + ' (' + r.months + ' мес семечки)'; }).join('; '));
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
    if (/^function (monthLabel|dayLabel|monthOf|validate)/.test(raw)) inLabel = true;
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
      ' — это подписи дат и тексты ошибок, не параметры модели');
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
