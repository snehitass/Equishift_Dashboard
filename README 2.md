# EquiShift Dashboard Setup

## File Organization

Put all these files in this structure:

```
equishift-dashboard/
├── src/
│   ├── EDStaffingDashboard.jsx  ← The main dashboard
│   ├── App.jsx                  ← Entry point
│   └── index.css                ← Styles
├── index.html                   ← HTML file
├── package.json                 ← Dependencies
├── vite.config.js              ← Vite config
└── README.md                    ← This file
```

## Setup Steps

### 1. Create the folder structure
```bash
mkdir equishift-dashboard
cd equishift-dashboard
mkdir src
```

### 2. Place the files:

**Put in ROOT folder (equishift-dashboard/):**
- index.html
- package.json
- vite.config.js
- README.md

**Put in src/ folder:**
- EDStaffingDashboard.jsx
- App.jsx
- index.css

### 3. Install dependencies
```bash
npm install
```

### 4. Run the app
```bash
npm run dev
```

The dashboard will open at http://localhost:3000

## That's it!

If you get errors:
1. Make sure Node.js is installed: https://nodejs.org/
2. Make sure files are in the correct folders (see structure above)
3. Make sure you ran `npm install` before `npm run dev`

## Build for production
```bash
npm run build
```
Output will be in the `dist/` folder.
