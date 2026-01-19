#!/bin/bash
# Setup script for FastAPI backend
# Updates the systemd service to use the new backend

set -e

echo "🔄 Updating Family Calendar Backend to FastAPI..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root (use sudo)"
    exit 1
fi

# Get project directory
PROJECT_DIR="/var/www/family-calendar"
if [ ! -d "$PROJECT_DIR" ]; then
    echo "❌ Project directory not found: $PROJECT_DIR"
    exit 1
fi

cd "$PROJECT_DIR"

# Install Python dependencies
echo "📦 Installing Python dependencies..."
pip3 install -r requirements.txt

# Update systemd service
echo "⚙️ Updating systemd service..."
cat > /etc/systemd/system/family-calendar.service <<EOF
[Unit]
Description=Family Calendar Dashboard (FastAPI Backend)
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=$PROJECT_DIR
Environment="PATH=$PROJECT_DIR/venv/bin:/usr/local/bin:/usr/bin:/bin"
ExecStart=/usr/bin/python3 -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and restart service
echo "🔄 Reloading systemd..."
systemctl daemon-reload

echo "🔄 Restarting service..."
systemctl restart family-calendar

echo "✅ Backend updated to FastAPI!"
echo ""
echo "Check status: sudo systemctl status family-calendar"
echo "View logs: sudo journalctl -u family-calendar -f"
echo "API docs: http://$(hostname -I | awk '{print $1}')/docs"
