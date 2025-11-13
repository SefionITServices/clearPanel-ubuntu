# Connectivity Modes: Direct IP vs Cloudflare Tunnel

You can run clearPanel in two ways depending on your network situation:

- Direct (Public IP): Best for VPS or any host with a routable public IP and port-forwarding. Uses your server IP, optional Nginx, and your registrar's DNS A records.
- Cloudflare Tunnel: Best when your ISP blocks port-forwarding (CGNAT) or you're on a home/office network. Exposes your local service securely via Cloudflare without opening ports.

## Option A â€” Direct (Public IP)

Requirements:
- Server with public IP or router with port-forwarding
- Optional: a domain at any registrar

Steps (summary):
1) Run backend on 0.0.0.0:3334 (already default).
2) Open the firewall on your server for TCP 3334 (or set up Nginx on port 80/443).
3) If you own a domain, point DNS A records to your server IP.
4) (Recommended) Put Nginx in front and enable HTTPS via Letâ€™s Encrypt.

See: README.md â†’ Installation and Nginx sections.

## Option B â€” Cloudflare Tunnel (no ports, works behind CGNAT)

Cloudflare Tunnel creates an outbound-only connection from your machine to Cloudflare and provides a public hostname for your service. Two variants:

- Quick test (no account): one-time url under trycloudflare.com
- Persistent tunnel (recommended): requires Cloudflare account, optional domain

### B1) Quick Test (no account)

Run this on the host where clearPanel listens on port 3334:

```bash
# Install cloudflared (Debian/Ubuntu/Zorin)
curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb || sudo apt-get -f install -y && sudo dpkg -i cloudflared.deb

# Start an ephemeral tunnel to localhost:3334
cloudflared tunnel --url http://localhost:3334
```

Youâ€™ll get a https://â€¦trycloudflare.com URL you can share immediately. When you stop the process, the URL goes away.

### B2) Persistent Tunnel (recommended)

Requirements:
- Cloudflare account
- Optional: your domain added to Cloudflare (for pretty hostnames)

Install and log in:
```bash
# Install cloudflared (Debian/Ubuntu/Zorin)
sudo apt-get update && sudo apt-get install -y curl
curl -fsSL https://pkg.cloudflare.com/install.sh | sudo bash
sudo apt-get install -y cloudflared

# Login in browser to authorize this machine
cloudflared tunnel login
```

Create a named tunnel and credentials:
```bash
# Create a tunnel named clearPanel
cloudflared tunnel create clearPanel

# Show tunnel ID
auth_tunnel_id=$(cloudflared tunnel list | awk '/clearPanel/ {print $1; exit}')
[ -n "$auth_tunnel_id" ] && echo "Tunnel ID: $auth_tunnel_id"
```

Create config at ~/.cloudflared/config.yml:
```yaml
# ~/.cloudflared/config.yml
# Replace YOUR_TUNNEL_ID and PANEL_HOSTNAME below

tunnel: YOUR_TUNNEL_ID
credentials-file: /home/USERNAME/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  - hostname: panel.example.com
    service: http://localhost:3334
  - service: http_status:404
```

Start the tunnel as a service:
```bash
# Route DNS (if your domain is on Cloudflare)
cloudflared tunnel route dns clearPanel panel.example.com

# Run it
cloudflared tunnel run clearPanel

# Or install as a system service (Debian/Ubuntu)
sudo cloudflared service install
sudo systemctl status cloudflared
```

DNS options:
- If your domain is in Cloudflare: the `route dns` command will create a proxied CNAME for `panel.example.com` automatically.
- If you donâ€™t want to put your domain in Cloudflare: you can still use the random .cfargotunnel.com hostname Cloudflare provides for the tunnel; CNAME your own DNS to that hostname (not proxied), or just use the provided hostname directly.

### Security notes
- The tunnel endpoint is HTTPS by default (Cloudflare side). Your local service can remain HTTP on localhost:3334.
- For Auth, consider Cloudflare Access (Zero Trust) or keep clearPanelâ€™s own login strong and unique.

## Choosing Modes in clearPanel

Today: choose by deployment.
- Direct mode: run Nginx + open ports; use registrar DNS A records.
- Cloudflare mode: run cloudflared and route your hostname via the tunnel.

Next (planned): a simple â€œConnectivity Modeâ€ toggle in Settings that would:
- Direct: manage Nginx vhosts and show A-record instructions
- Cloudflare: manage a cloudflared tunnel and show CNAME/hostname instructions

If you want this toggle now, open an issue or askâ€”we can wire endpoints like /api/tunnel/* to automate cloudflared from clearPanel.

