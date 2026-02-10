(function () {
  const { getLogs, saveLogs, getSavedProjection } = ForexPlan;

  // ─── Week filter state ───────────────────────────

  // Get Monday of a given date's week
  function getMonday(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Monday = 1
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

  function formatDateShort(d) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  let filterMonday = getMonday(new Date());
  let isAllTime = false;

  function getFilteredLogs() {
    const logs = getLogs();
    if (isAllTime) return logs;
    const sunday = getSunday(filterMonday);
    return logs.filter((l) => {
      const d = new Date(l.date);
      return d >= filterMonday && d <= sunday;
    });
  }

  ForexPlan.setWeekFilter = function (direction) {
    if (direction === 'prev') {
      filterMonday = new Date(filterMonday.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (direction === 'next') {
      filterMonday = new Date(filterMonday.getTime() + 7 * 24 * 60 * 60 * 1000);
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
  };

  function updateWeekLabel() {
    const label = document.getElementById('week-label');
    const allBtn = document.getElementById('btn-all-time');
    if (isAllTime) {
      label.textContent = 'All Time';
      allBtn.classList.add('active');
    } else {
      const sunday = getSunday(filterMonday);
      label.textContent = `${formatDateShort(filterMonday)} – ${formatDateShort(sunday)}`;
      allBtn.classList.remove('active');
    }
  }

  // ─── Helpers ───────────────────────────────────────

  function totalFromLogs(logs) {
    return logs.reduce((sum, l) => sum + (l.outcome === 'win' ? l.amount : -l.amount), 0);
  }

  ForexPlan.totalFromLogs = totalFromLogs;

  // ─── CRUD ──────────────────────────────────────────

  ForexPlan.addLog = function (entry) {
    const logs = getLogs();
    logs.push({ id: String(Date.now()), ...entry });
    saveLogs(logs);
    ForexPlan.refreshLogView();
  };

  ForexPlan.deleteLog = function (id) {
    if (!confirm('Delete this trade?')) return;
    saveLogs(getLogs().filter((l) => l.id !== id));
    ForexPlan.refreshLogView();
  };

  // ─── Render table ──────────────────────────────────

  ForexPlan.renderLogs = function () {
    const logs = getFilteredLogs();
    const allLogs = getLogs();
    const tbody = document.getElementById('log-tbody');
    const countEl = document.getElementById('log-count');
    countEl.textContent = allLogs.length;

    if (logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">No trades this period</td></tr>';
      return;
    }

    tbody.innerHTML = logs
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .map(
        (l) =>
          `<tr>
            <td>${l.date}</td>
            <td><span class="${l.outcome}">${l.outcome.toUpperCase()}</span></td>
            <td>$${l.amount.toFixed(2)}</td>
            <td>${l.lot != null ? l.lot.toFixed(2) : '—'}</td>
            <td>${l.points}</td>
            <td>${l.sl != null ? l.sl : '—'}</td>
            <td><button type="button" class="btn btn-ghost" data-id="${l.id}">Delete</button></td>
          </tr>`
      )
      .join('');

    tbody.querySelectorAll('.btn-ghost').forEach((btn) => {
      btn.addEventListener('click', () => ForexPlan.deleteLog(btn.dataset.id));
    });
  };

  // ─── Summary stats ─────────────────────────────────

  ForexPlan.updateLogSummary = function () {
    const logs = getFilteredLogs();
    const allLogs = getLogs();
    const el = document.getElementById('log-cards');

    if (allLogs.length === 0) {
      el.hidden = true;
      return;
    }

    const total = totalFromLogs(logs);
    const wins = logs.filter((l) => l.outcome === 'win').length;
    const losses = logs.filter((l) => l.outcome === 'loss').length;
    const winRate = logs.length > 0 ? ((wins / logs.length) * 100).toFixed(0) : 0;

    // R:R from filtered logs: avg TP points (wins) / avg SL points (losses)
    const winLogs = logs.filter((l) => l.outcome === 'win' && l.points > 0);
    const lossLogs = logs.filter((l) => l.outcome === 'loss' && l.sl > 0);
    const avgTp = winLogs.length > 0 ? winLogs.reduce((s, l) => s + l.points, 0) / winLogs.length : 0;
    const avgSl = lossLogs.length > 0 ? lossLogs.reduce((s, l) => s + l.sl, 0) / lossLogs.length : 0;
    const rrRatio = avgSl > 0 ? avgTp / avgSl : 0;

    let rrHtml = '';
    if (winLogs.length > 0 && lossLogs.length > 0) {
      rrHtml = `
      <div class="stat">
        <div class="stat-label">R : R ratio <span class="info-tip" data-tip="Actual Reward-to-Risk ratio from your logs. Average TP points (wins) / average SL points (losses). Higher = more reward per unit of risk."><img src="assets/info.png" alt="info" /></span></div>
        <div class="stat-value">${rrRatio.toFixed(1)}</div>
        <div class="stat-sub">avg ${avgTp.toFixed(0)} TP / ${avgSl.toFixed(0)} SL pts</div>
      </div>`;
    }

    // Current capital (always from all logs)
    const saved = getSavedProjection();
    let capitalHtml = '';
    if (saved) {
      const allTimePnl = totalFromLogs(allLogs);
      const currentCapital = saved.params.capital + allTimePnl;
      capitalHtml = `
      <div class="stat">
        <div class="stat-label">Current Capital <span class="info-tip" data-tip="Your initial capital plus total P&L from all logged trades (all time)."><img src="assets/info.png" alt="info" /></span></div>
        <div class="stat-value accent">$${currentCapital.toFixed(2)}</div>
        <div class="stat-sub">started at $${saved.params.capital.toFixed(2)}</div>
      </div>`;
    }

    el.innerHTML = `
      ${capitalHtml}
      <div class="stat">
        <div class="stat-label">P&L ${isAllTime ? '(all time)' : '(this week)'} <span class="info-tip" data-tip="${isAllTime ? 'Sum of all logged trades.' : 'Sum of trades for the selected week.'}"><img src="assets/info.png" alt="info" /></span></div>
        <div class="stat-value ${total >= 0 ? 'green' : ''}" style="${total < 0 ? 'color:var(--red)' : ''}">
          ${total >= 0 ? '+' : '-'}$${Math.abs(total).toFixed(2)}
        </div>
        <div class="stat-sub">${logs.length} trade${logs.length !== 1 ? 's' : ''}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Win rate <span class="info-tip" data-tip="Percentage of trades you've won in the selected period."><img src="assets/info.png" alt="info" /></span></div>
        <div class="stat-value">${winRate}%</div>
        <div class="stat-sub">${wins}W / ${losses}L</div>
      </div>
      ${rrHtml}
    `;
    el.hidden = false;
  };

  // ─── Comparison vs projection ──────────────────────

  ForexPlan.updateComparison = function () {
    const allLogs = getLogs();
    const saved = getSavedProjection();
    const el = document.getElementById('log-vs-projection');

    if (!saved || allLogs.length === 0) {
      el.hidden = true;
      return;
    }

    try {
      const { params, result } = saved;
      const initialCapital = params.capital;
      const logProfit = totalFromLogs(allLogs);
      const actualCapital = initialCapital + logProfit;

      const firstLogDate = new Date(Math.min(...allLogs.map((l) => new Date(l.date))));
      const latestLogDate = new Date(Math.max(...allLogs.map((l) => new Date(l.date))));
      const daysSinceStart = (latestLogDate - firstLogDate) / (1000 * 60 * 60 * 24);
      const weeksSinceStart = Math.max(0, Math.floor(daysSinceStart / 7));
      const projectedForPeriod =
        weeksSinceStart < result.weeks.length
          ? result.weeks[weeksSinceStart].capitalEnd
          : result.finalCapital;

      const diff = actualCapital - projectedForPeriod;
      const isOnTrack = diff >= 0;

      el.className = `banner ${isOnTrack ? 'on-track' : 'behind'}`;
      el.innerHTML = isOnTrack
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> On track — Actual $${actualCapital.toFixed(2)} vs projected ~$${projectedForPeriod.toFixed(2)} (+$${diff.toFixed(2)})`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Behind — Actual $${actualCapital.toFixed(2)} vs projected ~$${projectedForPeriod.toFixed(2)} (${diff.toFixed(2)})`;
    } catch {
      el.className = 'banner behind';
      el.textContent = 'Could not compare to projection.';
    }

    el.hidden = false;
  };

  // ─── Init label ──────────────────────────────────

  ForexPlan._initWeekFilter = function () {
    updateWeekLabel();
  };
})();
