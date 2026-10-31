# User Activity Tracking Chrome Extension

This repository contains a Chrome extension and Spring Boot backend for tracking website usage. The extension records time by domain, and its popup displays daily, weekly, and monthly totals with a Chart.js summary. The backend can analyze usage with Google Gemini.

## Requirements

- Google Chrome
- Java 21 and Maven
- PostgreSQL
- A Gemini API key for AI analysis

## Run the backend

1. Create a PostgreSQL database and configure its connection in `user-tracking-extension-backend/src/main/resources/application.properties`.
2. Set `gemini.api.key` in that file. You can use `application-example.properties` as a starting point.
3. From `user-tracking-extension-backend`, run:

   ```bash
   mvn spring-boot:run
   ```

The backend listens on `http://localhost:8080` by default.

## Load the extension

1. Open `chrome://extensions/` and enable Developer mode.
2. Choose **Load unpacked** and select the `user-tracking-extension` directory.
3. Keep the backend running at `http://localhost:8080`, which is the URL used by the extension.

## Current functionality

- Tracks active website time and saves totals through the `/api/tracking` endpoints.
- Displays per-site daily, weekly, and monthly totals in the popup.
- Shows a chart of site usage and offers Gemini-based usage analysis.

The backend also provides activity session and reminder event endpoints. The extension currently records activity sessions; reminder scheduling and daily or weekly report views are not implemented.

## Gemini configuration

Set `gemini.api.key` in `application.properties`. The model defaults to `gemini-1.5-flash` and can be changed with `gemini.model`. The API base URL is configured with `gemini.api.url`; the example file uses Google's Generative Language API endpoint.

Keep `application.properties` and API keys out of version control.
