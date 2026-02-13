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

  function updateTotalTargetPtsDisplay() {
    const f = document.getElementById('projection-form');
    const el = document.getElementById('total-target-pts-value');
    if (!f || !el) return;
    const tp = Number(f.tpPoints.value) || 0;
    const max = Number(f.maxTradesPerDay.value) || 0;
    el.textContent = ForexPlan.fmtN(tp * max, 0);
  }

  function updateProjectionExplainer() {
    const el = document.getElementById('projection-explainer');
    const f = document.getElementById('projection-form');
    if (!el || !f) return;
    const fmt = ForexPlan.fmtN;
    const t = ForexPlan.t;
    const capital = Number(f.capital.value) || 0;
    const riskPct = Number(f.riskPct.value) || 0;
    const winRate = Number(f.winRate.value);
    const tpPoints = Number(f.tpPoints.value) || 0;
    const slPoints = Number(f.slPoints.value) || 0;
    const maxTradesPerDay = Number(f.maxTradesPerDay.value) || 0;
    const targetPerDay = Number(f.targetPerDay.value) || 0;
    const riskDollar = capital * (riskPct / 100);
    const dailyGoalPts = maxTradesPerDay * tpPoints;

    let weeksToGoal = t('projectionExplainerWeeksPlaceholder');
    const saved = ForexPlan.getSavedProjection();
    if (saved && saved.result && saved.result.weeks && saved.result.weeks.length > 0) {
      const last = saved.result.weeks[saved.result.weeks.length - 1];
      const TRADING_DAYS = ForexPlan.TRADING_DAYS_PER_WEEK || 5;
      const reachedGoal = last.weeklyProfit / TRADING_DAYS >= (saved.params.targetPerDay || 0);
      weeksToGoal = reachedGoal ? String(saved.result.totalWeeks) + ' ' + (saved.result.totalWeeks === 1 ? ForexPlan.t('weekUnit') : ForexPlan.t('weeksUnit')) : t('projectionExplainerWeeksPlaceholder');
    }

    const template = t('projectionExplainerTemplate');
    const replacements = {
      capital: capital ? '$' + fmt(capital, 0) : '—',
      riskPct: riskPct || '—',
      riskDollar: riskDollar ? '$' + fmt(riskDollar, 0) : '—',
      winRate: f.winRate.value === '' ? '—' : String(winRate >= 0 && winRate <= 100 ? winRate : 100),
      maxTradesPerDay: maxTradesPerDay || '—',
      tpPoints: tpPoints ? fmt(tpPoints, 0) : '—',
      slPoints: slPoints ? fmt(slPoints, 0) : '—',
      dailyGoalPts: dailyGoalPts ? fmt(dailyGoalPts, 0) : '—',
      targetPerDay: targetPerDay ? '$' + fmt(targetPerDay, 0) : '—',
      weeksToGoal,
    };
    let text = template;
    Object.keys(replacements).forEach((key) => {
      text = text.replace(new RegExp('{{' + key + '}}', 'g'), replacements[key]);
    });
    el.textContent = text;
  }

  const projForm = document.getElementById('projection-form');
  projForm.addEventListener('submit', (e) => {
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
    updateProjectionExplainer();
  });
  projForm.tpPoints.addEventListener('input', updateTotalTargetPtsDisplay);
  projForm.maxTradesPerDay.addEventListener('input', updateTotalTargetPtsDisplay);
  ['capital', 'riskPct', 'winRate', 'tpPoints', 'slPoints', 'maxTradesPerDay', 'targetPerDay'].forEach((name) => {
    projForm[name].addEventListener('input', updateProjectionExplainer);
    projForm[name].addEventListener('change', updateProjectionExplainer);
  });

  // ─── Log form (shared handler) ─────────────────────

  function handleLogSubmit(e) {
    e.preventDefault();
    const f = e.target;
    const outcome = f.outcome.value;
    const amount = Number(f.amount.value);
    const lot = Number(f.lot.value);
    const points = lot > 0 ? Math.round(amount / lot) : 0;

    const commission = Number(f.commission?.value) || 0;
    addLog({
      outcome,
      amount,
      lot: Math.round(lot * 100) / 100,
      points,
      date: f.date.value,
      note: (f.note.value || '').trim(),
      commission,
    });
    // Remember lot & commission for next trade and sync both forms
    localStorage.setItem(ForexPlan.STORAGE_KEYS.lastLot, lot);
    localStorage.setItem(ForexPlan.STORAGE_KEYS.lastCommission, commission);
    document.querySelectorAll('input[name="lot"]').forEach((el) => { el.value = lot; });
    document.querySelectorAll('input[name="commission"]').forEach((el) => { el.value = commission; });
    f.amount.value = '';
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

  // ─── PWA install ─────────────────────────────────

  let deferredInstallPrompt = null;
  const installBtn = document.getElementById('btn-install-app');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (installBtn) installBtn.removeAttribute('hidden');
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    if (installBtn) installBtn.setAttribute('hidden', '');
  });

  if (installBtn) {
    installBtn.addEventListener('click', (e) => {
      e.preventDefault();
      settingsDropdown.classList.remove('open');
      if (!deferredInstallPrompt) {
        alert('Install from the browser menu: ⋮ → "Install Forex Plan" or "Add to Home Screen". (Install prompt appears in Chrome/Edge on HTTPS.)');
        return;
      }
      deferredInstallPrompt.prompt();
      deferredInstallPrompt.userChoice.then((choice) => {
        if (choice.outcome === 'accepted') deferredInstallPrompt = null;
        installBtn.setAttribute('hidden', '');
      });
    });
  }

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

    const t = ForexPlan.t;
    document.getElementById('storage-info').textContent =
      `${logs.length} ${logs.length !== 1 ? t('trades') : t('trade')} · ${sizeStr}`;
  }

  updateStorageInfo();

  // Update storage info when dropdown opens
  settingsBtn.addEventListener('click', updateStorageInfo);

  document.getElementById('btn-clear-data').addEventListener('click', () => {
    if (!confirm(ForexPlan.t('confirmClearData'))) return;
    const keys = ForexPlan.STORAGE_KEYS;
    localStorage.removeItem(keys.projection);
    localStorage.removeItem(keys.logs);
    settingsDropdown.classList.remove('open');
    location.reload();
  });

  // ─── Locale / i18n ───────────────────────────────

  function applyLocale() {
    ForexPlan.applyStaticTranslations();
    const emptyText = document.getElementById('overview-empty-text');
    if (emptyText) {
      const s = ForexPlan.t('overviewEmpty');
      emptyText.innerHTML = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    }
    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    const themeLabel = document.getElementById('theme-label');
    if (themeLabel) themeLabel.textContent = theme === 'dark' ? ForexPlan.t('settingsLightMode') : ForexPlan.t('settingsDarkMode');
  }

  window.addEventListener('forexplan-locale-change', () => {
    applyLocale();
    ForexPlan.renderOverview();
    renderLogs();
    updateLogSummary();
    updateComparison();
    restoreProjection();
    updateProjectionExplainer();
  });

  document.getElementById('btn-lang-en').addEventListener('click', () => {
    ForexPlan.setLocale('en');
    settingsDropdown.classList.remove('open');
  });
  document.getElementById('btn-lang-th').addEventListener('click', () => {
    ForexPlan.setLocale('th');
    settingsDropdown.classList.remove('open');
  });

  // ─── Theme toggle ────────────────────────────────

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('fx-theme', theme);
    const isDark = theme === 'dark';
    document.getElementById('theme-icon-dark').style.display = isDark ? 'inline' : 'none';
    document.getElementById('theme-icon-light').style.display = isDark ? 'none' : 'inline';
    document.getElementById('theme-label').textContent = isDark ? ForexPlan.t('settingsLightMode') : ForexPlan.t('settingsDarkMode');
  }

  // Restore saved theme (default dark)
  applyTheme(localStorage.getItem('fx-theme') || 'dark');

  document.getElementById('btn-theme').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
    // Re-render charts so they pick up theme colors
    restoreProjection();
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

  // Restore last-used lot & commission
  const savedLot = localStorage.getItem(ForexPlan.STORAGE_KEYS.lastLot);
  const savedCommission = localStorage.getItem(ForexPlan.STORAGE_KEYS.lastCommission);
  if (savedLot) {
    document.getElementById('logLot').value = savedLot;
    document.getElementById('ov-lot').value = savedLot;
  }
  if (savedCommission) {
    document.getElementById('logCommission').value = savedCommission;
    document.getElementById('ov-commission').value = savedCommission;
  }

  applyLocale();
  ForexPlan._initWeekFilter();
  ForexPlan.renderOverview();
  renderLogs();
  updateLogSummary();
  updateComparison();
  restoreProjection();
  updateProjectionExplainer();
})();
