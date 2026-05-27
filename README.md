# EquiShift — ED Staffing Dashboard

A predictive staffing recommendation dashboard for Emergency Departments. EquiShift analyzes historical volume patterns to surface data-driven shift staffing recommendations, ROI impact estimates, and month-by-month trend visualizations.

## Features

- **Predictive recommendations** — per-shift staffing suggestions (Doctors, APPs, Nurses) based on volume probability thresholds
- **Impact analysis** — see projected changes to throughput, wait times, and patient capacity when adjusting staff levels
- **ROI calculator** — configurable cost/revenue inputs to quantify the financial impact of staffing decisions
- **Interactive adjustments** — override recommended staffing and see real-time impact recalculation
- **Trend charts** — area, line, and bar charts for volume and staffing patterns across the month

## Tech Stack

| Layer | Library |
|---|---|
| UI | React 18 |
| Charts | Recharts |
| Icons | Lucide React |
| Styling | Tailwind CSS |
| Build | Vite |

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Start dev server
npm run dev
```

The app will be available at `http://localhost:5173`.

## Build

```bash
npm run build
```

Output goes to `dist/`.

## Project Structure

```
src/
├── App.jsx                  # Entry point
├── EDStaffingDashboard.jsx  # Main dashboard component
└── index.css                # Global styles
```
