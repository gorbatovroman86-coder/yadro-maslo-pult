/* Пересчёт сценарного анализа из текущего CONFIG.
   Запуск: node scenarios.js > scenario.md
   Побочно пишет scenario-params.json — набор параметров, при которых посчитан анализ.
   Инвариант 23 сверяет этот файл с CONFIG: разошлись — анализ устарел, публиковать нельзя. */
var fs = require('fs');
var CONFIG = require('./config.js').CONFIG;
var E = require('./engine.js');

var M = function (n) { return (n / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: 1 }); };
var f = function (n) { return Math.round(n).toLocaleString('ru-RU'); };
var r2 = function (n) { return n.toLocaleString('ru-RU', { maximumFractionDigits: 2 }); };
function mk(over) {
  var c = JSON.parse(JSON.stringify(CONFIG));
  Object.keys(over || {}).forEach(function (p) { var a = p.split('.'); c[a[0]][a[1]].v = over[p]; });
  return c;
}
function kpi(over) { return E.calcModel(mk(over)).kpi; }
function mix(a, b) { var o = {}; Object.keys(a).forEach(function (k) { o[k] = a[k]; }); Object.keys(b || {}).forEach(function (k) { o[k] = b[k]; }); return o; }
function tuneStop(over) {
  for (var d = 0; d <= 150; d++) {
    var k = kpi(mix(over, { 'policy.kernStop': d }));
    if (k.endKern2 + k.endKern3 + k.endRape < 0.01) return { stop: d, k: k };
  }
  return { stop: null, k: kpi(over) };
}

var P = {
  kernIntake: CONFIG.kernel.intake.v,
  oilKern: CONFIG.oil.intakeKern.v,
  oilRape: CONFIG.oil.intakeRape.v,
  safetyDays: CONFIG.policy.safetyDays.v,
  minRunDays: CONFIG.policy.minRunDays.v,
  procKern: CONFIG.kernel.procCost.v,
  procOil: CONFIG.oil.procCost.v,
  coefOn: CONFIG.priceParts.coefOn.v,
  kern2Price: CONFIG.prices.kern2.v,
  kernStop: CONFIG.policy.kernStop.v
};
fs.writeFileSync(__dirname + '/scenario-params.json', JSON.stringify(P, null, 2) + '\n');

var HEAD = '> Посчитано при: заход ядра 2 кат. **' + f(P.kernIntake) + ' т/сут**, маслоцех **' +
  f(P.oilKern) + ' т/сут** на ядре и **' + f(P.oilRape) + ' т/сут** на рапсе, страховой запас **' +
  P.safetyDays + ' дн**, порог минимального пуска **' + P.minRunDays + ' дн**, обрушка **' +
  f(P.procKern) + ' ₽/т**, второй передел **' + f(P.procOil) + ' ₽/т**, база цен **' +
  (P.coefOn ? 'с понижающим коэффициентом' : 'без понижающего коэффициента') + '**.';

var out = [];
var say = function (s) { out.push(s); };

/* ---- 1. паритет ---- */
var vg = CONFIG.finance.vatGoods.v, vs = CONFIG.finance.vatService.v;
E.derive(CONFIG);
var gross = CONFIG.oil.kernOil.v * CONFIG.prices.sunOil.v / vg + CONFIG.oil.kernMeal.v * CONFIG.prices.sunMeal.v / vg -
  (CONFIG.oil.kernOil.v * CONFIG.freight.oil.v + CONFIG.oil.kernMeal.v * CONFIG.freight.meal.v) / vs;
var sell = CONFIG.prices.kern2.v / vg - CONFIG.freight.kern1.v / vs;
say('### Отжать или продать: решает ставка второго передела\n');
say(HEAD + '\n');
say('Обрушка в сравнении не участвует — она понесена в обеих ветках.\n');
say('| Ставка второго передела | Отжать | Продать | Выгоднее | Паритетная цена П/Ф |');
say('|---|---|---|---|---|');
[1500, 2500, 3500, 5000, 6500].forEach(function (rt) {
  var press = gross - rt / vs;
  say('| ' + f(rt) + ' | ' + f(press) + ' | ' + f(sell) + ' | ' + (press > sell ? '**отжать**' : 'продать') +
    ' | ' + f((press + CONFIG.freight.kern1.v / vs) * vg) + ' |');
});
say('\n**Точка разворота — ставка ' + r2((gross - sell) * vs) + ' ₽/т.** Ниже неё выгоднее отжимать, выше — продавать.\n');

/* ---- 2. четыре стратегии ---- */
var S = [
  { n: '1. Остановка обрушки', o: {} },
  { n: '2. Продажа излишка', o: { 'policy.kernStop': 0, 'policy.sellKern2': 1 } },
  { n: '3. Только рапс', o: { 'policy.kernStop': 0, 'policy.rapeOnly': 1, 'policy.rapeBuffer': 0 } },
  { n: '4. Маслоцех 60,3 — только ядро', o: { 'oil.intakeKern': 60.3, 'policy.kernStop': 0, 'policy.sellKern2': 1, 'policy.rapeBuffer': 0 } }
];
say('### Четыре стратегии сезона\n');
say(HEAD + '\n');
say('| Вариант | Ядро 2 кат. | Рапс | Закуп рапса | Закуп ядра 2 кат. | Продано П/Ф | Пик хран. | Капитал | Фин. результат | Рент. |');
say('|---|---|---|---|---|---|---|---|---|---|');
S.forEach(function (st) {
  var k = kpi(st.o);
  say('| ' + st.n + ' | ' + k.kernMonths + ' | ' + k.rapeMonths + ' | ' + f(k.rapeBuy) + ' т | ' + f(k.seedBuy) +
    ' т | ' + f(k.sellKern2) + ' т | ' + f(k.peakStock) + ' т | ' + M(k.capitalAvg) + ' млн | **' + M(k.profit) +
    ' млн** | ' + (k.profit / k.revenue * 100).toFixed(1) + ' % |');
});
say('\n### Те же стратегии при разных ставках второго передела\n');
say(HEAD + '\n');
say('| Вариант | 2 500 | 5 000 | 6 500 | Разброс |');
say('|---|---|---|---|---|');
S.forEach(function (st) {
  var v = [2500, 5000, 6500].map(function (rt) { return kpi(mix(st.o, { 'oil.procCost': rt })).profit; });
  say('| ' + st.n + ' | ' + M(v[0]) + ' | ' + M(v[1]) + ' | ' + M(v[2]) + ' | ' + M(Math.max.apply(null, v) - Math.min.apply(null, v)) + ' |');
});

/* ---- 3. разложение разрыва ---- */
var k1 = kpi(S[0].o), k3 = kpi(S[2].o);
var m1 = E.calcModel(mk(S[0].o)), m3 = E.calcModel(mk(S[2].o));
var seedExtra = k3.seedBuy - k1.seedBuy;
var kernPressed = m1.days.reduce(function (a, d) { return a + d.useKern2 + d.useKern3; }, 0);
var rapeExtra = m3.days.reduce(function (a, d) { return a + d.useRape; }, 0) - m1.days.reduce(function (a, d) { return a + d.useRape; }, 0);
var press5 = gross - CONFIG.oil.procCost.v / vs;
var rapeM = CONFIG.oil.rapeOil.v * CONFIG.prices.rapeOil.v / vg + CONFIG.oil.rapeMeal.v * CONFIG.prices.rapeMeal.v / vg -
  CONFIG.prices.buyRape.v / vg - CONFIG.oil.procCost.v / vs -
  (CONFIG.oil.rapeOil.v * CONFIG.freight.oil.v + CONFIG.oil.rapeMeal.v * CONFIG.freight.meal.v) / vs;
var kern1Net = CONFIG.prices.kern1.v / vg - CONFIG.freight.kern1.v / vs;
var A = seedExtra * CONFIG.kernel.yKern1.v * kern1Net + seedExtra * CONFIG.kernel.yKern2.v * sell -
  seedExtra * (CONFIG.prices.buySeed.v / vg + CONFIG.kernel.procCost.v / vs);
var B = kernPressed * (sell - press5), C = rapeExtra * rapeM, D = -(k3.interest - k1.interest);
var pre = A + B + C + D, tax = CONFIG.finance.profitTax.v;
say('\n### Из чего складывается разрыв между вариантами 1 и 3\n');
say(HEAD + '\n');
say('| Составляющая | Объём | До налога, млн ₽ |');
say('|---|---|---|');
say('| **A. Обрушка не останавливается** — доп. сырьё | ' + f(seedExtra) + ' т | **' + M(A) + '** |');
say('| **B. Ядро продаём, а не отжимаем** (' + f(sell - press5) + ' ₽/т) | ' + f(kernPressed) + ' т | **' + M(B) + '** |');
say('| **C. Маслоцех переведён с ядра на рапс** (' + f(rapeM) + ' ₽/т) | ' + f(rapeExtra) + ' т | **' + M(C) + '** |');
say('| **D. Проценты за оборотный капитал** | | **' + M(D) + '** |');
say('| Итого до налога | | ' + M(pre) + ' |');
say('| Налог на прибыль ' + (tax * 100) + ' % | | ' + M(-pre * tax) + ' |');
say('| **Итого разрыв** | | **' + M(pre * (1 - tax)) + '** |');
say('\nФактический разрыв ' + M(k3.profit - k1.profit) + ' млн, расхождение разложения **' +
  M(pre * (1 - tax) - (k3.profit - k1.profit)) + ' млн**.\n');

/* ---- 4. лимиты ---- */
say('### Сезонные лимиты\n');
say(HEAD + '\n');
say('| Лимит закупа рапса | Закуп | Простой | Фин. результат |');
say('|---|---|---|---|');
[0, 20000, 15000, 10000].forEach(function (L) {
  var k = kpi(mix(S[2].o, { 'policy.rapeLimit': L }));
  say('| ' + (L ? f(L) + ' т' : 'без ограничения') + ' | ' + f(k.rapeBuy) + ' т | ' + f(k.idle) + ' т | **' + M(k.profit) + ' млн** |');
});
say('\n| Лимит продажи ядра 2 кат. | Продано | Остаток | Фин. результат |');
say('|---|---|---|---|');
[0, 12000, 8000, 4000].forEach(function (L) {
  var k = kpi(mix(S[2].o, { 'policy.kern2Limit': L }));
  say('| ' + (L ? f(L) + ' т' : 'без ограничения') + ' | ' + f(k.sellKern2) + ' т | ' + f(k.endKern2 + k.endKern3) + ' т | **' + M(k.profit) + ' млн** |');
});

/* ---- 5. чувствительность по рапсу ---- */
say('\n### Чувствительность по рапсу\n');
say(HEAD + '\n');
[[2, 'Вариант 3 «только рапс»'], [0, 'Вариант 1 «остановка обрушки»']].forEach(function (pair) {
  say('\n' + pair[1] + ', млн ₽:\n');
  say('| Закуп рапса, ₽/т | Масло −10 % | Базовая | Масло +10 % |');
  say('|---|---|---|---|');
  [28000, 30000, 33000, 36000].forEach(function (buy) {
    var v = [-0.1, 0, 0.1].map(function (d) {
      return M(kpi(mix(S[pair[0]].o, { 'prices.buyRape': buy, 'priceParts.rapeOilCny': CONFIG.priceParts.rapeOilCny.v * (1 + d) })).profit);
    });
    say('| ' + (buy === CONFIG.prices.buyRape.v ? '**' + f(buy) + '**' : f(buy)) + ' | ' + v.join(' | ') + ' |');
  });
});

/* ---- 6. цена П/Ф × ставка ---- */
say('\n### Выгода продажи излишка против остановки обрушки, млн ₽\n');
say(HEAD + '\n');
var RATES = [1500, 2500, 3500, 5000, 6500];
say('| Цена П/Ф | ₽/т | ' + RATES.map(function (r) { return 'ставка ' + f(r); }).join(' | ') + ' |');
say('|---|---|' + RATES.map(function () { return '---|'; }).join(''));
[0, -0.1, -0.2, -0.3].forEach(function (kf) {
  var price = CONFIG.prices.kern2.v * (1 + kf);
  var cells = RATES.map(function (rt) {
    var a = kpi({ 'oil.procCost': rt, 'policy.sellKern2': 0, 'policy.rapeOnly': 0 }).profit;
    var b = kpi({ 'oil.procCost': rt, 'policy.kernStop': 0, 'policy.sellKern2': 1, 'policy.rapeOnly': 0, 'prices.kern2': price }).profit;
    return (b - a >= 0 ? '+' : '') + M(b - a);
  });
  say('| ' + (kf ? (kf * 100).toFixed(0) + ' %' : '**базовая**') + ' | ' + f(price) + ' | ' + cells.join(' | ') + ' |');
});

/* ---- 7. коэффициент ---- */
say('\n### Ранжирование при понижающем коэффициенте\n');
say(HEAD + '\n');
say('| Вариант | Коэффициент выключен | Коэффициент включён |');
say('|---|---|---|');
S.forEach(function (st) {
  say('| ' + st.n + ' | ' + M(kpi(mix(st.o, { 'priceParts.coefOn': 0 })).profit) + ' млн | ' +
    M(kpi(mix(st.o, { 'priceParts.coefOn': 1 })).profit) + ' млн |');
});

console.log(out.join('\n'));
