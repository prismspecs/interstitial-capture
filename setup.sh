#!/bin/bash
# ==============================================================
# Online Captive Portal Setup (SXSW/Berlin Project)
# Installs and configures Pi as a NAT router with a NoDogSplash portal.
# ==============================================================

set -e

if [ "$EUID" -ne 0 ]; then 
    echo "ERROR: Run with sudo."
    exit 1
fi

# ================= Configuration =================
SSID="SXSW Free Wifi"
INTERFACE="wlan0"
WAN_INTERFACE="eth0"
PORTAL_IP="10.3.141.1"
DHCP_RANGE="10.3.141.50,10.3.141.150"
# =================================================

echo "[1/8] Updating system..."
apt update && apt upgrade -y

echo "[2/8] Installing dependencies..."
apt install -y hostapd dnsmasq nginx iptables-persistent nodogsplash curl
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi

echo "[3/8] Configuring IP Forwarding & NAT..."
sysctl -w net.ipv4.ip_forward=1
grep -q "net.ipv4.ip_forward=1" /etc/sysctl.conf || echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf

iptables -t nat -A POSTROUTING -o $WAN_INTERFACE -j MASQUERADE
iptables -A FORWARD -i $WAN_INTERFACE -o $INTERFACE -m state --state RELATED,ESTABLISHED -j ACCEPT
iptables -A FORWARD -i $INTERFACE -o $WAN_INTERFACE -j ACCEPT
netfilter-persistent save

echo "[4/8] Configuring Static IP on $INTERFACE..."
systemctl stop hostapd dnsmasq nginx nodogsplash 2>/dev/null || true

if systemctl is-active --quiet NetworkManager; then
    mkdir -p /etc/NetworkManager/conf.d
    echo -e "[keyfile]\nunmanaged-devices=interface-name:$INTERFACE" > /etc/NetworkManager/conf.d/wlan0-unmanaged.conf
    
    cat > /etc/systemd/system/wlan0-static-ip.service << EOF
[Unit]
Description=Configure static IP for $INTERFACE
Before=hostapd.service
[Service]
Type=oneshot
ExecStart=/usr/sbin/ip addr flush dev $INTERFACE
ExecStart=/usr/sbin/ip addr add ${PORTAL_IP}/24 dev $INTERFACE
ExecStart=/usr/sbin/ip link set $INTERFACE up
RemainAfterExit=yes
[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload
    systemctl enable wlan0-static-ip.service
    systemctl restart NetworkManager
else
    if ! grep -q "interface $INTERFACE" /etc/dhcpcd.conf; then
        cat >> /etc/dhcpcd.conf << EOF
interface $INTERFACE
    static ip_address=${PORTAL_IP}/24
    nohook wpa_supplicant
EOF
    fi
    systemctl restart dhcpcd
fi

ip addr flush dev $INTERFACE 2>/dev/null || true
ip addr add ${PORTAL_IP}/24 dev $INTERFACE 2>/dev/null || true
ip link set $INTERFACE up

echo "[5/8] Generating Service Configurations..."

# hostapd
cat > /etc/hostapd/hostapd.conf << EOF
interface=$INTERFACE
driver=nl80211
ssid=$SSID
hw_mode=g
channel=7
wmm_enabled=0
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
EOF
echo 'DAEMON_CONF="/etc/hostapd/hostapd.conf"' > /etc/default/hostapd

# dnsmasq
cat > /etc/dnsmasq.conf << EOF
interface=$INTERFACE
domain-needed
bogus-priv
dhcp-range=$DHCP_RANGE,12h
dhcp-option=3,$PORTAL_IP
dhcp-option=6,8.8.8.8,1.1.1.1
dhcp-authoritative
log-dhcp
stop-dns-rebind
rebind-localhost-ok
EOF

# nodogsplash
cat > /etc/nodogsplash/nodogsplash.conf << EOF
GatewayInterface $INTERFACE
GatewayAddress $PORTAL_IP
MaxClients 250
RedirectURL http://$PORTAL_IP/

FirewallRuleSet authenticated-users {
  FirewallRule allow all
}
FirewallRuleSet preauthenticated-users {
  FirewallRule allow tcp port 80
  FirewallRule allow tcp port 3000
}
FirewallRuleSet users-to-router {
  FirewallRule allow udp port 53
  FirewallRule allow tcp port 53
  FirewallRule allow udp port 67
  FirewallRule allow tcp port 22
}
EOF

# nginx
cat > /etc/nginx/sites-available/default << 'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    root /var/www/html;
    index index.html index.htm;
    
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_buffering off;
        proxy_cache off;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /api/ {
        proxy_pass http://localhost:3000;
    }
    
    location / {
        try_files $uri $uri/ /index.html;
    }

    # OS Captive Portal Endpoints (Android, iOS, Windows, Firefox)
    location = /generate_204 { return 302 http://$host/index.html; }
    location = /hotspot-detect.html { return 302 http://$host/index.html; }
    location = /connecttest.txt { return 302 http://$host/index.html; }
    location = /success.txt { return 302 http://$host/index.html; }
}
EOF

echo "[6/8] Deploying Webapp & Permissions..."
rm -rf /var/www/html/*
cp -r $(dirname "$0")/webapp/* /var/www/html/
chown -R www-data:www-data /var/www/html

echo "www-data ALL=(ALL) NOPASSWD: /usr/bin/ndsctl" > /etc/sudoers.d/ndsctl-www-data
chmod 0440 /etc/sudoers.d/ndsctl-www-data

echo "[7/8] Configuring Backend Service..."
mkdir -p /opt/captive-portal/backend
cp $(dirname "$0")/backend/server.js $(dirname "$0")/backend/package.json /opt/captive-portal/backend/
cd /opt/captive-portal/backend && npm install --production --quiet

cat > /etc/systemd/system/captive-backend.service << EOF
[Unit]
Description=Captive Portal Backend Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/captive-portal/backend
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload

echo "[8/8] Starting & Enabling Services..."
systemctl unmask hostapd
systemctl enable hostapd dnsmasq nginx nodogsplash captive-backend
systemctl start hostapd
sleep 2
systemctl start dnsmasq nginx nodogsplash captive-backend

echo "======================================================"
echo " Setup Complete! Reboot Pi to ensure everything binds."
echo "======================================================"
