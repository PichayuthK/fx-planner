(function () {
  const {
    TRADING_DAYS_PER_WEEK,
    MIN_LOT,
    LOT_STEP,
    getLogs,
    getSavedProjection,
  } = ForexPlan;

  let projectionChart = null;

  // ─── Math ──────────────────────────────────────────

  function roundLotDown(lot) {
    if (lot < MIN_LOT) return MIN_LOT;
    return Math.floor(lot / LOT_STEP) * LOT_STEP;
  }

  ForexPlan.runProjection = function (params) {
    const {
      capital: initialCapital,
      riskPct,
      tpPoints,
      slPoints,
      maxTradesPerDay,
      targetPerDay,
      winRate,
    } = params;

    const winRatio = (winRate ?? 100) / 100;
    const weeks = [];
    let capital = initialCapital;
    let weekIndex = 0;

    while (weekIndex < 200) {
      const riskDollar = capital * (riskPct / 100);
      const rawLot = riskDollar / slPoints;
      const maxLot = roundLotDown(rawLot);

      const profitPerWin = maxLot * tpPoints;
      const lossPerLoss = maxLot * slPoints;
      const tradesPerWeek = maxTradesPerDay * TRADING_DAYS_PER_WEEK;

      const expectedWins = tradesPerWeek * winRatio;
      const expectedLosses = tradesPerWeek * (1 - winRatio);
      const weeklyProfit = expectedWins * profitPerWin - expectedLosses * lossPerLoss;

      weeks.push({
        week: weekIndex + 1,
        capitalStart: capital,
        riskDollar,
        maxLot,
        profitPerWin,
        lossPerLoss,
        weeklyProfit,
        capitalEnd: capital + weeklyProfit,
      });

      capital += weeklyProfit;
      weekIndex += 1;

      if (weeklyProfit <= 0) break;

      const earningPerDay = weeklyProfit / TRADING_DAYS_PER_WEEK;
      if (earningPerDay >= targetPerDay) break;
    }

    return { weeks, totalWeeks: weeks.length, finalCapital: capital, targetPerDay, winRate };
  };

  // ─── Render ────────────────────────────────────────

  ForexPlan.renderProjectionResult = function (data) {
    const f = ForexPlan.fmtN;
    const statsEl = document.getElementById('projection-stats');
    const tbodyEl = document.getElementById('projection-tbody');
    const last = data.weeks[data.weeks.length - 1];
    const reachedGoal = last.weeklyProfit / TRADING_DAYS_PER_WEEK >= data.targetPerDay;
    statsEl.innerHTML = `
      <div class="stat">
        <div class="stat-label">Weeks to goal <span class="info-tip" data-tip="Number of weeks until your daily earnings meet your target. N/A if the goal can't be reached with current settings."><img src="assets/info.png" alt="info" /></span></div>
        <div class="stat-value accent">${reachedGoal ? data.totalWeeks : 'N/A'}</div>
        <div class="stat-sub">$${f(data.targetPerDay)}/day target</div>
      </div>
      <div class="stat">
        <div class="stat-label">Max lot (final) <span class="info-tip" data-tip="Largest lot size you can open on the final week based on your risk % and stop loss."><img src="assets/info.png" alt="info" /></span></div>
        <div class="stat-value">${f(last.maxLot)}</div>
        <div class="stat-sub">per order</div>
      </div>
      <div class="stat">
        <div class="stat-label">Final capital <span class="info-tip" data-tip="Your projected total capital at the end of the last simulated week."><img src="assets/info.png" alt="info" /></span></div>
        <div class="stat-value green">$${f(data.finalCapital)}</div>
        <div class="stat-sub">projected</div>
      </div>
    `;

    // Find which week the user's actual capital falls in
    const logs = getLogs();
    const saved = getSavedProjection();
    let currentCapital = null;
    let currentWeekIdx = -1;
    if (saved && logs.length > 0) {
      const totalPnl = logs.reduce((s, l) => s + (l.outcome === 'win' ? l.amount : -l.amount), 0);
      currentCapital = saved.params.capital + totalPnl;
      // Find the week where capitalStart <= currentCapital < capitalEnd (or last week)
      for (let i = 0; i < data.weeks.length; i++) {
        const w = data.weeks[i];
        if (currentCapital >= w.capitalStart && currentCapital <= w.capitalEnd) {
          currentWeekIdx = i;
          break;
        }
      }
      // If capital is below week 1 start
      if (currentWeekIdx === -1 && currentCapital < data.weeks[0].capitalStart) {
        currentWeekIdx = 0;
      }
      // If capital exceeds all weeks
      if (currentWeekIdx === -1 && currentCapital > data.weeks[data.weeks.length - 1].capitalEnd) {
        currentWeekIdx = data.weeks.length - 1;
      }
    }

    tbodyEl.innerHTML = data.weeks
      .map(
        (w, i) => {
          const isLast = i === data.weeks.length - 1;
          const isCurrent = i === currentWeekIdx;
          let rowClass = '';
          if (isCurrent) rowClass = 'current-week-row';
          else if (isLast) rowClass = 'highlight-row';
          return `<tr class="${rowClass}">
            <td>${w.week}${isCurrent ? ' <span class="you-are-here">← You</span>' : ''}${isLast ? ' <img src="assets/trophy.png" alt="goal" class="trophy-icon" />' : ''}</td>
            <td>$${f(w.capitalStart)}</td>
            <td>$${f(w.riskDollar)}</td>
            <td>${f(w.maxLot)}</td>
            <td>$${f(w.profitPerWin)}</td>
            <td class="${w.weeklyProfit < 0 ? 'loss' : ''}">$${f(w.weeklyProfit)}</td>
            <td>$${f(w.capitalEnd)}</td>
          </tr>`;
        }
      )
      .join('');

    renderProjectionChart(data);
    document.getElementById('projection-result').hidden = false;
  };

  // ─── Chart ─────────────────────────────────────────

  function renderProjectionChart(data) {
    const ctx = document.getElementById('projection-chart');
    if (projectionChart) projectionChart.destroy();

    const labels = ['Start', ...data.weeks.map((w) => `W${w.week}`)];
    const projectedData = [data.weeks[0].capitalStart, ...data.weeks.map((w) => w.capitalEnd)];

    const logs = getLogs();
    let actualData = null;

    if (logs.length > 0) {
      const saved = getSavedProjection();
      if (saved) {
        const sorted = [...logs].sort((a, b) => new Date(a.date) - new Date(b.date));
        const firstDate = new Date(sorted[0].date);

        const weekBuckets = {};
        sorted.forEach((l) => {
          const daysDiff = (new Date(l.date) - firstDate) / (1000 * 60 * 60 * 24);
          const weekIdx = Math.floor(daysDiff / 7);
          if (!weekBuckets[weekIdx]) weekBuckets[weekIdx] = 0;
          weekBuckets[weekIdx] += l.outcome === 'win' ? l.amount : -l.amount;
        });

        const maxWeek = Math.max(...Object.keys(weekBuckets).map(Number));
        actualData = [saved.params.capital];
        let runningCapital = saved.params.capital;
        for (let i = 0; i <= Math.min(maxWeek, data.weeks.length - 1); i++) {
          runningCapital += weekBuckets[i] || 0;
          actualData.push(runningCapital);
        }
      }
    }

    const datasets = [
      {
        label: 'Projected Capital',
        data: projectedData,
        borderColor: '#6c9cff',
        backgroundColor: 'rgba(108, 156, 255, 0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ];

    if (actualData && actualData.length > 1) {
      datasets.push({
        label: 'Actual Capital',
        data: actualData,
        borderColor: '#34d399',
        backgroundColor: 'rgba(52, 211, 153, 0.1)',
        fill: false,
        tension: 0.3,
        pointRadius: 5,
        pointHoverRadius: 7,
        borderDash: [5, 3],
      });
    }

    projectionChart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: {
            labels: { color: '#a0aec0', font: { family: 'Inter', size: 12 } },
          },
          tooltip: {
            backgroundColor: '#1a2332',
            titleColor: '#e8edf5',
            bodyColor: '#a0aec0',
            borderColor: '#2d3a4d',
            borderWidth: 1,
            callbacks: {
              label: (tip) => `${tip.dataset.label}: $${ForexPlan.fmtN(tip.parsed.y)}`,
            },
          },
        },
        scales: {
          x: {
            ticks: { color: '#6b7a90', font: { family: 'Inter', size: 11 } },
            grid: { color: 'rgba(45, 58, 77, 0.5)' },
          },
          y: {
            ticks: {
              color: '#6b7a90',
              font: { family: 'Inter', size: 11 },
              callback: (v) => '$' + ForexPlan.fmtN(v, 0),
            },
            grid: { color: 'rgba(45, 58, 77, 0.5)' },
          },
        },
      },
    });
  }

  // ─── Restore ───────────────────────────────────────

  ForexPlan.restoreProjection = function () {
    const saved = getSavedProjection();
    if (!saved) return;

    try {
      const { params } = saved;
      const form = document.getElementById('projection-form');
      form.capital.value = params.capital;
      form.riskPct.value = params.riskPct;
      form.tpPoints.value = params.tpPoints;
      form.slPoints.value = params.slPoints;
      form.maxTradesPerDay.value = params.maxTradesPerDay;
      form.targetPerDay.value = params.targetPerDay;
      form.winRate.value = params.winRate ?? 100;

      const freshResult = ForexPlan.runProjection(params);
      ForexPlan.renderProjectionResult(freshResult);
    } catch (e) {
      console.warn('Could not restore projection', e);
    }
  };
})();
