(function () {
  const { STORAGE_KEYS } = ForexPlan;

  ForexPlan.getLogs = function () {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.logs);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  ForexPlan.saveLogs = function (logs) {
    localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(logs));
  };

  ForexPlan.getSavedProjection = function () {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.projection);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  ForexPlan.saveProjection = function (params, result) {
    try {
      localStorage.setItem(
        STORAGE_KEYS.projection,
        JSON.stringify({ params, result, at: new Date().toISOString() })
      );
    } catch (e) {
      console.warn('Could not save projection', e);
    }
  };
})();
