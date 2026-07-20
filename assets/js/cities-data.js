/* CHUWU (初·五) — birth-place lookup for true solar time correction.
   Bazi hour/day pillars traditionally use true solar time at the birth location, not the civil
   clock. Each entry gives the city's longitude (°, +East) and its civil UTC offset (hours), so we
   can convert an input civil clock reading to a China-Standard-Time-equivalent, true-solar-corrected
   reading before handing it to the Bazi engine (which assumes a UTC+8, 120°E-referenced civil clock). */
(function (root) {
  const CITIES = {
    // Mainland China — a few representative cities spanning the country's longitude range
    // (that's what actually matters for the true-solar-time correction), not an exhaustive list.
    'Beijing': { longitude: 116.40, utcOffset: 8, group: 'China' },
    'Shanghai': { longitude: 121.47, utcOffset: 8, group: 'China' },
    'Guangzhou / Shenzhen': { longitude: 113.5, utcOffset: 8, group: 'China' },
    "Chengdu / Xi'an": { longitude: 106.5, utcOffset: 8, group: 'China' },
    'Urumqi': { longitude: 87.62, utcOffset: 8, group: 'China' },
    'Hong Kong': { longitude: 114.17, utcOffset: 8, group: 'China' },
    'Macau': { longitude: 113.55, utcOffset: 8, group: 'China' },
    'Taipei': { longitude: 121.56, utcOffset: 8, group: 'China' },

    // East & Southeast Asia
    'Singapore': { longitude: 103.82, utcOffset: 8, group: 'East & Southeast Asia' },
    'Kuala Lumpur': { longitude: 101.69, utcOffset: 8, group: 'East & Southeast Asia' },
    'Jakarta': { longitude: 106.85, utcOffset: 7, group: 'East & Southeast Asia' },
    'Manila': { longitude: 120.98, utcOffset: 8, group: 'East & Southeast Asia' },
    'Bangkok': { longitude: 100.50, utcOffset: 7, group: 'East & Southeast Asia' },
    'Ho Chi Minh City': { longitude: 106.70, utcOffset: 7, group: 'East & Southeast Asia' },
    'Tokyo': { longitude: 139.69, utcOffset: 9, group: 'East & Southeast Asia' },
    'Seoul': { longitude: 126.98, utcOffset: 9, group: 'East & Southeast Asia' },

    // South Asia & Middle East
    'Mumbai': { longitude: 72.88, utcOffset: 5.5, group: 'South Asia & Middle East' },
    'New Delhi': { longitude: 77.21, utcOffset: 5.5, group: 'South Asia & Middle East' },
    'Dubai': { longitude: 55.27, utcOffset: 4, group: 'South Asia & Middle East' },

    // Europe & Africa
    'London': { longitude: -0.13, utcOffset: 0, group: 'Europe & Africa' },
    'Paris': { longitude: 2.35, utcOffset: 1, group: 'Europe & Africa' },
    'Berlin': { longitude: 13.40, utcOffset: 1, group: 'Europe & Africa' },
    'Amsterdam': { longitude: 4.90, utcOffset: 1, group: 'Europe & Africa' },
    'Moscow': { longitude: 37.62, utcOffset: 3, group: 'Europe & Africa' },
    'Cairo': { longitude: 31.24, utcOffset: 2, group: 'Europe & Africa' },
    'Johannesburg': { longitude: 28.05, utcOffset: 2, group: 'Europe & Africa' },

    // Americas
    'New York': { longitude: -74.00, utcOffset: -5, group: 'Americas' },
    'Chicago': { longitude: -87.63, utcOffset: -6, group: 'Americas' },
    'Los Angeles': { longitude: -118.24, utcOffset: -8, group: 'Americas' },
    'Toronto': { longitude: -79.38, utcOffset: -5, group: 'Americas' },
    'Vancouver': { longitude: -123.12, utcOffset: -8, group: 'Americas' },
    'Mexico City': { longitude: -99.13, utcOffset: -6, group: 'Americas' },
    'São Paulo': { longitude: -46.63, utcOffset: -3, group: 'Americas' },

    // Oceania
    'Sydney': { longitude: 151.21, utcOffset: 10, group: 'Oceania' },
    'Melbourne': { longitude: 144.96, utcOffset: 10, group: 'Oceania' },
    'Auckland': { longitude: 174.76, utcOffset: 12, group: 'Oceania' }
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
