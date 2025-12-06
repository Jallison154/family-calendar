#!/bin/bash
# Set up automatic git pull every 5 minutes

echo "⏰ Setting up automatic updates..."

# Install update script
sudo cp /var/www/family-calendar/deploy/update-dashboard.sh /usr/local/bin/update-dashboard
sudo chmod +x /usr/local/bin/update-dashboard

# Add cron job for auto-update every 5 minutes
(crontab -l 2>/dev/null | grep -v "update-dashboard"; echo "*/5 * * * * /usr/local/bin/update-dashboard >> /var/log/dashboard-update.log 2>&1") | crontab -

echo "✅ Auto-update configured!"
echo "   Dashboard will check for updates every 5 minutes."
echo "   Logs: /var/log/dashboard-update.log"
echo ""
echo "   To disable: crontab -e (and remove the update-dashboard line)"


