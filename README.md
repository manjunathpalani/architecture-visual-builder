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

## VS Code

The builder can run as a VS Code custom editor so architecture JSON lives in the workspace and each component can launch a linked coding agent (Copilot Chat).

A packaged `.vsix` is **unsigned**. VS Code will say **Extension is not signed**. Load from disk instead:

```bash
cd app
npm install
npm run build:single

cd ../extension
npm install
npm run open
```

`npm run open` starts an Extension Development Host (no signature). To keep it installed across restarts: `npm run install-local` in `extension/`, then reload the window.

- **Architecture Visual Builder: New Architecture Diagram**
- Open `*.architecture.json` / `*.avb.json` in the canvas
- Mark canvas items as **new** or **changed**, define a feature, generate work instructions, then **Apply** to run a linked coding agent

See `extension/README.md` for unsigned install, VSIX **Install Anyway**, and the agent workflow.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run build:single` | Single-file HTML build |
