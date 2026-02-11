(function () {
  const { STORAGE_KEYS } = ForexPlan;

  ForexPlan.exportData = function () {
    const data = {
      projection: localStorage.getItem(STORAGE_KEYS.projection),
      logs: localStorage.getItem(STORAGE_KEYS.logs),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forex-plan-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  ForexPlan.importData = function (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.projection) localStorage.setItem(STORAGE_KEYS.projection, data.projection);
        if (data.logs) localStorage.setItem(STORAGE_KEYS.logs, data.logs);
        ForexPlan.renderOverview();
        ForexPlan.renderLogs();
        ForexPlan.updateLogSummary();
        ForexPlan.updateComparison();
        ForexPlan.restoreProjection();
        alert(ForexPlan.t('importSuccess'));
      } catch (err) {
        alert(ForexPlan.t('importInvalid'));
        console.warn('Import error', err);
      }
    };
    reader.readAsText(file);
  };
  ForexPlan.exportCsv = function () {
    const logs = ForexPlan.getLogs();
    if (logs.length === 0) {
      alert(ForexPlan.t('exportNoLogs'));
      return;
    }

    const headers = ['Date', 'Result', 'Amount', 'Commission', 'P/L', 'Lot', 'TP Points', 'SL Points', 'Note'];
    const rows = logs
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((l) => {
        const commission = l.commission != null ? l.commission : 0;
        const netGain = l.outcome === 'win' ? l.amount - commission : -(l.amount + commission);
        return [
          l.date,
          l.outcome,
          l.amount.toFixed(2),
          commission.toFixed(2),
          netGain.toFixed(2),
          l.lot != null ? l.lot.toFixed(2) : '',
          l.points,
          l.sl != null ? l.sl : '',
          `"${(l.note || '').replace(/"/g, '""')}"`,
        ].join(',');
      });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forex-trading-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
})();
