window.ForexPlan = window.ForexPlan || {};

ForexPlan.TRADING_DAYS_PER_WEEK = 5;
ForexPlan.MIN_LOT = 0.01;
ForexPlan.LOT_STEP = 0.01;

ForexPlan.STORAGE_KEYS = {
  projection: 'forex-plan-projection',
  logs: 'forex-plan-logs',
};

// Number formatting with thousand separators
ForexPlan.fmtN = function (n, decimals) {
  if (decimals === undefined) decimals = 2;
  return Number(n).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};
