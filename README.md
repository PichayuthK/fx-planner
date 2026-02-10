# Forex Plan

Static web app for **port growth projection** and **daily trading log**. Data is stored in the browser (localStorage). Deploy to GitHub Pages.

## Run locally

Open `index.html` in a browser, or:

```bash
npx serve .
```

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. Settings → Pages → Source: Deploy from branch → main (or your branch) → / (root).
3. Site will be at `https://<username>.github.io/forex-plan/`.

## Features

- **Port growth projection**: Enter capital, risk %, TP/SL points, max trades per day, target $/day. Get max lot per order and number of weeks to reach the goal. Capital compounds weekly.
- **Daily trading log**: Add Win/Loss, amount, points, date. View total P&L and comparison vs your last projection (on track / behind).

## Forex assumptions

- 0.01 lot × 100 points (correct direction) = $1 profit.
- Max lot = (capital × risk%) / SL points, rounded down to 0.01 steps.
- Projection assumes all trades win (optimistic).
