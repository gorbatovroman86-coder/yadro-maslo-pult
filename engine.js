/* ДВИЖОК пульта «Ядро + Масло». Чистые функции, DOM не трогает.
   Вход: объект CONFIG (см. config.js). Выход: посуточный ряд, помесячный свод, KPI, точки смены культуры.
   Ни одной числовой константы — всё через cfg. Исключения: 0, 1 и индексы массивов. */

/* допуск сравнения чисел с плавающей точкой — не параметр модели */
var EPS_T = 1e-9;

/* значение параметра */
function pv(p) { return p.v; }

/* плоская копия значений — чтобы дальше в коде не писать .v на каждом шаге */
function flat(cfg) {
  var out = {};
  Object.keys(cfg).forEach(function (grp) {
    out[grp] = {};
    Object.keys(cfg[grp]).forEach(function (k) { out[grp][k] = pv(cfg[grp][k]); });
  });
  return out;
}

/* ярлык месяца: год/месяц горизонта по индексу */
function monthOf(h, i) {
  var m = h.startMonth - 1 + i;
  return { year: h.startYear + Math.floor(m / 12), month: (m % 12) + 1 };
}
var MONTH_RU = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
function monthLabel(h, i) { var d = monthOf(h, i); return MONTH_RU[d.month - 1] + '.' + String(d.year).slice(2); }
function dayLabel(h, i, dayInMonth) {
  var d = monthOf(h, i);
  return String(dayInMonth).padStart(2, '0') + '.' + String(d.month).padStart(2, '0') + '.' + d.year;
}

/* ===================== ПРОИЗВОДНЫЕ ВЕЛИЧИНЫ И ПРОВЕРКА ВВОДА =====================
   Цены реализации собираются из составляющих (курс, цена в юанях, логистика,
   понижающий коэффициент) — готовых чисел в модели нет.
   Выходы связаны формулами листа: ядро 2 = 1 − остальные, жмых = товарный выход − масло. */
function derive(cfg) {
  var pp = cfg.priceParts, F = cfg.finance, K = cfg.kernel, O = cfg.oil, P = cfg.prices;
  var coef = pp.coefOn.v ? (1 - (pp.coefNum.v / pp.coefDen.v - 1)) : 1;
  cfg._coef = coef;

  P.kern1.v = (pp.kern1Cny.v * pp.cnyRate.v * pp.kern1Grade.v * coef - pp.kern1Log.v) * F.vatGoods.v;
  P.sunOil.v = (pp.sunOilCny.v * coef * pp.cnyRate.v - pp.sunOilLog1.v - pp.sunOilLog2.v) * F.vatGoods.v;
  P.sunMeal.v = pp.sunMealBase.v * coef;
  /* в рапсовых формулах листа коэффициента нет — цены от выключателя не зависят */
  P.rapeOil.v = (pp.rapeOilCny.v * pp.cnyRate.v - pp.rapeOilLog.v) * F.vatGoods.v;
  P.rapeMeal.v = (pp.rapeMealCny.v * pp.cnyRate.v - pp.rapeMealLog.v) * F.vatGoods.v;

  K.yKern2.v = 1 - K.yKern1.v - K.yKern3.v - K.yHusk.v - K.yLoss.v;
  O.kernMeal.v = O.kernTotal.v - O.kernOil.v;
  O.kernLoss.v = 1 - O.kernTotal.v;
  O.rapeMeal.v = O.rapeTotal.v - O.rapeOil.v;
  O.rapeLoss.v = 1 - O.rapeTotal.v;
  return coef;
}

/* Проверка ввода. Возвращает список понятных сообщений; пустой список — всё в порядке. */
function validate(cfg) {
  var e = [], K = cfg.kernel, O = cfg.oil, P = cfg.policy, H = cfg.horizon, S = cfg.storage;
  Object.keys(cfg).forEach(function (grp) {
    if (grp.charAt(0) === '_') return;
    Object.keys(cfg[grp]).forEach(function (k) {
      var p = cfg[grp][k];
      if (typeof p.v !== 'number') return;
      if (!isFinite(p.v)) { e.push('«' + p.label + '»: не число'); return; }
      if (p.int && p.v !== Math.round(p.v)) e.push('«' + p.label + '»: только целое число, введено ' + p.v);
      if (p.min !== undefined && p.v < p.min) e.push('«' + p.label + '»: не меньше ' + p.min + ', введено ' + p.v);
      if (p.max !== undefined && p.v > p.max) e.push('«' + p.label + '»: не больше ' + p.max + ', введено ' + p.v);
    });
  });
  var sumK = K.yKern1.v + K.yKern3.v + K.yHusk.v + K.yLoss.v;
  if (sumK > 1)
    e.push('Выходы завода ядра: ядро 1 кат. + ядро 3 кат. + лузга + потери = ' +
      (sumK * 100).toFixed(1) + ' %, больше 100 % быть не может — на ядро 2 кат. ничего не остаётся');
  if (O.kernOil.v > O.kernTotal.v)
    e.push('Выход масла из ядра (' + (O.kernOil.v * 100).toFixed(1) + ' %) больше товарного выхода (' +
      (O.kernTotal.v * 100).toFixed(1) + ' %) — на жмых ничего не остаётся');
  if (O.rapeOil.v > O.rapeTotal.v)
    e.push('Выход масла рапсового (' + (O.rapeOil.v * 100).toFixed(1) + ' %) больше товарного выхода (' +
      (O.rapeTotal.v * 100).toFixed(1) + ' %) — на жмых ничего не остаётся');
  if (P.buyWindow.v > H.workDays.v)
    e.push('Окно закупа (' + P.buyWindow.v + ' дн) длиннее месяца (' + H.workDays.v + ' рабочих суток)');
  if (S.count.v * S.capacity.v <= 0)
    e.push('Вместимость складов равна нулю — хранить сырьё негде');
  return e;
}

/* ============================ ОСНОВНОЙ РАСЧЁТ ============================ */
function calcModel(cfg) {
  derive(cfg);
  var problems = validate(cfg);
  if (problems.length) throw new Error(problems.join('\n'));
  var c = flat(cfg);
  var h = c.horizon, K = c.kernel, O = c.oil, S = c.storage, P = c.policy;
  var capTotal = S.count * S.capacity;

  /* остатки на складах (совместное хранение) + стоимость запаса (метод средней) */
  var stK2 = S.startKern2, stK3 = S.startKern3, stRape = S.startRape;
  /* входящие остатки оцениваем по стоимости, а не нулём:
     ядро — по себестоимости тонны с завода ядра, рапс — по цене закупа без НДС */
  var unitKernBase = (K.yKern1 + K.yKern2 + K.yKern3) > 0
    ? (c.prices.buySeed / c.finance.vatGoods + K.procCost / c.finance.vatService) / (K.yKern1 + K.yKern2 + K.yKern3)
    : 0;
  var valKern = (stK2 + stK3) * unitKernBase;
  var valRape = stRape * c.prices.buyRape / c.finance.vatGoods;

  var days = [], months = [], switches = [];
  var prevCrop = null;

  /* вложенный капитал и % за деньги считаются в finance() по ячейкам B35:B41 листа «Ядро+масло» */

  var kernDaily = K.intake * (K.yKern2 + K.yKern3);   // плановый приход ядра 2+3 кат. в сутки
  var totalDays = h.months * h.workDays;
  var kernLastDay = totalDays - P.kernStop;           // с этого дня (0-based) обрушка стоит
  var kernWorks = function (i) { return i < kernLastDay; };
  var lastMonth = h.months - 1;

  for (var m = 0; m < h.months; m++) {
    /* --- решение о культуре месяца: только на 1-е число ---
       Доступное ядро = остаток на складе + плановые поступления за месяц.
       Запускаемся на семечке, если доступного хватает на полный месяц работы
       маслоцеха плюс страховой запас, И если маслоцех обеспечен КАЖДЫЕ сутки месяца. */
    var stockKern = stK2 + stK3;
    var isLast = (m === lastMonth);
    var kernDaysIn = 0;                                    // рабочих суток обрушки в этом месяце
    for (var q = 0; q < h.workDays; q++) if (kernWorks(m * h.workDays + q)) kernDaysIn++;
    var plannedKern = kernDaily * kernDaysIn;
    var planned = plannedKern;
    var available = stockKern + planned;
    var required = O.intakeKern * (h.workDays + P.safetyDays);
    var feasible = available >= required - EPS_T;
    var failDay = 0, minStock = 0;
    if (feasible) {
      var probe = stockKern, low = available;
      for (var t = 1; t <= h.workDays; t++) {
        probe += (kernWorks(m * h.workDays + t - 1) ? kernDaily : 0);   // приход суток
        if (probe < O.intakeKern - EPS_T) { feasible = false; failDay = t; break; }
        probe -= O.intakeKern;                         // переработка суток
        if (probe < low) low = probe;
      }
      minStock = low;
    }
    var crop = feasible ? 'kern' : 'rape';
    if (crop !== prevCrop) {
      switches.push({
        month: m, label: monthLabel(h, m), date: dayLabel(h, m, 1), from: prevCrop, to: crop,
        stock: stockKern, planned: planned, available: available, need: required
      });
    }
    prevCrop = crop;

    /* --- план закупа на месяц --- */
    var seedNeed = K.intake * kernDaysIn;                  // семечка только на те сутки, когда обрушка работает
    var rapeMonth = O.intakeRape * h.workDays;             // месячная потребность завода масла
    var rapeNeed;
    if (isLast) {
      /* последний месяц: рапса берём ровно столько, сколько успеем сжечь после ядра */
      var kernDays = O.intakeKern > 0 ? (stockKern + plannedKern) / O.intakeKern : 0;
      var freeDays = Math.max(0, h.workDays - kernDays);
      rapeNeed = Math.max(0, freeDays * O.intakeRape - stRape);
    } else if (crop === 'rape') {
      rapeNeed = Math.max(0, rapeMonth - stRape);          // докуп до месячной потребности
    } else if (P.rapeBuffer) {
      /* месяц семечки: страховой рапс на свободное место складов.
         Свободное место = потолок минус ядро на 1-е число (в месяце семечки ядро только убывает). */
      var target = Math.min(rapeMonth, Math.max(0, capTotal - stockKern));
      rapeNeed = Math.max(0, target - stRape);
    } else {
      rapeNeed = 0;
    }
    var win = Math.min(P.buyWindow, h.workDays);
    /* в последний месяц закрывающая партия рапса приходит разом, чтобы переход
       с культуры на культуру был один, а не размазывался по окну закупа */
    var winRape = isLast ? 1 : win;

    var M = {
      idx: m, label: monthLabel(h, m), crop: crop, need: required, stockAtStart: stockKern,
      planned: planned, available: available, failDay: failDay, minStockPlan: minStock,
      seedIn: 0, kern1: 0, kern2: 0, kern3: 0, husk: 0, kernLoss: 0,
      seedBuy: 0, rapeBuy: 0, oilIntake: 0, oilFromKern: 0, oilFromRape: 0,
      oilSun: 0, mealSun: 0, oilRape: 0, mealRape: 0, oilLoss: 0,
      idle: 0, overPeak: 0, overDays: 0, mixDays: 0, isLast: isLast, kernDaysIn: kernDaysIn,
      costKern1: 0, costOilRaw: 0,                // списанная стоимость: проданное ядро 1 кат. и сырьё маслоцеха
      sellKern2: 0, costKern2Sold: 0              // ядро 2 кат., проданное на сторону
    };

    for (var d = 1; d <= h.workDays; d++) {
      var row = { i: days.length, month: m, monthLabel: M.label, day: d, date: dayLabel(h, m, d), crop: crop };

      /* 1. закуп (равными долями в окно закупа) */
      row.seedBuy = d <= win ? seedNeed / win : 0;
      row.rapeBuy = d <= winRape ? rapeNeed / winRape : 0;
      stRape += row.rapeBuy;
      valRape += row.rapeBuy * c.prices.buyRape / c.finance.vatGoods;

      /* 2. завод ядра — работает, пока не наступила остановка перед концом горизонта */
      row.kernOn = kernWorks(row.i);
      row.seedIn = row.kernOn ? K.intake : 0;
      row.kern1 = row.seedIn * K.yKern1;      // 1 кат. — сразу на продажу, на склад НЕ заводим
      row.kern2 = row.seedIn * K.yKern2;      // 2 кат. — на склад
      row.kern3 = row.seedIn * K.yKern3;      // 3 кат. — на склад
      row.husk = row.seedIn * K.yHusk;        // лузга — отход, не продаём
      row.kernLoss = row.seedIn * K.yLoss;
      stK2 += row.kern2;
      stK3 += row.kern3;

      /* 2а. затраты завода ядра ложатся на товарный выход (лузга затрат не несёт).
             Ядро 1 кат. списывается сразу, ядро 2/3 кат. уходит в стоимость запаса. */
      var plantCost = row.seedIn * (c.prices.buySeed / c.finance.vatGoods + K.procCost / c.finance.vatService);
      var goodOut = row.kern1 + row.kern2 + row.kern3;
      row.unitKern = goodOut > 0 ? plantCost / goodOut : 0;
      row.costKern1 = row.kern1 * row.unitKern;
      valKern += (row.kern2 + row.kern3) * row.unitKern;

      /* 2а-бис. Продажа излишка ядра 2 кат. на сторону (если режим включён).
         Сверх вместимости отгружаем сразу, в последние сутки горизонта — весь остаток. */
      row.sellKern2 = 0; row.costKern2Sold = 0;
      var sellKern = function (want) {                      // отгрузка ядра 2/3 кат. на сторону
        var s2 = Math.min(stK2, want), s3 = Math.min(stK3, want - s2);
        if (s2 + s3 <= 0) return;
        var qK = stK2 + stK3, avg = qK > 0 ? valKern / qK : 0;
        row.sellKern2 += s2 + s3;
        row.costKern2Sold += (s2 + s3) * avg;
        valKern -= (s2 + s3) * avg;
        stK2 -= s2; stK3 -= s3;
      };
      if (P.sellKern2) sellKern(Math.max(0, (stK2 + stK3 + stRape) - capTotal));   // сверх вместимости

      /* 2б. ПИК СУТОК: склад загружен максимально после прихода и до переработки —
             именно этот объём должен физически поместиться. */
      row.pkKern = stK2 + stK3; row.pkRape = stRape; row.pkTotal = row.pkKern + row.pkRape;

      /* 3. завод масла — одна культура в моменте, больше склада взять не может */
      row.useKern2 = 0; row.useKern3 = 0; row.useRape = 0; row.idle = 0; row.mixed = 0;
      /* Порядок культур в сутках. Обычный месяц — только культура месяца (вариант Б)
         либо с добором рапсом (вариант А). ПОСЛЕДНИЙ месяц горизонта — единственное
         исключение: дожимаем культуру месяца в ноль и без паузы переходим на вторую. */
      var queue = (isLast || P.emptyMonth === 'A')
        ? (crop === 'kern' ? ['kern', 'rape'] : ['rape', 'kern'])
        : [crop];
      var free = 1;                                         // свободная доля суточной мощности
      queue.forEach(function (c) {
        if (free <= 0) return;
        if (c === 'kern') {
          if (O.intakeKern <= 0) return;
          var want = O.intakeKern * free, had = want;
          var t2 = Math.min(want, stK2); row.useKern2 += t2; want -= t2;
          var t3 = Math.min(want, stK3); row.useKern3 += t3; want -= t3;
          free -= (had - want) / O.intakeKern;
        } else {
          if (O.intakeRape <= 0) return;
          var wantR = O.intakeRape * free;
          var tr = Math.min(wantR, stRape); row.useRape += tr;
          free -= tr / O.intakeRape;
        }
      });
      row.idle = free * (crop === 'kern' ? O.intakeKern : O.intakeRape);
      var gotK = row.useKern2 + row.useKern3 > EPS_T, gotR = row.useRape > EPS_T;
      row.mixed = (gotK && gotR) ? 1 : 0;                   // сутки перехода с культуры на культуру
      row.useCrop = gotK && gotR ? 'both' : gotK ? 'kern' : gotR ? 'rape' : 'none';
      /* списание стоимости сырья маслоцеха по средней */
      var qK = stK2 + stK3, qR = stRape;
      var avgK = qK > 0 ? valKern / qK : 0, avgR = qR > 0 ? valRape / qR : 0;
      row.costOilRaw = (row.useKern2 + row.useKern3) * avgK + row.useRape * avgR;
      valKern -= (row.useKern2 + row.useKern3) * avgK;
      valRape -= row.useRape * avgR;

      stK2 -= row.useKern2; stK3 -= row.useKern3; stRape -= row.useRape;

      /* 4. выработка */
      var inKern = row.useKern2 + row.useKern3;
      row.oilSun = inKern * O.kernOil;
      row.mealSun = inKern * O.kernMeal;
      row.oilRape = row.useRape * O.rapeOil;
      row.mealRape = row.useRape * O.rapeMeal;
      row.oilLoss = inKern * O.kernLoss + row.useRape * O.rapeLoss;
      row.oilIntake = inKern + row.useRape;

      /* 4б. в последние сутки горизонта остаток ядра уходит на сторону — уже после переработки */
      if (P.sellKern2 && row.i === totalDays - 1) sellKern(stK2 + stK3);

      /* 5. остатки на конец суток */
      row.stKern2 = stK2; row.stKern3 = stK3; row.stRape = stRape;
      row.stTotal = stK2 + stK3 + stRape;
      row.stValue = valKern + valRape;

      /* 5а. раскладка ПИКА суток по складам: ядро занимает склады с первого,
             рапс — с последнего; что не поместилось, идёт в «сверх». */
      var free = [], whK = [], whR = [], w;
      for (w = 0; w < S.count; w++) { free.push(S.capacity); whK.push(0); whR.push(0); }
      var restK = row.pkKern, restR = row.pkRape, put;
      for (w = 0; w < S.count; w++) { put = Math.min(restK, free[w]); whK[w] = put; free[w] -= put; restK -= put; }
      for (w = S.count - 1; w >= 0; w--) { put = Math.min(restR, free[w]); whR[w] = put; free[w] -= put; restR -= put; }
      row.whK = whK; row.whR = whR;
      row.wh = whK.map(function (x, i) { return x + whR[i]; });
      row.over = restK + restR;                             // сколько тонн не влезает в пике суток
      if (row.over > 0) { M.overDays++; if (row.over > M.overPeak) M.overPeak = row.over; }

      /* агрегируем в месяц */
      M.seedIn += row.seedIn; M.kern1 += row.kern1; M.kern2 += row.kern2; M.kern3 += row.kern3;
      M.husk += row.husk; M.kernLoss += row.kernLoss;
      M.seedBuy += row.seedBuy; M.rapeBuy += row.rapeBuy;
      M.oilIntake += row.oilIntake; M.oilFromKern += inKern; M.oilFromRape += row.useRape;
      M.oilSun += row.oilSun; M.mealSun += row.mealSun;
      M.oilRape += row.oilRape; M.mealRape += row.mealRape;
      M.oilLoss += row.oilLoss; M.idle += row.idle;
      if (row.mixed) M.mixDays = (M.mixDays || 0) + 1;
      M.costKern1 += row.costKern1; M.costOilRaw += row.costOilRaw;
      M.sellKern2 += row.sellKern2; M.costKern2Sold += row.costKern2Sold;

      days.push(row);
    }

    finance(M, c);
    months.push(M);
  }

  return { days: days, months: months, switches: switches, capTotal: capTotal, kpi: kpi(days, months, c) };
}

/* ============================ ФИНАНСЫ МЕСЯЦА ============================ */
/* НДС и состав статей — по листу «Ядро+масло»: выручка и сырьё /1,1, переработка и отгрузка /1,2.
   Отличие от файла: затраты сырья списываются в месяц ПЕРЕРАБОТКИ (решение владельца),
   поэтому переходящий остаток на складе остаётся активом, а не расходом периода. */
function finance(M, c) {
  var PR = c.prices, FR = c.freight, F = c.finance, K = c.kernel, O = c.oil;

  M.revKern1 = M.kern1 * PR.kern1 / F.vatGoods;
  M.revKern2 = M.sellKern2 * PR.kern2 / F.vatGoods;
  M.revSunOil = M.oilSun * PR.sunOil / F.vatGoods;
  M.revSunMeal = M.mealSun * PR.sunMeal / F.vatGoods;
  M.revRapeOil = M.oilRape * PR.rapeOil / F.vatGoods;
  M.revRapeMeal = M.mealRape * PR.rapeMeal / F.vatGoods;
  M.revHusk = M.husk * PR.husk / F.vatGoods;
  M.revenue = M.revKern1 + M.revKern2 + M.revSunOil + M.revSunMeal + M.revRapeOil + M.revRapeMeal + M.revHusk;

  M.costProcOil = M.oilIntake * O.procCost / F.vatService;
  M.cost = M.costKern1 + M.costKern2Sold + M.costOilRaw + M.costProcOil;              // costKern1/costOilRaw уже включают переработку ядра

  M.frKern1 = M.kern1 * FR.kern1 / F.vatService;
  M.frKern2 = M.sellKern2 * FR.kern1 / F.vatService;   // тариф «ЯДРО + П/Ф + 3 кат», H3
  M.frOil = (M.oilSun + M.oilRape) * FR.oil / F.vatService;
  M.frMeal = (M.mealSun + M.mealRape) * FR.meal / F.vatService;
  M.freight = M.frKern1 + M.frKern2 + M.frOil + M.frMeal;

  /* вложенный капитал — 1:1 по ячейкам листа «Ядро+масло»:
     B35 запас сырья = месячный закуп сырья по ценам с НДС (в файле N1×L1×D1);
     B36 КЗ = половина B35; B37 ДЗ = месячная выработка ядра 1 кат × цена с НДС;
     B38 = сумма; B40/B41 — годовые проценты и их двенадцатая часть. */
  M.stockRaw = M.seedBuy * PR.buySeed + M.rapeBuy * PR.buyRape;   // B35
  M.arRaw = M.kern1 * PR.kern1;                                   // B37
  M.capital = M.stockRaw * F.stockMonths + M.stockRaw * F.apMonths + M.arRaw * F.arMonths;  // B38
  M.interest = M.capital * F.moneyRate / F.monthsYear;            // B40 / B41

  M.base = M.revenue - M.cost - M.freight - M.interest;
  M.tax = Math.max(0, M.base) * F.profitTax;              // при убытке налог не начисляем
  M.profit = M.base - M.tax;
  M.margin = M.revenue > 0 ? M.profit / M.revenue : 0;
}

/* ============================ KPI ЗА СЕЗОН ============================ */
function kpi(days, months, c) {
  var sum = function (arr, f) { return arr.reduce(function (a, x) { return a + f(x); }, 0); };
  var last = days[days.length - 1];
  return {
    seedBuy: sum(months, function (m) { return m.seedBuy; }),
    rapeBuy: sum(months, function (m) { return m.rapeBuy; }),
    kern1: sum(months, function (m) { return m.kern1; }),
    kern2: sum(months, function (m) { return m.kern2; }),
    sellKern2: sum(months, function (m) { return m.sellKern2; }),
    seedIdle: 0,
    husk: sum(months, function (m) { return m.husk; }),
    oilSun: sum(months, function (m) { return m.oilSun; }),
    mealSun: sum(months, function (m) { return m.mealSun; }),
    oilRape: sum(months, function (m) { return m.oilRape; }),
    mealRape: sum(months, function (m) { return m.mealRape; }),
    idle: sum(months, function (m) { return m.idle; }),
    revenue: sum(months, function (m) { return m.revenue; }),
    cost: sum(months, function (m) { return m.cost; }),
    freight: sum(months, function (m) { return m.freight; }),
    interest: sum(months, function (m) { return m.interest; }),
    tax: sum(months, function (m) { return m.tax; }),
    profit: sum(months, function (m) { return m.profit; }),
    kernMonths: months.filter(function (m) { return m.crop === 'kern'; }).length,
    rapeMonths: months.filter(function (m) { return m.crop === 'rape'; }).length,
    overPeak: Math.max.apply(null, days.map(function (d) { return d.over; })),
    overDays: days.filter(function (d) { return d.over > 0; }).length,
    peakStock: Math.max.apply(null, days.map(function (d) { return d.pkTotal; })),
    endKern2: last.stKern2, endKern3: last.stKern3, endRape: last.stRape,
    endValue: last.stValue
  };
}

if (typeof module !== 'undefined') module.exports = { calcModel: calcModel, derive: derive, validate: validate, monthLabel: monthLabel, dayLabel: dayLabel };
