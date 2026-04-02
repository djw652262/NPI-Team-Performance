# Electrical NPI Performance Dashboard

A static web app that supports two analytics experiences from CSV data.

## Dashboard 1: Generic CSV Analytics

- Drag-and-drop CSV upload
- Automatic column detection (numeric, date, categorical)
- Charts: bar, line, pie
- Dynamic filters for categorical columns
- Auto-generated insights (for example: peak/trend summaries)

## Dashboard 2: PCB Review Findings (Specialized)

Designed for `pcb_review_findings.csv` style data with columns like:

- `PCB Design`
- `Finding ID`
- `Issue Type`
- `Status`
- `Designer`
- `Reviewer`
- `Designer Response`

Features:

- Dedicated PCB findings dashboard shown below the generic dashboard
- Filters:
  - PCB Design
  - Status
  - Designer
  - Reviewer
- KPI cards:
  - Total Findings
  - Open
  - In Progress
  - Resolved
- Charts:
  - Status Distribution (doughnut)
  - Top Issue Types (bar)
- Insights summary and filtered findings table

## Files

- `index.html`
- `styles.css`
- `app.js`
- `electrical_npi_performance.csv` (generic demo CSV)
- `pcb_review_findings.csv` (PCB dashboard source CSV)

## Run locally

You can open `index.html` directly, but browsers may block automatic CSV loading in `file://` mode.

Recommended:

```powershell
cd "C:\Users\Owner\GitHub\NPI Team Performance"
python -m http.server 8080
```

Then open:

- `http://localhost:8080`

In `file://` mode, if PCB data does not auto-load, use the **Upload PCB CSV** button in the PCB dashboard.

## Host live on GitHub Pages

1. Push this folder to a GitHub repository.
2. In GitHub: `Settings -> Pages`.
3. Under "Build and deployment", choose:
   - Source: `Deploy from a branch`
   - Branch: `main` (or your default branch), folder `/ (root)`
4. Save and wait for deployment.
5. Open the generated GitHub Pages URL.
