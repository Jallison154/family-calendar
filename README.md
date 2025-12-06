# Dashboard

A DAKboard-style smart home dashboard for always-on displays. Portrait 4K (9:16) optimized.

## Features

- **4-Week Calendar Grid** with multi-day event support
- **Today Summary** showing today's events with "NOW" indicator  
- **5-Day Weather Forecast** via Home Assistant or OpenWeatherMap
- **Home Assistant Monitoring** - display entity states
- **Unsplash Backgrounds** with Ken Burns effect
- **Countdown Events** for important dates
- **Quick Message** section (Dad Jokes, reminders, etc.)
- **Control Panel** for live configuration updates

## Quick Start

1. Open `index.html` in a browser (this is the dashboard)
2. Open `control.html` in another browser/device (this is the control panel)
3. Configure your API keys and settings in the control panel
4. Save - dashboard updates automatically!

**No build step required.**

## Pages

| Page | Description |
|------|-------------|
| `index.html` | Main dashboard display |
| `control.html` | Settings control panel |

## Keyboard Shortcuts (Dashboard)

| Key | Action |
|-----|--------|
| `F` | Toggle fullscreen |
| `R` | Refresh all data |
| `Space` | Next background image |
| `C` | Open control panel |

## Layout

```
┌─────────────────────────────────────────────┐
│ Clock          │ Weather                    │
│ 2:07 PM        │ 41° 🌨️  5-day forecast    │
│ December 5     │ 💨10mph 💧60%             │
├────────────────┼────────────────────────────┤
│ Today          │ Dad Joke of the Day        │
│ • 7:00 Event 1 │ Why did the scarecrow...   │
│ • 9:30 Event 2 │                            │
├─────────────────────────────────────────────┤
│                Calendar Grid                │
│  S   M   T   W   T   F   S                 │
│ Nov Dec  2   3   4   5   6                 │
│  7   8   9  10  11  12  13                 │
│ 14  15  16  17  18  19  20                 │
├─────────────────────────────────────────────┤
│ 🏠 Home Status    │ ⏰ Countdown            │
│ Living 72°F       │ Christmas    20 days    │
│ Outside 41°F      │ New Year     27 days    │
└─────────────────────────────────────────────┘
```

## Configuration

All settings are managed via `control.html` and stored in browser localStorage.

### API Keys Needed

1. **Unsplash** (free) - [unsplash.com/developers](https://unsplash.com/developers)
2. **Google Calendar** - [Google Cloud Console](https://console.cloud.google.com)
3. **OpenWeatherMap** (optional) - [openweathermap.org/api](https://openweathermap.org/api)
4. **Home Assistant** - Long-lived access token from your profile

### Multiple Calendar Accounts

The control panel supports multiple Google accounts, each with their own API key and calendars. Perfect for combining work and personal calendars.

## Live Sync

Changes made in `control.html` automatically sync to `index.html` via localStorage events. No page refresh needed on the dashboard!

## Deployment

### Proxmox/VM (One-liner setup)

```bash
curl -sSL https://raw.githubusercontent.com/Jallison154/family-calendar/main/deploy/setup.sh | bash -s -- https://github.com/Jallison154/family-calendar.git
```

This will:
- Install nginx and git
- Clone the repository
- Configure the web server
- Optimize VM for fast shutdown/restart

Dashboard will be available at `http://[vm-ip]`

### Local

```bash
# Python
python -m http.server 8000

# Node
npx serve
```

### Kiosk Mode (Raspberry Pi)

```bash
chromium-browser --kiosk --noerrdialogs http://localhost:8000
```

Access control panel from your phone: `http://[pi-ip]:8000/control.html`

## Files

```
├── index.html       # Main dashboard
├── control.html     # Control panel
├── css/
│   ├── style.css    # Dashboard styles
│   └── animations.css
├── js/
│   ├── config.js    # Default config
│   ├── app.js       # Main app
│   ├── settings.js  # Settings manager
│   ├── calendar.js  # Calendar widget
│   ├── widgets.js   # Clock, weather, etc.
│   ├── homeassistant.js
│   └── unsplash.js
└── README.md
```

## Browser Support

Chrome/Chromium recommended. Also works in Firefox, Safari, Edge.

## License

MIT
