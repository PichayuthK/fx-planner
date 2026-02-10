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
        alert('Data imported successfully!');
      } catch (err) {
        alert('Invalid backup file.');
        console.warn('Import error', err);
      }
    };
    reader.readAsText(file);
  };
  ForexPlan.exportCsv = function () {
    const logs = ForexPlan.getLogs();
    if (logs.length === 0) {
      alert('No trading logs to export.');
      return;
    }

    const headers = ['Date', 'Result', 'Amount', 'Lot', 'TP Points', 'SL Points', 'Note'];
    const rows = logs
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((l) => {
        const signedAmt = l.outcome === 'win' ? l.amount : -l.amount;
        return [
          l.date,
          l.outcome,
          signedAmt.toFixed(2),
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
