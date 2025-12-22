# Vencord Krisp Toggle Plugin

Toggle Discord Krisp noise suppression with a global hotkey and Stream Deck integration.

## Features

- 🎮 **Global Hotkey**: Toggle Krisp even when Discord isn't focused (default: `Ctrl+Shift+K`)
- 🎛️ **Stream Deck Integration**: Full support for Elgato Stream Deck with live status updates
- 🔄 **Smart State Tracking**: Automatically syncs state across multiple devices
- ⚡ **Fast & Responsive**: Sub-200ms toggle response time

## Installation

### Prerequisites

- [Vencord](https://vencord.dev/) installed
- Discord Desktop client

### Steps

1. Download the latest release or clone this repository
2. Copy the `krispToggle` folder to your Vencord userplugins directory:
   - Windows: `%APPDATA%\Vencord\src\userplugins\`
   - Linux: `~/.config/Vencord/src/userplugins/`
   - macOS: `~/Library/Application Support/Vencord/src/userplugins/`

3. Restart Discord or rebuild Vencord:
```bash
   cd path/to/Vencord
   pnpm build
```

4. Enable the plugin in Discord:
   - Open Discord Settings
   - Navigate to Vencord → Plugins
   - Find "KrispToggle" and enable it

## Usage

### Hotkey

Press `Ctrl+Shift+K` (default) to toggle Krisp on/off. You can customize this in the plugin settings.

### Stream Deck

1. Install the [Krisp Toggle Stream Deck Plugin](https://github.com/DarkSide1305/streamdeck-krisp-toggle)
2. Add the Krisp Toggle button to your Stream Deck
3. Press to toggle Krisp with visual feedback

## Configuration

Open Discord Settings → Vencord → Plugins → KrispToggle:

- **Keybind**: Customize your global hotkey (e.g., `ctrl+shift+k`)
- **Stream Deck Integration**: Enable/disable the HTTP server for Stream Deck

## How It Works

The plugin hooks into Discord's MediaEngineStore to toggle between:
- **Krisp Mode**: Noise Suppression ON + Noise Cancellation ON
- **None Mode**: Both OFF

The native module runs an HTTP server (localhost:37320) that the Stream Deck plugin connects to for real-time state updates.

## Troubleshooting

### Hotkey not working
- Check if another application is using the same hotkey
- Try a different key combination in settings
- Restart Discord

### Stream Deck not connecting
- Ensure Discord is running
- Check that Stream Deck integration is enabled in plugin settings
- Verify no firewall is blocking localhost:37320

### Plugin not appearing
- Make sure you placed it in the `userplugins` folder
- Rebuild Vencord: `pnpm build`
- Restart Discord completely

## Development
```bash
# Clone the repository
git clone https://github.com/DarkSide1305/vencord-krisp-toggle.git

# Copy to Vencord userplugins
cp -r vencord-krisp-toggle path/to/Vencord/src/userplugins/krispToggle

# Rebuild Vencord
cd path/to/Vencord
pnpm build
```

## API Endpoints

When Stream Deck integration is enabled:

- `GET /health` - Check if server is running
- `GET /plugin-check` - Verify plugin is installed
- `POST /toggle` - Toggle Krisp state

## License

GPL-3.0-or-later

## Credits

Created by DarkSide1305

Part of the [Vencord](https://vencord.dev/) ecosystem.