# Quick Start Guide - Finding Your Project Directory

If you're getting "command not found" errors, you need to first locate where the Family Calendar project is installed.

## Step 1: Find the Project

Run these commands to locate the project:

```bash
# Option 1: Check the most common location (if you used setup.sh)
ls -la /var/www/family-calendar

# Option 2: Search for server.py anywhere on the system
find / -name "server.py" -type f 2>/dev/null | grep -i calendar

# Option 3: Check your current location
pwd
ls -la

# Option 4: Search for index.html
find / -name "index.html" -path "*/Family-Calendar/*" 2>/dev/null
```

## Step 2: Navigate to the Project Directory

Once you find it, navigate there:

```bash
# Example (adjust path based on what you found):
cd /var/www/family-calendar

# Or if it's in your home directory:
cd ~/Family-Calendar

# Or wherever you found it:
cd /path/you/found
```

## Step 3: Verify You're in the Right Place

Make sure these files exist:

```bash
ls -la server.py
ls -la deploy/setup-server.sh
```

## Step 4: Run the Setup Script

```bash
# Make sure script is executable
chmod +x deploy/setup-server.sh

# Run it with sudo
sudo ./deploy/setup-server.sh
```

## Common Locations:

- `/var/www/family-calendar` - If you used the full setup.sh script
- `/home/yourusername/Family-Calendar` - If you cloned it manually to your home
- `/opt/family-calendar` - Alternative location
- `~/Family-Calendar` - Your home directory






