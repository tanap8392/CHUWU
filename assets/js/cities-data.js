/* CHUWU (初·五) — birth-place lookup for true solar time correction.
   Bazi hour/day pillars traditionally use true solar time at the birth location, not the civil
   clock. Each entry gives the city's longitude (°, +East) and its civil UTC offset (hours), so we
   can convert an input civil clock reading to a China-Standard-Time-equivalent, true-solar-corrected
   reading before handing it to the Bazi engine (which assumes a UTC+8, 120°E-referenced civil clock). */
(function (root) {
  const CITIES = {
    // Mainland China (UTC+8)
    'Beijing': { longitude: 116.40, utcOffset: 8, group: 'Mainland China' },
    'Shanghai': { longitude: 121.47, utcOffset: 8, group: 'Mainland China' },
    'Guangzhou': { longitude: 113.26, utcOffset: 8, group: 'Mainland China' },
    'Shenzhen': { longitude: 114.06, utcOffset: 8, group: 'Mainland China' },
    'Chengdu': { longitude: 104.06, utcOffset: 8, group: 'Mainland China' },
    'Chongqing': { longitude: 106.55, utcOffset: 8, group: 'Mainland China' },
    'Hangzhou': { longitude: 120.15, utcOffset: 8, group: 'Mainland China' },
    'Nanjing': { longitude: 118.78, utcOffset: 8, group: 'Mainland China' },
    'Wuhan': { longitude: 114.31, utcOffset: 8, group: 'Mainland China' },
    "Xi'an": { longitude: 108.95, utcOffset: 8, group: 'Mainland China' },
    'Tianjin': { longitude: 117.20, utcOffset: 8, group: 'Mainland China' },
    'Suzhou': { longitude: 120.62, utcOffset: 8, group: 'Mainland China' },
    'Qingdao': { longitude: 120.38, utcOffset: 8, group: 'Mainland China' },
    'Xiamen': { longitude: 118.10, utcOffset: 8, group: 'Mainland China' },
    'Fuzhou': { longitude: 119.30, utcOffset: 8, group: 'Mainland China' },
    'Ningbo': { longitude: 121.55, utcOffset: 8, group: 'Mainland China' },
    'Kunming': { longitude: 102.83, utcOffset: 8, group: 'Mainland China' },
    'Harbin': { longitude: 126.53, utcOffset: 8, group: 'Mainland China' },
    'Shenyang': { longitude: 123.43, utcOffset: 8, group: 'Mainland China' },
    'Zhengzhou': { longitude: 113.65, utcOffset: 8, group: 'Mainland China' },
    'Changsha': { longitude: 112.94, utcOffset: 8, group: 'Mainland China' },
    'Dalian': { longitude: 121.62, utcOffset: 8, group: 'Mainland China' },
    'Hefei': { longitude: 117.27, utcOffset: 8, group: 'Mainland China' },
    'Jinan': { longitude: 117.00, utcOffset: 8, group: 'Mainland China' },
    'Nanning': { longitude: 108.37, utcOffset: 8, group: 'Mainland China' },
    'Guiyang': { longitude: 106.71, utcOffset: 8, group: 'Mainland China' },
    'Lanzhou': { longitude: 103.73, utcOffset: 8, group: 'Mainland China' },
    'Urumqi': { longitude: 87.62, utcOffset: 8, group: 'Mainland China' },
    'Lhasa': { longitude: 91.13, utcOffset: 8, group: 'Mainland China' },

    // Greater China & Southeast Asia
    'Hong Kong': { longitude: 114.17, utcOffset: 8, group: 'Greater China & SE Asia' },
    'Macau': { longitude: 113.55, utcOffset: 8, group: 'Greater China & SE Asia' },
    'Taipei': { longitude: 121.56, utcOffset: 8, group: 'Greater China & SE Asia' },
    'Kaohsiung': { longitude: 120.30, utcOffset: 8, group: 'Greater China & SE Asia' },
    'Singapore': { longitude: 103.82, utcOffset: 8, group: 'Greater China & SE Asia' },
    'Kuala Lumpur': { longitude: 101.69, utcOffset: 8, group: 'Greater China & SE Asia' },
    'Bangkok': { longitude: 100.50, utcOffset: 7, group: 'Greater China & SE Asia' },
    'Tokyo': { longitude: 139.69, utcOffset: 9, group: 'Greater China & SE Asia' },
    'Seoul': { longitude: 126.98, utcOffset: 9, group: 'Greater China & SE Asia' },

    // Other international hubs
    'Sydney': { longitude: 151.21, utcOffset: 10, group: 'Other International' },
    'New York': { longitude: -74.00, utcOffset: -5, group: 'Other International' },
    'Los Angeles': { longitude: -118.24, utcOffset: -8, group: 'Other International' },
    'Vancouver': { longitude: -123.12, utcOffset: -8, group: 'Other International' },
    'Toronto': { longitude: -79.38, utcOffset: -5, group: 'Other International' },
    'London': { longitude: -0.13, utcOffset: 0, group: 'Other International' }
  };

  // Adjusts a civil birth date/time at `cityKey` into a China-Standard-Time-equivalent,
  // true-solar-corrected reading suitable for ChuwuBazi.computeBazi(). Returns input unchanged
  // (i.e. assumes standard 120°E meridian, the engine's documented default) if cityKey is unknown.
  function adjustForTrueSolarTime(dt, cityKey) {
    const city = CITIES[cityKey];
    if (!city) return dt;
    const localMeridian = city.utcOffset * 15;
    const solarCorrectionMin = (city.longitude - localMeridian) * 4;
    const beijingShiftMin = (8 - city.utcOffset) * 60;
    const totalMin = Math.round(solarCorrectionMin + beijingShiftMin);

    const d = new Date(dt.year, dt.month - 1, dt.day, dt.hour, dt.minute);
    d.setMinutes(d.getMinutes() + totalMin);
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      hour: d.getHours(),
      minute: d.getMinutes()
    };
  }

  root.ChuwuCities = { CITIES, adjustForTrueSolarTime };
})(typeof window !== 'undefined' ? window : globalThis);
