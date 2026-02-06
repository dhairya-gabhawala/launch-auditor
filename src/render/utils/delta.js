// Delta formatting helpers for UI badges.

function formatDelta(delta) {
  if (delta > 0) return `▲ +${delta}`;
  if (delta < 0) return `▼ ${delta}`;
  return '— 0';
}

function deltaClass(delta) {
  if (delta > 0) return 'text-emerald-700';
  if (delta < 0) return 'text-rose-700';
  return 'text-slate-500';
}

module.exports = {
  formatDelta,
  deltaClass
};
