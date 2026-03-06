#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# ClearPanel — Quick Server Test
# Usage:  bash test-server.sh
#         bash test-server.sh --password <yourpassword>   (auto-login test)
# ─────────────────────────────────────────────────────────────────────────────

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'
BOLD='\033[1m'; NC='\033[0m'
SEP="──────────────────────────────────────────────────────────────"

ok()   { echo -e "  ${GREEN}✔ $1${NC}"; }
fail() { echo -e "  ${RED}✘ $1${NC}"; }
warn() { echo -e "  ${YELLOW}⚠ $1${NC}"; }
info() { echo -e "  ${CYAN}ℹ $1${NC}"; }
header() { echo -e "\n${BOLD}${CYAN}$SEP\n  $1\n$SEP${NC}"; }

PASS=""
for i in "$@"; do [[ "$1" == "--password" ]] && PASS="$2"; done

PORT=${CLEARPANEL_PORT:-3334}
BASE="http://localhost:${PORT}"
COOKIE_JAR=$(mktemp /tmp/clearpanel-test-XXXX.txt)
ERRORS=0

echo -e "\n${BOLD}ClearPanel Server Test  —  $(date)${NC}"
echo -e "  Target : ${BASE}"
echo -e "  Host   : $(hostname) / $(hostname -I 2>/dev/null | awk '{print $1}')\n"

# ── 1. Process / Service ──────────────────────────────────────────────────────
header "1. Process & Service"

if systemctl is-active --quiet clearpanel 2>/dev/null; then
  ok "clearpanel.service is ACTIVE"
else
  fail "clearpanel.service is NOT running"
  echo ""
  info "Last 20 lines of journal:"
  journalctl -u clearpanel -n 20 --no-pager 2>/dev/null | sed 's/^/      /'
  ((ERRORS++))
fi

if systemctl is-enabled --quiet clearpanel 2>/dev/null; then
  ok "clearpanel.service is enabled (auto-start on boot)"
else
  warn "clearpanel.service is NOT enabled — won't restart on reboot"
fi

PID=$(pgrep -f "node.*main.js" 2>/dev/null | head -1)
if [ -n "$PID" ]; then
  ok "Node process running (PID $PID)"
  MEM=$(ps -o rss= -p "$PID" 2>/dev/null | awk '{printf "%.1f MB", $1/1024}')
  info "Memory: $MEM"
else
  fail "No node process found"
  ((ERRORS++))
fi

# ── 2. Port ───────────────────────────────────────────────────────────────────
header "2. Port Binding"

if ss -tlnp 2>/dev/null | grep -q ":${PORT}"; then
  ok "Port ${PORT} is listening"
  ss -tlnp 2>/dev/null | grep ":${PORT}" | sed 's/^/    /'
else
  fail "Nothing is listening on port ${PORT}"
  info "All listening TCP ports:"
  ss -tlnp 2>/dev/null | grep LISTEN | sed 's/^/    /'
  ((ERRORS++))
fi

# ── 3. HTTP Reachability ─────────────────────────────────────────────────────
header "3. HTTP Reachability"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${BASE}/api/setup/status" 2>/dev/null)
if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 500 ] 2>/dev/null; then
  ok "API responds (HTTP ${HTTP_CODE})  →  ${BASE}/api/setup/status"
else
  fail "API not reachable (got: '${HTTP_CODE}')  →  ${BASE}/api/setup/status"
  info "Trying raw curl:"
  curl -v --max-time 5 "${BASE}/api/setup/status" 2>&1 | head -30 | sed 's/^/    /'
  ((ERRORS++))
fi

# ── 4. Auth Test (if password given) ─────────────────────────────────────────
header "4. Authentication"

if [ -n "$PASS" ]; then
  LOGIN_RESP=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -X POST "${BASE}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"admin\",\"password\":\"${PASS}\"}" \
    --max-time 10 2>/dev/null)
  
  if echo "$LOGIN_RESP" | grep -q '"authenticated":true\|"username":"admin"'; then
    ok "Login successful"
    
    # Test a few protected endpoints
    for ENDPOINT in \
      "domains:GET:/api/domains" \
      "subdomains:GET:/api/subdomains" \
      "monitoring:GET:/api/monitoring/stats" \
      "webserver:GET:/api/webserver/status" \
      "git repos:GET:/api/git/repos"
    do
      LABEL="${ENDPOINT%%:*}"
      URL="${BASE}${ENDPOINT##*:}"
      METHOD="${ENDPOINT#*:}"; METHOD="${METHOD%%:*}"
      CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
        -X "$METHOD" --max-time 5 "$URL" 2>/dev/null)
      if [ "$CODE" == "200" ]; then
        ok "${LABEL} → ${CODE}"
      elif [ "$CODE" == "401" ]; then
        fail "${LABEL} → 401 Unauthorized"
        ((ERRORS++))
      else
        warn "${LABEL} → ${CODE}"
      fi
    done
  else
    fail "Login failed. Response: $LOGIN_RESP"
    ((ERRORS++))
  fi
else
  warn "No --password given — skipping auth + API endpoint tests"
  info "Re-run:  bash test-server.sh --password <yourpassword>"
fi

# ── 5. Nginx ──────────────────────────────────────────────────────────────────
header "5. Nginx"

if systemctl is-active --quiet nginx 2>/dev/null; then
  ok "nginx is ACTIVE"
  if nginx -t 2>&1 | grep -q "syntax is ok"; then
    ok "nginx config syntax OK"
  else
    fail "nginx config has errors:"
    nginx -t 2>&1 | sed 's/^/    /'
    ((ERRORS++))
  fi
else
  warn "nginx is not running (optional — panel works without it)"
fi

# ── 6. Database ───────────────────────────────────────────────────────────────
header "6. Database (optional)"

for DB in mysql mariadb postgresql; do
  if systemctl is-active --quiet "$DB" 2>/dev/null; then
    ok "$DB is ACTIVE"
  fi
done

# ── 7. Disk Space ─────────────────────────────────────────────────────────────
header "7. Disk Space"

df -h / 2>/dev/null | awk 'NR>1 {
  used=$5+0
  if (used > 90) printf "  \033[0;31m✘ Root disk %s used (%s free)\033[0m\n", $5, $4
  else if (used > 75) printf "  \033[1;33m⚠ Root disk %s used (%s free)\033[0m\n", $5, $4
  else printf "  \033[0;32m✔ Root disk %s used (%s free)\033[0m\n", $5, $4
}'

AVAIL_MB=$(df -m / 2>/dev/null | awk 'NR>1{print $4}')
if [ -n "$AVAIL_MB" ] && [ "$AVAIL_MB" -lt 500 ]; then
  fail "Low disk space: only ${AVAIL_MB} MB free!"
  ((ERRORS++))
fi

# ── 8. Recent Errors ─────────────────────────────────────────────────────────
header "8. Recent Error Logs"

info "Last 15 lines from clearpanel journal:"
journalctl -u clearpanel -n 15 --no-pager 2>/dev/null | sed 's/^/  /' || \
  echo "  (journalctl not available — check /var/log/clearpanel.log)"

# Check for crash/error keywords
CRASH_LINES=$(journalctl -u clearpanel -n 100 --no-pager 2>/dev/null | \
  grep -Ei "error|failed|exception|unhandled|ENOENT|EACCES|SyntaxError|TypeError|MODULE_NOT_FOUND" | \
  tail -10)
if [ -n "$CRASH_LINES" ]; then
  echo ""
  warn "Potential error lines in journal:"
  echo "$CRASH_LINES" | sed 's/^/    /'
fi

# ── 9. Setup Status File ──────────────────────────────────────────────────────
header "9. Setup & Config"

SETUP_FILE="/var/lib/clearpanel/setup-status.json"
[ -f "./setup-status.json" ] && SETUP_FILE="./setup-status.json"

if [ -f "$SETUP_FILE" ]; then
  ok "setup-status.json found: $SETUP_FILE"
  cat "$SETUP_FILE" | python3 -m json.tool 2>/dev/null | sed 's/^/    /' || \
    cat "$SETUP_FILE" | sed 's/^/    /'
else
  warn "setup-status.json not found at $SETUP_FILE"
fi

ENV_FILE="/etc/clearpanel/.env"
[ -f "./.env" ] && ENV_FILE="./.env"
[ -f "./backend/.env" ] && ENV_FILE="./backend/.env"

if [ -f "$ENV_FILE" ]; then
  ok ".env found: $ENV_FILE"
  grep -v "PASSWORD\|SECRET\|KEY\|TOKEN" "$ENV_FILE" | sed 's/^/    /'
else
  warn ".env not found (checked $ENV_FILE)"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${SEP}${NC}"
if [ "$ERRORS" -eq 0 ]; then
  echo -e "  ${GREEN}${BOLD}✔ All checks passed${NC}"
else
  echo -e "  ${RED}${BOLD}✘ ${ERRORS} issue(s) found — review the output above${NC}"
fi
echo -e "${BOLD}${SEP}${NC}\n"

rm -f "$COOKIE_JAR"
exit $ERRORS
