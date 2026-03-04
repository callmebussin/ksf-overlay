# KSF Overlay

A Twitch-compatible player card overlay that displays real-time KSF stats for a player's current map.

## Architecture
- **Backend (Server)**: Node.js/Express proxy that securely communicates with the KSF API.
- **Frontend (Client)**: Electron application that displays the overlay and manages configuration.

## Setup

### 1. Backend Server
The server must be running for the overlay to fetch data.

1. Navigate to `server/`.
2. Install dependencies: `npm install`.
3. Create `.env` file (already created) with your KSF API Token.
4. Start the server:
   ```bash
   npm start
   ```
   Server runs on `http://localhost:3000`.

### 2. Client Overlay
The overlay connects to the local backend.

1. Navigate to `client/`.
2. Install dependencies: `npm install`.
3. Start the application:
   ```bash
   npm start
   ```

## Configuration
- Right-click the tray icon or use the opened Config window.
- Enter your **SteamID** (e.g., `STEAM_0:1:12345678`).
- Set refresh rate (default 60s).
- Configure opacity.

## Usage
- The overlay window is transparent and always on top.
- Press **F5** (or configured key) to manually refresh stats (60s cooldown).
- The overlay automatically updates based on the refresh rate.

## Development Notes
- **Security**: The KSF API key is stored only on the backend server. The client never communicates directly with KSF.
- **Rate Limiting**: The backend enforces rate limits to prevent API abuse.
