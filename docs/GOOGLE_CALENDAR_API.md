# Using the Google Calendar API

The dashboard can load events in two ways:

1. **ICS feeds** – Embed link, public ICS link, or “Secret address in iCal format”. No API key. Works for public calendars; for private ones you need the secret iCal URL from the calendar owner.
2. **Google Calendar API** – Uses an API key and calendar IDs. **Only works for calendars that are public** (or you use OAuth, which the app does not support yet).

---

## If you set up the API (API key)

### 1. Get an API key

- Go to [Google Cloud Console](https://console.cloud.google.com).
- Create or select a project → **APIs & Services** → **Library** → enable **Google Calendar API**.
- **APIs & Services** → **Credentials** → **Create credentials** → **API key**.
- (Recommended) Restrict the key to **Google Calendar API** and, if you want, to your server’s IP.

### 2. Get the calendar ID

- From an **embed link**:  
  `https://calendar.google.com/calendar/embed?src=CALENDAR_ID&ctz=...`  
  The value of `src` (after decoding) is the calendar ID, e.g.  
  `c_0f2eaf3714a6c8e539080a9822a72fb03088c01066c8f8e051ae76d65bddf01c@group.calendar.google.com`
- Or in Google Calendar: **Settings and sharing** for that calendar → **Integrate calendar** → “Calendar ID”.

### 3. Configure in the dashboard

- Open **Control Panel** (e.g. `control.html`).
- Under **Google Calendar**, expand **Calendar accounts** (or the section where you add an API key).
- **Add account** (if needed):
  - **API key**: paste your Google Calendar API key.
  - **Calendars**: one line per calendar in the form:
    ```text
    CALENDAR_ID, #hexcolor, Display name
    ```
    Example:
    ```text
    c_0f2eaf3714a6c8e539080a9822a72fb03088c01066c8f8e051ae76d65bddf01c@group.calendar.google.com, #3b82f6, Jonathan DiA 2
    ```
- Save. The app will fetch events from the **Calendar API** for that calendar.

### 4. Important

- **API key = public only.** If the calendar is private, the API will return 403/forbidden. To use the API with that calendar, the owner must make it **public** (e.g. “See all event details”). If you can’t make it public, use the **Secret address in iCal format** (ICS) instead of the API.

---

## Summary

| Calendar type | Use |
|---------------|-----|
| Public        | API key + calendar ID **or** embed/ICS link. |
| Private       | Only **Secret address in iCal format** (ICS). API key will not work. |

The app merges events from all configured **accounts** (API) and **ICS feeds**, and deduplicates them.
