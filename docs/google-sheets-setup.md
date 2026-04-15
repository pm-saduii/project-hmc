# Google Sheets Setup Guide

## 1. Create a Google Cloud Project

1. Visit https://console.cloud.google.com
2. Click **Select a project → New Project**
3. Name it `ProjectMS` and click **Create**

## 2. Enable the Google Sheets API

1. In the left menu: **APIs & Services → Library**
2. Search for **"Google Sheets API"** → Click **Enable**

## 3. Create a Service Account

1. **APIs & Services → Credentials → Create Credentials → Service Account**
2. Name: `projectms-service`, click **Create and Continue → Done**

## 4. Generate a JSON Key

1. Click your service account → **Keys** tab → **Add Key → Create new key → JSON**
2. The `.json` file downloads automatically

## 5. Extract Values for `.env`

From the downloaded JSON:

```
GOOGLE_SERVICE_ACCOUNT_EMAIL=<client_email>
GOOGLE_PRIVATE_KEY=<private_key>   # keep literal \n characters
```

## 6. Create the Spreadsheet

1. Create a new Google Sheet at https://sheets.google.com
2. Rename the first tab to **Tasks**
3. Copy the Spreadsheet ID from the URL:
   ```
   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
   ```
4. Set `GOOGLE_SPREADSHEET_ID=SPREADSHEET_ID` in `.env`

## 7. Share with Service Account

Click **Share**, paste `client_email`, set role to **Editor**.

## 8. Column Reference

| Col | Header            | Description                          |
|-----|-------------------|--------------------------------------|
| A   | `id`              | UUID (auto-generated)               |
| B   | `wbs`             | Work Breakdown Structure number     |
| C   | `taskName`        | Task display name                   |
| D   | `startDate`       | YYYY-MM-DD                          |
| E   | `endDate`         | YYYY-MM-DD                          |
| F   | `duration`        | Days (auto-calculated)              |
| G   | `percentComplete` | 0–100                               |
| H   | `resource`        | Assigned person                     |
| I   | `relatedTask`     | Predecessor task ID (FS dependency) |
| J   | `parentId`        | Parent task ID (blank = root)       |
| K   | `level`           | Depth (0 = root)                    |
| L   | `order`           | Sort order                          |

> The backend writes the header row automatically on first run.
