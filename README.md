# clearPanel - Web Hosting Control Panel

A modern, plug-and-play web hosting control panel for any VPS. Features automatic domain provisioning, DNS server integration, web server automation, and file management.

## 🚀 Key Features

✅ **Domain Management**
- One-click domain creation with automatic folder structure
- Auto-configure nginx virtual hosts
- Built-in DNS zone management
- Domain deletion with cleanup

✅ **Own DNS Server (BIND9)**
- Transform your VPS into an authoritative nameserver
- Automatic zone file creation for each domain
- Custom nameservers (ns1.yourdomain.com, ns2.yourdomain.com)
- Full control over DNS records
- See [DNS Server Guide](docs/DNS-SERVER.md)

✅ **Web Server Automation**
- Automatic nginx virtual host configuration
- PHP-FPM integration ready
- SSL certificate support
- Per-domain access/error logs
 - See [Web Server Setup (Nginx vs Apache)](docs/WEB-SERVER.md)

✅ **DNS Management**
- Edit A, AAAA, CNAME, MX, TXT records
- Real-time zone updates
- Import existing DNS from registrar

✅ **File Manager**
- Browse directories with breadcrumb navigation
- Upload files (up to 100MB by default)
- Download files and folders (as ZIP)
- Create, rename, and delete files/folders
- Built-in text editor for common file types
- Modern, responsive UI with icons
- Real-time file operations

✅ **Security**
- Session-based authentication
- Path traversal protection
- Configurable root directory access
- Secure file operations

✅ **Dual Connectivity Modes**
- **Direct IP Access:** Perfect for VPS with public IP
- **Cloudflare Tunnel:** Access from anywhere, even behind CGNAT/NAT
- See [Connectivity Guide](docs/CONNECTIVITY.md)

## Quick Start

### Automated Installation

git clone https://github.com/SefionITServices/clearPanel.git
```bash
# Clone repository
git clone https://github.com/SefionITServices/clearPanel.git
cd clearPanel

# Run installation script
sudo chmod +x install.sh
sudo ./install.sh
```

The installer will:
- Install Node.js dependencies
- Set up environment configuration
- Create systemd service
- Configure nginx (optional)
- Set up Cloudflare Tunnel (optional)

See detailed guides:
- [Full Installation Guide](docs/INSTALLATION.md)
- [Connectivity Options](docs/CONNECTIVITY.md)
- [DNS Server Setup](docs/DNS-SERVER.md)
 - [Web Server Setup (Nginx vs Apache)](docs/WEB-SERVER.md)

## Manual Installation

### 1. Prerequisites

**Ubuntu/Debian:**
```bash
# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install nginx
sudo apt-get install -y nginx

# Install BIND9 (for DNS server)
sudo apt-get install -y bind9 bind9utils
```

**CentOS/AlmaLinux/RHEL:**
```bash
# Install Node.js 20.x
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs

# Install nginx
sudo dnf install -y nginx

# Install BIND (for DNS server)
sudo dnf install -y bind bind-utils
```

### 2. Install Application

```bash
# Clone or download
cd /opt
sudo git clone https://github.com/SefionITServices/clearPanel.git clearpanel
cd clearpanel

# Install dependencies
sudo npm install

# Build backend
cd backend
npm install
npm run build
cd ..
```

### 3. Configure Environment

```bash
cd backend
sudo cp .env.example .env
sudo nano .env
```

Edit `.env` file:

```env
PORT=3334
SESSION_SECRET=your-random-secure-string-here

# Change these credentials!
ADMIN_USERNAME=admin
ADMIN_PASSWORD=StrongPassword123!

# File Manager & Domain Settings
ROOT_PATH=/home/sefion
DOMAINS_ROOT=/home/sefion/Domains
SERVER_IP=your.vps.ip.address

# Upload limits
ALLOWED_EXTENSIONS=*
MAX_FILE_SIZE=104857600
```

**Important:**
- Change `ADMIN_USERNAME` and `ADMIN_PASSWORD`
- Generate `SESSION_SECRET`: `openssl rand -hex 32`
- Set `SERVER_IP` to your VPS public IP
- Set `ROOT_PATH` to user home directory
- Set `DOMAINS_ROOT` for domain folder creation

### 4. Set Up Systemd Service

Use the provided service file:

```bash
sudo cp clearpanel.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable clearpanel
sudo systemctl start clearpanel

# Check status
sudo systemctl status clearpanel
```

### 5. Configure Firewall

```bash
# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow DNS (for DNS server feature)
sudo ufw allow 53/tcp
sudo ufw allow 53/udp

# Or for firewalld (CentOS/AlmaLinux)
sudo firewall-cmd --add-service=http --permanent
sudo firewall-cmd --add-service=https --permanent
sudo firewall-cmd --add-service=dns --permanent
sudo firewall-cmd --reload
```

### 6. Install DNS Server (Optional but Recommended)

```bash
# Via clearPanel UI (after login)
# Go to Settings → DNS Server → Install BIND9

# Or via API
curl -X POST http://localhost:3334/api/dns-server/install

# Or manually
sudo apt-get install -y bind9 bind9utils  # Ubuntu/Debian
sudo dnf install -y bind bind-utils        # CentOS/AlmaLinux
```

## Usage

### Access the Panel

**Direct IP Access:**
```
http://your-vps-ip:3334
```

**Via Nginx Reverse Proxy:**
```
https://panel.yourdomain.com
```

**Via Cloudflare Tunnel:**
```
https://clearpanel.your-tunnel.com
```

### Creating Your First Domain

1. Login with admin credentials
2. Navigate to **Domains** → **Add Domain**
3. Enter domain name (e.g., `mywebsite.com`)
4. Click **Create Domain**

clearPanel automatically:
- ✅ Creates `/home/sefion/Domains/mywebsite.com/` folder
- ✅ Generates nginx virtual host configuration
- ✅ Creates BIND9 DNS zone with ns1/ns2 records
- ✅ Provides nameserver setup instructions

5. Follow the nameserver instructions to point your domain:
   - Create glue records at registrar: `ns1.mywebsite.com` → your VPS IP
   - Set nameservers to `ns1.mywebsite.com` and `ns2.mywebsite.com`
   - Wait 24-48 hours for propagation

### Managing DNS Records

1. Go to **DNS** → Select your domain
2. Add/Edit records:
   - **A Record:** Point domain to IP address
   - **CNAME:** Create subdomain alias
   - **MX:** Configure email servers
   - **TXT:** Add SPF, DKIM, verification records

### File Management

1. Navigate to **Files**
2. Browse domain folders under `/Domains/`
3. Upload website files, edit configurations
4. Download backups as ZIP

# Check status
sudo systemctl status clearpanel
```

### 5. Configure Firewall

```bash
# Open port 3000 (or your configured port)
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload

# Verify
sudo firewall-cmd --list-ports
```

### 6. Access the Panel

Open your browser and navigate to:
```
http://your-vps-ip:3000
```

## API Documentation

### Authentication
```bash
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "your-password"
}
```

### Domains

**List all domains:**
```bash
GET /api/domains
```

**Create domain:**
```bash
POST /api/domains
Content-Type: application/json

{
  "domain": "example.com"
}

# Response includes nameserver instructions
{
  "domain": {...},
  "nameserverInfo": {
    "ns1": "ns1.example.com",
    "ns2": "ns2.example.com",
    "ip": "204.83.99.245",
    "instructions": "..."
  }
}
```

**Delete domain:**
```bash
DELETE /api/domains/:domain
```

### DNS Records

**Get records for domain:**
```bash
GET /api/dns/:domain
```

**Add DNS record:**
```bash
POST /api/dns
Content-Type: application/json

{
  "domain": "example.com",
  "type": "A",
  "name": "@",
  "value": "204.83.99.245",
  "ttl": 3600
}
```

**Delete DNS record:**
```bash
DELETE /api/dns
Content-Type: application/json

{
  "domain": "example.com",
  "recordId": "record-id-here"
}
```

### DNS Server

**Get status:**
```bash
GET /api/dns-server/status

# Response
{
  "installed": true,
  "running": true,
  "version": "BIND 9.18.12",
  "zonesPath": "/etc/bind/zones",
  "namedConfPath": "/etc/bind/named.conf.local"
}
```

**Install BIND9:**
```bash
POST /api/dns-server/install
```

**Reload DNS server:**
```bash
POST /api/dns-server/reload
```

**Get nameserver instructions:**
```bash
GET /api/dns-server/nameserver-instructions/:domain
```

### File Manager

**List directory:**
```bash
POST /api/files/list
Content-Type: application/json

{
  "path": "/home/sefion"
}
```

**Upload file:**
```bash
POST /api/files/upload
Content-Type: multipart/form-data

# Form data with 'file' field
```

**Download file:**
```bash
POST /api/files/download
Content-Type: application/json

{
  "path": "/home/sefion/file.txt"
}
```

## Architecture

### Backend (NestJS)
```
backend/src/
├── auth/                 # Authentication module
├── domains/              # Domain management
│   ├── domains.service.ts    # Domain CRUD, integrations
│   └── domains.controller.ts # REST endpoints
├── dns/                  # DNS record tracking
│   ├── dns.service.ts        # Zone data (dns.json)
│   └── dns.controller.ts
├── dns-server/           # BIND9 DNS server
│   ├── dns-server.service.ts    # Zone files, BIND control
│   └── dns-server.controller.ts
├── webserver/            # Nginx automation
│   └── webserver.service.ts  # Vhost creation/deletion
└── files/                # File manager
    ├── files.service.ts
    └── files.controller.ts
```

### Frontend (React + MUI)
```
frontend/src/
├── pages/
│   ├── DomainsListView.tsx   # Domain management UI
│   ├── DomainCreate.tsx      # Add domain form
│   ├── DnsEditor.tsx         # DNS record editor
│   └── FileManager.tsx       # File operations
├── components/
│   ├── Sidebar.tsx           # Navigation
│   └── ...
└── App.tsx                   # Router, auth
```

### Data Flow: Creating a Domain

1. **User submits domain** via frontend form
2. **DomainsController** receives POST request
3. **DomainsService** orchestrates:
   - Creates folder: `/home/sefion/Domains/example.com/`
   - Calls **WebServerService**: generates nginx vhost
   - Calls **DnsService**: adds to dns.json for tracking
   - Calls **DnsServerService**: creates BIND9 zone file
4. **DnsServerService**:
   - Generates zone file with SOA, NS, A records
   - Writes to `/etc/bind/zones/db.example.com`
   - Updates `/etc/bind/named.conf.local`
   - Reloads BIND9: `systemctl reload bind9`
5. **Response** includes nameserver setup instructions
6. **Frontend** displays success + nameserver guide

### Integration Points

- **Domains ↔ DNS Server:** Auto-create zones on domain add
- **Domains ↔ Webserver:** Auto-configure nginx vhosts
- **Domains ↔ DNS:** Track zones in dns.json
- **File Manager:** Operates on domain folders in `DOMAINS_ROOT`

## Connectivity Modes

### Direct IP (VPS Deployment)
- Open ports 80, 443, 53 on firewall
- Configure nginx reverse proxy
- Point A records to VPS IP
- Best for: Cloud VPS with public IP

### Cloudflare Tunnel (CGNAT/Home)
- No port forwarding required
- Works behind NAT/CGNAT
- Free tier available
- Best for: Home servers, restrictive networks

See [CONNECTIVITY.md](docs/CONNECTIVITY.md) for detailed setup.

## Troubleshooting

### DNS Server Issues

**BIND not running:**
```bash
# Check status
sudo systemctl status bind9  # or named

# View logs
sudo journalctl -u bind9 -n 50

# Test zone syntax
sudo named-checkzone example.com /etc/bind/zones/db.example.com

# Test BIND config
sudo named-checkconf
```

**Zone not resolving:**
```bash
# Test locally
dig @localhost example.com

# Test from VPS IP
dig @204.83.99.245 example.com

# Check public DNS (after propagation)
dig example.com
nslookup example.com
```

### Domain Creation Failures

**Check logs:**
```bash
# Backend logs
sudo journalctl -u clearpanel -f

# Or if running in terminal
tail -f server.log
```

**Verify integrations:**
```bash
# Check nginx vhost created
ls -la /etc/nginx/sites-available/

# Check zone file created
ls -la /etc/bind/zones/

# Check dns.json updated
cat backend/dns.json
```

### Service Management

```bash
# Start clearPanel
sudo systemctl start clearpanel

# Stop clearPanel
sudo systemctl stop clearpanel

# Restart clearPanel
sudo systemctl restart clearpanel

# View logs
sudo journalctl -u clearpanel -f

# Check status
sudo systemctl status clearpanel
```

### Permission Errors

```bash
# Ensure correct ownership
sudo chown -R clearpanel:clearpanel /opt/clearpanel

# Check domain folder permissions
ls -la /home/sefion/Domains/

# Fix if needed
sudo chown -R sefion:sefion /home/sefion/Domains/
```

## Security Best Practices

1. ✅ **Change default credentials** immediately
2. ✅ **Use HTTPS** with Let's Encrypt SSL
3. ✅ **Strong SESSION_SECRET** (32+ chars)
4. ✅ **Firewall rules** - only open needed ports
5. ✅ **Regular updates** - `npm update`, system patches
6. ✅ **Limit ROOT_PATH** to specific directories
7. ✅ **Rate limiting** on DNS queries (BIND built-in)
8. ✅ **Backup strategy** for dns.json and configs
9. ✅ **Monitor logs** for suspicious activity
10. ✅ **DNSSEC** (optional) for enhanced DNS security

## Production Checklist

Before going live:

- [ ] Change admin password
- [ ] Set strong SESSION_SECRET
- [ ] Install and configure SSL certificate
- [ ] Set up firewall rules (ufw/firewalld)
- [ ] Configure nginx reverse proxy
- [ ] Install and configure BIND9
- [ ] Set up automated backups
- [ ] Test domain creation workflow
- [ ] Verify DNS resolution
- [ ] Set up monitoring/alerting
- [ ] Document custom configurations

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Roadmap

### In Progress
- ✅ Domain management with automation
- ✅ DNS server (BIND9) integration
- ✅ Webserver automation (nginx)
- ✅ File manager with editor

### Planned
- 🔲 Frontend UI for DNS server status
- 🔲 Email server management (Postfix/Dovecot)
- 🔲 Database management (MySQL/PostgreSQL)
- 🔲 SSL certificate automation (Let's Encrypt)
- 🔲 System monitoring dashboard
- 🔲 User management & permissions
- 🔲 Backup & restore system
- 🔲 FTP/SFTP server integration
- 🔲 DNSSEC support
- 🔲 Secondary DNS server setup

## Resources

- [BIND9 Documentation](https://bind9.readthedocs.io/)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)

## License

MIT License - Free to use and modify.

## Support

- **Documentation:** See `docs/` folder
- **Issues:** GitHub Issues
- **Logs:** `sudo journalctl -u clearpanel -f`

---

**clearPanel** - Making VPS hosting automation accessible to everyone.
