# clearPanel - Ubuntu/Zorin OS Deployment Guide

This guide walks you from a clean Ubuntu/Zorin OS system to a publicly reachable clearPanel control panel. Complete the quick start checklist to ensure the application runs on your LAN, then pick the exposure method that fits your environment.

---

## Quick Start: From Fresh VPS to Local Access

Follow these steps in order on the server. Skip any item you have already completed during an earlier installation.

1. **Prepare the Ubuntu/Zorin OS system.**
   ```bash
   sudo apt update
   sudo apt install -y curl git ufw software-properties-common
   # Add NodeSource repository for latest Node.js
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs nginx
   ```
   Enable the firewall and allow SSH: 
   ```bash
   sudo ufw allow OpenSSH
   sudo ufw enable
   ```

2. **Fetch or update the clearPanel source.**
   ```bash
   sudo mkdir -p /opt
   cd /opt
   sudo git clone https://github.com/SefionITServices/clearPanel.git clearpanel
   sudo chown -R $USER:$USER /opt/clearpanel
   cd /opt/clearpanel
   ```
   If the repository already exists, pull the latest changes: `git pull`.

3. **Install dependencies.**
   ```bash
   cd /opt/clearpanel/backend
   npm install
   cd /opt/clearpanel/frontend
   npm install
   ```

4. **Configure environment variables.**
   ```bash
   cd /opt/clearpanel/backend
   cp .env.example .env
   nano .env
   ```
   Update at least the following values:
   - `ADMIN_USERNAME` and `ADMIN_PASSWORD`
   - `SESSION_SECRET` (use `openssl rand -hex 32`)
   - `ROOT_PATH`, `DOMAINS_ROOT`, and `SERVER_IP`
   - `PORT` if you need something other than `3334`

5. **Build application artifacts.**
   ```bash
   cd /opt/clearpanel/frontend
   npm run build

   cd /opt/clearpanel/backend
   npm run build
   mkdir -p public
   cp -r ../frontend/dist/* public/
   ```

6. **Start the backend service.**
   ```bash
   cd /opt/clearpanel/backend
   mkdir -p logs
   node dist/main.js > logs/backend.log 2>&1 &
   echo $! > clearpanel.pid
   ```
   The helper scripts (`start-backend.sh`, `start-online.sh`) contain hard-coded paths. Update them to match `/opt/clearpanel` (or your chosen location) before using them.

7. **Verify local access.**
   ```bash
   curl http://localhost:3334/api/auth/status
   hostname -I
   ```
   You should see a `200 OK` from the API and record the local LAN IP (for example `192.168.1.50`).

8. **Choose an exposure method.**
   - [Method 1](#method-1-simple-port-forwarding-quick): home/office router with public IP
   - [Method 2](#method-2-production-setup-with-nginx--ssl-recommended): production VPS with domain name and HTTPS
   - [Method 3](#method-3-ngrok-no-router-changes): temporary or CGNAT environments

---

## Method 1: Simple Port Forwarding (Quick)

Use this when you control the router and only need HTTP access on port `3334`.

1. **Confirm the service is listening.**
   ```bash
   sudo ss -tulpn | grep 3334
   ```
   You should see `node` bound to `0.0.0.0:3334`.

2. **Allow traffic through the server firewall.**
   - **ufw (Ubuntu/Debian):**
     ```bash
     sudo ufw allow 3334/tcp
     sudo ufw reload
     sudo ufw status | grep 3334
     ```
   - **firewalld (CentOS/AlmaLinux/RHEL):**
     ```bash
     sudo firewall-cmd --permanent --add-port=3334/tcp
     sudo firewall-cmd --reload
     sudo firewall-cmd --list-ports | grep 3334
     ```
     If `firewall-cmd` is missing, install and enable firewalld first:
     - Debian/Ubuntu: `sudo apt install firewalld && sudo systemctl enable --now firewalld`
     - RHEL/CentOS/Fedora: `sudo dnf install firewalld && sudo systemctl enable --now firewalld`

3. **Create a router port-forwarding rule.**
   1. Open the router admin page (often `http://192.168.1.1`).
   2. Locate the Port Forwarding/Virtual Server section.
   3. Add a rule:
      - **External Port:** `3334`
      - **Internal IP:** the LAN address from `hostname -I`
      - **Internal Port:** `3334`
      - **Protocol:** `TCP`
   4. Apply and reboot the router if required.

4. **Verify from an external network.**
   ```bash
   curl http://<your-public-ip>:3334/api/auth/status
   ```
   Replace `<your-public-ip>` with the address reported by `curl ifconfig.me`. You should receive a JSON status response. Test using mobile data or an external web-based HTTP checker.

---

## Method 2: Production Setup with Nginx + SSL (Recommended)

Choose this for long-lived deployments with a domain name, HTTPS, and process management.

1. **Install web server prerequisites.**
   - **Ubuntu/Debian:**
     ```bash
     sudo apt update
     sudo apt install -y nginx certbot python3-certbot-nginx
     ```
   - **CentOS/AlmaLinux/RHEL:**
     ```bash
     sudo dnf install -y nginx certbot python3-certbot-nginx
     ```

2. **Build the frontend and backend (repeat if code changes).**
   ```bash
   cd /opt/clearpanel/frontend
   npm run build

   cd /opt/clearpanel/backend
   npm run build
   mkdir -p public
   cp -r ../frontend/dist/* public/
   ```

3. **Configure nginx as a reverse proxy.**
   ```bash
    sudo cp /opt/clearpanel/nginx.conf.example /etc/nginx/sites-available/clearpanel
   sudo nano /etc/nginx/sites-available/clearpanel
   ```
   Update `server_name`, SSL certificate paths, and upstream paths to match your environment. Then enable the site:
   ```bash
    sudo ln -s /etc/nginx/sites-available/clearpanel /etc/nginx/sites-enabled/clearpanel
   sudo nginx -t
   sudo systemctl reload nginx
   ```

4. **Issue certificates.**
   - **Let's Encrypt:** `sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com`
   - **Self-signed (lab use):**
     ```bash
     sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout /etc/ssl/private/clearpanel.key \
       -out /etc/ssl/certs/clearpanel.crt
     ```

5. **Run clearPanel under PM2.**
   ```bash
   sudo npm install -g pm2
   cd /opt/clearpanel/backend
   pm2 start dist/main.js --name clearpanel
   pm2 startup
   pm2 save
   ```
   After `pm2 startup`, copy and run the `sudo env ... pm2 startup` command that PM2 prints, then verify with `pm2 status clearpanel`.

6. **Open required firewall ports.**
   - **ufw:**
     ```bash
     sudo ufw allow 'Nginx Full'
     sudo ufw allow 3334/tcp    # optional if you still want direct access
     sudo ufw reload
     ```
   - **firewalld:**
     ```bash
     sudo firewall-cmd --permanent --add-service=http
     sudo firewall-cmd --permanent --add-service=https
     sudo firewall-cmd --permanent --add-port=3334/tcp
     sudo firewall-cmd --reload
     ```

7. **Validate the full stack.**
   ```bash
   curl -I https://yourdomain.com
   pm2 logs clearpanel --lines 20
   sudo tail -f /var/log/nginx/access.log
   ```
   Confirm you receive `200 OK` over HTTPS and there are no PM2 or nginx errors.

---

## Method 3: ngrok (No Router Changes)

Ideal for development, demos, or environments behind CGNAT where inbound ports are blocked.

1. **Install ngrok.**
   ```bash
   curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
   echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
   sudo apt update && sudo apt install -y ngrok
   ```
   On RPM-based systems: `sudo dnf install -y ngrok` after adding the official repository from the ngrok docs.

2. **Authenticate ngrok.**
   ```bash
   ngrok config add-authtoken YOUR_AUTH_TOKEN
   ```

3. **Start the backend (if not already running).**
   ```bash
   cd /opt/clearpanel/backend
   mkdir -p logs
   node dist/main.js > logs/backend.log 2>&1 &
   ```

4. **Launch the tunnel.**
   ```bash
   ngrok http 3334
   ```
   ngrok prints a forwarding URL (for example `https://abc123.ngrok.io`). Share this URL to access clearPanel externally.

5. **Keep the session alive.**
   Leave the ngrok process running. For unattended use, run it inside a `tmux` or `screen` session.

---

## Security Checklist

⚠️ **Complete these before exposing the panel to the internet.**

1. **Change credentials and secrets.**
   ```bash
   cd /opt/clearpanel/backend
   nano .env
   # Update ADMIN_USERNAME, ADMIN_PASSWORD, SESSION_SECRET
   ```
2. **Enforce HTTPS** when serving to the public (Method 2).
3. **Limit firewall exposure** to only required ports (typically 80/443 and optionally 3334).
4. **Apply updates** regularly (`sudo apt upgrade` or `sudo dnf upgrade`).
5. **Monitor logs** (`pm2 logs`, `/var/log/nginx/*`, `logs/backend.log`).
6. **Implement rate limiting** on nginx (`limit_req_zone`) or via a WAF/CDN.
7. **Back up critical data**: `backend/dns.json`, `backend/domains.json`, and the domain root directories.

---

## Troubleshooting

- **`firewall-cmd: command not found`:** install firewalld (`sudo apt install firewalld` or `sudo dnf install firewalld`) and enable it with `sudo systemctl enable --now firewalld`.
- **Can access locally but not externally:** confirm router rule, verify firewall (`sudo ufw status` or `sudo firewall-cmd --list-all`), and check the public IP (`curl ifconfig.me`).
- **Backend fails to start:**
  ```bash
   tail -n 100 /opt/clearpanel/backend/logs/backend.log
  sudo lsof -ti:3334 | xargs sudo kill -9
   cd /opt/clearpanel/backend && npm run build
  ```
- **nginx shows 502/504:** ensure PM2 process is running (`pm2 status clearpanel`) and the upstream port matches `PORT` in `.env` and `nginx.conf`.
- **Certificates fail to issue:** double-check DNS records point to the server and port 80 is open before running `certbot`.

---

## Daily Management Commands

```bash
# Start (manual)
cd /opt/clearpanel/backend && node dist/main.js > logs/backend.log 2>&1 &

# Using PM2
pm2 start clearpanel
pm2 restart clearpanel
pm2 stop clearpanel
pm2 logs clearpanel

# Using helper script (update paths first)
./start-online.sh

# Stop manual background process
kill $(cat /opt/clearpanel/backend/clearpanel.pid)

# Check status
curl http://localhost:3334/api/auth/status
pm2 status
```

---

## Reference Configuration Values

- **Backend Port:** `3334` (changeable via `.env`)
- **Installation Path (example):** `/opt/clearpanel`
- **Domains Root (example):** `/opt/clearpanel-data/domains`
- **Direct LAN URL:** `http://<local-ip>:3334`
- **Public URL (Method 1):** `http://<public-ip>:3334`
- **Reverse Proxy URL (Method 2):** `https://yourdomain.com`
- **ngrok URL (Method 3):** `https://<random>.ngrok.io`
