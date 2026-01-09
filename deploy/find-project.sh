#!/bin/bash
# Helper script to find the Family Calendar project directory

echo "🔍 Finding Family Calendar project directory..."
echo ""

# Common locations to check
SEARCH_PATHS=(
    "$HOME"
    "/var/www"
    "/opt"
    "/home"
    "$(pwd)"
    "$(dirname "$(readlink -f "$0")")/.."
)

FOUND=false

for base_path in "${SEARCH_PATHS[@]}"; do
    if [ -d "$base_path" ]; then
        # Search for server.py in common locations
        while IFS= read -r -d '' dir; do
            if [ -f "$dir/server.py" ] && [ -f "$dir/index.html" ]; then
                echo "✅ Found project at: $dir"
                echo ""
                echo "To set up the server, run:"
                echo "  cd $dir"
                echo "  sudo ./deploy/setup-server.sh"
                echo ""
                FOUND=true
                break 2
            fi
        done < <(find "$base_path" -maxdepth 3 -type d -print0 2>/dev/null)
    fi
done

if [ "$FOUND" = false ]; then
    echo "❌ Could not find Family Calendar project directory"
    echo ""
    echo "Please check:"
    echo "  1. The project is cloned/extracted somewhere"
    echo "  2. It contains server.py and index.html"
    echo ""
    echo "Or manually navigate to the project directory and run:"
    echo "  cd /actual/path/to/Family-Calendar"
    echo "  sudo ./deploy/setup-server.sh"
fi










