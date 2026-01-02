#!/bin/bash
# Fresh Install Script for Family Calendar Dashboard Server
# This script removes any existing installation and sets up a fresh one

set -e

SERVICE_NAME="family-calendar"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

echo "🧹 Family Calendar Dashboard - Fresh Install"
echo "============================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root (use sudo)"
    exit 1
fi

# Detect project directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

# Allow custom project directory or port as arguments
PORT=8000
if [ -n "$1" ]; then
    if [ -d "$1" ] && [ -f "$1/server.py" ]; then
        PROJECT_DIR="$1"
        PORT=${2:-8000}
    elif [[ "$1" =~ ^[0-9]+$ ]]; then
        PORT="$1"
    else
        echo "❌ Invalid first argument: $1"
        echo "   Expected: directory path or port number"
        exit 1
    fi
fi

echo "📁 Project directory: $PROJECT_DIR"
echo "🔌 Port: $PORT"
echo ""

# Verify we're in the right place
if [ ! -f "$PROJECT_DIR/server.py" ]; then
    echo "❌ server.py not found in $PROJECT_DIR"
    echo "   Please run this script from the project directory or specify the path:"
    echo "   sudo ./deploy/fresh-install.sh [project-dir] [port]"
    exit 1
fi

# Step 1: Stop and remove existing service
echo "🛑 Stopping existing service (if running)..."
systemctl stop "$SERVICE_NAME" 2>/dev/null || true
systemctl disable "$SERVICE_NAME" 2>/dev/null || true

echo "🗑️  Removing old service file..."
rm -f "$SERVICE_FILE"

# Step 2: Kill any running Python servers on this port
echo "🔍 Checking for processes using port $PORT..."
if command -v lsof >/dev/null 2>&1; then
    PIDS=$(lsof -ti:$PORT 2>/dev/null || true)
    if [ -n "$PIDS" ]; then
        echo "   Killing processes on port $PORT..."
        kill -9 $PIDS 2>/dev/null || true
    fi
elif command -v netstat >/dev/null 2>&1; then
    PIDS=$(netstat -tlnp 2>/dev/null | grep ":$PORT " | awk '{print $7}' | cut -d'/' -f1 | grep -v '-' | sort -u || true)
    if [ -n "$PIDS" ]; then
        echo "   Killing processes on port $PORT..."
        kill -9 $PIDS 2>/dev/null || true
    fi
fi

# Step 3: Reload systemd
echo "🔄 Reloading systemd..."
systemctl daemon-reload

# Step 4: Install Python 3 if needed
echo "🐍 Checking Python 3 installation..."
if ! command -v python3 >/dev/null 2>&1; then
    echo "   Installing Python 3..."
    if command -v apt-get >/dev/null 2>&1; then
        apt-get update
        apt-get install -y python3
    elif command -v yum >/dev/null 2>&1; then
        yum install -y python3
    elif command -v dnf >/dev/null 2>&1; then
        dnf install -y python3
    else
        echo "❌ Cannot install Python 3 automatically. Please install it manually."
        exit 1
    fi
else
    PYTHON_VERSION=$(python3 --version)
    echo "   ✓ Python 3 found: $PYTHON_VERSION"
fi

# Find Python 3 executable
PYTHON_CMD=$(which python3)
if [ -z "$PYTHON_CMD" ]; then
    echo "❌ Python 3 not found in PATH"
    exit 1
fi

echo "   Using: $PYTHON_CMD"

# Step 5: Make server.py executable
echo "📝 Setting permissions..."
chmod +x "$PROJECT_DIR/server.py"
chmod +x "$PROJECT_DIR/deploy/setup-server.sh" 2>/dev/null || true

# Step 6: Determine user to run service
if [ -n "$SUDO_USER" ]; then
    RUN_USER="$SUDO_USER"
elif [ -n "$USER" ] && [ "$USER" != "root" ]; then
    RUN_USER="$USER"
else
    # Try to find a non-root user
    RUN_USER=$(getent passwd | grep -v '^root:' | grep '/home' | head -1 | cut -d: -f1 || echo "www-data")
fi

# Verify user exists
if ! id "$RUN_USER" >/dev/null 2>&1; then
    RUN_USER="www-data"
    # Create www-data if it doesn't exist
    if ! id "$RUN_USER" >/dev/null 2>&1; then
        useradd -r -s /bin/false "$RUN_USER" 2>/dev/null || true
    fi
fi

echo "👤 Service will run as user: $RUN_USER"

# Step 7: Create systemd service file
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
ExecStart=$PYTHON_CMD $PROJECT_DIR/server.py $PORT
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

echo "   ✓ Service file created at $SERVICE_FILE"

# Step 8: Set ownership and permissions on project directory
echo "🔐 Setting project directory permissions..."
chown -R "$RUN_USER:$RUN_USER" "$PROJECT_DIR"
chmod -R 755 "$PROJECT_DIR"

# Step 9: Create settings.json if it doesn't exist (with correct permissions)
if [ ! -f "$PROJECT_DIR/settings.json" ]; then
    echo "📄 Creating settings.json..."
    echo '{}' > "$PROJECT_DIR/settings.json"
    chown "$RUN_USER:$RUN_USER" "$PROJECT_DIR/settings.json"
    chmod 644 "$PROJECT_DIR/settings.json"
fi

# Step 10: Reload systemd and enable service
echo "🔄 Reloading systemd..."
systemctl daemon-reload

echo "⚙️  Enabling service to start on boot..."
systemctl enable "$SERVICE_NAME"

# Step 11: Start the service
echo "▶️  Starting service..."
if systemctl start "$SERVICE_NAME"; then
    echo "   ✓ Service started successfully"
else
    echo "❌ Failed to start service. Checking status..."
    systemctl status "$SERVICE_NAME" || true
    echo ""
    echo "📋 Check logs with:"
    echo "   sudo journalctl -u $SERVICE_NAME -n 50"
    exit 1
fi

# Step 12: Wait and verify
sleep 3
if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo ""
    echo "✅ Fresh Install Complete!"
    echo "============================================="
    echo ""
    
    # Get IP address
    IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "localhost")
    
    echo "🌐 Dashboard should be available at:"
    echo "   http://$IP:$PORT"
    echo "   http://$IP:$PORT/control.html"
    echo ""
    echo "📁 Settings file location:"
    echo "   $PROJECT_DIR/settings.json"
    echo ""
    echo "📋 Useful commands:"
    echo "   View logs:    sudo journalctl -u $SERVICE_NAME -f"
    echo "   Restart:      sudo systemctl restart $SERVICE_NAME"
    echo "   Stop:         sudo systemctl stop $SERVICE_NAME"
    echo "   Status:       sudo systemctl status $SERVICE_NAME"
    echo ""
else
    echo "❌ Service is not running. Check logs with:"
    echo "   sudo journalctl -u $SERVICE_NAME -n 50"
    exit 1
fi



