<div align="center">

![Banner](./.github/assets/banner.png)

# @photon-ai/rapid

</div>

Toolkit for rapid AI and agent prototyping. Rapid gives you reusable building blocks so you can validate new agent architectures, memory systems, and workflows without rebuilding the interface layer every time.

## Why Rapid
- Terminal-first developer experience for iterating on prompts, memory, and control flows.
- Composable modules exposed as ESM entry points; mix and match what you need.
- TypeScript-first API with strong types for chat messages, event handlers, and controller handles.

## Installation
Install the package with your preferred manager (Node.js 18+):

```bash
npm install @photon-ai/rapid
# or
pnpm add @photon-ai/rapid
# or
bun add @photon-ai/rapid
```

Rapid expects a TypeScript toolchain (`typescript@^5.9.3` as a peer dependency). If you are running in CommonJS, bundle or load with a compatible transpiler such as `ts-node/register`.

## Module Catalog
This section will expand as new building blocks ship. Each module lives under an explicit export path so you can import only what you need.

| Category | Module | Description | Status |
| --- | --- | --- | --- |
| Chat TUI | `@photon-ai/rapid/cli-chat` | Ink-powered terminal chat UI with message panel, input bar, and controller API. | Available |

## Usage Patterns
### CLI Chat
Render the chat surface inside your CLI and connect it to your agent logic.

```ts
// demo.ts
import { renderChatUI } from "@photon-ai/rapid/cli-chat";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const chat = renderChatUI();

chat.sendMessage("Welcome to Rapid! Type anything and I'll echo it back.");

chat.onInput(async (prompt) => {
    chat.sendMessage("Thinking...");
    await delay(500);
    chat.sendMessage(`Echo: ${prompt.toUpperCase()}`);
});

// Keep the Ink app alive. Press Ctrl+C to exit.
await new Promise(() => {});
```

Run the example with your preferred TypeScript runner:

```bash
ts-node demo.ts
```

#### Controller API snapshot
- `renderChatUI()` mounts the Ink application and returns an imperative controller.
- `chat.onInput(handler)` registers listeners for user-submitted prompts (supports async handlers).
- `chat.sendMessage(content)` streams assistant messages back into the UI in real time.

## Developing New Modules
- Add modules under `src/<module-name>` and export them via `package.json`.
- Document each module with a short description and example import path in the catalog above.
- Keep runnable snippets in this README so users can copy-paste and tinker.

## Repo Scripts
Rapid uses [Bun](https://bun.com) for scripts and dependency management:

```bash
bun install        # install dependencies
bun run src/index.ts
```

---

# Hackathon Demo: FollowUp OS (CLI)

This repo now includes a runnable hackathon demo CLI app:

- Entry: `src/followup-os/index.tsx`
- Local memory: `./data/memory.jsonl` (JSONL append-only)

## Run

```bash
npm install
npm run followup-os
```

## Commands (inside the chat UI)

- `ingest` → paste meeting notes (multi-line), end with a single `.` line
- `followups today` → shows recent action items
- `what did <name> ask` → searches stored notes
- `draft email to <name> about <topic>` → generates a follow-up draft + writes a receipt

## 90-second demo script

1) Type `ingest` and paste:
   - "Met Hashem (SNBLA). Wants Tue 11:30 Riyadh. Needs deck + intro to Saleh."
   - "Action: send updated invite. Action: email deck."
   End with `.`
2) Show extracted facts + the **TRUST RECEIPT**.
3) Type `followups today` → show prioritized actions.
4) Type `draft email to Hashem about updated time + deck` → show subject/body + receipt.

## Contributions
Contributions, bug reports, and ideas are welcome—open an issue or PR when you build something others can reuse.
