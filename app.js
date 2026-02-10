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
      note: (f.note.value || '').trim(),
    });
    f.amount.value = '';
    f.points.value = '';
    f.sl.value = '';
    f.note.value = '';
    f.date.value = new Date().toISOString().slice(0, 10);
    // Reset toggle to Win
    f.outcome.value = 'win';
    f.querySelectorAll('.outcome-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.value === 'win');
    });
  }

  document.getElementById('log-form').addEventListener('submit', handleLogSubmit);
  document.getElementById('overview-log-form').addEventListener('submit', handleLogSubmit);

  // ─── Outcome toggle buttons ──────────────────────

  document.querySelectorAll('.outcome-toggle').forEach((toggle) => {
    const hidden = toggle.closest('form').querySelector('input[name="outcome"]');
    toggle.querySelectorAll('.outcome-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        toggle.querySelectorAll('.outcome-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        hidden.value = btn.dataset.value;
      });
    });
  });

  // ─── Note cell expand on click ────────────────────

  document.addEventListener('click', (e) => {
    const cell = e.target.closest('.note-cell[data-note]');
    if (cell) {
      cell.classList.toggle('expanded');
      return;
    }
    // Collapse any open note cells when clicking elsewhere
    document.querySelectorAll('.note-cell.expanded').forEach((c) => c.classList.remove('expanded'));
  });

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

  // ─── Storage info + clear data ───────────────────

  function updateStorageInfo() {
    const keys = ForexPlan.STORAGE_KEYS;
    const projSize = (localStorage.getItem(keys.projection) || '').length;
    const logsSize = (localStorage.getItem(keys.logs) || '').length;
    const themeSize = (localStorage.getItem('fx-theme') || '').length;
    const totalBytes = (projSize + logsSize + themeSize) * 2; // UTF-16 = 2 bytes per char
    const logs = ForexPlan.getLogs();

    let sizeStr;
    if (totalBytes < 1024) sizeStr = totalBytes + ' B';
    else if (totalBytes < 1024 * 1024) sizeStr = (totalBytes / 1024).toFixed(1) + ' KB';
    else sizeStr = (totalBytes / (1024 * 1024)).toFixed(2) + ' MB';

    document.getElementById('storage-info').textContent =
      `${logs.length} trade${logs.length !== 1 ? 's' : ''} · ${sizeStr} used`;
  }

  updateStorageInfo();

  // Update storage info when dropdown opens
  settingsBtn.addEventListener('click', updateStorageInfo);

  document.getElementById('btn-clear-data').addEventListener('click', () => {
    if (!confirm('Delete ALL data? This cannot be undone.\n\nProjection, trading logs, and settings will be permanently removed.')) return;
    const keys = ForexPlan.STORAGE_KEYS;
    localStorage.removeItem(keys.projection);
    localStorage.removeItem(keys.logs);
    settingsDropdown.classList.remove('open');
    location.reload();
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
