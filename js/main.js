(() => {
  let currentMode = 'capital';
  let progress = null;
  let gameMap = null;
  let atlasMap = null;

  const MODE_LABELS = {
    capital: { icon: '🏛️', title: '猜首都', subtitle: '點地圖、猜首都，練出你的世界地理感', atlasTitle: '首都地圖點亮進度', atlasBtn: '世界地圖總覽', factsTitle: '本輪首都小知識' },
    country: { icon: '🗺️', title: '猜國家', subtitle: '看地圖形狀或國旗，猜出是哪個國家', atlasTitle: '國家地圖點亮進度', atlasBtn: '世界地圖總覽', factsTitle: '本輪國家小知識' },
    taiwan: { icon: '🇹🇼', title: '愛台灣', subtitle: '在地小知識、鄰居關係、鄉鎮歸屬大考驗', atlasTitle: '縣市熟悉度總覽', atlasBtn: '縣市熟悉度總覽', factsTitle: '本輪台灣小知識' }
  };

  let session = {
    questions: [],
    index: 0,
    score: 0,
    streak: 0,
    bestStreakThisRun: 0,
    correctCount: 0,
    wrongList: [],
    shareEmojis: [],
    timerId: null,
    timeLeft: 15,
    isDaily: false,
    mode: 'capital'
  };

  const TIME_PER_Q = 15;

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  function selectMode(mode) {
    currentMode = mode;
    progress = Storage.load(mode);
    const labels = MODE_LABELS[mode];
    document.getElementById('hub-title').textContent = `${labels.icon} ${labels.title}`;
    document.getElementById('hub-subtitle').textContent = labels.subtitle;
    document.getElementById('prompt-style-group').style.display = mode === 'country' ? 'block' : 'none';
    document.getElementById('btn-atlas').textContent = labels.atlasBtn;
    refreshHubStats();
    showScreen('screen-hub');
  }

  function refreshHubStats() {
    document.getElementById('stat-best-score').textContent = progress.bestScore;
    document.getElementById('stat-best-streak').textContent = progress.bestStreak;
    document.getElementById('stat-total').textContent = progress.totalPlayed;

    const today = Storage.todayStr();
    const dailyStatus = document.getElementById('daily-status');
    if (progress.dailyChallenge.lastPlayedDate === today) {
      dailyStatus.textContent = `今天已完成：${progress.dailyChallenge.todayScore} 分`;
    } else {
      dailyStatus.textContent = '今天還沒玩過';
    }
  }

  function startSession(questions, isDaily) {
    clearInterval(session.timerId);
    session = {
      questions,
      index: 0,
      score: 0,
      streak: 0,
      bestStreakThisRun: 0,
      correctCount: 0,
      wrongList: [],
      shareEmojis: [],
      timerId: null,
      timeLeft: TIME_PER_Q,
      isDaily,
      mode: currentMode,
      promptStyle: currentMode === 'country' ? getActiveChip('promptstyle-chips') : 'map',
      direction: currentMode === 'country' && document.getElementById('reverse-toggle').classList.contains('active') ? 'reverse' : 'forward'
    };
    Storage.markRecentlyPlayed(progress, questions.map(q => q.country.code));
    Storage.save(progress, currentMode);

    document.getElementById('q-total').textContent = questions.length;
    showScreen('screen-game');
    nextQuestion();
  }

  function nextQuestion() {
    clearInterval(session.timerId);
    if (session.index >= session.questions.length) {
      finishSession();
      return;
    }
    document.getElementById('q-index').textContent = session.index + 1;
    document.getElementById('streak-count').textContent = session.streak;
    session.answered = false;

    const q = session.questions[session.index];
    const mapContainer = document.getElementById('map-container');
    const flagContainer = document.getElementById('flag-container');
    const zoomControls = document.getElementById('map-zoom-controls');
    const choicesEl = document.getElementById('choices');
    const questionTextEl = document.querySelector('.question-text');

    if (session.mode === 'taiwan') {
      mapContainer.style.display = 'none';
      flagContainer.style.display = 'none';
      zoomControls.style.display = 'none';
      questionTextEl.textContent = q.promptText;
    } else if (q.interaction === 'map-click') {
      mapContainer.style.display = 'block';
      flagContainer.style.display = 'none';
      zoomControls.style.display = 'flex';
      gameMap.clearFlash();
      gameMap.clearTarget();
      gameMap.resetZoom();
      questionTextEl.textContent = `「${q.country.name}」在地圖上的哪裡？點地圖回答`;
    } else if (q.interaction === 'choice' && q.choices[0] && q.choices[0].isFlag) {
      mapContainer.style.display = 'none';
      flagContainer.style.display = 'none';
      zoomControls.style.display = 'none';
      questionTextEl.textContent = `「${q.country.name}」的國旗是？`;
    } else if (session.promptStyle === 'flag') {
      mapContainer.style.display = 'none';
      flagContainer.style.display = 'flex';
      zoomControls.style.display = 'none';
      const flagUrl = `https://flagcdn.com/w320/${q.country.code.toLowerCase()}.png`;
      flagContainer.innerHTML = `<img src="${flagUrl}" alt="國旗" onerror="this.replaceWith(Object.assign(document.createElement('div'), {className: 'flag-missing', textContent: '這個國家的國旗圖片暫缺'}))">`;
      questionTextEl.textContent = '這是哪個國家？';
    } else {
      mapContainer.style.display = 'block';
      flagContainer.style.display = 'none';
      zoomControls.style.display = 'none';
      gameMap.clearFlash();
      gameMap.resetZoom();
      gameMap.setTarget(q.country.numeric);
      if (session.mode === 'country') {
        questionTextEl.textContent = '這是哪個國家？';
      } else {
        const showName = q.country.difficulty !== 'hard';
        questionTextEl.textContent = showName
          ? `這是「${q.country.name}」，首都是？`
          : '這個國家的首都是？（地獄模式：地圖上自己找）';
      }
    }

    choicesEl.style.display = q.interaction === 'map-click' ? 'none' : 'grid';
    choicesEl.innerHTML = '';
    q.choices.forEach(choice => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      if (choice.isFlag) {
        btn.className += ' choice-flag-btn';
        btn.innerHTML = `<img class="choice-flag-img" src="https://flagcdn.com/w160/${choice.value.toLowerCase()}.png" alt="國旗選項">`;
      } else {
        btn.innerHTML = choice.valueEn
          ? `${choice.value}<span class="capital-en">${choice.valueEn}</span>`
          : choice.value;
      }
      btn.dataset.value = choice.value;
      btn.addEventListener('click', () => handleAnswer(choice.value, btn));
      choicesEl.appendChild(btn);
    });

    session.timeLeft = TIME_PER_Q;
    document.getElementById('timer-count').textContent = session.timeLeft;
    session.timerId = setInterval(() => {
      session.timeLeft -= 1;
      document.getElementById('timer-count').textContent = session.timeLeft;
      if (session.timeLeft <= 0) {
        clearInterval(session.timerId);
        handleAnswer(null, null);
      }
    }, 1000);
  }

  function handleAnswer(chosenValue, btnEl) {
    if (session.answered) return;
    session.answered = true;
    clearInterval(session.timerId);
    const q = session.questions[session.index];
    const correctValue = q.answer;
    const isCorrect = chosenValue === correctValue;

    document.querySelectorAll('.choice-btn').forEach(b => {
      b.disabled = true;
      if (b.dataset.value === correctValue) b.classList.add('correct');
      else if (b === btnEl) b.classList.add('wrong');
    });

    if (q.interaction === 'map-click') {
      if (chosenValue) gameMap.flash(chosenValue, isCorrect ? 'correct' : 'wrong');
      if (!isCorrect) gameMap.flash(q.country.numeric, 'reveal');
    } else if (session.mode !== 'taiwan' && session.promptStyle !== 'flag') {
      gameMap.flash(q.country.numeric, isCorrect ? 'correct' : 'wrong');
    }
    Storage.recordAnswer(progress, q.country.code, isCorrect);

    if (isCorrect) {
      session.streak += 1;
      session.bestStreakThisRun = Math.max(session.bestStreakThisRun, session.streak);
      const multiplier = 1 + Math.min(session.streak - 1, 5) * 0.2;
      session.score += Math.round(10 * multiplier);
      session.correctCount += 1;
      session.shareEmojis.push('🟩');
    } else {
      session.streak = 0;
      const correctLabel = session.mode === 'capital'
        ? `${q.country.capital} ${q.country.capitalEn}`
        : q.answerLabel;
      let chosenLabel = '（超時）';
      if (q.interaction === 'map-click') {
        const clicked = chosenValue ? GameEngine.countries.find(c => String(c.numeric) === String(chosenValue)) : null;
        if (clicked) chosenLabel = clicked.name;
      } else {
        const chosenChoice = q.choices.find(c => c.value === chosenValue);
        if (chosenChoice && chosenChoice.isFlag) {
          const country = GameEngine.countries.find(c => c.code === chosenChoice.value);
          chosenLabel = country ? country.name : chosenChoice.value;
        } else if (chosenChoice) {
          chosenLabel = chosenChoice.valueEn ? `${chosenChoice.value} ${chosenChoice.valueEn}` : chosenChoice.value;
        }
      }
      session.wrongList.push({ name: q.country.name, correct: correctLabel, chosen: chosenLabel });
      session.shareEmojis.push('🟥');
    }

    document.getElementById('streak-count').textContent = session.streak;
    session.index += 1;
    setTimeout(nextQuestion, 1100);
  }

  function finishSession() {
    progress.bestScore = Math.max(progress.bestScore, session.score);
    progress.bestStreak = Math.max(progress.bestStreak, session.bestStreakThisRun);
    const isNewRecord = session.score >= progress.bestScore && session.score > 0;

    if (session.isDaily) {
      progress.dailyChallenge.lastPlayedDate = Storage.todayStr();
      progress.dailyChallenge.todayScore = session.score;
      progress.dailyChallenge.history.unshift(`${Storage.todayStr()}: ${session.correctCount}/${session.questions.length}`);
      progress.dailyChallenge.history = progress.dailyChallenge.history.slice(0, 30);
    }
    Storage.save(progress, currentMode);
    refreshHubStats();

    document.getElementById('result-title').textContent = session.isDaily ? '每日挑戰結束！' : '練習結束！';
    document.getElementById('result-score').textContent = session.score;
    document.getElementById('result-correct').textContent = `${session.correctCount}/${session.questions.length}`;
    document.getElementById('result-streak').textContent = session.bestStreakThisRun;
    document.getElementById('result-newrecord').style.display = isNewRecord ? 'block' : 'none';
    document.getElementById('result-share').textContent = session.shareEmojis.join('');

    const reviewEl = document.getElementById('result-review');
    reviewEl.innerHTML = '';
    if (session.wrongList.length) {
      session.wrongList.forEach(w => {
        const div = document.createElement('div');
        div.className = 'review-item';
        div.innerHTML = `<span>${w.name}</span><span><span class="wrong-answer">${w.chosen}</span><span class="right-answer">${w.correct}</span></span>`;
        reviewEl.appendChild(div);
      });
    }

    const isFlagRound = session.mode === 'country' && session.promptStyle === 'flag';
    document.getElementById('facts-title').textContent = isFlagRound
      ? '本輪國旗小知識'
      : MODE_LABELS[session.mode].factsTitle;
    const factsEl = document.getElementById('result-facts');
    factsEl.innerHTML = '';
    const shownCodes = new Set();
    session.questions.forEach(q => {
      const c = q.country;
      if (session.mode === 'taiwan') {
        if (shownCodes.has(c.code)) return;
        shownCodes.add(c.code);
      }
      const div = document.createElement('div');
      div.className = 'fact-card';
      if (isFlagRound) {
        div.className += ' fact-card-flag';
        div.innerHTML = `
          <img class="fact-flag-img" src="https://flagcdn.com/w160/${c.code.toLowerCase()}.png" alt="${c.name}國旗" onerror="this.style.display='none'">
          <div class="fact-flag-text">
            <div class="fact-head">${c.name}</div>
            <div class="fact-body">${c.flagMeaning}</div>
          </div>
        `;
      } else if (session.mode === 'taiwan') {
        const clueList = (TaiwanEngine.clues[c.code] || []).map(text => `<li>${text}</li>`).join('');
        div.innerHTML = `
          <div class="fact-head">${c.code}</div>
          <ul class="fact-body fact-clue-list">${clueList}</ul>
        `;
      } else if (session.mode === 'country') {
        div.innerHTML = `
          <div class="fact-head">${c.name}</div>
          <div class="fact-body">${c.countryIntro}</div>
        `;
      } else {
        div.innerHTML = `
          <div class="fact-head">${c.name} <span class="fact-capital">${c.capital} ${c.capitalEn}</span></div>
          <div class="fact-body">${c.capitalIntro}</div>
        `;
      }
      factsEl.appendChild(div);
    });

    showScreen('screen-result');
  }

  function renderTaiwanAtlas() {
    document.getElementById('atlas-map-container').style.display = 'none';
    const grid = document.getElementById('atlas-taiwan-grid');
    grid.style.display = 'grid';
    grid.innerHTML = '';
    const detail = document.getElementById('atlas-detail');
    let lit = 0;
    TaiwanEngine.counties.forEach(county => {
      const stat = progress.countryStats[county];
      const tile = document.createElement('div');
      tile.className = 'taiwan-tile';
      if (stat && stat.attempts > 0) {
        lit += 1;
        const ratio = stat.correct / stat.attempts;
        const green = Math.round(60 + ratio * 140);
        tile.style.background = `rgb(${Math.round(61 - ratio * 20)}, ${green}, ${Math.round(132 - ratio * 40)})`;
      }
      tile.textContent = county;
      tile.addEventListener('click', () => {
        detail.textContent = stat
          ? `${county}：答對 ${stat.correct} / ${stat.attempts} 次`
          : `${county}：還沒練過`;
      });
      grid.appendChild(tile);
    });
    document.getElementById('atlas-progress-text').textContent = `已點亮 ${lit} / ${TaiwanEngine.counties.length} 個縣市`;
  }

  async function openAtlas() {
    showScreen('screen-atlas');
    document.getElementById('atlas-title').textContent = MODE_LABELS[currentMode].atlasTitle;
    document.getElementById('atlas-detail').textContent = '';

    if (currentMode === 'taiwan') {
      renderTaiwanAtlas();
      return;
    }
    document.getElementById('atlas-map-container').style.display = 'block';
    document.getElementById('atlas-taiwan-grid').style.display = 'none';
    if (!atlasMap) {
      atlasMap = await MapRenderer.render('atlas-map-container', {
        onClick: (numericId) => {
          const country = GameEngine.countries.find(c => String(c.numeric) === String(numericId));
          const detail = document.getElementById('atlas-detail');
          if (!country) { detail.textContent = ''; return; }
          const stat = progress.countryStats[country.code];
          if (!stat) {
            detail.textContent = `${country.name}：還沒練過`;
          } else {
            detail.textContent = `${country.name}：答對 ${stat.correct} / ${stat.attempts} 次`;
          }
        }
      });
    }
    let lit = 0;
    const total = GameEngine.countries.length;
    atlasMap.colorByStats((numericId) => {
      const country = GameEngine.countries.find(c => String(c.numeric) === String(numericId));
      if (!country) return null;
      const stat = progress.countryStats[country.code];
      if (!stat || stat.attempts === 0) return null;
      lit += 1;
      return stat.correct / stat.attempts;
    });
    document.getElementById('atlas-progress-text').textContent = `已點亮 ${lit} / ${total} 個國家`;
  }

  function setupChips(containerId) {
    const container = document.getElementById(containerId);
    container.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        container.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
      });
    });
  }

  function getActiveChip(containerId) {
    return document.querySelector(`#${containerId} .chip.active`).dataset.value;
  }

  // "反向" is an independent toggle layered on top of the 地圖/國旗 choice,
  // not a third exclusive option.
  function resolveEngineParams() {
    if (currentMode !== 'country') return { direction: 'forward', promptStyle: 'map' };
    const promptStyle = getActiveChip('promptstyle-chips');
    const direction = document.getElementById('reverse-toggle').classList.contains('active') ? 'reverse' : 'forward';
    return { direction, promptStyle };
  }

  function buildDailyForCurrentMode() {
    if (currentMode === 'taiwan') {
      return TaiwanEngine.buildDailyQuestions('mix', 10);
    }
    const { direction, promptStyle } = resolveEngineParams();
    return GameEngine.buildDailyQuestions(10, currentMode, direction, promptStyle);
  }

  function buildPracticeForCurrentMode() {
    if (currentMode === 'taiwan') {
      return TaiwanEngine.buildPracticeQuestions('mix', 10, new Set(progress.recentlyPlayed));
    }
    const { direction, promptStyle } = resolveEngineParams();
    return GameEngine.buildPracticeQuestions(
      { difficulty: getActiveChip('difficulty-chips'), continent: getActiveChip('continent-chips') },
      10,
      new Set(progress.recentlyPlayed),
      currentMode,
      direction,
      promptStyle
    );
  }

  async function init() {
    await GameEngine.loadCountries();
    await TaiwanEngine.loadData();
    gameMap = await MapRenderer.render('map-container', {
      onClick: (numericId) => {
        const q = session.questions[session.index];
        if (q && q.interaction === 'map-click' && !session.answered) {
          handleAnswer(String(numericId), null);
        }
      }
    });
    setupChips('difficulty-chips');
    setupChips('continent-chips');
    setupChips('promptstyle-chips');
    document.getElementById('reverse-toggle').addEventListener('click', (e) => {
      e.currentTarget.classList.toggle('active');
    });

    document.getElementById('btn-zoom-in').addEventListener('click', () => gameMap.zoomBy(1.5));
    document.getElementById('btn-zoom-out').addEventListener('click', () => gameMap.zoomBy(1 / 1.5));
    document.getElementById('btn-zoom-reset').addEventListener('click', () => gameMap.resetZoom());

    document.querySelectorAll('.mode-card').forEach(card => {
      card.addEventListener('click', () => selectMode(card.dataset.mode));
    });

    document.getElementById('btn-daily').addEventListener('click', () => {
      startSession(buildDailyForCurrentMode(), true);
    });

    document.getElementById('btn-practice').addEventListener('click', () => {
      if (currentMode === 'taiwan') {
        startSession(buildPracticeForCurrentMode(), false);
      } else {
        showScreen('screen-setup');
      }
    });

    document.getElementById('btn-start-practice').addEventListener('click', () => {
      const questions = buildPracticeForCurrentMode();
      if (!questions.length) {
        alert('這個篩選條件下沒有題目，換個組合試試！');
        return;
      }
      startSession(questions, false);
    });

    document.getElementById('btn-atlas').addEventListener('click', openAtlas);
    document.getElementById('btn-play-again').addEventListener('click', () => {
      if (session.isDaily) {
        showScreen('screen-hub');
      } else {
        startSession(buildPracticeForCurrentMode(), false);
      }
    });

    document.querySelectorAll('.btn-back, .btn-back-small').forEach(btn => {
      btn.addEventListener('click', () => showScreen(btn.dataset.target));
    });
  }

  init();
})();
