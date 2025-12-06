#!/bin/bash
# Quick update script - pulls latest from git

WEB_DIR="/var/www/family-calendar"

echo "🔄 Updating Family Calendar Dashboard..."

# Fix git safe directory issue
git config --global --add safe.directory $WEB_DIR

cd $WEB_DIR

# Stash any local config changes
git stash 2>/dev/null || true

# Pull latest
git pull origin main

# Restore local config (if any)
git stash pop 2>/dev/null || true

# Fix permissions
sudo chown -R www-data:www-data $WEB_DIR

echo "✅ Update complete!"
echo "   Refresh your browser to see changes."
