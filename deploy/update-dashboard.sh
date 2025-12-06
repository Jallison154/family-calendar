#!/bin/bash
# Quick update script - pulls latest from git

WEB_DIR="/var/www/family-calendar"

echo "🔄 Updating Family Calendar Dashboard..."

# Fix git safe directory issue
git config --global --add safe.directory $WEB_DIR

cd $WEB_DIR

# Reset to match remote (handles divergent branches)
git fetch origin main
git reset --hard origin/main

# Fix permissions
chown -R www-data:www-data $WEB_DIR

echo "✅ Update complete!"
echo "   Refresh your browser to see changes."
