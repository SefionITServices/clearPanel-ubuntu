# clearPanel Quick Start Guide

Get your hosting control panel running in 5 minutes.

## Prerequisites

- VPS with Ubuntu/Debian or CentOS/AlmaLinux
- Public IP address
- Root or sudo access
- Domain name (optional for initial setup)

## Installation

### 1. Clone Repository

```bash
cd /opt
sudo git clone https://github.com/SefionITServices/clearPanel.git clearPanel
cd clearPanel
```

### 2. Run Installer

```bash
sudo chmod +x install.sh
sudo ./install.sh
```

The installer automatically:
- âœ… Installs Node.js and dependencies
- âœ… Creates backend environment file
- âœ… Builds the application
- âœ… Sets up systemd service
- âœ… Starts the panel

### 3. Configure Environment

Edit the configuration:

```bash
sudo nano backend/.env
```

**Required changes:**
```env
# Set your VPS public IP
SERVER_IP=your.vps.ip.address

# Change admin credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=YourStrongPassword123!

# Generate secure session secret
SESSION_SECRET=run_openssl_rand_-hex_32
```

Save and restart:

```bash
sudo systemctl restart clearPanel
```

### 4. Configure Firewall

**Ubuntu/Debian:**
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 53/tcp
sudo ufw allow 53/udp
sudo ufw allow 3334/tcp  # Backend port
sudo ufw reload
```

**CentOS/AlmaLinux:**
```bash
sudo firewall-cmd --add-service=http --permanent
sudo firewall-cmd --add-service=https --permanent
sudo firewall-cmd --add-service=dns --permanent
sudo firewall-cmd --add-port=3334/tcp --permanent
sudo firewall-cmd --reload
```

### 5. Install DNS Server (Recommended)

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y bind9 bind9utils
sudo systemctl enable bind9
sudo systemctl start bind9
```

**CentOS/AlmaLinux:**
```bash
sudo dnf install -y bind bind-utils
sudo systemctl enable named
sudo systemctl start named
```

### 6. Access Panel

Open browser:
```
http://your-vps-ip:3334
```

Login with your credentials from `.env`

## First Steps

### Create Your First Domain

1. **Login** to clearPanel
2. **Navigate** to Domains â†’ Add Domain
3. **Enter** domain name (e.g., `mywebsite.com`)
4. **Click** Create Domain

clearPanel automatically:
- Creates domain folder
- Configures nginx virtual host
- Creates DNS zone with nameservers
- Provides setup instructions

### Configure Domain at Registrar

From the nameserver instructions provided:

**Step 1: Create Glue Records**
- Go to your domain registrar
- Find "Nameservers" or "Glue Records" settings
- Add:
  - `ns1.mywebsite.com` â†’ `your-vps-ip`
  - `ns2.mywebsite.com` â†’ `your-vps-ip`

**Step 2: Set Custom Nameservers**
- Change nameservers to:
  - Primary: `ns1.mywebsite.com`
  - Secondary: `ns2.mywebsite.com`

**Step 3: Wait for Propagation**
- Allow 24-48 hours for DNS to propagate worldwide
- Some registrars are faster (1-4 hours)

### Upload Website Files

1. **Go to** File Manager
2. **Navigate** to `/Domains/mywebsite.com/`
3. **Upload** your website files
4. **Create** `index.html` if needed

### Test DNS Resolution

After propagation period:

```bash
# Test direct query to your VPS
dig @your-vps-ip mywebsite.com

# Test public DNS
dig mywebsite.com

# Use nslookup
nslookup mywebsite.com
```

Expected output:
```
mywebsite.com.  86400  IN  A  your-vps-ip
```

### Visit Your Website

```
http://mywebsite.com
```

## Optional: Set Up Nginx Reverse Proxy

For production with SSL:

### 1. Install Nginx

**Ubuntu/Debian:**
```bash
sudo apt-get install -y nginx
```

**CentOS/AlmaLinux:**
```bash
sudo dnf install -y nginx
```

### 2. Configure Panel Access

```bash
sudo nano /etc/nginx/sites-available/clearPanel
```

Add:
```nginx
server {
    listen 80;
    server_name panel.yourdomain.com;

    location / {
        proxy_pass http://localhost:3334;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable and restart:
```bash
sudo ln -s /etc/nginx/sites-available/clearPanel /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 3. Install SSL Certificate

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d panel.yourdomain.com
```

Now access via:
```
https://panel.yourdomain.com
```

## Optional: Cloudflare Tunnel (for CGNAT/Home)

If you can't open ports or are behind CGNAT:

### 1. Install Cloudflared

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
sudo mv cloudflared /usr/local/bin/
sudo chmod +x /usr/local/bin/cloudflared
```

### 2. Authenticate

```bash
cloudflared tunnel login
```

### 3. Create Tunnel

```bash
cloudflared tunnel create clearPanel
```

### 4. Configure DNS

```bash
cloudflared tunnel route dns clearPanel panel.yourdomain.com
```

### 5. Create Config

```bash
sudo mkdir -p /etc/cloudflared
sudo nano /etc/cloudflared/config.yml
```

Add:
```yaml
tunnel: <tunnel-id-from-step-3>
credentials-file: /root/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: panel.yourdomain.com
    service: http://localhost:3334
  - service: http_status:404
```

### 6. Start Service

```bash
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

Access via:
```
https://panel.yourdomain.com
```

## Verify Installation

### Check Services

```bash
# Check clearPanel backend
sudo systemctl status clearPanel

# Check BIND9 DNS
sudo systemctl status bind9  # or named

# Check nginx (if installed)
sudo systemctl status nginx

# Check cloudflared (if installed)
sudo systemctl status cloudflared
```

### Check Logs

```bash
# clearPanel logs
sudo journalctl -u clearPanel -f

# DNS logs
sudo journalctl -u bind9 -f  # or named

# Nginx logs
sudo tail -f /var/log/nginx/error.log
```

### Test API

```bash
# Check DNS server status
curl http://localhost:3334/api/dns-server/status

# Check domains (requires auth)
curl http://localhost:3334/api/domains
```

## Common Commands

### Service Management

```bash
# Restart clearPanel
sudo systemctl restart clearPanel

# Restart DNS server
sudo systemctl restart bind9  # or named

# Reload nginx
sudo systemctl reload nginx

# View clearPanel logs
sudo journalctl -u clearPanel -n 50
```

### DNS Operations

```bash
# Check zone syntax
sudo named-checkzone example.com /etc/bind/zones/db.example.com

# Check BIND config
sudo named-checkconf

# Test DNS query
dig @localhost example.com
```

### File Permissions

```bash
# Fix domain folder permissions
sudo chown -R sefion:sefion /home/sefion/Domains/

# Fix clearPanel permissions
sudo chown -R clearPanel:clearPanel /opt/clearPanel/
```

## Troubleshooting

### Panel won't start

```bash
# Check logs
sudo journalctl -u clearPanel -n 50

# Test manually
cd /opt/clearPanel/backend
node dist/main.js

# Check port conflicts
sudo netstat -tulpn | grep 3334
```

### DNS not resolving

```bash
# Check BIND running
sudo systemctl status bind9

# Test local query
dig @localhost yourdomain.com

# Check zone file
sudo cat /etc/bind/zones/db.yourdomain.com

# Check BIND logs
sudo journalctl -u bind9 -n 50
```

### Can't access via browser

```bash
# Check firewall
sudo ufw status  # or firewall-cmd --list-all

# Check service running
sudo systemctl status clearPanel

# Check nginx (if used)
sudo nginx -t
sudo systemctl status nginx
```

### Domain creation fails

```bash
# Check clearPanel logs
sudo journalctl -u clearPanel -f

# Try creating manually:
sudo mkdir -p /home/sefion/Domains/testdomain.com

# Check permissions
ls -la /home/sefion/Domains/
```

## Next Steps

1. âœ… **Add more domains** via Domains â†’ Add Domain
2. âœ… **Manage DNS records** via DNS editor
3. âœ… **Upload website files** via File Manager
4. âœ… **Set up email** (coming soon)
5. âœ… **Configure SSL** for hosted domains
6. âœ… **Set up backups** for critical data
7. âœ… **Monitor resources** (coming soon)

## Resources

- [Full Documentation](../README.md)
- [DNS Server Guide](DNS-SERVER.md)
- [Connectivity Options](CONNECTIVITY.md)
- [Installation Guide](INSTALLATION.md)

## Get Help

- Check logs: `sudo journalctl -u clearPanel -f`
- Test API: `curl http://localhost:3334/api/dns-server/status`
- GitHub Issues: Report bugs and request features

---

**Welcome to clearPanel!** You're now running your own hosting control panel. ðŸŽ‰

