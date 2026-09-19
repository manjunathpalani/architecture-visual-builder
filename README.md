# Architecture Visual Builder

Visual tool for mapping enterprise integration and infrastructure landscapes: systems, APIs, end-to-end flows, current vs future state, and export to Word / PowerPoint. Word SAD export includes nested diagrams, sequence flows, and non-functional requirements. **AI → Write SAD** drafts the narrative with your configured engine.

## Run locally

```bash
cd app
npm install
npm run dev
```

Open [http://localhost:5173/](http://localhost:5173/).

## Optional AI (SpaceXAI, Copilot, and others)

Copy `app/.env.example` to `app/.env` and set provider keys. Keys stay on the Vite server and are not bundled into the browser.

**GitHub Copilot** is a first-class engine in **Settings → AI engines**. In the VS Code extension it uses the signed-in Copilot Chat model (no key). In the browser, paste a GitHub token with Copilot or GitHub Models access, or set `GITHUB_TOKEN`.

## VS Code

The builder can run as a VS Code custom editor so architecture JSON lives in the workspace and each component can launch a linked coding agent (Copilot Chat). **Feature & apply → Send to agent** sends the feature, user stories, and component instructions together: VS Code Copilot Chat inside the extension, GitHub Copilot coding agent when a repo is linked, or local Copilot CLI during `npm run dev`.

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
