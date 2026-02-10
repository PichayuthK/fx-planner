(function () {
  const {
    saveProjection,
    runProjection,
    renderProjectionResult,
    restoreProjection,
    addLog,
    renderLogs,
    updateLogSummary,
    updateComparison,
    exportData,
    importData,
  } = ForexPlan;

  // ─── Tabs ──────────────────────────────────────────

  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });

  // ─── Projection form ───────────────────────────────

  document.getElementById('projection-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const params = {
      capital: Number(f.capital.value),
      riskPct: Number(f.riskPct.value),
      tpPoints: Number(f.tpPoints.value),
      slPoints: Number(f.slPoints.value),
      maxTradesPerDay: Number(f.maxTradesPerDay.value),
      targetPerDay: Number(f.targetPerDay.value),
      winRate: Number(f.winRate.value),
    };
    const result = runProjection(params);
    renderProjectionResult(result);
    saveProjection(params, result);
    updateComparison();
  });

  // ─── Log form (shared handler) ─────────────────────

  function handleLogSubmit(e) {
    e.preventDefault();
    const f = e.target;
    const outcome = f.outcome.value;
    const amount = Number(f.amount.value);
    const points = Number(f.points.value);
    const sl = Number(f.sl.value);
    const lot = outcome === 'win' && points > 0
      ? amount / points
      : sl > 0 ? amount / sl : 0;

    addLog({
      outcome,
      amount,
      lot: Math.round(lot * 100) / 100,
      points,
      sl,
      date: f.date.value,
    });
    f.amount.value = '';
    f.points.value = '';
    f.sl.value = '';
    f.date.value = new Date().toISOString().slice(0, 10);
  }

  document.getElementById('log-form').addEventListener('submit', handleLogSubmit);
  document.getElementById('overview-log-form').addEventListener('submit', handleLogSubmit);

  // ─── Settings dropdown ────────────────────────────

  const settingsBtn = document.getElementById('btn-settings');
  const settingsDropdown = document.getElementById('settings-dropdown');

  settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    settingsDropdown.classList.toggle('open');
  });

  document.addEventListener('click', () => {
    settingsDropdown.classList.remove('open');
  });

  settingsDropdown.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  document.getElementById('btn-export').addEventListener('click', () => {
    exportData();
    settingsDropdown.classList.remove('open');
  });
  document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', (e) => {
    if (e.target.files[0]) importData(e.target.files[0]);
    e.target.value = '';
    settingsDropdown.classList.remove('open');
  });
  document.getElementById('btn-export-csv').addEventListener('click', () => {
    ForexPlan.exportCsv();
    settingsDropdown.classList.remove('open');
  });

  // ─── Theme toggle ────────────────────────────────

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('fx-theme', theme);
    const isDark = theme === 'dark';
    document.getElementById('theme-icon-dark').style.display = isDark ? 'inline' : 'none';
    document.getElementById('theme-icon-light').style.display = isDark ? 'none' : 'inline';
    document.getElementById('theme-label').textContent = isDark ? 'Light Mode' : 'Dark Mode';
  }

  // Restore saved theme (default dark)
  applyTheme(localStorage.getItem('fx-theme') || 'dark');

  document.getElementById('btn-theme').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
    settingsDropdown.classList.remove('open');
  });

  // ─── Week filter ──────────────────────────────────

  document.getElementById('btn-prev-week').addEventListener('click', () => {
    ForexPlan.setWeekFilter('prev');
  });
  document.getElementById('btn-next-week').addEventListener('click', () => {
    ForexPlan.setWeekFilter('next');
  });
  document.getElementById('btn-all-time').addEventListener('click', () => {
    ForexPlan.toggleAllTime();
  });

  // ─── Refresh chart ────────────────────────────────

  document.getElementById('btn-refresh-chart').addEventListener('click', () => {
    restoreProjection();
  });

  // ─── Init ──────────────────────────────────────────

  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('logDate').value = today;
  document.getElementById('ov-date').value = today;

  ForexPlan._initWeekFilter();
  ForexPlan.renderOverview();
  renderLogs();
  updateLogSummary();
  updateComparison();
  restoreProjection();
})();
