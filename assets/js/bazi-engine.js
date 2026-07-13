/*!
 * ChuwuBazi — Traditional Chinese Bazi (八字, Four Pillars of Destiny) engine.
 *
 * Self-contained, dependency-free vanilla JavaScript. Works both:
 *   - in a browser via <script src="bazi-engine.js"> (attaches window.ChuwuBazi)
 *   - under plain Node (attaches globalThis.ChuwuBazi) for testing / server-side use
 *
 * ---------------------------------------------------------------------------
 * KEY DESIGN DECISIONS (documented per the spec this file was built against)
 * ---------------------------------------------------------------------------
 *
 * 1) SOLAR-CALENDAR BAZI, NOT LUNAR.
 *    Orthodox Bazi pillars are derived from the 24 solar terms (节气), not the
 *    lunar month/new-moon calendar. We never touch lunar dates:
 *      - Year pillar boundary  = Li Chun 立春 (solar longitude 315°), NOT Jan 1
 *        and NOT Lunar New Year.
 *      - Month pillar boundary = the 12 "Jie" 节 solar terms (every 30° of
 *        solar longitude, at the odd multiples of 15°: 315, 345, 15, 45, ...).
 *
 * 2) TIMEZONE ASSUMPTION.
 *    The caller passes local CIVIL time already resolved (no DST/timezone
 *    math needed on our end). We assume that civil time is mainland China
 *    Standard Time (UTC+8) — a single fixed offset, no historical DST rules,
 *    which is correct for virtually all PRC birth records. This is a
 *    deliberate simplification: true-solar-time correction by birth
 *    longitude is NOT applied (see "Known limitations" below).
 *
 * 3) DAY PILLAR — the "late Zi / early Zi" (早晚子时) convention.
 *    Every Bazi tool has to pick a side on what happens between 23:00 and
 *    00:59. We use the common MODERN convention:
 *      - 23:00–23:59 ("late Zi / 晚子时") already belongs to the NEXT
 *        calendar day: both the day pillar AND the hour pillar roll over to
 *        tomorrow's Zi hour.
 *      - 00:00–00:59 ("early Zi / 早子时") uses TODAY's calendar date's day
 *        pillar, with hour branch Zi (子) — i.e. it does NOT get a second
 *        rollover, because the day pillar already advanced at 23:00.
 *    This is the single most common modern software convention (used by most
 *    Chinese "万年历"/Bazi calculators). Some classical schools instead treat
 *    the whole 23:00–00:59 window as a single Zi hour with NO day-pillar
 *    rollover at 23:00 ("单日辰" style); we do not implement that variant.
 *
 * 4) SOLAR LONGITUDE — Meeus low-precision solar position (~0.01° accuracy,
 *    i.e. within roughly a few to ~15 minutes of time around a solar-term
 *    instant). This is the standard "low accuracy" formula (see Jean Meeus,
 *    "Astronomical Algorithms", ch. 25) built from the sun's mean longitude,
 *    mean anomaly and the equation of center, with a small nutation/
 *    aberration correction for apparent longitude. We do not implement full
 *    VSOP87 — not required for a consumer-facing personalization quiz.
 *    ΔT (TT vs UT) is ignored: over 1900–2035 this is at most ~1 minute,
 *    which is already inside the formula's own ~0.01° error budget.
 *
 * 5) VALID RANGE. Designed and validated for Gregorian years ~1900–2035.
 *    The day-pillar Julian Day math and the solar-longitude series are both
 *    fine well outside that window too, but solar-term seed dates (used to
 *    seed the Newton root-finder) are only guaranteed close enough to
 *    converge within that span.
 *
 * ---------------------------------------------------------------------------
 * VALIDATION
 * ---------------------------------------------------------------------------
 * This engine was checked against several independently documented facts
 * (see the accompanying test script used during development):
 *   - 2000-01-01 (any daytime hour): year 己卯, month 丙子, day 戊午
 *     ("该日的干支为己卯丙子戊午" — multiple Chinese almanac / 老黄历 sources).
 *   - 2000-02-04 20:05 (Beijing time), with that year's Li Chun occurring
 *     ~20:32–20:40 the same day: still 己卯 year / 丁丑 month (birth is
 *     BEFORE Li Chun, so both the year and the month stay in the previous
 *     solar-year's cycle) — a documented worked example of the boundary case.
 *   - 1928-07-29 (any daytime hour): year 戊辰, month 己未, day 庚午 — from
 *     Li Ka-shing's (李嘉诚) widely cited eight-characters chart (the hour
 *     pillar is disputed among sources, so only year/month/day were used).
 *   - Li Chun 2024: Feb 4, ~16:26:53–16:27:08 Beijing time (news / Purple
 *     Mountain Observatory reporting).
 *   - Li Chun 1984: Feb 4, ~23:18:44 Beijing time — a rare very-late-in-the-
 *     day Li Chun, useful as a same-day year-boundary edge case.
 *   - Julian-Day ↔ sexagenary-day formula cross-checked against the
 *     professionally maintained reference calculator/derivation at
 *     ytliu0.github.io/ChineseCalendar (worked example: JDN 2371629 at noon
 *     = 1781-03-13 → 壬戌 day), which matches this file's S = 1 + ((JDN_noon
 *     − 11) mod 60) formula exactly (S=1 ↔ 甲子).
 */

(function (root) {
  'use strict';

  // ---------------------------------------------------------------------
  // Core sexagenary tables
  // ---------------------------------------------------------------------

  var HEAVENLY_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  var EARTHLY_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

  // Stems: 甲乙=Wood 丙丁=Fire 戊己=Earth 庚辛=Metal 壬癸=Water; even index = Yang, odd = Yin.
  var STEM_ELEMENT = ['Wood', 'Wood', 'Fire', 'Fire', 'Earth', 'Earth', 'Metal', 'Metal', 'Water', 'Water'];
  var STEM_YINYANG = ['Yang', 'Yin', 'Yang', 'Yin', 'Yang', 'Yin', 'Yang', 'Yin', 'Yang', 'Yin'];

  // Each branch's own primary Five-Element category (地支五行):
  // 寅卯=Wood 巳午=Fire 辰戌丑未=Earth 申酉=Metal 亥子=Water
  // (indices follow EARTHLY_BRANCHES order: 子丑寅卯辰巳午未申酉戌亥)
  var BRANCH_ELEMENT = ['Water', 'Earth', 'Wood', 'Wood', 'Earth', 'Fire', 'Fire', 'Earth', 'Metal', 'Metal', 'Earth', 'Water'];

  // Hidden stems (藏干) per branch, as [stemIndex, weight] pairs, main stem first.
  // Weighting convention: 3-stem branches -> 0.6 / 0.3 / 0.1 (main/middle/residual qi),
  // 2-stem branches -> 0.7 / 0.3, 1-stem branches -> 1.0. Internally consistent; any
  // standard weighting scheme works for the element tally, this is simply one of them.
  var HIDDEN_STEMS = [
    [[9, 1.0]],                          // 子: 癸
    [[5, 0.6], [9, 0.3], [7, 0.1]],       // 丑: 己 癸 辛
    [[0, 0.6], [2, 0.3], [4, 0.1]],       // 寅: 甲 丙 戊
    [[1, 1.0]],                          // 卯: 乙
    [[4, 0.6], [1, 0.3], [9, 0.1]],       // 辰: 戊 乙 癸
    [[2, 0.6], [4, 0.3], [6, 0.1]],       // 巳: 丙 戊 庚
    [[3, 0.7], [5, 0.3]],                 // 午: 丁 己
    [[5, 0.6], [3, 0.3], [1, 0.1]],       // 未: 己 丁 乙
    [[6, 0.6], [8, 0.3], [4, 0.1]],       // 申: 庚 壬 戊
    [[7, 1.0]],                          // 酉: 辛
    [[4, 0.6], [7, 0.3], [3, 0.1]],       // 戌: 戊 辛 丁
    [[8, 0.7], [0, 0.3]]                  // 亥: 壬 甲
  ];

  var ELEMENT_ORDER = ['Wood', 'Fire', 'Earth', 'Metal', 'Water'];
  var ELEMENT_ZH = { Wood: '木', Fire: '火', Earth: '土', Metal: '金', Water: '水' };

  // ---------------------------------------------------------------------
  // Julian Day helpers (proleptic Gregorian calendar; valid ~1900-2035
  // for this module's purposes, but the math itself is generally valid).
  // ---------------------------------------------------------------------

  // Fractional Julian Day (JD) for a Gregorian calendar date/time given in UT.
  // Standard Meeus algorithm (Astronomical Algorithms, ch. 7).
  function gregorianToJD(year, month, day, hour, minute, second) {
    hour = hour || 0; minute = minute || 0; second = second || 0;
    var y = year, m = month;
    if (m <= 2) { y -= 1; m += 12; }
    var A = Math.floor(y / 100);
    var B = 2 - A + Math.floor(A / 4);
    var dayFrac = day + (hour + minute / 60 + second / 3600) / 24;
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + dayFrac + B - 1524.5;
  }

  // Standard integer JDN "at noon" for a calendar date (ignores time of day).
  // For 2000-01-01 this returns 2451545, the well-known J2000.0 JDN anchor.
  function gregorianToNoonJDN(year, month, day) {
    return Math.round(gregorianToJD(year, month, day, 12, 0, 0));
  }

  // Add `n` calendar days to a plain Y/M/D (used for the late-Zi day rollover).
  // Uses UTC-based Date arithmetic purely as a calendar calculator (no real
  // timezone semantics involved) so month/year rollovers are handled for free.
  function addCalendarDays(year, month, day, n) {
    var dt = new Date(Date.UTC(year, month - 1, day));
    dt.setUTCDate(dt.getUTCDate() + n);
    return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() };
  }

  // ---------------------------------------------------------------------
  // Day pillar (continuous 60-cycle from Julian Day Number)
  // ---------------------------------------------------------------------
  //
  // Formula: S = 1 + ((JDN_noon - 11) mod 60), where S=1 <-> 甲子 (index 0).
  // Cross-checked against:
  //   - the professionally maintained reference derivation at
  //     ytliu0.github.io/ChineseCalendar (worked example: JDN 2371629 at
  //     noon = 1781-03-13 -> 壬戌 day).
  //   - independently documented fact: 2000-01-01 -> 戊午 day (multiple
  //     Chinese almanac sources state "该日的干支为己卯丙子戊午").
  function sexagenaryIndexFromJDN(jdnNoon) {
    var S = 1 + (((jdnNoon - 11) % 60) + 60) % 60; // 1..60
    return S - 1; // 0-based index into the 60 Jiazi cycle
  }

  // ---------------------------------------------------------------------
  // Solar longitude (Meeus low-precision apparent geocentric ecliptic
  // longitude of the Sun). Accuracy ~0.01 degree. Input: fractional JD (UT).
  // Output: degrees, normalized to [0, 360).
  // ---------------------------------------------------------------------
  function toRad(deg) { return deg * Math.PI / 180; }
  function norm360(deg) { return ((deg % 360) + 360) % 360; }

  function solarApparentLongitude(jd) {
    var T = (jd - 2451545.0) / 36525.0;

    var L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T; // mean longitude
    var M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;  // mean anomaly
    var Mrad = toRad(norm360(M));

    var C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mrad)
      + (0.019993 - 0.000101 * T) * Math.sin(2 * Mrad)
      + 0.000289 * Math.sin(3 * Mrad);

    var trueLongitude = L0 + C;

    var omega = 125.04 - 1934.136 * T;
    var apparentLongitude = trueLongitude - 0.00569 - 0.00478 * Math.sin(toRad(omega));

    return norm360(apparentLongitude);
  }

  // Approximate (year, month, day) seed for each of the 12 "Jie" 节 solar
  // terms, used purely to give the Newton root-finder a starting point
  // within ~1-2 days of the true instant (per the spec's reference dates).
  var JIE_SEED = {
    315: [2, 4],   // 立春 Li Chun   ~Feb 4  (Yin  寅 month starts / year boundary)
    345: [3, 6],   // 惊蛰 Jingzhe   ~Mar 6  (Mao  卯)
    15: [4, 5],    // 清明 Qingming  ~Apr 5  (Chen 辰)
    45: [5, 6],    // 立夏 Lixia     ~May 6  (Si   巳)
    75: [6, 6],    // 芒种 Mangzhong ~Jun 6  (Wu   午)
    105: [7, 7],   // 小暑 Xiaoshu   ~Jul 7  (Wei  未)
    135: [8, 7],   // 立秋 Liqiu     ~Aug 7  (Shen 申)
    165: [9, 8],   // 白露 Bailu     ~Sep 8  (You  酉)
    195: [10, 8],  // 寒露 Hanlu     ~Oct 8  (Xu   戌)
    225: [11, 7],  // 立冬 Lidong    ~Nov 7  (Hai  亥)
    255: [12, 7],  // 大雪 Daxue     ~Dec 7  (Zi   子)
    285: [1, 6]    // 小寒 Xiaohan   ~Jan 6  (Chou 丑)
  };

  // Find the UT fractional Julian Day at which the sun's apparent longitude
  // equals `targetDeg` (one of the 12 Jie multiples of 15, e.g. 315 for Li
  // Chun) within calendar year `gregorianYear`. Uses a damped Newton
  // iteration seeded from JIE_SEED; converges in well under 10 iterations.
  function findSolarTermJD(gregorianYear, targetDeg) {
    var seed = JIE_SEED[targetDeg];
    if (!seed) { throw new Error('Unsupported Jie target longitude: ' + targetDeg); }
    var seedMonth = seed[0];
    var seedYear = gregorianYear + (seedMonth === 1 && targetDeg === 285 ? 1 : 0);
    // 小寒 (285°) seed date is Jan 6 of the FOLLOWING calendar year relative
    // to its Bazi-year label is not an issue here: JIE_SEED already stores
    // plain calendar month/day, so seedYear is simply gregorianYear unless
    // the caller is asking for a term whose seed month is January and the
    // requested "year" convention differs — kept simple: this module only
    // ever calls findSolarTermJD with targetDeg=315 (Li Chun, seed month
    // February), so this branch is inert but left for generality/testing.

    // China civil-time noon of the seed date, converted to UT (-8h).
    var jd = gregorianToJD(seedYear, seedMonth, seed[1], 12, 0, 0) - 8 / 24;

    for (var i = 0; i < 30; i++) {
      var lon = solarApparentLongitude(jd);
      var diff = lon - targetDeg;
      diff = ((diff + 180) % 360 + 360) % 360 - 180; // normalize to (-180, 180]
      if (Math.abs(diff) < 1e-8) { break; }
      jd -= diff / 0.9856002; // ~mean degrees/day; damped Newton step
    }
    return jd; // UT fractional Julian Day
  }

  // ---------------------------------------------------------------------
  // Five Tiger Dun 五虎遁 (month stem from year stem) and
  // Five Rat Dun 五鼠遁 (hour stem from day stem).
  // ---------------------------------------------------------------------
  //
  // Five Tiger rhyme:
  //   甲己之年丙作首 (甲/己 year -> Yin month starts at 丙)
  //   乙庚之岁戊为头 (乙/庚 -> 戊)
  //   丙辛必定寻庚起 (丙/辛 -> 庚)
  //   丁壬壬位顺行流 (丁/壬 -> 壬)
  //   若问戊癸何方发, 甲寅之上好追求 (戊/癸 -> 甲)
  //
  // Closed form: yinStemIndex = (2 * (yearStemIndex % 5) + 2) % 10
  // (verified against all 5 pairs above).
  function yinMonthStemIndex(yearStemIndex) {
    return (2 * (yearStemIndex % 5) + 2) % 10;
  }

  // Five Rat rhyme:
  //   甲己还加甲 (甲/己 day -> Zi hour starts at 甲)
  //   乙庚丙作初 (乙/庚 -> 丙)
  //   丙辛从戊起 (丙/辛 -> 戊)
  //   丁壬庚子居 (丁/壬 -> 庚)
  //   戊癸何方发, 壬子是真途 (戊/癸 -> 壬)
  //
  // Closed form: ziHourStemIndex = (2 * (dayStemIndex % 5)) % 10.
  function ziHourStemIndex(dayStemIndex) {
    return (2 * (dayStemIndex % 5)) % 10;
  }

  // ---------------------------------------------------------------------
  // Pillar assembly helper
  // ---------------------------------------------------------------------
  function makePillar(stemIndex, branchIndex) {
    return {
      stem: HEAVENLY_STEMS[stemIndex],
      branch: EARTHLY_BRANCHES[branchIndex],
      stemElement: STEM_ELEMENT[stemIndex],
      branchElement: BRANCH_ELEMENT[branchIndex],
      label: HEAVENLY_STEMS[stemIndex] + EARTHLY_BRANCHES[branchIndex]
    };
  }

  // ---------------------------------------------------------------------
  // Main entry point
  // ---------------------------------------------------------------------
  function computeBazi(input) {
    var year = input.year;
    var month = input.month;
    var day = input.day;
    var hour = input.hour;
    var minute = input.minute || 0;

    if (
      typeof year !== 'number' || typeof month !== 'number' ||
      typeof day !== 'number' || typeof hour !== 'number'
    ) {
      throw new Error('ChuwuBazi.computeBazi requires numeric { year, month, day, hour, minute }');
    }

    // --- Actual birth instant, converted from China civil time (UTC+8) to UT.
    // Used for everything astronomical (year boundary + month branch), which
    // must depend on the true instant, NOT on the late-Zi day-pillar shift.
    var birthJD_UT = gregorianToJD(year, month, day, hour, minute, 0) - 8 / 24;

    // --- YEAR PILLAR: sexagenary year, boundary = Li Chun (solar longitude 315°).
    var liChunJD_UT = findSolarTermJD(year, 315);
    var baseYear = year;
    if (birthJD_UT < liChunJD_UT) {
      baseYear -= 1; // born before this year's Li Chun -> previous sexagenary year
    }
    var yearStemIndex = ((baseYear - 4) % 10 + 10) % 10;
    var yearBranchIndex = ((baseYear - 4) % 12 + 12) % 12;

    // --- MONTH PILLAR: branch from the 30°-wide Jie sector containing the
    // birth instant's solar longitude; stem from Five Tiger Dun off the
    // (Li-Chun-adjusted) year stem above.
    var solarLon = solarApparentLongitude(birthJD_UT);
    var sectorIndex = Math.floor(norm360(solarLon - 315) / 30); // 0..11, 0 = Yin sector
    var monthBranchIndex = (2 + sectorIndex) % 12; // Yin(寅)=2 is EARTHLY_BRANCHES index 2

    var yinStemIdx = yinMonthStemIndex(yearStemIndex);
    var offsetFromYin = ((monthBranchIndex - 2) % 12 + 12) % 12;
    var monthStemIndex = (yinStemIdx + offsetFromYin) % 10;

    // --- DAY PILLAR: continuous 60-cycle from JDN, with late-Zi (23:00+)
    // rollover to the next calendar day (see file header, point 3).
    var effDate = (hour >= 23) ? addCalendarDays(year, month, day, 1) : { year: year, month: month, day: day };
    var dayJDN = gregorianToNoonJDN(effDate.year, effDate.month, effDate.day);
    var daySexIndex = sexagenaryIndexFromJDN(dayJDN);
    var dayStemIndex = daySexIndex % 10;
    var dayBranchIndex = daySexIndex % 12;

    // --- HOUR PILLAR: 12 two-hour branches starting 23:00 (子); stem from
    // Five Rat Dun off the (already-rolled-over) day stem above.
    var adjHour = (hour + 1) % 24;
    var hourBranchIndex = Math.floor(adjHour / 2);
    var ziStemIdx = ziHourStemIndex(dayStemIndex);
    var hourStemIndex = (ziStemIdx + hourBranchIndex) % 10;

    var pillars = {
      year: makePillar(yearStemIndex, yearBranchIndex),
      month: makePillar(monthStemIndex, monthBranchIndex),
      day: makePillar(dayStemIndex, dayBranchIndex),
      hour: makePillar(hourStemIndex, hourBranchIndex)
    };

    var dayMaster = {
      stem: HEAVENLY_STEMS[dayStemIndex],
      element: STEM_ELEMENT[dayStemIndex],
      yinYang: STEM_YINYANG[dayStemIndex]
    };

    // --- FIVE ELEMENT TALLY: 4 stems (full weight) + 4 branches (weighted
    // hidden stems). Total mass = 8.0 across the 5 elements.
    var tally = { Wood: 0, Fire: 0, Earth: 0, Metal: 0, Water: 0 };

    [yearStemIndex, monthStemIndex, dayStemIndex, hourStemIndex].forEach(function (si) {
      tally[STEM_ELEMENT[si]] += 1.0;
    });

    [yearBranchIndex, monthBranchIndex, dayBranchIndex, hourBranchIndex].forEach(function (bi) {
      HIDDEN_STEMS[bi].forEach(function (pair) {
        var hiddenStemIndex = pair[0], weight = pair[1];
        tally[STEM_ELEMENT[hiddenStemIndex]] += weight;
      });
    });

    // Round away floating point dust (weights like 0.1/0.3/0.7 don't sum exactly in binary fp).
    ELEMENT_ORDER.forEach(function (el) { tally[el] = Math.round(tally[el] * 1e6) / 1e6; });

    var minTally = Math.min.apply(null, ELEMENT_ORDER.map(function (el) { return tally[el]; }));
    var lackingElements = ELEMENT_ORDER.filter(function (el) { return tally[el] === minTally; });

    return {
      pillars: pillars,
      dayMaster: dayMaster,
      elementTally: tally,
      lackingElements: lackingElements,
      elementOrder: ELEMENT_ORDER.slice()
    };
  }

  var ChuwuBazi = {
    computeBazi: computeBazi,
    ELEMENT_ZH: ELEMENT_ZH,
    // Exposed for testing / advanced use; not required by the public interface.
    _internal: {
      gregorianToJD: gregorianToJD,
      gregorianToNoonJDN: gregorianToNoonJDN,
      sexagenaryIndexFromJDN: sexagenaryIndexFromJDN,
      solarApparentLongitude: solarApparentLongitude,
      findSolarTermJD: findSolarTermJD,
      HEAVENLY_STEMS: HEAVENLY_STEMS,
      EARTHLY_BRANCHES: EARTHLY_BRANCHES
    }
  };

  root.ChuwuBazi = ChuwuBazi;

})(typeof window !== 'undefined' ? window : globalThis);
