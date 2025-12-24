# Family Calendar Dashboard - Project Plan

## Overview
A clean, always-on family calendar dashboard for a wall-mounted 4K portrait TV (43"). Designed for easy reading and family coordination.

## Display Specifications
- **Size**: 43" 4K TV
- **Orientation**: Portrait (vertical)
- **Resolution**: 4K (3840x2160) in portrait mode
- **Interaction**: Non-touch (touchless display)
- **Usage**: Always-on wall-mounted display

## Core Features

### 1. Calendar (Primary Feature)
- **Source**: Google Calendar (ICS feeds or API)
- **Display**: Next 4 weeks visible
- **Features**:
  - Color-coded events by calendar
  - Family member filtering/tabs
  - Today highlighted
  - Event details on hover (if mouse available)
  - Multi-day event spanning
  - All-day events clearly marked

### 2. Weather Widget
- **Source**: Home Assistant (National Weather Service)
- **Display**: Large, prominent
- **Data**:
  - Current temperature (large)
  - Current conditions
  - "Feels like" temperature
  - Humidity, wind speed
  - 5-day forecast with icons
  - Weather effects (snow, rain, etc.) on background

### 3. Time Widget
- **Display**: Large, prominent clock
- **Features**:
  - 12/24 hour format option
  - Current date
  - Time-based greeting
  - Smooth transitions

### 4. Home Assistant Integration
- **Display**: Entity status cards
- **Features**:
  - Temperature sensors
  - Light status
  - Door/window sensors
  - Other configured entities
  - Real-time updates via WebSocket

### 5. Visitor Mode
- **Trigger**: Manual toggle (via control panel or Home Assistant)
- **Behavior**: 
  - Hides sensitive information
  - Shows only public calendar events
  - Simplified view
  - Maybe shows welcome message

### 6. Dad Jokes
- **Source**: Online API (icanhazdadjoke.com or similar)
- **Display**: Rotating jokes
- **Update**: Every 5 minutes

### 7. ONVIF Camera Feeds (Optional/Cool Feature)
- **Display**: Small camera previews
- **Features**:
  - Live feed from ONVIF cameras
  - Configurable positions
  - Maybe motion-triggered larger view

## Layout System

### Widget-Based Architecture
- **Modular widgets**: Each feature is a widget
- **Grid system**: CSS Grid for flexible layout
- **Responsive sizing**: Widgets can be resized
- **Positioning**: Absolute or grid-based positioning

### Layout Editor (Control Panel)
- **Drag-and-drop**: Arrange widgets visually
- **Resize handles**: Adjust widget sizes
- **Save layout**: Persist to localStorage/config
- **Preview mode**: See changes before applying
- **Presets**: Pre-configured layouts

### Default Layout (Portrait 4K)
```
┌─────────────────────────────────┐
│  Header (Family Name + Month)    │
├─────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐    │
│  │  Clock   │  │ Weather  │    │
│  │  (Large) │  │  (Large) │    │
│  └──────────┘  └──────────┘    │
├─────────────────────────────────┤
│  ┌──────────────────────────┐  │
│  │                          │  │
│  │    Calendar (4 Weeks)    │  │
│  │    (Main Focus Area)     │  │
│  │                          │  │
│  └──────────────────────────┘  │
├─────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐    │
│  │ Home     │  │ Dad      │    │
│  │ Assistant│  │ Joke     │    │
│  └──────────┘  └──────────┘    │
└─────────────────────────────────┘
```

## Technical Architecture

### File Structure
```
/
├── index.html              # Main dashboard
├── control.html            # Control panel (layout editor)
├── css/
│   ├── style.css          # Main styles
│   ├── widgets.css        # Widget-specific styles
│   └── layout-editor.css  # Layout editor styles
├── js/
│   ├── app.js             # Main application
│   ├── config.js          # Configuration
│   ├── widgets/
│   │   ├── calendar.js    # Calendar widget
│   │   ├── weather.js     # Weather widget
│   │   ├── clock.js       # Clock widget
│   │   ├── homeassistant.js # HA widget
│   │   ├── dadjoke.js     # Dad joke widget
│   │   └── camera.js      # ONVIF camera widget
│   ├── layout/
│   │   ├── layout-manager.js # Layout persistence
│   │   └── widget-registry.js # Widget registry
│   ├── integrations/
│   │   ├── google-calendar.js
│   │   ├── homeassistant.js
│   │   └── onvif.js
│   └── utils/
│       ├── api.js
│       └── helpers.js
└── README.md
```

### Widget System
- **Base Widget Class**: Common functionality
- **Widget Registry**: Register/load widgets
- **Layout Manager**: Save/load widget positions and sizes
- **Event System**: Widget communication

### Data Flow
1. **Config Load**: Load from localStorage or config.js
2. **Widget Init**: Initialize widgets based on layout
3. **Data Fetch**: Fetch from APIs (Google Calendar, HA, etc.)
4. **Render**: Update DOM with data
5. **Auto-refresh**: Scheduled updates

## Integration Details

### Google Calendar
- **Method**: ICS feeds (easier, no API key needed)
- **Alternative**: Google Calendar API (if needed)
- **Sync**: Every 5 minutes
- **Features**: Multiple calendars, color coding

### Home Assistant
- **Connection**: WebSocket API
- **Weather**: NWS integration entity
- **Entities**: Configurable list
- **Updates**: Real-time via WebSocket

### ONVIF Cameras
- **Library**: Use ONVIF library or direct RTSP
- **Display**: Small preview windows
- **Refresh**: Every few seconds or on motion

### Dad Jokes API
- **Source**: icanhazdadjoke.com
- **Update**: Every 5 minutes
- **Fallback**: Local jokes if API fails

## Visitor Mode

### Implementation
- **Toggle**: Home Assistant entity or control panel
- **Storage**: localStorage flag
- **Behavior**:
  - Hide sensitive calendar events
  - Hide Home Assistant entity details
  - Show simplified view
  - Maybe show welcome message

### Configuration
- **Sensitive calendars**: Mark in config
- **Hidden entities**: List in config
- **Welcome message**: Customizable

## Styling & Design

### Color Scheme
- **Base**: Clean, modern
- **Background**: Unsplash images (rotating)
- **Overlay**: Dark semi-transparent
- **Text**: High contrast, easy to read
- **Accents**: Subtle, not distracting

### Typography
- **Font**: Outfit or similar (clean, readable)
- **Sizes**: Large for 4K display
- **Hierarchy**: Clear size differences

### Responsive Design
- **4K Portrait**: Primary target
- **Widget scaling**: Based on viewport
- **Font scaling**: Use rem/em for scalability

## Performance

### Optimization
- **Lazy loading**: Load widgets on demand
- **Image optimization**: Compress/optimize images
- **Caching**: Cache API responses
- **Debouncing**: Limit API calls
- **WebSocket**: Efficient real-time updates

### Always-On Considerations
- **Memory management**: Clean up unused resources
- **Error handling**: Graceful degradation
- **Auto-reconnect**: Reconnect on connection loss
- **Health checks**: Monitor widget health

## Implementation Phases

### Phase 1: Foundation
- [ ] Basic HTML structure
- [ ] Widget system architecture
- [ ] Layout manager
- [ ] Configuration system

### Phase 2: Core Widgets
- [ ] Clock widget
- [ ] Weather widget (Home Assistant)
- [ ] Calendar widget (Google Calendar)
- [ ] Basic styling

### Phase 3: Integrations
- [ ] Home Assistant integration
- [ ] Google Calendar integration
- [ ] Dad jokes API

### Phase 4: Advanced Features
- [ ] Layout editor (control panel)
- [ ] Visitor mode
- [ ] ONVIF camera feeds
- [ ] Widget resizing/positioning

### Phase 5: Polish
- [ ] Performance optimization
- [ ] Error handling
- [ ] Documentation
- [ ] Testing

## Configuration

### Control Panel Features
- **Layout Editor**: Drag-and-drop widget placement
- **Widget Settings**: Configure each widget
- [ ] Google Calendar feeds
- [ ] Home Assistant connection
- [ ] Weather entity selection
- [ ] ONVIF camera configuration
- [ ] Visitor mode settings
- [ ] Widget size/position adjustments

## Next Steps

1. **Review this plan** - Confirm requirements
2. **Start Phase 1** - Build foundation
3. **Iterate** - Build and test incrementally


