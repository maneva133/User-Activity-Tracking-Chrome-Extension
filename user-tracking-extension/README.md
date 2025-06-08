# Website Usage Tracker - Chrome Extension

This Chrome extension tracks your website usage and provides detailed analytics through a Spring Boot backend.

## Features

- Automatic website usage tracking
- Real-time statistics
- Daily and weekly usage patterns
- Usage predictions
- Time limit warnings
- Beautiful visualization with charts

## Setup

1. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select this directory

2. Configure backend URL:
   - The extension expects the backend to run at `http://localhost:8080`
   - If your backend runs on a different URL, update it in `background.js`

## Files

- `manifest.json` - Extension configuration
- `background.js` - Background tracking script
- `popup.html` - Extension popup UI
- `popup.js` - Popup functionality and charts
- `icon.png` - Extension icon

## Usage

1. The extension automatically tracks your website usage
2. Click the extension icon to view:
   - Today's statistics
   - Weekly overview
   - Usage predictions
3. Receive notifications when you exceed 5 hours on a website

## Backend Integration

This extension works with the `website-analytics-backend` Spring Boot application. Make sure to:
1. Start the backend server first
2. Keep it running while using the extension
3. Check the backend's README for setup instructions 