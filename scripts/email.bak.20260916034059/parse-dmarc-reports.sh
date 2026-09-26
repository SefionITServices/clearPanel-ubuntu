#!/usr/bin/env bash
# parse-dmarc-reports.sh — Parse DMARC aggregate reports (XML)
# Usage: parse-dmarc-reports.sh <action> [args...]
#   parse-dmarc-reports.sh fetch <domain>          — list parsed DMARC reports
#   parse-dmarc-reports.sh summary <domain>        — get summary stats
#   parse-dmarc-reports.sh ingest <domain> <file>  — parse & store a report XML
#
# Dual-mode: MAIL_MODE=dev (JSON state) vs production (real report files)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

ACTION="${1:?Usage: parse-dmarc-reports.sh <fetch|summary|ingest> <domain> [file]}"
DOMAIN="${2:?domain required}"

STATE_DIR="${MAIL_STATE_DIR:-$SCRIPT_DIR/../../backend/mail-state}"
REPORT_DIR="$STATE_DIR/dmarc-reports/$DOMAIN"
mkdir -p "$REPORT_DIR"

parse_xml_report() {
  local FILE="$1"
  # Use python3 if available for XML parsing, otherwise awk
  if command -v python3 &>/dev/null; then
    python3 - "$FILE" << 'PYEOF'
import sys, xml.etree.ElementTree as ET, json, os

f = sys.argv[1]
try:
    tree = ET.parse(f)
    root = tree.getroot()
    
    meta = root.find('.//report_metadata') or root.find('report_metadata')
    policy = root.find('.//policy_published') or root.find('policy_published')
    
    org = meta.findtext('org_name', '') if meta is not None else ''
    report_id = meta.findtext('report_id', '') if meta is not None else ''
    date_begin = meta.findtext('.//date_range/begin', '') if meta is not None else ''
    date_end = meta.findtext('.//date_range/end', '') if meta is not None else ''
    
    domain = policy.findtext('domain', '') if policy is not None else ''
    p = policy.findtext('p', '') if policy is not None else ''
    sp = policy.findtext('sp', '') if policy is not None else ''
    pct = policy.findtext('pct', '100') if policy is not None else '100'
    
    records = []
    for rec in root.findall('.//record'):
        row = rec.find('row')
        auth = rec.find('auth_results')
        ip = row.findtext('source_ip', '') if row else ''
        count = int(row.findtext('count', '0')) if row else 0
        disposition = row.findtext('.//policy_evaluated/disposition', '') if row else ''
        dkim_eval = row.findtext('.//policy_evaluated/dkim', '') if row else ''
        spf_eval = row.findtext('.//policy_evaluated/spf', '') if row else ''
        
        dkim_result = ''
        spf_result = ''
        if auth is not None:
            d = auth.find('dkim')
            s = auth.find('spf')
            dkim_result = d.findtext('result', '') if d is not None else ''
            spf_result = s.findtext('result', '') if s is not None else ''
        
        records.append({
            'sourceIp': ip,
            'count': count,
            'disposition': disposition,
            'dkimEval': dkim_eval,
            'spfEval': spf_eval,
            'dkimResult': dkim_result,
            'spfResult': spf_result,
        })
    
    report = {
        'org': org,
        'reportId': report_id,
        'dateBegin': date_begin,
        'dateEnd': date_end,
        'domain': domain,
        'policy': p,
        'subdomainPolicy': sp,
        'pct': int(pct),
        'records': records,
        'totalMessages': sum(r['count'] for r in records),
        'passCount': sum(r['count'] for r in records if r['dkimEval'] == 'pass' and r['spfEval'] == 'pass'),
        'failCount': sum(r['count'] for r in records if r['dkimEval'] == 'fail' or r['spfEval'] == 'fail'),
    }
    print(json.dumps(report))
except Exception as e:
    print(json.dumps({'error': str(e)}))
PYEOF
  else
    echo '{"error":"python3 required for XML parsing"}'
  fi
}

case "$ACTION" in
  ingest)
    FILE="${3:?file path required}"
    if [[ ! -f "$FILE" ]]; then
      echo "{\"error\":\"File not found: $FILE\"}" >&2
      exit 1
    fi

    # Handle gzipped files
    TMP_FILE="$FILE"
    if [[ "$FILE" == *.gz ]]; then
      TMP_FILE=$(mktemp)
      gunzip -c "$FILE" > "$TMP_FILE"
    fi

    PARSED=$(parse_xml_report "$TMP_FILE")
    REPORT_ID=$(echo "$PARSED" | python3 -c "import sys,json; print(json.load(sys.stdin).get('reportId','unknown'))" 2>/dev/null || echo "unknown")
    echo "$PARSED" > "$REPORT_DIR/${REPORT_ID}.json"

    [[ "$FILE" == *.gz ]] && rm -f "$TMP_FILE"
    log_info "Ingested DMARC report $REPORT_ID for $DOMAIN"
    echo "$PARSED"
    ;;

  fetch)
    echo "["
    FIRST=true
    for f in "$REPORT_DIR"/*.json; do
      [[ -f "$f" ]] || continue
      if $FIRST; then FIRST=false; else echo ","; fi
      cat "$f"
    done
    echo "]"
    ;;

  summary)
    if command -v python3 &>/dev/null; then
      python3 - "$REPORT_DIR" << 'PYEOF'
import sys, json, os, glob

rdir = sys.argv[1]
reports = []
for f in glob.glob(os.path.join(rdir, '*.json')):
    try:
        with open(f) as fh:
            reports.append(json.load(fh))
    except:
        pass

total = sum(r.get('totalMessages', 0) for r in reports)
passed = sum(r.get('passCount', 0) for r in reports)
failed = sum(r.get('failCount', 0) for r in reports)
orgs = list(set(r.get('org', '') for r in reports if r.get('org')))

# Collect unique source IPs with counts
ip_map = {}
for r in reports:
    for rec in r.get('records', []):
        ip = rec.get('sourceIp', '')
        if ip:
            ip_map[ip] = ip_map.get(ip, 0) + rec.get('count', 0)

top_senders = sorted(ip_map.items(), key=lambda x: -x[1])[:10]

summary = {
    'reportCount': len(reports),
    'totalMessages': total,
    'passCount': passed,
    'failCount': failed,
    'passRate': round(passed / total * 100, 1) if total > 0 else 0,
    'organizations': orgs,
    'topSenders': [{'ip': ip, 'count': c} for ip, c in top_senders],
}
print(json.dumps(summary))
PYEOF
    else
      echo '{"error":"python3 required"}'
    fi
    ;;

  *)
    echo "Unknown action: $ACTION" >&2
    exit 1
    ;;
esac
