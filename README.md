# Mneme

**Chat-first AI operator** with persistent memory, integrations, scheduling, and trust receipts.

Mneme connects to your tools (Gmail, Calendar, GitHub, Slack via [One](https://withone.ai)), remembers context across conversations (via [HydraDB](https://hydradb.com)), schedules proactive reminders, and shows you exactly what it did on every response with **trust receipts**.

## Quick Start

```bash
git clone https://github.com/sohazur/mneme.git
cd mneme
cp .env.example .env    # fill in your API keys
npm install
npm run dev             # → http://localhost:3000
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `LLM_API_KEY` | Yes | API key for Kimi K2.5 (GMI Serving) |
| `LLM_MODEL` | No | Model ID (default: `moonshotai/Kimi-K2.5`) |
| `LLM_BASE_URL` | No | LLM API base URL (default: `https://api.gmi-serving.com/v1`) |
| `HYDRA_OPENCLAW_API_KEY` | No | HydraDB API key for persistent memory |
| `PORT` | No | Server port (default: `3000`) |

## Architecture

```
Browser (public/)           Express Server              Agent Core
┌──────────────────┐      ┌──────────────────┐       ┌──────────────────────┐
│ Vanilla HTML/CSS │ ──── │ POST /api/chat   │ ──── │ 1. Recall (HydraDB)  │
│ Trust Receipt UI │ JSON │ POST /api/schedule│       │ 2. LLM (Kimi K2.5)  │
│ Session (UUID)   │ ──── │ Static serving   │ ──── │ 3. Tools (One/Sched) │
└──────────────────┘      └──────────────────┘       │ 4. Store memory      │
                                                     │ 5. Trust receipt     │
                                                     └──────────────────────┘
```

## Features

### Memory (HydraDB)
Every conversation is stored in HydraDB. On each new message, Mneme recalls relevant context from past conversations and injects it into the LLM prompt. The trust receipt shows which memories were recalled and their relevance scores.

### Integrations (One)
Mneme can perform actions across connected apps:
- **Gmail**: Draft/send emails, search inbox
- **Google Calendar**: Create events, find free time
- **GitHub**: Create issues, open PRs
- **Slack**: Send messages, search channels

### Scheduling (OpenClaw-inspired)
Set one-time reminders or recurring tasks:
- "Remind me to review the PR tomorrow at 9am"
- "Every Monday at 8am, summarize my week"

### Trust Receipts
Every response includes a collapsible trust receipt showing:
- Memories recalled (with relevance scores)
- Tools called (with arguments and results)
- Actions performed
- Model used, latency, timestamp

## API

### POST /api/chat
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "test-session-1",
    "message": "Draft an email to the team about the hackathon demo",
    "history": []
  }'
```

Response:
```json
{
  "reply": "I've drafted an email for the team...",
  "trustReceipt": {
    "timestamp": "2026-03-28T13:00:00Z",
    "model": "moonshotai/Kimi-K2.5",
    "latencyMs": 1200,
    "memoriesRecalled": [],
    "toolsCalled": [{ "name": "integration_action", "args": {...} }],
    "actionsPerformed": ["Draft created via One → Gmail API"],
    "memoryStored": true
  }
}
```

### GET /api/health
Returns service status and configuration.

### POST /api/schedule
Create a scheduled reminder.

### GET /api/schedules/:chatId
List active schedules for a session.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm start` | Start production server |
| `npm run build` | Compile TypeScript |
| `npm run cli` | Run the FollowUp OS CLI demo |

## Tech Stack

- **LLM**: Kimi K2.5 via GMI Serving (OpenAI-compatible)
- **Memory**: HydraDB (tenant: openclaw)
- **Integrations**: One (withone.ai)
- **Server**: Express
- **Frontend**: Vanilla HTML/CSS/JS
- **Language**: TypeScript (Node.js)

## Project Structure

```
mneme/
├── public/                 # Frontend (served as static)
│   ├── index.html
│   ├── style.css
│   └── app.js
├── src/
│   ├── agent/              # Core orchestration
│   │   ├── index.ts        # MnemeAgent class
│   │   ├── llm.ts          # Kimi K2.5 client
│   │   └── types.ts        # Interfaces
│   ├── memory/
│   │   └── hydradb.ts      # HydraDB client
│   ├── scheduler/
│   │   └── index.ts        # Cron/reminder system
│   ├── integrations/
│   │   └── one.ts          # One integration layer
│   ├── server/
│   │   ├── index.ts        # Express entry point
│   │   └── routes/
│   └── cli-chat/           # Ink terminal UI
├── .env.example
├── tsconfig.json
└── package.json
```

## License

MIT
