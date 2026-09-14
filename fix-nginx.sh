#!/bin/bash
# Fix script for Nginx SPA routing

CONF="/etc/nginx/sites-available/clearpanel"
if [ ! -f "$CONF" ]; then
    CONF="/etc/nginx/conf.d/clearpanel.conf"
fi

if [ ! -f "$CONF" ]; then
    echo "Nginx config not found!"
    exit 1
fi

echo "Fixing Nginx config at $CONF..."

# Use awk to rebuild the location / block properly
# We will completely replace any existing location / block and the nested cache block
awk '
BEGIN { skip=0 }
/^[[:space:]]*location \/ \{/ {
    skip=1
    print "    location / {"
    print "        try_files $uri $uri/ /index.html;"
    print "    }"
    print "    "
    print "    # Cache static assets"
    print "    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {"
    print "        try_files $uri =404;"
    print "        expires 1y;"
    print "        add_header Cache-Control \"public, immutable\";"
    print "    }"
    next
}
skip==1 && /^[[:space:]]*\}/ { skip=0; next }
skip==1 { next }
{ print }
' "$CONF" > "${CONF}.tmp"

mv "${CONF}.tmp" "$CONF"

nginx -t && systemctl reload nginx
echo "Fixed successfully!"
