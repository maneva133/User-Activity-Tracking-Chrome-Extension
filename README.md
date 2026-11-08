# User Activity Tracking Chrome Extension

This repository contains a Chrome extension and Spring Boot backend for tracking website usage. The extension records time by domain, and its popup displays daily, weekly, and monthly totals with a Chart.js summary. The backend can analyze usage with Google Gemini.

## Requirements

- Google Chrome
- Docker Desktop with Docker Compose
- A Gemini API key for AI analysis

## Run the backend and database

From `user-tracking-extension-backend`, start PostgreSQL and the Spring backend with:

```bash
docker compose up --build
```

The backend listens on `http://localhost:8080`; PostgreSQL listens on port `1234`. Database files persist in a named Docker volume when containers are stopped or recreated. To stop the services, press Ctrl+C and run `docker compose down`.

The default database credentials are for local development. To set your own, copy `user-tracking-extension-backend/.env.example` to `.env` in that folder and edit the values. Set `GEMINI_API_KEY` there to enable AI analysis. Do not commit `.env`.

## Load the extension

1. Open `chrome://extensions/` and enable Developer mode.
2. Choose **Load unpacked** and select the `user-tracking-extension` directory.
3. Keep the backend running at `http://localhost:8080`, which is the URL used by the extension.

## Open the analytics dashboard

With the backend running and the extension loaded in Chrome, open the extension popup and choose **Open full dashboard**. The popup passes the extension's device ID to the local dashboard at `http://localhost:8080/dashboard/index.html`. The dashboard shows tracked time, daily averages, active days, category totals, top domains, daily trends, and recent sessions for a selected date range. Rules are the default classifier; selecting Gemini asks for confirmation because it may send each distinct domain and page title in the range to the Gemini API.

## Current functionality

- Tracks active website time and saves totals through the `/api/tracking` endpoints.
- Displays per-site daily, weekly, and monthly totals in the popup.
- Shows a chart of site usage and offers Gemini-based usage analysis.

The backend also stores activity sessions and reminder events. The extension records activity sessions and supports configurable break reminders.

## Website classification

The backend classifies a site with `GET /api/classify?domain=example.com&title=Page%20title&classifier=rules` or `classifier=llm`. The rule classifier reads `user-tracking-extension-backend/src/main/resources/categories.json`; the LLM classifier uses Gemini and stores domain/title-hash predictions in PostgreSQL. LLM cache can be bypassed with `useCache=false`. The popup sends today's saved sessions to `GET /api/sessions/analyze`; the backend classifies and sums session seconds in Java for either classifier.

To evaluate both classifiers, create `evaluation/labeled_sites.csv` with columns `domain,title,true_category` and install `evaluation/requirements.txt`. Start the backend, then run `python evaluation/classification_eval.py`. It compares the rule classifier with three fresh LLM runs, prints per-class reports and run-to-run consistency, average latency and API-call counts, and writes `evaluation/classification_confusion_matrix.png`. A saved prediction CSV can be supplied with `--predictions`; it must match the input rows and include `rules_prediction` plus `llm_prediction_1`, `llm_prediction_2`, and `llm_prediction_3` columns. Optional latency and call-count columns are `rules_latency_ms`, `rules_api_calls`, `llm_latency_ms_1..3`, and `llm_api_calls_1..3`.

## Gemini configuration

Set `GEMINI_API_KEY` in the backend `.env` file to enable AI analysis. When running outside Docker, configure the matching `gemini.api.key` property. The model defaults to `gemini-1.5-flash` and can be changed with `gemini.model`.

Keep `application.properties` and API keys out of version control.
