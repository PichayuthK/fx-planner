(function () {
  const { getLogs, saveLogs, getSavedProjection } = ForexPlan;

  // ─── Date helpers ─────────────────────────────────

  function getMonday(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function getSunday(monday) {
    const sun = new Date(monday);
    sun.setDate(sun.getDate() + 6);
    sun.setHours(23, 59, 59, 999);
    return sun;
  }

  function fmt(d) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function logsForWeek(monday) {
    const sunday = getSunday(monday);
    return getLogs().filter((l) => {
      const d = new Date(l.date);
      return d >= monday && d <= sunday;
    });
  }

  function totalFromLogs(logs) {
    return logs.reduce(
      (sum, l) => sum + (l.outcome === "win" ? l.amount : -l.amount),
      0,
    );
  }

  ForexPlan.totalFromLogs = totalFromLogs;

  /** Net points: wins add TP points, losses subtract SL points */
  function netPointsFromLogs(logs) {
    return logs.reduce(
      (sum, l) => sum + (l.outcome === "win" ? (l.points || 0) : -(l.sl || 0)),
      0,
    );
  }

  function logsForToday() {
    const today = new Date().toISOString().slice(0, 10);
    return getLogs().filter((l) => l.date === today);
  }

  // ─── Log tab filter state ─────────────────────────

  let filterMonday = getMonday(new Date());
  let isAllTime = false;

  function getFilteredLogs() {
    if (isAllTime) return getLogs();
    return logsForWeek(filterMonday);
  }

  ForexPlan.setWeekFilter = function (direction) {
    if (direction === "prev") {
      filterMonday = new Date(filterMonday.getTime() - 7 * 86400000);
    } else if (direction === "next") {
      filterMonday = new Date(filterMonday.getTime() + 7 * 86400000);
    }
    isAllTime = false;
    ForexPlan.refreshLogView();
  };

  ForexPlan.toggleAllTime = function () {
    isAllTime = !isAllTime;
    if (!isAllTime) filterMonday = getMonday(new Date());
    ForexPlan.refreshLogView();
  };

  ForexPlan.refreshLogView = function () {
    updateWeekLabel();
    ForexPlan.renderLogs();
    ForexPlan.updateLogSummary();
    ForexPlan.updateComparison();
    ForexPlan.renderOverview();
    // Refresh equity curve in Projection tab
    const saved = getSavedProjection();
    if (saved) ForexPlan.renderEquityCurve(saved.params.capital, getLogs());
  };

  function updateWeekLabel() {
    const label = document.getElementById("week-label");
    const allBtn = document.getElementById("btn-all-time");
    if (isAllTime) {
      label.textContent = "All Time";
      allBtn.classList.add("active");
    } else {
      const sunday = getSunday(filterMonday);
      label.textContent = `${fmt(filterMonday)} – ${fmt(sunday)}`;
      allBtn.classList.remove("active");
    }
  }

  // ─── CRUD ──────────────────────────────────────────

  ForexPlan.addLog = function (entry) {
    const logs = getLogs();
    logs.push({ id: String(Date.now()), ...entry });
    saveLogs(logs);
    ForexPlan.refreshLogView();
  };

  ForexPlan.deleteLog = function (id) {
    if (!confirm("Delete this trade?")) return;
    saveLogs(getLogs().filter((l) => l.id !== id));
    ForexPlan.refreshLogView();
  };

  // ─── Log tab: render table ─────────────────────────

  ForexPlan.renderLogs = function () {
    const f = ForexPlan.fmtN;
    const logs = getFilteredLogs();
    const tbody = document.getElementById("log-tbody");
    const countEl = document.getElementById("log-count");
    countEl.textContent = logs.length;

    if (logs.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="8" class="empty">No trades this period</td></tr>';
      return;
    }

    tbody.innerHTML = logs
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .map(
        (l) =>
          `<tr>
            <td>${l.date}</td>
            <td><span class="${l.outcome}">${l.outcome.toUpperCase()}</span></td>
            <td>$${f(l.amount)}</td>
            <td>${l.lot != null ? f(l.lot) : "—"}</td>
            <td>${f(l.points, 0)}</td>
            <td>${l.sl != null ? f(l.sl, 0) : "—"}</td>
            <td class="note-cell"${l.note ? ' data-note="1"' : ''}><span class="note-text">${l.note || "—"}</span></td>
            <td><button type="button" class="btn btn-ghost" data-id="${l.id}">Delete</button></td>
          </tr>`,
      )
      .join("");

    tbody.querySelectorAll(".btn-ghost").forEach((btn) => {
      btn.addEventListener("click", () => ForexPlan.deleteLog(btn.dataset.id));
    });
  };

  // ─── Log tab: summary stats ────────────────────────

  ForexPlan.updateLogSummary = function () {
    const f = ForexPlan.fmtN;
    const logs = getFilteredLogs();
    const allLogs = getLogs();
    const el = document.getElementById("log-cards");

    if (allLogs.length === 0) {
      el.hidden = true;
      return;
    }

    const total = totalFromLogs(logs);
    const wins = logs.filter((l) => l.outcome === "win").length;
    const losses = logs.filter((l) => l.outcome === "loss").length;
    const winRate =
      logs.length > 0 ? ((wins / logs.length) * 100).toFixed(0) : 0;

    const winLogs = logs.filter((l) => l.outcome === "win" && l.points > 0);
    const lossLogs = logs.filter((l) => l.outcome === "loss" && l.sl > 0);
    const avgTp =
      winLogs.length > 0
        ? winLogs.reduce((s, l) => s + l.points, 0) / winLogs.length
        : 0;
    const avgSl =
      lossLogs.length > 0
        ? lossLogs.reduce((s, l) => s + l.sl, 0) / lossLogs.length
        : 0;
    const rrRatio = avgSl > 0 ? avgTp / avgSl : 0;

    let rrHtml = "";
    if (winLogs.length > 0 && lossLogs.length > 0) {
      rrHtml = `
      <div class="stat">
        <div class="stat-label">R : R ratio <span class="info-tip" data-tip="Actual Reward-to-Risk ratio. Avg TP pts (wins) / avg SL pts (losses)."><img src="assets/info.png" alt="info" /></span></div>
        <div class="stat-value">${f(rrRatio, 1)}</div>
        <div class="stat-sub">avg ${f(avgTp, 0)} TP / ${f(avgSl, 0)} SL pts</div>
      </div>`;
    }

    const saved = getSavedProjection();
    let capitalHtml = "";
    if (saved) {
      const allTimePnl = totalFromLogs(allLogs);
      const currentCapital = saved.params.capital + allTimePnl;
      capitalHtml = `
      <div class="stat">
        <div class="stat-label">Current Capital <span class="info-tip" data-tip="Initial capital + total P&L from all logged trades."><img src="assets/info.png" alt="info" /></span></div>
        <div class="stat-value accent">$${f(currentCapital)}</div>
        <div class="stat-sub">started at $${f(saved.params.capital)}</div>
      </div>`;
    }

    el.innerHTML = `
      ${capitalHtml}
      <div class="stat">
        <div class="stat-label">P&L ${isAllTime ? "(all time)" : "(this week)"} <span class="info-tip" data-tip="${isAllTime ? "Sum of all logged trades." : "Sum of trades for the selected week."}"><img src="assets/info.png" alt="info" /></span></div>
        <div class="stat-value ${total >= 0 ? "green" : ""}" style="${total < 0 ? "color:var(--red)" : ""}">
          ${total >= 0 ? "+" : "-"}$${f(Math.abs(total))}
        </div>
        <div class="stat-sub">${logs.length} trade${logs.length !== 1 ? "s" : ""}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Win rate <span class="info-tip" data-tip="Win % for the selected period."><img src="assets/info.png" alt="info" /></span></div>
        <div class="stat-value">${winRate}%</div>
        <div class="stat-sub">${wins}W / ${losses}L</div>
      </div>
      ${rrHtml}
    `;
    el.hidden = false;
  };

  // ─── Log tab: comparison banner ────────────────────

  ForexPlan.updateComparison = function () {
    const allLogs = getLogs();
    const saved = getSavedProjection();
    const el = document.getElementById("log-vs-projection");

    if (!saved || allLogs.length === 0) {
      el.hidden = true;
      return;
    }

    try {
      const { params, result } = saved;
      const logProfit = totalFromLogs(allLogs);
      const actualCapital = params.capital + logProfit;

      const firstLogDate = new Date(
        Math.min(...allLogs.map((l) => new Date(l.date))),
      );
      const latestLogDate = new Date(
        Math.max(...allLogs.map((l) => new Date(l.date))),
      );
      const daysSinceStart = (latestLogDate - firstLogDate) / 86400000;
      const weeksSinceStart = Math.max(0, Math.floor(daysSinceStart / 7));
      const projectedForPeriod =
        weeksSinceStart < result.weeks.length
          ? result.weeks[weeksSinceStart].capitalEnd
          : result.finalCapital;

      const diff = actualCapital - projectedForPeriod;
      const isOnTrack = diff >= 0;

      const fn = ForexPlan.fmtN;
      el.className = `banner ${isOnTrack ? "on-track" : "behind"}`;
      el.innerHTML = isOnTrack
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> On track — $${fn(actualCapital)} vs projected ~$${fn(projectedForPeriod)} (+$${fn(diff)})`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Behind — $${fn(actualCapital)} vs projected ~$${fn(projectedForPeriod)} (${fn(diff)})`;
    } catch {
      el.className = "banner behind";
      el.textContent = "Could not compare to projection.";
    }

    el.hidden = false;
  };

  // ─── Equity curve chart ────────────────────────────

  let equityChart = null;

  ForexPlan.renderEquityCurve = function (initialCapital, allLogs) {
    const card = document.getElementById('equity-curve-card');
    const ctx = document.getElementById('equity-chart');
    const f = ForexPlan.fmtN;

    if (allLogs.length < 2) {
      if (equityChart) { equityChart.destroy(); equityChart = null; }
      card.hidden = true;
      return;
    }

    // Sort by date, build cumulative equity points
    const sorted = [...allLogs].sort((a, b) => new Date(a.date) - new Date(b.date));
    const labels = ['Start'];
    const data = [initialCapital];
    let running = initialCapital;

    sorted.forEach((l) => {
      running += l.outcome === 'win' ? l.amount : -l.amount;
      labels.push(l.date);
      data.push(running);
    });

    // Track peak for drawdown shading
    let peak = initialCapital;
    const peakLine = [initialCapital];
    sorted.forEach((l, i) => {
      peak = Math.max(peak, data[i + 1]);
      peakLine.push(peak);
    });

    if (equityChart) equityChart.destroy();

    // Determine colors based on theme
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const lineColor = isDark ? '#6c9cff' : '#4a7dff';
    const fillColor = isDark ? 'rgba(108, 156, 255, 0.08)' : 'rgba(74, 125, 255, 0.06)';
    const peakColor = isDark ? 'rgba(248, 113, 113, 0.15)' : 'rgba(224, 72, 72, 0.08)';
    const gridColor = isDark ? 'rgba(45, 58, 77, 0.5)' : 'rgba(0, 0, 0, 0.06)';
    const tickColor = isDark ? '#6b7a90' : '#8893a4';

    equityChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Equity',
            data,
            borderColor: lineColor,
            backgroundColor: fillColor,
            fill: true,
            tension: 0.25,
            pointRadius: 3,
            pointHoverRadius: 6,
            borderWidth: 2,
          },
          {
            label: 'Peak',
            data: peakLine,
            borderColor: 'transparent',
            backgroundColor: peakColor,
            fill: '-1',
            pointRadius: 0,
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: isDark ? '#1a2332' : '#ffffff',
            titleColor: isDark ? '#e8edf5' : '#1a1d24',
            bodyColor: isDark ? '#a0aec0' : '#4a5568',
            borderColor: isDark ? '#2d3a4d' : '#e0e3e8',
            borderWidth: 1,
            callbacks: {
              label: (tip) => {
                if (tip.datasetIndex === 1) return null;
                return `Capital: $${f(tip.parsed.y)}`;
              },
            },
            filter: (item) => item.datasetIndex === 0,
          },
        },
        scales: {
          x: {
            ticks: { color: tickColor, font: { family: 'Inter', size: 10 }, maxRotation: 45 },
            grid: { color: gridColor },
          },
          y: {
            ticks: {
              color: tickColor,
              font: { family: 'Inter', size: 11 },
              callback: (v) => '$' + f(v, 0),
            },
            grid: { color: gridColor },
          },
        },
      },
    });
    card.hidden = false;
  };

  // ═══════════════════════════════════════════════════
  //  OVERVIEW TAB — always current week
  // ═══════════════════════════════════════════════════

  ForexPlan.renderOverview = function () {
    const saved = getSavedProjection();
    const emptyEl = document.getElementById("overview-empty");
    const goalsEl = document.getElementById("overview-goals");
    const widgetsEl = document.getElementById("overview-widgets");
    const tradesCard = document.getElementById("overview-trades-card");
    const weekHeading = document.getElementById("overview-week-label");

    const thisMonday = getMonday(new Date());
    const thisSunday = getSunday(thisMonday);
    weekHeading.textContent = `${fmt(thisMonday)} – ${fmt(thisSunday)}`;

    if (!saved || !saved.result || !saved.result.weeks.length) {
      goalsEl.hidden = true;
      widgetsEl.hidden = true;
      tradesCard.hidden = true;
      emptyEl.hidden = false;
      return;
    }

    emptyEl.hidden = true;

    const { params } = saved;
    const allLogs = getLogs();
    const TRADING_DAYS = ForexPlan.TRADING_DAYS_PER_WEEK || 5;

    const dailyGoalPts = (params.tpPoints || 0) * (params.maxTradesPerDay || 1);
    const weekGoalPts = dailyGoalPts * TRADING_DAYS;
    const todayLogs = logsForToday();
    const thisWeekLogs = logsForWeek(thisMonday);
    const netPtsToday = netPointsFromLogs(todayLogs);
    const netPtsWeek = netPointsFromLogs(thisWeekLogs);
    const todayDone = dailyGoalPts > 0 && netPtsToday >= dailyGoalPts;
    const weekDone = weekGoalPts > 0 && netPtsWeek >= weekGoalPts;

    const f = ForexPlan.fmtN;
    goalsEl.innerHTML = `
      <div class="overview-goals-grid">
        <div class="overview-goal-block ${todayDone ? "done" : ""}">
          <div class="overview-goal-label">Today</div>
          <div class="overview-goal-value">${f(netPtsToday, 0)} / ${f(dailyGoalPts, 0)} pts ${todayDone ? "<span class=\"overview-done-badge\">✓ Done</span>" : ""}</div>
        </div>
        <div class="overview-goal-block ${weekDone ? "done" : ""}">
          <div class="overview-goal-label">This week</div>
          <div class="overview-goal-value">${f(netPtsWeek, 0)} / ${f(weekGoalPts, 0)} pts ${weekDone ? "<span class=\"overview-done-badge\">✓ Done</span>" : ""}</div>
        </div>
      </div>
    `;
    goalsEl.hidden = false;

    // ── Current Capital & P&L (this week) ────────
    const allTimePnl = totalFromLogs(allLogs);
    const currentCapital = params.capital + allTimePnl;
    const weekPnl = totalFromLogs(thisWeekLogs);
    widgetsEl.innerHTML = `
      <div class="stat">
        <div class="stat-label">Current Capital <span class="info-tip" data-tip="Initial capital + total P&L from all logged trades."><img src="assets/info.png" alt="info" /></span></div>
        <div class="stat-value accent">$${f(currentCapital)}</div>
        <div class="stat-sub">started at $${f(params.capital)}</div>
      </div>
      <div class="stat">
        <div class="stat-label">P&L (this week) <span class="info-tip" data-tip="Sum of trades for this week."><img src="assets/info.png" alt="info" /></span></div>
        <div class="stat-value ${weekPnl >= 0 ? "green" : ""}" style="${weekPnl < 0 ? "color:var(--red)" : ""}">
          ${weekPnl >= 0 ? "+" : "-"}$${f(Math.abs(weekPnl))}
        </div>
        <div class="stat-sub">${thisWeekLogs.length} trade${thisWeekLogs.length !== 1 ? "s" : ""}</div>
      </div>
    `;
    widgetsEl.hidden = false;

    if (thisWeekLogs.length > 0) {
      const tbody = document.getElementById("overview-tbody");
      document.getElementById("overview-trade-count").textContent =
        thisWeekLogs.length;
      tbody.innerHTML = thisWeekLogs
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .map(
          (l) =>
            `<tr>
              <td>${l.date}</td>
              <td><span class="${l.outcome}">${l.outcome.toUpperCase()}</span></td>
              <td>$${f(l.amount)}</td>
              <td>${l.lot != null ? f(l.lot) : "—"}</td>
              <td>${f(l.points, 0)}</td>
              <td>${l.sl != null ? f(l.sl, 0) : "—"}</td>
              <td class="note-cell"${l.note ? ' data-note="1"' : ''}><span class="note-text">${l.note || "—"}</span></td>
              <td><button type="button" class="btn btn-ghost" data-id="${l.id}">Delete</button></td>
            </tr>`,
        )
        .join("");
      tbody.querySelectorAll(".btn-ghost").forEach((btn) => {
        btn.addEventListener("click", () => ForexPlan.deleteLog(btn.dataset.id));
      });
      tradesCard.hidden = false;
    } else {
      tradesCard.hidden = true;
    }
  };

  // ─── Init ──────────────────────────────────────────

  ForexPlan._initWeekFilter = function () {
    updateWeekLabel();
  };
})();
