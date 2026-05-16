#!/usr/bin/env bash
# ============================================================================
# temps.sh — emit Pi 4B telemetry as JSON on stdout.
# Used by lucya.sh frontend (see script.js → THERMAL).
#
# DEPLOY:
#   sudo install -m 0755 scripts/temps.sh /usr/local/bin/temps.sh
#
# CRON (every minute, atomic write so the frontend never reads a partial file):
#   * * * * * /usr/local/bin/temps.sh > /srv/websites/lucya.sh/temps.json.tmp \
#       && mv /srv/websites/lucya.sh/temps.json.tmp /srv/websites/lucya.sh/temps.json
#
# Faster than 1 min? Use a systemd timer with OnUnitActiveSec=15s instead of cron.
# ============================================================================
set -eu

# ---- CPU temp (millidegrees C from sysfs; works on every modern Linux + Pi)
TEMP_MILLI=$(cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null || echo 0)
TEMP_C=$(awk -v t="$TEMP_MILLI" 'BEGIN{ printf "%.1f", t/1000 }')

# ---- load avg
read -r LOAD1 LOAD5 LOAD15 _ < /proc/loadavg

# ---- uptime (seconds, integer)
read -r UP_RAW _ < /proc/uptime
UP_SEC=${UP_RAW%.*}

# ---- memory (use MemAvailable for the "actually used" estimate Linux recommends)
MEM_TOTAL=$(awk '/^MemTotal:/{print $2; exit}'     /proc/meminfo)
MEM_AVAIL=$(awk '/^MemAvailable:/{print $2; exit}' /proc/meminfo)
MEM_PCT=$(awk -v t="$MEM_TOTAL" -v a="$MEM_AVAIL" 'BEGIN{ printf "%.1f", ((t-a)/t)*100 }')

HOST=$(hostname)
NOW=$(date +%s)

cat <<EOF
{
  "host": "${HOST}",
  "ts": ${NOW},
  "cpu_temp_c": ${TEMP_C},
  "load_1m": ${LOAD1},
  "load_5m": ${LOAD5},
  "load_15m": ${LOAD15},
  "uptime_s": ${UP_SEC},
  "mem_used_pct": ${MEM_PCT}
}
EOF
