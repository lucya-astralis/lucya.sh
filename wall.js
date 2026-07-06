const targetDate = new Date("2026-08-09T00:00:00");

function updateCountdown() {
  const now = new Date();
  const diff = targetDate - now;

  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  document.getElementById("daysLeft").textContent =
    days > 0 ? `${days}日` : "到着";
}

updateCountdown();
setInterval(updateCountdown, 60000);
