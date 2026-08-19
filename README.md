# Architecture Visual Builder

Visual tool for mapping enterprise integration and infrastructure landscapes: systems, APIs, end-to-end flows, current vs future state, and export to Word / PowerPoint.

## Run locally

```bash
cd app
npm install
npm run dev
```

Open [http://localhost:5173/](http://localhost:5173/).

## Optional AI (SpaceXAI and others)

Copy `app/.env.example` to `app/.env` and set provider keys. Keys stay on the Vite server and are not bundled into the browser.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run build:single` | Single-file HTML build |
