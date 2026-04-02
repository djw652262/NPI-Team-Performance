# Electrical NPI Performance Dashboard

A static web app that turns any CSV file into an interactive analytics dashboard.

## Features

- Drag-and-drop CSV upload
- Automatic column detection (numeric, date, categorical)
- Charts: bar, line, pie
- Dynamic filters for categorical columns
- Auto-generated insights (for example: revenue peak/trend summaries)
- Works as a static site, ideal for GitHub Pages

## Files

- `index.html`
- `styles.css`
- `app.js`
- `electrical_npi_performance.csv` (sample/demo CSV)

## Run locally

Open `index.html` in your browser.

For best behavior (and to avoid local browser file restrictions), use a simple local server:

```powershell
cd "C:\Users\Owner\GitHub\NPI Team Performance"
python -m http.server 8080
```

Then visit `http://localhost:8080`.

## Host live on GitHub Pages

1. Push this folder to a GitHub repository.
2. In GitHub: `Settings -> Pages`.
3. Under "Build and deployment", choose:
   - Source: `Deploy from a branch`
   - Branch: `main` (or your default branch), folder `/ (root)`
4. Save and wait for deployment.
5. Open the generated GitHub Pages URL.
