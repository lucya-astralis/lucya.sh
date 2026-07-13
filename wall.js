// Countdowns shown on the video wall. Each ticks down to midnight of its date;
// once the date is reached it shows its `done` label instead of a day count.
const countdowns = [
  { id: "daysLeft",       target: "2026-08-09T00:00:00", done: "到着"   }, // 日本まで — Japan-Reise
  { id: "daysLeftUrlaub", target: "2026-07-31T00:00:00", done: "休暇中" }, // 休暇まで — Urlaub
];

function updateCountdowns() {
  const now = new Date();
  for (const { id, target, done } of countdowns) {
    const el = document.getElementById(id);
    if (!el) continue;
    const days = Math.ceil((new Date(target) - now) / (1000 * 60 * 60 * 24));
    el.textContent = days > 0 ? `${days}日` : done;
  }
}

updateCountdowns();
setInterval(updateCountdowns, 60000);
