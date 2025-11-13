# VPS Deployment Guide - Step by Step

Complete guide to deploy clearPanel on your VPS from scratch.

## Prerequisites

- VPS with Ubuntu 20.04+ or CentOS 8+ or AlmaLinux
- Root or sudo access
- Public IP address (e.g., 204.83.99.245)
- Domain name (optional, but recommended)
- SSH access to your VPS

## Step 1: Connect to Your VPS

```bash
# From your local machine
ssh root@204.83.99.245
# Or if using a non-root user:
ssh your-username@204.83.99.245
```

## Step 2: Update System

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get upgrade -y
```

**CentOS/AlmaLinux:**
```bash
sudo dnf update -y
```

## Step 3: Install Node.js 20.x

**Ubuntu/Debian:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**CentOS/AlmaLinux:**
```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
```

**Verify installation:**
```bash
node --version  # Should show v20.x.x
npm --version   # Should show 10.x.x or higher
```

## Step 4: Install Git

**Ubuntu/Debian:**
```bash
sudo apt-get install -y git
```

**CentOS/AlmaLinux:**
```bash
sudo dnf install -y git
```

## Step 5: Clone clearPanel Repository

```bash
cd /opt
sudo git clone https://github.com/SefionITServices/clearPanel.git clearpanel
cd clearpanel
```

## Step 6: Install Dependencies

```bash
# Install main dependencies
sudo npm install

# Install backend dependencies
cd backend
sudo npm install
```

## Step 7: Configure Environment

```bash
# Create environment file from example
sudo cp .env.example .env

# Edit the configuration
sudo nano .env
```

**Update these critical values:**
```env
PORT=3334

# IMPORTANT: Generate a secure secret!
SESSION_SECRET=GENERATE_NEW_SECRET_HERE

# IMPORTANT: Change these credentials!
ADMIN_USERNAME=admin
ADMIN_PASSWORD=YourStrongPassword123!

# Set your VPS public IP
SERVER_IP=204.83.99.245

# File and domain paths
ROOT_PATH=/home/sefion
DOMAINS_ROOT=/home/sefion/Domains

# Upload settings
ALLOWED_EXTENSIONS=*
MAX_FILE_SIZE=104857600
```

**Generate SESSION_SECRET:**
```bash
# Run this command and copy the output
openssl rand -hex 32
```

**Save and exit:** Press `Ctrl+X`, then `Y`, then `Enter`

## Step 8: Create System User

```bash
# Create user for running clearPanel
sudo useradd -r -s /bin/bash -d /home/sefion sefion

# Create home directory
sudo mkdir -p /home/sefion
sudo chown sefion:sefion /home/sefion

# Create domains directory
sudo mkdir -p /home/sefion/Domains
sudo chown -R sefion:sefion /home/sefion
```

## Step 9: Build Backend

```bash
cd /opt/clearpanel/backend
sudo npm run build
```

**Expected output:** Should see "Webpack compiled successfully"

## Step 10: Set Up Systemd Service

```bash
# Copy service file
sudo cp /opt/clearpanel/clearpanel.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable clearpanel

# Start the service
sudo systemctl start clearpanel

# Check status
sudo systemctl status clearpanel
```

**Expected output:** Should show "active (running)" in green

## Step 11: Configure Firewall

**Ubuntu/Debian (UFW):**
```bash
# Enable firewall if not already enabled
sudo ufw enable

# Allow SSH (IMPORTANT: Don't lock yourself out!)
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow DNS server
sudo ufw allow 53/tcp
sudo ufw allow 53/udp

# Allow backend port (optional, if accessing directly)
sudo ufw allow 3334/tcp

# Check status
sudo ufw status
```

**CentOS/AlmaLinux (firewalld):**
```bash
# Enable firewall
sudo systemctl enable firewalld
sudo systemctl start firewalld

# Allow HTTP/HTTPS
sudo firewall-cmd --add-service=http --permanent
sudo firewall-cmd --add-service=https --permanent

# Allow DNS
sudo firewall-cmd --add-service=dns --permanent

# Allow backend port (optional)
sudo firewall-cmd --add-port=3334/tcp --permanent

# Reload firewall
sudo firewall-cmd --reload

# Check status
sudo firewall-cmd --list-all
```

## Step 12: Install Nginx

**Ubuntu/Debian:**
```bash
sudo apt-get install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

**CentOS/AlmaLinux:**
```bash
sudo dnf install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

## Step 13: Configure Nginx Reverse Proxy

**Create nginx configuration:**
```bash
sudo nano /etc/nginx/sites-available/clearpanel
```

**Paste this configuration:**
```nginx
server {
    listen 80;
    server_name 204.83.99.245;  # Your VPS IP or domain

        proxy_pass http://localhost:3334;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Increase timeout for large file uploads
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
     cp /opt/clearpanel/backend/.env $BACKUP_DIR/env_$DATE.bak
    }
}
```

**For Ubuntu/Debian (using sites-enabled):**
```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/clearpanel /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default
     sudo chmod +x /opt/clearpanel/backup.sh
# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

**For CentOS/AlmaLinux:**
```bash
# Copy to conf.d
sudo cp /etc/nginx/sites-available/clearpanel /etc/nginx/conf.d/clearpanel.conf

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

## Step 14: Install BIND9 DNS Server

**Ubuntu/Debian:**
```bash
sudo apt-get install -y bind9 bind9utils bind9-doc
sudo systemctl enable bind9
sudo systemctl start bind9
```

**CentOS/AlmaLinux:**
```bash
sudo dnf install -y bind bind-utils
sudo systemctl enable named
sudo systemctl start named
```

**Verify DNS server:**
```bash
# Check service status
sudo systemctl status bind9  # or 'named' on CentOS

# Test DNS query
dig @localhost google.com
```

## Step 15: Access clearPanel

**Open your browser and navigate to:**
```
http://204.83.99.245
```

**Login with credentials from your `.env` file:**
- Username: admin (or what you set)
- Password: Your password from .env

## Step 16: Verify Installation

**Check all services are running:**
```bash
# clearPanel backend
sudo systemctl status clearpanel

# Nginx web server
sudo systemctl status nginx

# BIND9 DNS server
sudo systemctl status bind9  # or 'named'
```

**Check logs if needed:**
```bash
# clearPanel logs
sudo journalctl -u clearpanel -n 50

# Nginx logs
sudo tail -f /var/log/nginx/error.log

# BIND9 logs
sudo journalctl -u bind9 -n 50  # or 'named'
```

**Test DNS server API:**
```bash
curl http://localhost:3334/api/dns-server/status
```

**Expected response:**
```json
{
  "installed": true,
  "running": true,
  "version": "BIND 9.x.x",
  "zonesPath": "/etc/bind/zones",
  "namedConfPath": "/etc/bind/named.conf.local"
}
```

## Step 17: Create Your First Domain

**Via Web Interface:**
1. Login to clearPanel
2. Click "Domains" in sidebar
3. Click "Add Domain" button
4. Enter your domain name (e.g., `mywebsite.com`)
5. Click "Create Domain"
6. Copy the nameserver instructions provided

**Via API (alternative):**
```bash
# First login to get session cookie
curl -X POST http://localhost:3334/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"YourPassword"}'

# Then create domain (use cookie from above)
curl -X POST http://localhost:3334/api/domains \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  -d '{"domain":"mywebsite.com"}'
```

## Step 18: Configure Domain at Registrar

After creating your domain, follow these steps at your domain registrar (GoDaddy, Namecheap, etc.):

### A. Create Glue Records

1. Login to your domain registrar
2. Find your domain settings
3. Look for "Nameservers" or "Glue Records" or "Host Records"
4. Add these glue records:

```
Hostname: ns1.mywebsite.com
IP Address: 204.83.99.245

Hostname: ns2.mywebsite.com
IP Address: 204.83.99.245
```

### B. Set Custom Nameservers

1. Change nameservers from registrar's default to custom
2. Set:
   - Primary Nameserver: `ns1.mywebsite.com`
   - Secondary Nameserver: `ns2.mywebsite.com`

### C. Wait for Propagation

- DNS changes take 24-48 hours to propagate worldwide
- Some registrars are faster (1-4 hours)

## Step 19: Upload Website Files

**Via File Manager (Web Interface):**
1. Click "Files" in sidebar
2. Navigate to `/Domains/mywebsite.com/`
3. Click "Upload" button
4. Select your website files
5. Upload

**Via SCP (from local machine):**
```bash
scp -r ./my-website/* root@204.83.99.245:/home/sefion/Domains/mywebsite.com/
```

**Via SFTP:**
```bash
sftp root@204.83.99.245
cd /home/sefion/Domains/mywebsite.com/
put -r ./my-website/*
```

## Step 20: Verify DNS Resolution

**After propagation period, test DNS:**

```bash
# Test direct query to your VPS
dig @204.83.99.245 mywebsite.com

# Test public DNS (after propagation)
dig mywebsite.com

# Check with nslookup
nslookup mywebsite.com

# Check nameservers
dig NS mywebsite.com
```

**Expected output:**
```
mywebsite.com.  86400  IN  A  204.83.99.245

;; AUTHORITY SECTION:
mywebsite.com.  86400  IN  NS  ns1.mywebsite.com.
mywebsite.com.  86400  IN  NS  ns2.mywebsite.com.
```

## Step 21: Install SSL Certificate (Optional but Recommended)

**Install Certbot:**

**Ubuntu/Debian:**
```bash
sudo apt-get install -y certbot python3-certbot-nginx
```

**CentOS/AlmaLinux:**
```bash
sudo dnf install -y certbot python3-certbot-nginx
```

**Get SSL certificate:**
```bash
# For clearPanel access
sudo certbot --nginx -d panel.yourdomain.com

# For hosted websites
sudo certbot --nginx -d mywebsite.com -d www.mywebsite.com
```

**Auto-renewal is configured automatically by certbot**

**Test renewal:**
```bash
sudo certbot renew --dry-run
```

## Step 22: Set Up Automatic Backups (Optional)

**Create backup script:**
```bash
sudo nano /opt/clearpanel/backup.sh
```

**Add this script:**
```bash
#!/bin/bash
BACKUP_DIR="/backup/clearpanel"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup domains
tar -czf $BACKUP_DIR/domains_$DATE.tar.gz /home/sefion/Domains/

# Backup DNS zones
tar -czf $BACKUP_DIR/dns_zones_$DATE.tar.gz /etc/bind/zones/

# Backup configuration
cp /opt/clearpanel/backend/.env $BACKUP_DIR/env_$DATE.bak
cp /etc/bind/named.conf.local $BACKUP_DIR/named.conf_$DATE.bak

# Keep only last 7 days
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
find $BACKUP_DIR -name "*.bak" -mtime +7 -delete

echo "Backup completed: $DATE"
```

**Make executable:**
```bash
sudo chmod +x /opt/clearpanel/backup.sh
```

**Add to cron (daily at 2 AM):**
```bash
sudo crontab -e
```

**Add this line:**
```
0 2 * * * /opt/clearpanel/backup.sh >> /var/log/clearpanel-backup.log 2>&1
```

## Troubleshooting

### Can't access clearPanel via browser

```bash
# Check if service is running
sudo systemctl status clearpanel

# Check if port is listening
sudo netstat -tulpn | grep 3334

# Check nginx
sudo systemctl status nginx
sudo nginx -t

# Check logs
sudo journalctl -u clearpanel -n 50
sudo tail -f /var/log/nginx/error.log
```

### DNS not working

```bash
# Check BIND9 status
sudo systemctl status bind9  # or 'named'

# Check zone files
ls -la /etc/bind/zones/

# Test zone syntax
sudo named-checkzone mywebsite.com /etc/bind/zones/db.mywebsite.com

# Check BIND config
sudo named-checkconf

# View DNS logs
sudo journalctl -u bind9 -n 50  # or 'named'
```

### Permission errors

```bash
# Fix domain folder permissions
sudo chown -R sefion:sefion /home/sefion/Domains/

# Fix clearPanel permissions
sudo chown -R sefion:sefion /opt/clearpanel/

# Fix BIND permissions
sudo chown -R bind:bind /etc/bind/zones/  # Ubuntu
sudo chown -R named:named /etc/bind/zones/  # CentOS
```

### Service won't start

```bash
# Check detailed logs
sudo journalctl -u clearpanel -xe

# Try running manually to see errors
cd /opt/clearpanel/backend
sudo -u sefion node dist/main.js

# Check environment file
cat /opt/clearpanel/backend/.env
```

## Post-Deployment Checklist

- [ ] clearPanel accessible via browser
- [ ] Can login with admin credentials
- [ ] Created test domain successfully
- [ ] DNS server status shows "installed: true, running: true"
- [ ] Nginx reverse proxy working
- [ ] Firewall configured correctly
- [ ] SSL certificate installed (if applicable)
- [ ] Backup script configured
- [ ] Tested file upload via File Manager
- [ ] Configured domain at registrar
- [ ] DNS resolving correctly (after propagation)
- [ ] Website accessible via domain name

## Security Hardening (Recommended)

**1. Change SSH port:**
```bash
sudo nano /etc/ssh/sshd_config
# Change: Port 22 to Port 2222
sudo systemctl restart sshd
```

**2. Disable root login:**
```bash
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
sudo systemctl restart sshd
```

**3. Install fail2ban:**
```bash
# Ubuntu/Debian
sudo apt-get install -y fail2ban

# CentOS/AlmaLinux
sudo dnf install -y fail2ban

sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

**4. Regular updates:**
```bash
# Ubuntu/Debian
sudo apt-get update && sudo apt-get upgrade -y

# CentOS/AlmaLinux
sudo dnf update -y
```

**5. Monitor logs regularly:**
```bash
# Check for suspicious activity
sudo tail -f /var/log/auth.log  # Ubuntu
sudo tail -f /var/log/secure     # CentOS
```

## Maintenance Commands

**Restart all services:**
```bash
sudo systemctl restart clearpanel
sudo systemctl restart nginx
sudo systemctl restart bind9  # or 'named'
```

**Update clearPanel:**
```bash
cd /opt/clearpanel
sudo git pull origin main
cd backend
sudo npm install
sudo npm run build
sudo systemctl restart clearpanel
```

**View all logs:**
```bash
# Real-time monitoring
sudo journalctl -u clearpanel -f
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## Next Steps

1. âœ… Add more domains
2. âœ… Set up email server (future feature)
3. âœ… Configure additional DNS records (MX, TXT, etc.)
4. âœ… Set up monitoring and alerting
5. âœ… Configure automated backups
6. âœ… Install additional security tools

## Support

- **Documentation:** `/opt/clearpanel/docs/`
- **Logs:** `sudo journalctl -u clearpanel -f`
- **GitHub:** https://github.com/SefionITServices/clearPanel

---

**Congratulations!** ðŸŽ‰ Your clearPanel hosting control panel is now live and ready to manage domains!

