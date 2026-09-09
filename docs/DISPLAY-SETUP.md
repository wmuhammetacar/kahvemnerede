# Display Device Setup

The display shows real-time ready orders on a TV/tablet/second screen in the café.

## Display URL

```
https://YOUR-DOMAIN/b/BRANCH-SLUG/display
```

## Setup Steps

### 1. Open Browser

On the display device (TV, tablet, or second monitor), open Chrome/Firefox.

### 2. Navigate to Display URL

Type or paste the display URL. No login required.

### 3. Enable Fullscreen

**Chrome/Edge:**
- Press `F11` key
- Or: Menu (⋮) → Full screen

**Firefox:**
- Press `F11` key

**Safari (iPad):**
- Tap the URL bar → tap the fullscreen icon (two arrows)
- Or: Settings → Request Desktop Site → then fullscreen

**Android TV / Smart TV Browser:**
- Browser fullscreen is usually automatic in kiosk mode
- If not: look for "Kiosk mode" or "Full screen" in browser settings

### 4. Disable Screen Sleep

**Windows:**
- Settings → System → Power → Screen → set to "Never"

**macOS:**
- System Settings → Lock Screen → set "Turn display off on battery" to "Never"

**iPad:**
- Settings → Display & Brightness → Auto-Lock → Never

**Android:**
- Settings → Display → Sleep → Never

### 5. Verify

The display should show:
- "Şu anda teslim edilmeyi bekleyen sipariş yok." when no orders are ready
- Order numbers when they become READY

### 6. Restart Behavior

After device restart:
1. Browser opens automatically (if configured) or open manually
2. Navigate to the display URL
3. Press F11 for fullscreen
4. Display is live — orders appear in real-time via SSE

## Important Notes

- Display is read-only — no interaction needed
- No login required
- Real-time updates via Server-Sent Events
- One display per branch (uses same URL)
- If display shows "connection lost", check network and refresh
