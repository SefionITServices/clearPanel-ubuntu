#!/bin/bash
# ─────────────────────────────────────────────────────────────────────
# clearPanel — Backup & Restore Utility
# ─────────────────────────────────────────────────────────────────────
# Usage:
#   ./backup-restore.sh backup              — Create a full backup
#   ./backup-restore.sh restore <archive>   — Restore from a backup
#   ./backup-restore.sh list                — List available backups
# ─────────────────────────────────────────────────────────────────────
set -e

INSTALL_DIR="/opt/clearpanel"
BACKEND_DIR="$INSTALL_DIR/backend"
BACKUP_ROOT="$INSTALL_DIR/backups"
SERVICE_NAME="clearpanel"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

# Read DATA_DIR from .env
ENV_FILE="$BACKEND_DIR/.env"
DATA_DIR=""
if [[ -f "$ENV_FILE" ]]; then
    DATA_DIR=$(grep '^DATA_DIR=' "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 || true)
fi
if [[ -z "$DATA_DIR" ]]; then
    DATA_DIR="$INSTALL_DIR/data"
fi

# ── backup ───────────────────────────────────────────────────────────
do_backup() {
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    SNAP_DIR="$BACKUP_ROOT/manual_$TIMESTAMP"
    ARCHIVE="$BACKUP_ROOT/clearpanel-backup_$TIMESTAMP.tar.gz"

    echo -e "${CYAN}Creating clearPanel backup...${NC}"
    mkdir -p "$SNAP_DIR"

    # 1. .env
    cp -p "$ENV_FILE" "$SNAP_DIR/.env" 2>/dev/null || true

    # 2. Bootstrap data (setup-status.json)
    [[ -d "$INSTALL_DIR/data" ]] && cp -rp "$INSTALL_DIR/data" "$SNAP_DIR/bootstrap_data" 2>/dev/null || true

    # 3. User data (DATA_DIR — domains.json, dns.json, server-settings.json, mail-domains.json, etc.)
    if [[ -d "$DATA_DIR" && "$DATA_DIR" != "$INSTALL_DIR/data" ]]; then
        cp -rp "$DATA_DIR" "$SNAP_DIR/user_data" 2>/dev/null || true
    fi

    # 4. Mail state (production: /etc/clearpanel/mail, dev: backend/mail-state)
    for DIR in "$BACKEND_DIR/mail-state" "/etc/clearpanel/mail"; do
        if [[ -d "$DIR" ]]; then
            cp -rp "$DIR" "$SNAP_DIR/mail-state" 2>/dev/null || true
            break
        fi
    done

    # 5. Mail policies
    [[ -d "$BACKEND_DIR/mail-policies" ]] && cp -rp "$BACKEND_DIR/mail-policies" "$SNAP_DIR/mail-policies" 2>/dev/null || true

    # 6. BIND9 zone files
    [[ -d "/etc/bind/zones" ]] && sudo cp -rp "/etc/bind/zones" "$SNAP_DIR/bind-zones" 2>/dev/null || true

    # 7. Nginx vhosts
    [[ -d "/etc/nginx/sites-available" ]] && sudo cp -rp "/etc/nginx/sites-available" "$SNAP_DIR/nginx-sites" 2>/dev/null || true

    # 8. SSL certificates (Let's Encrypt)
    [[ -d "/etc/letsencrypt" ]] && sudo cp -rp "/etc/letsencrypt" "$SNAP_DIR/letsencrypt" 2>/dev/null || true

    # Create compressed archive
    cd "$BACKUP_ROOT"
    tar czf "$ARCHIVE" -C "$SNAP_DIR" .
    rm -rf "$SNAP_DIR"

    SIZE=$(du -h "$ARCHIVE" | cut -f1)
    echo -e "${GREEN}✅ Backup complete: $ARCHIVE ($SIZE)${NC}"
    echo ""
    echo "To restore, run:"
    echo "  ./backup-restore.sh restore $ARCHIVE"
}

# ── restore ──────────────────────────────────────────────────────────
do_restore() {
    ARCHIVE="$1"
    if [[ ! -f "$ARCHIVE" ]]; then
        echo -e "${RED}Backup file not found: $ARCHIVE${NC}"
        exit 1
    fi

    echo -e "${YELLOW}⚠️  This will overwrite current data with the backup.${NC}"
    read -rp "Are you sure? (y/N): " CONFIRM
    if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
        echo "Cancelled."
        exit 0
    fi

    TEMP_DIR=$(mktemp -d)
    tar xzf "$ARCHIVE" -C "$TEMP_DIR"

    echo -e "${YELLOW}Stopping clearPanel service...${NC}"
    sudo systemctl stop "$SERVICE_NAME" 2>/dev/null || true

    # Restore .env
    if [[ -f "$TEMP_DIR/.env" ]]; then
        cp -p "$TEMP_DIR/.env" "$ENV_FILE"
        chown clearpanel:clearpanel "$ENV_FILE"
        chmod 600 "$ENV_FILE"
        echo -e "${GREEN}✓ .env restored${NC}"
    fi

    # Re-read DATA_DIR from restored .env
    DATA_DIR=$(grep '^DATA_DIR=' "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 || true)
    [[ -z "$DATA_DIR" ]] && DATA_DIR="$INSTALL_DIR/data"

    # Restore bootstrap data
    if [[ -d "$TEMP_DIR/bootstrap_data" ]]; then
        mkdir -p "$INSTALL_DIR/data"
        cp -rp "$TEMP_DIR/bootstrap_data/"* "$INSTALL_DIR/data/" 2>/dev/null || true
        chown -R clearpanel:clearpanel "$INSTALL_DIR/data"
        echo -e "${GREEN}✓ Bootstrap data restored${NC}"
    fi

    # Restore user data
    if [[ -d "$TEMP_DIR/user_data" ]]; then
        mkdir -p "$DATA_DIR"
        cp -rp "$TEMP_DIR/user_data/"* "$DATA_DIR/" 2>/dev/null || true
        chown -R clearpanel:clearpanel "$DATA_DIR"
        echo -e "${GREEN}✓ User data restored (DATA_DIR)${NC}"
    fi

    # Restore mail state
    if [[ -d "$TEMP_DIR/mail-state" ]]; then
        MAIL_STATE_TARGET="/etc/clearpanel/mail"
        [[ ! -d "$MAIL_STATE_TARGET" ]] && MAIL_STATE_TARGET="$BACKEND_DIR/mail-state"
        mkdir -p "$MAIL_STATE_TARGET"
        cp -rp "$TEMP_DIR/mail-state/"* "$MAIL_STATE_TARGET/" 2>/dev/null || true
        echo -e "${GREEN}✓ Mail state restored${NC}"
    fi

    # Restore mail policies
    if [[ -d "$TEMP_DIR/mail-policies" ]]; then
        mkdir -p "$BACKEND_DIR/mail-policies"
        cp -rp "$TEMP_DIR/mail-policies/"* "$BACKEND_DIR/mail-policies/" 2>/dev/null || true
        echo -e "${GREEN}✓ Mail policies restored${NC}"
    fi

    # Restore BIND zones
    if [[ -d "$TEMP_DIR/bind-zones" ]]; then
        sudo cp -rp "$TEMP_DIR/bind-zones/"* /etc/bind/zones/ 2>/dev/null || true
        sudo chown -R root:bind /etc/bind/zones
        echo -e "${GREEN}✓ DNS zones restored${NC}"
    fi

    # Restore nginx vhosts
    if [[ -d "$TEMP_DIR/nginx-sites" ]]; then
        sudo cp -rp "$TEMP_DIR/nginx-sites/"* /etc/nginx/sites-available/ 2>/dev/null || true
        sudo nginx -t && sudo systemctl reload nginx
        echo -e "${GREEN}✓ Nginx vhosts restored${NC}"
    fi

    # Restore SSL certs
    if [[ -d "$TEMP_DIR/letsencrypt" ]]; then
        sudo cp -rp "$TEMP_DIR/letsencrypt" /etc/
        echo -e "${GREEN}✓ SSL certificates restored${NC}"
    fi

    rm -rf "$TEMP_DIR"

    echo -e "${YELLOW}Restarting clearPanel...${NC}"
    sudo systemctl start "$SERVICE_NAME"
    sleep 3

    if sudo systemctl is-active --quiet "$SERVICE_NAME"; then
        echo -e "${GREEN}✅ Restore complete!  clearPanel is running.${NC}"
    else
        echo -e "${RED}⚠️  Service didn't start — check logs: sudo journalctl -u $SERVICE_NAME -n 50${NC}"
    fi
}

# ── list ─────────────────────────────────────────────────────────────
do_list() {
    echo -e "${CYAN}Available backups:${NC}"
    echo ""
    if [[ -d "$BACKUP_ROOT" ]]; then
        FOUND=false
        for f in "$BACKUP_ROOT"/*.tar.gz "$BACKUP_ROOT"/pre-update_*; do
            if [[ -e "$f" ]]; then
                FOUND=true
                SIZE=$(du -h "$f" 2>/dev/null | cut -f1)
                echo "  $f  ($SIZE)"
            fi
        done
        if [[ "$FOUND" = false ]]; then
            echo "  No backups found."
        fi
    else
        echo "  No backup directory found."
    fi
    echo ""
}

# ── main ─────────────────────────────────────────────────────────────
case "${1:-help}" in
    backup)
        do_backup
        ;;
    restore)
        if [[ -z "$2" ]]; then
            echo "Usage: $0 restore <archive-path>"
            exit 1
        fi
        do_restore "$2"
        ;;
    list)
        do_list
        ;;
    *)
        echo "clearPanel Backup & Restore"
        echo ""
        echo "Usage:"
        echo "  $0 backup              Create a full backup"
        echo "  $0 restore <archive>   Restore from a backup archive"
        echo "  $0 list                List available backups"
        ;;
esac
