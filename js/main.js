(() => {
  let progress = Storage.load();
  let gameMap = null;
  let atlasMap = null;

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
    isDaily: false
  };

  const TIME_PER_Q = 15;

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  function refreshHomeStats() {
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
      isDaily
    };
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

    const q = session.questions[session.index];
    gameMap.clearFlash();
    gameMap.setTarget(q.country.numeric);

    const showName = q.country.difficulty !== 'hard';
    const questionTextEl = document.querySelector('.question-text');
    questionTextEl.textContent = showName
      ? `這是「${q.country.name}」，首都是？`
      : '這個國家的首都是？（地獄模式：地圖上自己找）';

    const choicesEl = document.getElementById('choices');
    choicesEl.innerHTML = '';
    q.choices.forEach(capital => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.textContent = capital;
      btn.addEventListener('click', () => handleAnswer(capital, btn));
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

  function handleAnswer(chosenCapital, btnEl) {
    clearInterval(session.timerId);
    const q = session.questions[session.index];
    const isCorrect = chosenCapital === q.country.capital;

    document.querySelectorAll('.choice-btn').forEach(b => {
      b.disabled = true;
      if (b.textContent === q.country.capital) b.classList.add('correct');
      else if (b === btnEl) b.classList.add('wrong');
    });

    gameMap.flash(q.country.numeric, isCorrect ? 'correct' : 'wrong');
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
      session.wrongList.push({ name: q.country.name, correct: q.country.capital, chosen: chosenCapital || '（超時）' });
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
    Storage.save(progress);
    refreshHomeStats();

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

    showScreen('screen-result');
  }

  async function openAtlas() {
    showScreen('screen-atlas');
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

  async function init() {
    await GameEngine.loadCountries();
    gameMap = await MapRenderer.render('map-container', {});
    refreshHomeStats();
    setupChips('difficulty-chips');
    setupChips('continent-chips');

    document.getElementById('btn-daily').addEventListener('click', () => {
      const questions = GameEngine.buildDailyQuestions(10);
      startSession(questions, true);
    });

    document.getElementById('btn-practice').addEventListener('click', () => showScreen('screen-setup'));

    document.getElementById('btn-start-practice').addEventListener('click', () => {
      const difficulty = getActiveChip('difficulty-chips');
      const continent = getActiveChip('continent-chips');
      const questions = GameEngine.buildPracticeQuestions({ difficulty, continent }, 10);
      if (!questions.length) {
        alert('這個篩選條件下沒有題目，換個組合試試！');
        return;
      }
      startSession(questions, false);
    });

    document.getElementById('btn-atlas').addEventListener('click', openAtlas);
    document.getElementById('btn-play-again').addEventListener('click', () => {
      if (session.isDaily) {
        showScreen('screen-home');
      } else {
        const questions = GameEngine.buildPracticeQuestions(
          { difficulty: getActiveChip('difficulty-chips'), continent: getActiveChip('continent-chips') },
          10
        );
        startSession(questions, false);
      }
    });

    document.querySelectorAll('.btn-back').forEach(btn => {
      btn.addEventListener('click', () => showScreen(btn.dataset.target));
    });
  }

  init();
})();
