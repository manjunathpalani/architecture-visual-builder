# Architecture Visual Builder for VS Code

Hosts the Architecture Visual Builder canvas inside VS Code so you can map systems, save JSON in the workspace, and send Feature & apply instructions to a coding agent.

This is a **local/dev build**. It is **not Marketplace-signed**. A `.vsix` from `npm run package` will show **Extension is not signed**. That is expected. Do not use the VSIX unless you want to click **Install Anyway**.

## Load it without a signature (recommended)

From the repository:

```bash
cd app
npm install
npm run build:single

cd ../extension
npm install
npm run open
```

`npm run open` starts an **Extension Development Host** window with this folder loaded from disk. **No VSIX and no signature.**

Then:

1. **File → Open Folder** on the repo you want the agent to edit
2. Command Palette → **Architecture Visual Builder: New Architecture Diagram** (creates a `.avb.json` file)
3. Or open a `*.avb.json` / `*.architecture.json` / `*architecture*.json` file
4. Paste an AI key in **Settings → AI engines → Save & test**, or choose **GitHub Copilot** and sign in to Copilot in VS Code (no key). The extension calls the provider or `vscode.lm` directly (no `npm run dev` server)
5. **AI → Write SAD** drafts Word document narrative, NFRs, nested diagrams, and sequence flows; **File → Export Word SAD** always includes those sections even without AI

Do not open `package.json` or other non-diagram JSON in the builder. Those files are not architecture documents, and the extension will refuse to overwrite them.

From this repo in VS Code you can also press **F5** (**Run Architecture Visual Builder (unsigned)**).

## Persist it in your editor (still unsigned)

This copies the built extension into `~/.vscode/extensions` (and Cursor / Insiders if those folders exist). VS Code does not verify a Marketplace signature for a sideloaded folder.

```bash
cd extension
npm run install-local
```

Then **Developer: Reload Window**.

## If you already installed the .vsix

If the dialog says **Extension is not signed**, choose **Install Anyway**. That is the unsigned local package.

If install is blocked instead of offering **Install Anyway**:

1. Command Palette → **Preferences: Open User Settings (JSON)**
2. Add `"extensions.verifySignature": false`
3. Command Palette → **Extensions: Install from VSIX…**
4. Pick `extension/architecture-visual-builder-0.1.0.vsix`

Turn `extensions.verifySignature` back to `true` afterward if you only needed this once.

**Real Marketplace signing** requires a publisher at [https://marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage), then `vsce publish`. Microsoft signs Marketplace packages. This repo does not publish.

## Send Generate/Apply to an agent

1. Link the component **Codebase → Path in repo** (for example `src`)
2. Open the **Feature & apply** sub-tab, add user stories, **Generate**, then **Send feature to agent** (or send one story / component). The instruction includes the feature definition and user stories.
3. In this VS Code window that writes `.avb/apply-task.md` and opens Copilot Chat
4. If Chat does not open, paste the copied instruction into Copilot Agent / Cursor / Grok

## Features that still need `npm run dev`

Cloud OAuth and some Git/Jira proxies. Canvas, templates, AI keys, File → Import JSON, Feature & apply, and agent launch work in the extension.
