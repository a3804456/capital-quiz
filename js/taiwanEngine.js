const TaiwanEngine = (() => {
  let townships = [];
  let neighbors = {};
  let clues = {};
  let counties = [];

  async function loadData() {
    if (counties.length) return;
    const [tRes, nRes, cRes] = await Promise.all([
      fetch('data/taiwan-townships.json'),
      fetch('data/taiwan-neighbors.json'),
      fetch('data/taiwan-clues.json')
    ]);
    townships = (await tRes.json()).townships;
    neighbors = (await nRes.json()).neighbors;
    clues = (await cRes.json()).clues;
    counties = Object.keys(neighbors);
  }

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

  function toChoices(values, rng) {
    return shuffle(values, rng).map(v => ({ value: v, valueEn: null }));
  }

  function buildClueQuestion(recentCodes, rng) {
    const fresh = counties.filter(c => !recentCodes.has(c));
    const pool = fresh.length ? fresh : counties;
    const county = shuffle(pool, rng)[0];
    const clueText = shuffle(clues[county], rng)[0];
    const distractors = shuffle(counties.filter(c => c !== county), rng).slice(0, 3);
    return {
      country: { code: county, name: county, numeric: null },
      choices: toChoices([county, ...distractors], rng),
      mode: 'taiwan',
      answer: county,
      answerLabel: county,
      promptText: `這個縣市的特徵是：「${clueText}」，是哪裡？`,
      explanation: `「${clueText}」說的正是${county}。`,
      taiwanType: 'clue'
    };
  }

  function buildNeighborQuestion(recentCodes, rng) {
    const eligible = counties.filter(c => neighbors[c].length >= 3);
    const fresh = eligible.filter(c => !recentCodes.has(c));
    const pool = fresh.length ? fresh : eligible;
    const subject = shuffle(pool, rng)[0];
    const realNeighbors = shuffle(neighbors[subject], rng).slice(0, 3);
    const nonNeighbors = counties.filter(c => c !== subject && !neighbors[subject].includes(c));
    const answer = shuffle(nonNeighbors, rng)[0];
    return {
      country: { code: subject, name: subject, numeric: null },
      choices: toChoices([...realNeighbors, answer], rng),
      mode: 'taiwan',
      answer,
      answerLabel: answer,
      promptText: `以下哪一個「不是」${subject}的鄰近縣市？`,
      explanation: `${subject}真正相鄰的縣市是：${realNeighbors.join('、')}。${answer}並不與${subject}相鄰，所以是正確答案。`,
      taiwanType: 'neighbor'
    };
  }

  function buildTownshipQuestion(recentCodes, rng) {
    const pool = townships.filter(t => !t.ambiguous);
    const picked = shuffle(pool, rng)[0];
    const correctCounty = picked.county;
    const neighborDistractors = shuffle((neighbors[correctCounty] || []), rng);
    const fallback = shuffle(counties.filter(c => c !== correctCounty && !neighborDistractors.includes(c)), rng);
    const distractors = neighborDistractors.concat(fallback).slice(0, 3);
    return {
      country: { code: correctCounty, name: picked.name, numeric: null },
      choices: toChoices([correctCounty, ...distractors], rng),
      mode: 'taiwan',
      answer: correctCounty,
      answerLabel: correctCounty,
      promptText: `「${picked.name}」是台灣哪個縣市的行政區？`,
      explanation: `「${picked.name}」屬於${correctCounty}。`,
      taiwanType: 'township'
    };
  }

  const BUILDERS = { clue: buildClueQuestion, neighbor: buildNeighborQuestion, township: buildTownshipQuestion };
  const ALL_TYPES = Object.keys(BUILDERS);

  function buildOne(category, recentCodes, rng) {
    const type = category === 'mix' ? shuffle(ALL_TYPES, rng)[0] : category;
    return BUILDERS[type](recentCodes, rng);
  }

  function buildQuestions(category, count, recentCodes = new Set(), rng = Math.random) {
    const questions = [];
    const usedThisRound = new Set();
    for (let i = 0; i < count; i++) {
      const q = buildOne(category, new Set([...recentCodes, ...usedThisRound]), rng);
      usedThisRound.add(q.country.code);
      questions.push(q);
    }
    return questions;
  }

  function buildPracticeQuestions(category, count = 10, recentCodes = new Set()) {
    return buildQuestions(category, count, recentCodes, Math.random);
  }

  function buildDailyQuestions(category, count = 10) {
    const dateStr = Storage.todayStr();
    const rng = seededRng('taiwan-' + dateStr);
    return buildQuestions(category, count, new Set(), rng);
  }

  return {
    loadData,
    buildPracticeQuestions,
    buildDailyQuestions,
    get counties() { return counties; },
    get clues() { return clues; }
  };
})();
