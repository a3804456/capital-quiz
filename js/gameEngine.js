const GameEngine = (() => {
  let allCountries = [];

  async function loadCountries() {
    if (allCountries.length) return allCountries;
    const res = await fetch('data/countries.json');
    const data = await res.json();
    allCountries = data.countries;
    return allCountries;
  }

  // simple seeded RNG (mulberry32) so daily challenge is the same for everyone on a given date
  function seededRng(seedStr) {
    let h = 1779033703 ^ seedStr.length;
    for (let i = 0; i < seedStr.length; i++) {
      h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rng = Math.random) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function filterPool({ difficulty = 'all', continent = 'all' } = {}) {
    return allCountries.filter(c => {
      const diffOk = difficulty === 'all' || c.difficulty === difficulty;
      const contOk = continent === 'all' || c.continent === continent;
      return diffOk && contOk;
    });
  }

  // Pick distractors that are plausible mix-ups rather than random picks from
  // the whole world, so answers can't be spotted by elimination alone: same
  // continent + same difficulty tier first (most confusable), then same
  // continent, then same difficulty tier, then anything as a last resort.
  function pickDistractors(country, count, rng) {
    const candidates = allCountries.filter(c => c.code !== country.code && c.capital !== country.capital);
    const tiers = [
      candidates.filter(c => c.continent === country.continent && c.difficulty === country.difficulty),
      candidates.filter(c => c.continent === country.continent),
      candidates.filter(c => c.difficulty === country.difficulty),
      candidates
    ];
    const picked = [];
    const usedCodes = new Set();
    for (const tier of tiers) {
      if (picked.length >= count) break;
      const shuffled = shuffle(tier, rng);
      for (const c of shuffled) {
        if (picked.length >= count) break;
        if (usedCodes.has(c.code)) continue;
        picked.push(c);
        usedCodes.add(c.code);
      }
    }
    return picked;
  }

  function buildQuestions(pool, count, rng = Math.random, recentCodes = new Set(), mode = 'capital') {
    // avoid repeating recently-played countries first; only fall back to them
    // once the "fresh" pool has been exhausted, so practice rounds cycle
    // through the roster instead of resurfacing the same handful every time.
    const fresh = pool.filter(c => !recentCodes.has(c.code));
    const stale = pool.filter(c => recentCodes.has(c.code));
    const ordered = shuffle(fresh, rng).concat(shuffle(stale, rng));
    const picked = ordered.slice(0, Math.min(count, pool.length));
    return picked.map(country => {
      const distractors = pickDistractors(country, 3, rng);
      const choices = shuffle([country, ...distractors], rng).map(c =>
        mode === 'country'
          ? { value: c.name, valueEn: null }
          : { value: c.capital, valueEn: c.capitalEn }
      );
      const answer = mode === 'country' ? country.name : country.capital;
      return { country, choices, mode, answer };
    });
  }

  function buildPracticeQuestions(options, count = 10, recentCodes = new Set(), mode = 'capital') {
    const pool = filterPool(options);
    return buildQuestions(pool, count, Math.random, recentCodes, mode);
  }

  function buildDailyQuestions(count = 10, mode = 'capital') {
    const dateStr = Storage.todayStr();
    const rng = seededRng(dateStr);
    return buildQuestions(allCountries, count, rng, new Set(), mode);
  }

  return { loadCountries, buildPracticeQuestions, buildDailyQuestions, get countries() { return allCountries; } };
})();
