#!/bin/bash
# Setup script for Family Calendar Dashboard Server
# Installs Python server and creates systemd service for auto-start

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
SERVICE_NAME="family-calendar"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

echo "🚀 Family Calendar Dashboard Server Setup"
echo "=========================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root (use sudo)"
    exit 1
fi

# Check for Python 3
if ! command -v python3 &> /dev/null; then
    echo "📦 Installing Python 3..."
    apt-get update
    apt-get install -y python3
fi

# Make server.py executable
if [ -f "$PROJECT_DIR/server.py" ]; then
    chmod +x "$PROJECT_DIR/server.py"
    echo "✓ Server script is executable"
else
    echo "❌ server.py not found in $PROJECT_DIR"
    exit 1
fi

# Get the port (default 8000)
PORT=${1:-8000}

# Get the user who should run the service (try to detect current user or use www-data)
if [ -n "$SUDO_USER" ]; then
    RUN_USER="$SUDO_USER"
elif [ -n "$USER" ] && [ "$USER" != "root" ]; then
    RUN_USER="$USER"
else
    RUN_USER="www-data"
fi

# Get user's home directory
USER_HOME=$(getent passwd "$RUN_USER" | cut -d: -f6)

echo "📝 Creating systemd service..."
cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Family Calendar Dashboard Server
After=network.target

[Service]
Type=simple
User=$RUN_USER
Group=$RUN_USER
WorkingDirectory=$PROJECT_DIR
ExecStart=/usr/bin/python3 $PROJECT_DIR/server.py $PORT
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=$PROJECT_DIR

[Install]
WantedBy=multi-user.target
EOF

echo "✓ Service file created at $SERVICE_FILE"

# Reload systemd
echo "🔄 Reloading systemd..."
systemctl daemon-reload

# Enable service to start on boot
echo "⚙️  Enabling service to start on boot..."
systemctl enable "$SERVICE_NAME"

# Start the service
echo "▶️  Starting service..."
if systemctl start "$SERVICE_NAME"; then
    echo "✓ Service started successfully"
else
    echo "❌ Failed to start service. Checking status..."
    systemctl status "$SERVICE_NAME" || true
    exit 1
fi

# Wait a moment and check status
sleep 2
if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo ""
    echo "✅ Setup complete!"
    echo "=========================================="
    echo ""
    echo "📊 Service Status:"
    systemctl status "$SERVICE_NAME" --no-pager -l || true
    echo ""
    echo "📝 Useful commands:"
    echo "  View logs:     sudo journalctl -u $SERVICE_NAME -f"
    echo "  Restart:       sudo systemctl restart $SERVICE_NAME"
    echo "  Stop:          sudo systemctl stop $SERVICE_NAME"
    echo "  Status:        sudo systemctl status $SERVICE_NAME"
    echo ""
    
    # Try to get the IP address
    IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "localhost")
    echo "🌐 Dashboard should be available at:"
    echo "   http://$IP:$PORT"
    echo "   http://$IP:$PORT/control.html"
    echo ""
else
    echo "❌ Service is not running. Check logs with:"
    echo "   sudo journalctl -u $SERVICE_NAME -n 50"
    exit 1
fi

