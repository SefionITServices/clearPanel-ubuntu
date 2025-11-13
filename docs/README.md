# clearPanel Documentation

Complete documentation for clearPanel web hosting control panel.

## ðŸ“š Documentation Index

### Getting Started
- **[Quick Start Guide](QUICK-START.md)** - Get up and running in 5 minutes
- **[Installation Guide](INSTALLATION.md)** - Detailed installation instructions
- **[Connectivity Guide](CONNECTIVITY.md)** - Direct IP vs Cloudflare Tunnel setup

### Core Features
- **[DNS Server Guide](DNS-SERVER.md)** - Run your own authoritative nameserver with BIND9
- **[Web Server Setup (Nginx vs Apache)](WEB-SERVER.md)** - Install, configure, and secure Nginx/Apache on AlmaLinux
- **[Domain Management](DOMAIN-MANAGEMENT.md)** - Create and manage hosted domains (coming soon)
- **[File Manager](FILE-MANAGER.md)** - Upload and manage website files (coming soon)

### Advanced
- **[API Reference](API-REFERENCE.md)** - REST API documentation (coming soon)
- **[Architecture](ARCHITECTURE.md)** - System design and integration points (coming soon)
- **[Security Guide](SECURITY.md)** - Best practices and hardening (coming soon)

### Operations
- **[Troubleshooting](TROUBLESHOOTING.md)** - Common issues and solutions (coming soon)
- **[Backup & Restore](BACKUP.md)** - Data protection strategies (coming soon)
- **[Monitoring](MONITORING.md)** - Health checks and alerting (coming soon)

## Quick Links

### Installation
```bash
# One-command install
cd /opt && sudo git clone https://github.com/SefionITServices/clearPanel.git clearPanel && cd clearPanel && sudo ./install.sh
```

### Common Tasks

**Start/Stop Service:**
```bash
sudo systemctl start clearPanel
sudo systemctl stop clearPanel
sudo systemctl restart clearPanel
```

**View Logs:**
```bash
sudo journalctl -u clearPanel -f
```

**Check Status:**
```bash
sudo systemctl status clearPanel
curl http://localhost:3334/api/dns-server/status
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | Authenticate user |
| `/api/domains` | GET | List domains |
| `/api/domains` | POST | Create domain |
| `/api/domains/:domain` | DELETE | Delete domain |
| `/api/dns/:domain` | GET | Get DNS records |
| `/api/dns` | POST | Add DNS record |
| `/api/dns-server/status` | GET | DNS server status |
| `/api/dns-server/install` | POST | Install BIND9 |
| `/api/dns-server/reload` | POST | Reload DNS server |
| `/api/files/list` | POST | List directory |
| `/api/files/upload` | POST | Upload file |

## System Requirements

### Minimum
- 1 CPU core
- 1GB RAM
- 10GB storage
- Ubuntu 20.04+ or CentOS 8+

### Recommended
- 2+ CPU cores
- 2GB+ RAM
- 20GB+ storage
- Public IP address
- Domain name

## Feature Overview

### âœ… Currently Available

**Domain Management**
- One-click domain provisioning
- Automatic folder structure creation
- Nginx virtual host automation
- Domain deletion with cleanup

**DNS Server (BIND9)**
- Authoritative nameserver functionality
- Auto-generate zone files (SOA, NS, A records)
- Custom nameservers (ns1/ns2.yourdomain.com)
- Zone management via API
- Nameserver setup instructions

**DNS Management**
- Edit A, AAAA, CNAME, MX, TXT records
- Zone file tracking (dns.json)
- Per-domain DNS editing
- Real-time updates

**Web Server Automation**
- Nginx virtual host creation
- Per-domain access/error logs
- PHP-FPM ready
- Auto-reload on changes

**File Manager**
- Browse directory tree
- Upload/download files
- Create/delete folders
- Built-in text editor
- ZIP folder downloads

**Security**
- Session-based authentication
- Path traversal protection
- Configurable root access
- Secure file operations

**Connectivity**
- Direct IP access
- Cloudflare Tunnel integration
- Nginx reverse proxy support
- SSL/TLS ready

### ðŸ”² Coming Soon

- Frontend UI for DNS server status
- Email server integration (Postfix/Dovecot)
- Database management (MySQL/PostgreSQL)
- SSL certificate automation (Let's Encrypt)
- System monitoring dashboard
- User management & permissions
- Automated backup system
- FTP/SFTP server integration
- DNSSEC support
- Multi-server management

## Architecture

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    Frontend                     â”‚
â”‚         (React + Material-UI + Router)          â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                      â”‚ HTTP/HTTPS
                      â†“
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚              Backend (NestJS)                   â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚
â”‚  â”‚ Domains  â”‚   DNS   â”‚   DNS    â”‚  Files   â”‚  â”‚
â”‚  â”‚ Module   â”‚ Module  â”‚  Server  â”‚  Module  â”‚  â”‚
â”‚  â”‚          â”‚         â”‚  Module  â”‚          â”‚  â”‚
â”‚  â””â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”˜  â”‚
â”‚       â”‚          â”‚          â”‚          â”‚        â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”˜
        â”‚          â”‚          â”‚          â”‚
        â†“          â†“          â†“          â†“
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Folder   â”‚ dns.jsonâ”‚  BIND9   â”‚   File    â”‚
â”‚ Structure â”‚  (JSON) â”‚  Zones   â”‚  System   â”‚
â”‚           â”‚         â”‚          â”‚           â”‚
â”‚ /Domains/ â”‚ Tracker â”‚ /etc/bindâ”‚  /home/   â”‚
â”‚ domain1/  â”‚         â”‚ /zones/  â”‚  sefion/  â”‚
â”‚ domain2/  â”‚         â”‚          â”‚           â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
        â”‚                  â”‚
        â†“                  â†“
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”      â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚   Nginx   â”‚      â”‚ DNS Queries  â”‚
â”‚  Virtual  â”‚      â”‚   (Port 53)  â”‚
â”‚   Hosts   â”‚      â”‚              â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜      â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

## Technology Stack

**Backend**
- NestJS (Node.js framework)
- TypeScript
- Express.js
- express-session

**Frontend**
- React 18
- Material-UI v5
- React Router
- Axios

**System Integration**
- BIND9 (DNS server)
- Nginx (web server)
- Systemd (service management)
- Linux file system

**Optional**
- Cloudflare Tunnel (connectivity)
- Let's Encrypt (SSL - planned)
- Postfix/Dovecot (email - planned)

## Configuration

### Environment Variables

Located in `backend/.env`:

```env
# Server
PORT=3334
SESSION_SECRET=random-secret-here

# Authentication
ADMIN_USERNAME=admin
ADMIN_PASSWORD=secure-password

# Paths
ROOT_PATH=/home/sefion
DOMAINS_ROOT=/home/sefion/Domains

# Network
SERVER_IP=your.vps.ip.address

# File Upload
ALLOWED_EXTENSIONS=*
MAX_FILE_SIZE=104857600
```

### Service Files

**Systemd Service:** `/etc/systemd/system/clearPanel.service`
```ini
[Unit]
Description=clearPanel Web Hosting Control Panel
After=network.target

[Service]
Type=simple
User=clearPanel
WorkingDirectory=/opt/clearPanel/backend
ExecStart=/usr/bin/node dist/main.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

**Nginx Config:** `/etc/nginx/sites-available/clearPanel`
```nginx
server {
    listen 80;
    server_name panel.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3334;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**BIND9 Config:** `/etc/bind/named.conf.local`
```
zone "example.com" {
    type master;
    file "/etc/bind/zones/db.example.com";
    allow-transfer { any; };
};
```

## Best Practices

### Security
1. Change default credentials immediately
2. Use strong SESSION_SECRET (32+ characters)
3. Enable SSL/TLS with Let's Encrypt
4. Configure firewall (only open needed ports)
5. Regular security updates
6. Limit ROOT_PATH to specific directories
7. Monitor logs for suspicious activity

### Performance
1. Use nginx reverse proxy for production
2. Enable gzip compression
3. Configure DNS caching
4. Regular backup schedule
5. Monitor disk space

### Reliability
1. Set up systemd service for auto-restart
2. Configure log rotation
3. Regular backups of:
   - dns.json
   - /etc/bind/zones/
   - Domain folders
   - Environment files
4. Test DNS resolution regularly
5. Monitor service health

## Support & Community

- **GitHub:** [SefionITServices/clearPanel](https://github.com/SefionITServices/clearPanel)
- **Issues:** Report bugs and request features
- **Documentation:** This docs folder
- **Logs:** `sudo journalctl -u clearPanel -f`

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - Free to use and modify.

---

**Last Updated:** January 2025  
**Version:** 1.0.0  
**Status:** Active Development

