const Storage = (() => {
  const KEY = 'capitalQuiz_progress';

  const RECENT_LIMIT = 40;

  function defaultProgress() {
    return {
      bestScore: 0,
      bestStreak: 0,
      totalPlayed: 0,
      countryStats: {},
      recentlyPlayed: [],
      dailyChallenge: { lastPlayedDate: null, todayScore: null, history: [] }
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultProgress();
      const parsed = JSON.parse(raw);
      return { ...defaultProgress(), ...parsed };
    } catch (e) {
      return defaultProgress();
    }
  }

  function save(progress) {
    localStorage.setItem(KEY, JSON.stringify(progress));
  }

  function recordAnswer(progress, countryCode, isCorrect) {
    if (!progress.countryStats[countryCode]) {
      progress.countryStats[countryCode] = { correct: 0, attempts: 0 };
    }
    progress.countryStats[countryCode].attempts += 1;
    if (isCorrect) progress.countryStats[countryCode].correct += 1;
    progress.totalPlayed += 1;
  }

  function markRecentlyPlayed(progress, countryCodes) {
    const deduped = countryCodes.filter((code, i) => countryCodes.indexOf(code) === i);
    const remaining = progress.recentlyPlayed.filter(code => !deduped.includes(code));
    progress.recentlyPlayed = deduped.concat(remaining).slice(0, RECENT_LIMIT);
  }

  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  return { load, save, recordAnswer, markRecentlyPlayed, todayStr };
})();
