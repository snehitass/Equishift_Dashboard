# EquiShift — ED Staffing Dashboard

A predictive staffing recommendation dashboard for Emergency Departments. EquiShift analyzes historical volume patterns to surface data-driven shift staffing recommendations, ROI impact estimates, and month-by-month trend visualizations.

## How it Works
Step 1: View Monthly Predicted Demand + Staffing Recommendations
<img width="1440" height="710" alt="intro" src="https://github.com/user-attachments/assets/a1e967f9-7f7c-4117-81bd-3620020a17ee" />

Step 2: Configure Your ROI Settings
<img width="1440" height="670" alt="roi-setup" src="https://github.com/user-attachments/assets/9b14c83c-4d3e-41f3-8bc0-a8340b779937" />

Step 3: View Anomaly Days and Explore Operational and Financial Impact of Different Staffing Levels
<img width="1438" height="704" alt="feb7" src="https://github.com/user-attachments/assets/903a3499-d21a-4b47-8b85-94f70cb11128" />

Step 4: View Monthly Summary of Staffing and Total Added Revenue, Then Export Your Schedule!
<img width="1431" height="721" alt="equishift-monthly-summary" src="https://github.com/user-attachments/assets/65719418-38ba-4351-83ac-2d90e41dbc4b" />



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
