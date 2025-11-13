# clearPanel Installation Guide

## Quick Install (Recommended)

For a fresh VPS/server installation:

```bash
git clone https://github.com/SefionITServices/clearPanel.git
cd clearPanel
sudo ./install.sh
```

The script will automatically:
- Detect your package manager (apt-get or dnf)
- Install Node.js 20+ if needed
- Create a dedicated `clearpanel` system user
- Build and install the application to `/opt/clearpanel`
- Configure systemd service
- Setup nginx reverse proxy
- Generate secure environment configuration

---

## Manual Installation

### Prerequisites

#### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install -y curl git nginx
```

#### CentOS/RHEL/AlmaLinux
```bash
sudo dnf install -y curl git nginx
```

### Install Node.js 20 LTS

#### Ubuntu/Debian
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs
```

#### CentOS/RHEL/AlmaLinux
```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
```

### Install clearPanel

1. **Clone the repository**
   ```bash
   cd /opt
   sudo git clone https://github.com/SefionITServices/clearPanel.git
   cd clearPanel
   ```

2. **Create service user**
   ```bash
   sudo useradd -r -s /bin/false -d /opt/clearpanel clearpanel
   sudo mkdir -p /opt/clearpanel/data
   sudo chown -R clearpanel:clearpanel /opt/clearpanel
   ```

3. **Install backend dependencies**
   ```bash
   cd /opt/clearpanel/backend
   sudo -u clearpanel npm install
   ```

4. **Build backend**
   ```bash
   sudo -u clearpanel npm run build
   ```

5. **Install and build frontend**
   ```bash
   cd /opt/clearpanel/frontend
   sudo -u clearpanel npm install
   sudo -u clearpanel npm run build
   ```

6. **Configure environment**
   ```bash
   sudo nano /opt/clearpanel/backend/.env
   ```
   
   Add the following (customize as needed):
   ```env
   NODE_ENV=production
   PORT=3334
   SESSION_SECRET=your-random-secret-here
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=your-secure-password
   ROOT_PATH=/opt/clearpanel/data
   ALLOWED_EXTENSIONS=*
   MAX_FILE_SIZE=104857600
   ```

7. **Setup systemd service**
   ```bash
   sudo cp /opt/clearpanel/clearpanel.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable clearpanel
   sudo systemctl start clearpanel
   ```

8. **Configure nginx**

   #### Ubuntu/Debian
   ```bash
   sudo cp /opt/clearpanel/nginx.conf.example /etc/nginx/sites-available/clearpanel
   sudo ln -s /etc/nginx/sites-available/clearpanel /etc/nginx/sites-enabled/
   sudo rm -f /etc/nginx/sites-enabled/default
   ```

   #### CentOS/RHEL/AlmaLinux
   ```bash
   sudo cp /opt/clearpanel/nginx.conf.example /etc/nginx/conf.d/clearpanel.conf
   ```

   Edit the config and replace `your-domain.com` with your actual domain:
   ```bash
   # Ubuntu/Debian
   sudo nano /etc/nginx/sites-available/clearpanel
   
   # CentOS/RHEL
   sudo nano /etc/nginx/conf.d/clearpanel.conf
   ```

9. **Start nginx**
   ```bash
   sudo nginx -t
   sudo systemctl enable nginx
   sudo systemctl restart nginx
   ```

---

## Post-Installation

### Verify Installation

Check if clearPanel is running:
```bash
sudo systemctl status clearpanel
```

View logs:
```bash
sudo journalctl -u clearpanel -f
```

### Access the Panel

Open your browser and navigate to:
- **HTTP**: `http://your-server-ip`
- **With domain**: `http://your-domain.com`

Default login:
- Username: `admin`
- Password: (whatever you set in `.env`)

### Setup SSL (Recommended)

Install Certbot:

#### Ubuntu/Debian
```bash
sudo apt-get install -y certbot python3-certbot-nginx
```

#### CentOS/RHEL
```bash
sudo dnf install -y certbot python3-certbot-nginx
```

Get SSL certificate:
```bash
sudo certbot --nginx -d your-domain.com
```

Certbot will automatically update your nginx configuration for HTTPS.

---

## Updating

To update clearPanel to the latest version:

```bash
cd /opt/clearpanel
sudo ./deploy.sh
```

Or manually:
```bash
cd /opt/clearpanel
sudo git pull
cd frontend
sudo -u clearpanel npm install
sudo -u clearpanel npm run build
cd ../backend
sudo -u clearpanel npm install
sudo -u clearpanel npm run build
sudo systemctl restart clearpanel
```

---

## Firewall Configuration

### UFW (Ubuntu/Debian)
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### firewalld (CentOS/RHEL)
```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

---

## Troubleshooting

### Service won't start
```bash
# Check logs
sudo journalctl -u clearpanel -n 50

# Check if port is in use
sudo ss -ltnp | grep :3334

# Check file permissions
ls -la /opt/clearpanel/backend
```

### Nginx shows 502 Bad Gateway
```bash
# Verify backend is running
sudo systemctl status clearpanel

# Check nginx error logs
sudo tail -f /var/log/nginx/error.log

# Verify nginx can connect to backend
curl http://localhost:3334/api/auth/status
```

### Can't login
```bash
# Verify environment variables
sudo cat /opt/clearpanel/backend/.env

# Check session secret is set
sudo grep SESSION_SECRET /opt/clearpanel/backend/.env

# Restart service after changing .env
sudo systemctl restart clearpanel
```

### Permission issues
```bash
# Fix ownership
sudo chown -R clearpanel:clearpanel /opt/clearpanel
sudo chown -R clearpanel:clearpanel /opt/clearpanel/data

# Verify service user
id clearpanel
```

---

## Service Management

```bash
# Start service
sudo systemctl start clearpanel

# Stop service
sudo systemctl stop clearpanel

# Restart service
sudo systemctl restart clearpanel

# View status
sudo systemctl status clearpanel

# View logs
sudo journalctl -u clearpanel -f

# Enable on boot
sudo systemctl enable clearpanel

# Disable on boot
sudo systemctl disable clearpanel
```

---

## Uninstallation

```bash
# Stop and disable service
sudo systemctl stop clearpanel
sudo systemctl disable clearpanel
sudo rm /etc/systemd/system/clearpanel.service

# Remove nginx config
sudo rm /etc/nginx/sites-enabled/clearpanel    # Ubuntu/Debian
sudo rm /etc/nginx/sites-available/clearpanel  # Ubuntu/Debian
sudo rm /etc/nginx/conf.d/clearpanel.conf      # CentOS/RHEL

# Restart nginx
sudo systemctl restart nginx

# Remove application
sudo rm -rf /opt/clearpanel

# Remove user
sudo userdel clearpanel

# Reload systemd
sudo systemctl daemon-reload
```

---

## Security Recommendations

1. **Change default credentials immediately**
   ```bash
   sudo nano /opt/clearpanel/backend/.env
   # Update ADMIN_USERNAME and ADMIN_PASSWORD
   sudo systemctl restart clearpanel
   ```

2. **Use strong SESSION_SECRET**
   ```bash
   # Generate a new one
   openssl rand -hex 32
   ```

3. **Enable HTTPS with Let's Encrypt**
   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

4. **Restrict file access**
   ```bash
   sudo chmod 600 /opt/clearpanel/backend/.env
   ```

5. **Regular updates**
   ```bash
   cd /opt/clearpanel
   sudo git pull
   sudo ./deploy.sh
   ```

6. **Monitor logs**
   ```bash
   sudo journalctl -u clearpanel -f
   ```

---

## Support

For issues and questions:
- GitHub Issues: https://github.com/SefionITServices/clearPanel/issues
- Documentation: https://github.com/SefionITServices/clearPanel

