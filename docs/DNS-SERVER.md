# DNS Server Feature - Own Nameserver on VPS

## Overview

clearPanel now includes built-in BIND9 DNS server integration. When you add a domain, the system automatically:
1. Creates a DNS zone file with nameserver records
2. Configures BIND9 to serve authoritative DNS for that domain
3. Provides instructions for pointing your domain to this VPS as the nameserver

This makes your VPS a **fully functional DNS server** that responds to DNS queries for your domains.

## How It Works

### Traditional DNS (Registrar A Records)
- You set A records at your registrar pointing to your VPS IP
- Registrar's DNS servers answer queries for your domain
- Quick to set up, but limited control

### Own DNS Server (This Feature)
- Your VPS runs BIND9 and answers DNS queries directly
- You set custom nameservers (ns1.yourdomain.com, ns2.yourdomain.com) at your registrar
- Full control over DNS records, faster updates, professional setup

## Installation

### 1. Install BIND9 on Your VPS

**Option A: Via clearPanel UI**
- Go to Settings â†’ DNS Server
- Click "Install BIND9"
- Wait for installation to complete

**Option B: Via API**
```bash
curl -X POST http://localhost:3334/api/dns-server/install
```

**Option C: Manual Installation**

Ubuntu/Debian:
```bash
sudo apt-get update
sudo apt-get install -y bind9 bind9utils bind9-doc
sudo systemctl enable bind9
sudo systemctl start bind9
```

CentOS/RHEL/AlmaLinux:
```bash
sudo dnf install -y bind bind-utils
sudo systemctl enable named
sudo systemctl start named
```

### 2. Configure Firewall

Allow DNS queries (UDP/TCP port 53):

```bash
# UFW (Ubuntu/Debian)
sudo ufw allow 53/tcp
sudo ufw allow 53/udp

# firewalld (CentOS/RHEL)
sudo firewall-cmd --add-service=dns --permanent
sudo firewall-cmd --reload
```

### 3. Verify Installation

```bash
# Check status via API
curl http://localhost:3334/api/dns-server/status

# Check service
sudo systemctl status bind9  # or named on CentOS
```

## Using the DNS Server

### When You Create a Domain

1. Add a domain via clearPanel (e.g., `mywebsite.com`)
2. clearPanel automatically:
   - Creates `/etc/bind/zones/db.mywebsite.com`
   - Adds zone to `/etc/bind/named.conf.local`
   - Reloads BIND9
   - Returns nameserver instructions

### Nameserver Instructions Response

When you create a domain, the API returns:
```json
{
  "domain": { ... },
  "nameserverInfo": {
    "ns1": "ns1.mywebsite.com",
    "ns2": "ns2.mywebsite.com",
    "ip": "204.83.99.245",
    "instructions": "..."
  }
}
```

### Configure at Your Registrar

**Step 1: Create Glue Records**
At your domain registrar (GoDaddy, Namecheap, etc.):
- Go to domain settings â†’ Nameservers/Glue Records
- Create:
  - `ns1.mywebsite.com` â†’ `204.83.99.245` (your VPS IP)
  - `ns2.mywebsite.com` â†’ `204.83.99.245`

**Step 2: Set Custom Nameservers**
- Change nameservers to:
  - Primary: `ns1.mywebsite.com`
  - Secondary: `ns2.mywebsite.com`

**Step 3: Wait for Propagation**
- DNS changes take 24-48 hours to fully propagate
- Some registrars update faster (1-4 hours)

### Verify DNS is Working

```bash
# Query your VPS directly
dig @204.83.99.245 mywebsite.com

# Check public DNS (after propagation)
dig mywebsite.com
nslookup mywebsite.com
```

Expected response:
```
;; ANSWER SECTION:
mywebsite.com.  86400  IN  A  204.83.99.245
```

## Zone File Structure

Each domain gets a zone file at `/etc/bind/zones/db.DOMAIN`:

```dns
; Zone file for mywebsite.com
$TTL 86400
@   IN  SOA ns1.mywebsite.com. admin.mywebsite.com. (
        2025111301  ; Serial
        3600        ; Refresh
        1800        ; Retry
        604800      ; Expire
        86400 )     ; Minimum TTL

; Name servers
@       IN  NS      ns1.mywebsite.com.
@       IN  NS      ns2.mywebsite.com.

; A records for nameservers
ns1     IN  A       204.83.99.245
ns2     IN  A       204.83.99.245

; Main domain A record
@       IN  A       204.83.99.245
www     IN  A       204.83.99.245
```

## API Endpoints

### Get DNS Server Status
```bash
GET /api/dns-server/status
```

Response:
```json
{
  "installed": true,
  "running": true,
  "version": "BIND 9.18.12-0ubuntu0.22.04.3",
  "zonesPath": "/etc/bind/zones",
  "namedConfPath": "/etc/bind/named.conf.local"
}
```

### Install BIND9
```bash
POST /api/dns-server/install
```

### Reload DNS Server
```bash
POST /api/dns-server/reload
```

### Get Nameserver Instructions
```bash
GET /api/dns-server/nameserver-instructions/:domain
```

Response:
```json
{
  "ns1": "ns1.example.com",
  "ns2": "ns2.example.com",
  "ip": "204.83.99.245",
  "instructions": "..."
}
```

## Managing DNS Records

Once the zone is created, you can add/edit records via clearPanel's DNS editor:
- A records (IPv4)
- AAAA records (IPv6)
- CNAME records (aliases)
- MX records (mail)
- TXT records (SPF, DKIM, verification)

Changes take effect immediately after BIND reload.

## Troubleshooting

### DNS Not Resolving

1. **Check BIND is running:**
   ```bash
   sudo systemctl status bind9  # or named
   ```

2. **Check zone file syntax:**
   ```bash
   sudo named-checkzone mywebsite.com /etc/bind/zones/db.mywebsite.com
   ```

3. **Check BIND config:**
   ```bash
   sudo named-checkconf
   ```

4. **View BIND logs:**
   ```bash
   sudo journalctl -u bind9 -f  # or named
   ```

5. **Test local query:**
   ```bash
   dig @localhost mywebsite.com
   ```

6. **Firewall blocking port 53?**
   ```bash
   sudo ufw status | grep 53
   sudo netstat -tulpn | grep :53
   ```

### Zone Not Loading

```bash
# Reload BIND manually
sudo systemctl reload bind9

# Or restart if reload fails
sudo systemctl restart bind9

# Check for errors
sudo journalctl -u bind9 -n 50
```

### Glue Records Not Working

- Some registrars require both nameservers to have different IPs
- If you only have one VPS IP, most registrars accept ns1 and ns2 pointing to the same IP
- Check registrar documentation for glue record setup

## Security Considerations

1. **Rate Limiting:**
   - BIND has built-in rate limiting for queries
   - Prevents DNS amplification attacks

2. **Zone Transfers:**
   - Current config allows transfers (`allow-transfer { any; };`)
   - For production, restrict to secondary nameservers only

3. **DNSSEC:**
   - Not enabled by default
   - Can be configured for additional security

4. **Firewall:**
   - Only open port 53 (UDP/TCP)
   - Monitor for unusual query patterns

## Advanced Configuration

### Multiple Nameservers

For redundancy, set up a secondary DNS server:

1. Install BIND on a second VPS
2. Configure slave zones
3. Update glue records:
   - ns1.mydomain.com â†’ Primary VPS IP
   - ns2.mydomain.com â†’ Secondary VPS IP

### Custom DNS Records

Edit zone files manually:
```bash
sudo nano /etc/bind/zones/db.mydomain.com
# Make changes
sudo systemctl reload bind9
```

Or use clearPanel's DNS editor for a GUI.

## Benefits

âœ… **Full DNS Control** - Manage all record types  
âœ… **Fast Updates** - Changes take effect immediately (no registrar delays)  
âœ… **Professional Setup** - Custom nameservers (ns1.yourdomain.com)  
âœ… **Cost Savings** - No need for premium DNS services  
âœ… **Privacy** - Your DNS data stays on your VPS  
âœ… **Learning** - Understand how DNS works at a deep level  

## Limitations

âš ï¸ **Single Point of Failure** - If your VPS goes down, DNS fails  
âš ï¸ **Redundancy Required** - Production sites should have secondary nameserver  
âš ï¸ **Propagation Delay** - Initial setup takes 24-48 hours  
âš ï¸ **Technical Knowledge** - Requires basic DNS understanding  

## Next Steps

After setting up DNS:
1. âœ… Point domain nameservers to your VPS
2. âœ… Add additional DNS records (MX, TXT, etc.)
3. âœ… Set up email with proper MX and SPF records
4. âœ… Configure SSL certificates (works with custom DNS)
5. âœ… Monitor DNS query logs for troubleshooting

## Resources

- [BIND9 Documentation](https://bind9.readthedocs.io/)
- [DNS Record Types](https://en.wikipedia.org/wiki/List_of_DNS_record_types)
- [How DNS Works](https://howdns.works/)
- [DNS Propagation Checker](https://www.whatsmydns.net/)

