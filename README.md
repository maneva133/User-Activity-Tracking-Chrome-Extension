# User Activity Tracking Chrome Extension

This project contains a Chrome Manifest V3 extension, a Spring Boot 3.5 / Java 21 backend, and PostgreSQL. The extension records active tab sessions and reminder events. The backend stores them, summarizes usage, and classifies site and page-title pairs with rules or Gemini.

## Setup

Requirements: Google Chrome, Docker Desktop with Compose, and (for Gemini or Python evaluation) a Gemini API key and Python 3.10+.

1. In `user-tracking-extension-backend`, copy `.env.example` to `.env` and optionally set `GEMINI_API_KEY`. Do not commit `.env`.
2. From that directory run `docker compose up --build`.
3. In Chrome, open `chrome://extensions/`, enable Developer mode, choose **Load unpacked**, and select `user-tracking-extension`.
4. Visit a few websites with the backend running. Open the extension popup and click **Open full dashboard**.

The dashboard is served at `http://localhost:8080/dashboard/index.html`. Compose ports bind to loopback (`127.0.0.1`) for local use. PostgreSQL data is retained in the `user-tracking-extension-backend_pgdata` named volume. Stop with Ctrl+C or `docker compose down`; `docker compose down -v` also deletes the database volume.

## What is implemented

- The extension background service worker measures active website time, queues sessions while the backend is offline, and records reminder events. Browser-internal pages are skipped.
- The popup shows per-domain daily, weekly, and monthly time, a chart, reminder controls, and rule/Gemini category analysis.
- The dashboard shows totals, daily trends, category totals, top sites, recent sessions, and site controls for a selected 7/30/90-day or custom range. Its summary view uses grouped database queries and fetches only the latest 20 session details.
- Site controls can set a category override or exclude a domain for this extension device. Excluding a domain deletes its saved sessions and blocks future session writes. This cannot restore deleted history.
- The dashboard can export all sessions as CSV or delete sessions and reminder events in a selected date range.
- Category rules come from `user-tracking-extension-backend/src/main/resources/categories.json`. Gemini classifies one domain/title pair into STUDY, WORK, ENTERTAINMENT, SOCIAL, or OTHER. Results are cached in PostgreSQL; failures fall back to OTHER.
- Legacy `/api/tracking` endpoints and data remain in the backend for compatibility. The current extension uses `/api/sessions` and `/api/reminders`.

The backend currently identifies an extension installation with a local device ID; it does not provide user accounts or authentication. Keep it on your own computer. Loopback binding is not a substitute for authentication if you later host the service for multiple users.

## Classifier evaluation page

Create a CSV with columns `domain,title,true_category`, where true_category is one of the five supported category names. In the dashboard, open **Classifier evaluation**, choose the file, and run the evaluation. It reports accuracy, per-class precision/recall/F1, confusion matrices, average Gemini latency, reported API call count, and consistency across three Gemini runs. The page confirms before sending up to three uncached Gemini requests per row. Predictions can be downloaded as CSV. Rules evaluation works without Gemini; Gemini may return OTHER if its API is not configured.

The command-line evaluator is also available. Install `evaluation/requirements.txt`, start the backend, and run `python evaluation/classification_eval.py`. It reads `evaluation/labeled_sites.csv` and saves `evaluation/classification_confusion_matrix.png`. Use `--predictions` to load saved classifier outputs instead of calling the backend.

## API overview

- `GET /api/sessions` reads raw sessions for a device and date range.
- `GET /api/sessions/overview` returns database-aggregated dashboard totals.
- `GET /api/sessions/analyze?classifier=rules|llm` returns category totals (summed in Java).
- `GET /api/classify?domain=example.com&title=...&classifier=rules|llm` classifies a single site/title pair.
- `GET/PUT/DELETE /api/device-domains` reads or changes per-device category overrides and exclusions.
- `GET /api/export/{deviceId}.csv` exports sessions; `DELETE /api/sessions` deletes sessions and reminders for a device and range.

## Development checks

Backend tests are in `user-tracking-extension-backend/src/test`. The extension reminder checks are in `user-tracking-extension/reminders.test.js`. Run backend checks from `user-tracking-extension-backend` with `mvn test`; run extension checks with `node user-tracking-extension/reminders.test.js` from the repository root.
