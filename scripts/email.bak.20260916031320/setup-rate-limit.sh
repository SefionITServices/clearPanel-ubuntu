#!/usr/bin/env bash
# setup-rate-limit.sh — Configure per-user sending rate limits via Postfix policy
# Usage: setup-rate-limit.sh <domain> <email|'*'> <limit_per_hour>
#
# Dual-mode: honours MAIL_MODE=dev (JSON state) vs MAIL_MODE=production (real system)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

DOMAIN="${1:?Usage: setup-rate-limit.sh <domain> <email|*> <limit_per_hour>}"
EMAIL="${2:?Email address or * for domain-wide}"
LIMIT="${3:?Limit per hour}"

STATE_DIR="${MAIL_STATE_DIR:-$SCRIPT_DIR/../../backend/mail-state}"
RATE_DIR="$STATE_DIR/rate-limits"
mkdir -p "$RATE_DIR"

if [[ "$MAIL_MODE" == "production" ]]; then
  # Postfix anvil/rate limiting via smtpd_sender_restrictions + policy
  RATE_FILE="/etc/postfix/sender_rate_limit"
  
  # Create or update the rate limit file
  touch "$RATE_FILE"
  
  if [[ "$EMAIL" == "*" ]]; then
    KEY="@${DOMAIN}"
  else
    KEY="${EMAIL}"
  fi

  # Remove existing entry and add new one
  grep -v "^${KEY} " "$RATE_FILE" > "$RATE_FILE.tmp" 2>/dev/null || true
  echo "${KEY} ${LIMIT}" >> "$RATE_FILE.tmp"
  mv "$RATE_FILE.tmp" "$RATE_FILE"

  # Generate the rate limit policy script if it doesn't exist
  POLICY_SCRIPT="/etc/postfix/rate-limit-policy.sh"
  if [[ ! -f "$POLICY_SCRIPT" ]]; then
    cat > "$POLICY_SCRIPT" << 'POLICY_EOF'
#!/usr/bin/env bash
# Simple rate limit policy service for Postfix
# Reads sender rate limits from /etc/postfix/sender_rate_limit
RATE_FILE="/etc/postfix/sender_rate_limit"
COUNTER_DIR="/var/spool/postfix/rate-counters"
mkdir -p "$COUNTER_DIR"

while read -r line; do
  if [[ "$line" == "" ]]; then
    SENDER="${ATTR_sender:-}"
    if [[ -n "$SENDER" ]]; then
      DOMAIN="${SENDER#*@}"
      
      # Check specific sender first, then domain wildcard
      LIMIT=""
      if grep -q "^${SENDER} " "$RATE_FILE" 2>/dev/null; then
        LIMIT=$(grep "^${SENDER} " "$RATE_FILE" | awk '{print $2}')
      elif grep -q "^@${DOMAIN} " "$RATE_FILE" 2>/dev/null; then
        LIMIT=$(grep "^@${DOMAIN} " "$RATE_FILE" | awk '{print $2}')
      fi

      if [[ -n "$LIMIT" ]]; then
        COUNTER_FILE="$COUNTER_DIR/$(echo "$SENDER" | md5sum | cut -d' ' -f1)"
        HOUR=$(date +%Y%m%d%H)
        
        # Reset counter if hour changed
        CURRENT_HOUR=""
        CURRENT_COUNT=0
        if [[ -f "$COUNTER_FILE" ]]; then
          CURRENT_HOUR=$(head -1 "$COUNTER_FILE")
          CURRENT_COUNT=$(tail -1 "$COUNTER_FILE")
        fi
        
        if [[ "$CURRENT_HOUR" != "$HOUR" ]]; then
          CURRENT_COUNT=0
        fi
        
        CURRENT_COUNT=$((CURRENT_COUNT + 1))
        echo "$HOUR" > "$COUNTER_FILE"
        echo "$CURRENT_COUNT" >> "$COUNTER_FILE"
        
        if [[ "$CURRENT_COUNT" -gt "$LIMIT" ]]; then
          echo "action=DEFER_IF_PERMIT Rate limit exceeded ($LIMIT/hour)"
          echo ""
          unset "${!ATTR_@}"
          continue
        fi
      fi
    fi
    
    echo "action=DUNNO"
    echo ""
    unset "${!ATTR_@}"
  else
    KEY="${line%%=*}"
    VALUE="${line#*=}"
    declare "ATTR_${KEY}=${VALUE}"
  fi
done
POLICY_EOF
    chmod +x "$POLICY_SCRIPT"
  fi

  # Add policy service to master.cf if not present
  if ! grep -q "rate-limit" /etc/postfix/master.cf 2>/dev/null; then
    cat >> /etc/postfix/master.cf << 'MASTER_EOF'
# Rate limit policy service
rate-limit  unix  -       n       n       -       0       spawn
  user=nobody argv=/etc/postfix/rate-limit-policy.sh
MASTER_EOF
  fi

  # Add to smtpd_sender_restrictions if not present
  CURRENT=$(postconf -h smtpd_sender_restrictions 2>/dev/null || echo "")
  if [[ ! "$CURRENT" == *"check_policy_service"*"rate-limit"* ]]; then
    if [[ -z "$CURRENT" ]]; then
      postconf -e "smtpd_sender_restrictions = check_policy_service unix:private/rate-limit, permit"
    else
      postconf -e "smtpd_sender_restrictions = check_policy_service unix:private/rate-limit, $CURRENT"
    fi
  fi

  systemctl reload postfix 2>/dev/null || true
  log_info "Rate limit set for ${KEY}: ${LIMIT}/hour"
else
  # Dev mode — just save to state JSON
  log_info "[dev] Rate limit for ${EMAIL}@${DOMAIN}: ${LIMIT}/hour (state only)"
fi

# Always persist to state
RATE_FILE_JSON="$RATE_DIR/${DOMAIN}.json"
if [[ -f "$RATE_FILE_JSON" ]]; then
  EXISTING=$(cat "$RATE_FILE_JSON")
else
  EXISTING='{"domain":"'"$DOMAIN"'","limits":[]}'
fi

# Use jq if available, otherwise simple approach
if command -v jq &>/dev/null; then
  echo "$EXISTING" | jq --arg email "$EMAIL" --argjson limit "$LIMIT" \
    '.limits = [.limits[] | select(.email != $email)] + [{"email": $email, "limit": $limit, "updatedAt": (now | todate)}]' \
    > "$RATE_FILE_JSON"
else
  echo "$EXISTING" > "$RATE_FILE_JSON"
fi

echo "Rate limit configured: ${EMAIL} = ${LIMIT}/hour"
