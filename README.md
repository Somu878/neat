# Neat

![Nibby, the Neat mascot](assets/neat-monster-logo-transparent.png)

Meet **Nibby**, the tab-munching little alien who eats duplicate tabs, tucks stale tabs into hypersleep, and sorts the rest into tidy Chrome tab groups. Neat uses built-in Chrome AI when available — completely free, no API keys needed.

## Features

- **Nap stale tabs** — closes tabs you haven't accessed in N days (default: 5)
- **Feed Nibby duplicates** — deduplicates tabs by URL, keeping the active one
- **Auto-organize by category** — groups tabs into labeled Chrome tab groups (Dev, Work, Social, Shopping, etc.)
- **Chrome AI categorization** — uses `window.ai.languageModel` to categorize tabs the rules can't identify, runs locally on your device
- **80+ built-in rules** — instantly categorizes GitHub, YouTube, Gmail, LinkedIn, and 80+ other sites with zero AI calls
- **Auto-cleanup** — optional hourly background sweep
- **Playful UI** — a bright, tactile interface with Nibby's little tab-snack animations
- **Transparent mascot icon** — Nibby stays crisp in the toolbar on light and dark themes

## How Categorization Works

```
Tab URL
  │
  ├─ Matches a known rule? ── Yes ──▶ Category assigned instantly (0ms, 0 cost)
  │
  └─ No ──▶ Chrome AI categorizes it locally (no data leaves your browser)
                │
                └─ Chrome AI unavailable? ──▶ "Other"
```

Categories: `dev`, `work`, `social`, `shopping`, `entertainment`, `news`, `docs`, `finance`, `travel`, `learning`, `health`, `other`

## Install

1. Go to `chrome://flags/#optimization-guide-on-device-model` and set to **Enabled**
2. Restart Chrome — it will download the on-device model (~50MB)
3. Clone this repo:
   ```bash
   git clone https://github.com/Somu878/neat.git
   ```
4. Go to `chrome://extensions/`
5. Enable **Developer mode** (top right)
6. Click **Load unpacked** and select the `neat` folder

## Enable Chrome AI (Recommended)

Chrome AI powers categorization for tabs that rules can't identify. It runs entirely on your device.

1. Open `chrome://flags/#optimization-guide-on-device-model`
2. Set to **Enabled**
3. Restart Chrome

Without Chrome AI, Neat still works — it just falls back to rules for unknown sites (which covers most popular sites).

## Usage

- Click the Neat icon to see your tab stats
- **Sweep All** — lets Nibby eat duplicates + nap stale tabs + organize by category
- **Remove Duplicates** — feeds duplicate tabs to Nibby
- **Close Stale** — sends inactive tabs to Nibby's nap zone
- **Organize by Category** — groups tabs into labeled Chrome tab groups
- **Settings** — adjust stale threshold, toggle auto-cleanup

Nibby does a tiny snack animation when the popup opens, then chomps again when duplicates or stale tabs are cleaned up. Useful? Yes. Necessary? Spiritually.

## Project Structure

```
neat/
├── manifest.json          # Manifest V3 config
├── background.js          # Service worker (tab tracking, auto-cleanup)
├── lib/
│   ├── ai-provider.js     # Chrome AI + rule-based categorization
│   ├── storage.js          # Settings & tab metadata persistence
│   └── tab-manager.js      # Core logic: duplicates, stale, grouping
├── popup.html/css/js       # Main popup UI
├── options.html/css/js     # Settings page
├── icons/                   # Extension icons
└── assets/                  # Mascot/logo source assets
```

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Stale threshold | 5 days | Tabs not accessed for this many days are marked stale |
| Auto-cleanup | Disabled | Runs hourly — removes stale tabs & duplicates |

## Tech Stack

- **Manifest V3** Chrome Extension
- **Chrome AI** (`window.ai.languageModel`) for on-device categorization
- **Zero dependencies** — no build step, no npm, runs in-browser
- **Rules-first** — 80+ URL patterns cover most popular sites instantly

## License

MIT
