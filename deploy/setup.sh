#!/bin/bash
# Family Calendar Dashboard - Setup Script
# Works on VMs, LXC containers, and bare metal

set -e

echo "🏠 Family Calendar Dashboard - Setup"
echo "===================================="

# Detect if running in LXC container
IS_LXC=false
if [ -f /proc/1/environ ] && grep -q "container=lxc" /proc/1/environ 2>/dev/null; then
    IS_LXC=true
    echo "📦 Detected: LXC Container"
elif [ -d /proc/vz ] || grep -q "lxc" /proc/1/cgroup 2>/dev/null; then
    IS_LXC=true
    echo "📦 Detected: LXC Container"
else
    echo "📦 Detected: VM or Bare Metal"
fi

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install required packages
echo "📦 Installing nginx and git..."
apt install -y nginx git

# ============================================
# SYSTEMD TIMEOUT FIXES (safe for all)
# ============================================
echo "⚡ Optimizing systemd timeouts..."

mkdir -p /etc/systemd/system.conf.d
cat > /etc/systemd/system.conf.d/timeout.conf <<EOF
[Manager]
DefaultTimeoutStartSec=30s
DefaultTimeoutStopSec=10s
EOF

# Make nginx stop faster
mkdir -p /etc/systemd/system/nginx.service.d
cat > /etc/systemd/system/nginx.service.d/override.conf <<EOF
[Service]
TimeoutStopSec=5
EOF

# Disable network wait (safe for all)
systemctl disable systemd-networkd-wait-online.service 2>/dev/null || true
systemctl disable NetworkManager-wait-online.service 2>/dev/null || true

# Apply systemd changes
systemctl daemon-reload

# ============================================
# VM-ONLY FIXES (skip in LXC)
# ============================================
if [ "$IS_LXC" = false ]; then
    echo "🔧 Applying VM-specific optimizations..."
    
    # Disable cloud-init
    systemctl disable cloud-init.service cloud-init-local.service cloud-config.service cloud-final.service 2>/dev/null || true
    
    # Disable snapd
    systemctl disable snapd.service snapd.seeded.service 2>/dev/null || true
    
    # Mask plymouth
    systemctl mask plymouth-start.service plymouth-quit.service plymouth-quit-wait.service 2>/dev/null || true
    
    # Fix GRUB
    if [ -f /etc/default/grub ]; then
        sed -i 's/GRUB_CMDLINE_LINUX_DEFAULT=".*"/GRUB_CMDLINE_LINUX_DEFAULT=""/' /etc/default/grub
        sed -i 's/GRUB_TIMEOUT=.*/GRUB_TIMEOUT=2/' /etc/default/grub
        update-grub 2>/dev/null || true
    fi
    
    # Set text mode
    systemctl set-default multi-user.target
fi

echo "   ✓ System optimizations applied"

# ============================================
# Setup web directory
# ============================================
WEB_DIR="/var/www/family-calendar"
echo "📁 Creating web directory at $WEB_DIR..."
mkdir -p $WEB_DIR

# Add safe directory for git
git config --global --add safe.directory $WEB_DIR

# Clone or pull repository
REPO_URL="${1:-https://github.com/Jallison154/family-calendar.git}"

if [ -d "$WEB_DIR/.git" ]; then
    echo "🔄 Pulling latest changes..."
    cd $WEB_DIR
    git fetch origin main
    git reset --hard origin/main
else
    echo "📥 Cloning repository..."
    git clone $REPO_URL $WEB_DIR
fi

# Set permissions
chown -R www-data:www-data $WEB_DIR
chmod -R 755 $WEB_DIR

# ============================================
# Configure nginx
# ============================================
echo "⚙️ Configuring nginx..."
cat > /etc/nginx/sites-available/family-calendar <<'NGINX'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    
    root /var/www/family-calendar;
    index index.html;
    
    server_name _;
    
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    
    # Proxy API requests to Python server
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
}
NGINX

ln -sf /etc/nginx/sites-available/family-calendar /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

echo "🔄 Starting nginx..."
nginx -t
systemctl restart nginx
systemctl enable nginx

# ============================================
# Install update script
# ============================================
cat > /usr/local/bin/update-dashboard <<'SCRIPT'
#!/bin/bash
cd /var/www/family-calendar
git config --global --add safe.directory /var/www/family-calendar
git fetch origin main
git reset --hard origin/main
chown -R www-data:www-data /var/www/family-calendar
echo "✅ Dashboard updated!"
SCRIPT
chmod +x /usr/local/bin/update-dashboard

# Get IP address
IP=$(hostname -I | awk '{print $1}')

echo ""
echo "✅ Setup complete!"
echo "===================================="
echo "🌐 Dashboard: http://$IP"
echo "🌐 Control:   http://$IP/control.html"
echo ""
echo "📝 Update command: update-dashboard"
echo ""
