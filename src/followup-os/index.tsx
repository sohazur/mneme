import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { renderChatUI } from "../cli-chat/index.js";

type MemoryRecord = {
  ts: string;
  kind: "meeting" | "followup";
  inputHash: string;
  inputPreview: string;
  people: string[];
  companies: string[];
  commitments: string[];
  actionItems: string[];
  rawNotes?: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, "../../data");
const MEMORY_PATH = path.join(DATA_DIR, "memory.jsonl");

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function sha256(text: string) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function appendJsonl(obj: unknown) {
  ensureDataDir();
  fs.appendFileSync(MEMORY_PATH, JSON.stringify(obj) + "\n", "utf8");
}

function readJsonl(): MemoryRecord[] {
  try {
    const raw = fs.readFileSync(MEMORY_PATH, "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

// Very fast heuristic extractor (no external APIs).
// For the hackathon: predictable + demo-friendly.
function extractFromNotes(notes: string) {
  const people = new Set<string>();
  const companies = new Set<string>();
  const commitments: string[] = [];
  const actionItems: string[] = [];

  const lines = notes
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    // Simple cues
    if (/^people\s*:/i.test(line)) {
      line
        .split(":")[1]
        ?.split(/,|;|\|/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((p) => people.add(p));
      continue;
    }
    if (/^company\s*:/i.test(line) || /^companies\s*:/i.test(line)) {
      line
        .split(":")[1]
        ?.split(/,|;|\|/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((c) => companies.add(c));
      continue;
    }

    // Action item markers
    if (/^(todo|action|next)\s*:/i.test(line) || /^-\s*\[ \]/.test(line) || /^-\s*todo/i.test(line)) {
      actionItems.push(line.replace(/^(-\s*)?(\[ \]\s*)?/i, "").replace(/^(todo|action|next)\s*:/i, "").trim());
      continue;
    }

    // Commitment markers
    if (/\b(agreed|commit|committed|will|deadline|by\s+\w+)\b/i.test(line)) {
      commitments.push(line);
    }

    // naive proper-name capture (demo-friendly)
    const nameMatches = line.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g);
    if (nameMatches) {
      for (const m of nameMatches) {
        // avoid common words
        if (["I", "We", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].includes(m)) continue;
        // put in people unless it looks like a company suffix
        people.add(m);
      }
    }
  }

  return {
    people: uniq([...people]).slice(0, 12),
    companies: uniq([...companies]).slice(0, 12),
    commitments: uniq(commitments).slice(0, 12),
    actionItems: uniq(actionItems).slice(0, 12),
  };
}

function draftEmail(toName: string, topic: string, context?: Partial<MemoryRecord>) {
  const subject = `Quick follow-up re: ${topic}`;
  const bulletActions = (context?.actionItems ?? []).slice(0, 3).map((a) => `- ${a}`).join("\n");
  const body =
    `Hi ${toName},\n\n` +
    `Quick follow-up on ${topic}.\n\n` +
    (bulletActions ? `Next steps on my side:\n${bulletActions}\n\n` : "") +
    `If you prefer a different time or format, happy to adjust.\n\n` +
    `Best,\nSohazur\n`;
  return { subject, body };
}

function receiptBlock(r: MemoryRecord) {
  return [
    "\n=== TRUST RECEIPT ===",
    `inputHash: ${r.inputHash}`,
    `inputPreview: ${JSON.stringify(r.inputPreview)}`,
    `people: ${r.people.join(", ") || "(none)"}`,
    `companies: ${r.companies.join(", ") || "(none)"}`,
    `commitments: ${r.commitments.length}`,
    `actionItems: ${r.actionItems.length}`,
    `writes: memory.jsonl (+1 record)` ,
    "=====================\n",
  ].join("\n");
}

function helpText() {
  return [
    "Commands:",
    "  ingest            -> paste meeting notes (multi-line). End with a single '.' line",
    "  followups today    -> shows recent action items",
    "  what did <name> ask -> search memory for lines mentioning <name>",
    "  draft email to <name> about <topic> -> generates a draft",
    "  help              -> show this",
    "",
    `Memory file: ${MEMORY_PATH}`,
  ].join("\n");
}

async function main() {
  const chat = renderChatUI();

  chat.sendMessage("FollowUp OS (hackathon demo) — type 'help' for commands.");

  let mode: "normal" | "ingest" = "normal";
  let ingestBuf: string[] = [];

  chat.onInput(async (prompt) => {
    const p = prompt.trim();

    if (mode === "ingest") {
      if (p === ".") {
        mode = "normal";
        const notes = ingestBuf.join("\n");
        ingestBuf = [];

        const inputHash = sha256(notes);
        const inputPreview = notes.slice(0, 200);
        const extracted = extractFromNotes(notes);

        const rec: MemoryRecord = {
          ts: new Date().toISOString(),
          kind: "meeting",
          inputHash,
          inputPreview,
          ...extracted,
          rawNotes: notes,
        };

        appendJsonl(rec);

        chat.sendMessage("Saved. Extracted:");
        chat.sendMessage(`People: ${rec.people.join(", ") || "(none)"}`);
        chat.sendMessage(`Companies: ${rec.companies.join(", ") || "(none)"}`);
        if (rec.actionItems.length) chat.sendMessage("Action items:\n" + rec.actionItems.map((a, i) => `${i + 1}) ${a}`).join("\n"));
        chat.sendMessage(receiptBlock(rec));
        return;
      }

      ingestBuf.push(prompt);
      return;
    }

    if (!p || p.toLowerCase() === "help") {
      chat.sendMessage(helpText());
      return;
    }

    if (p.toLowerCase() === "ingest") {
      mode = "ingest";
      chat.sendMessage("Paste notes now (multi-line). End with a single '.' on its own line.");
      return;
    }

    const mem = readJsonl();

    if (p.toLowerCase() === "followups today") {
      const items = mem
        .slice(-50)
        .flatMap((r) => r.actionItems.map((a) => ({ ts: r.ts, a })));

      if (!items.length) {
        chat.sendMessage("No action items found yet. Use 'ingest' first.");
        return;
      }

      chat.sendMessage("Recent follow-ups:");
      chat.sendMessage(items.slice(-10).map((x) => `- ${x.a} (from ${x.ts.split("T")[0]})`).join("\n"));
      return;
    }

    const whatDid = p.match(/^what\s+did\s+(.+?)\s+ask\s*\??$/i);
    if (whatDid) {
      const name = whatDid[1].trim();
      const hits = mem
        .filter((r) => (r.rawNotes || "").toLowerCase().includes(name.toLowerCase()))
        .slice(-5);
      if (!hits.length) {
        chat.sendMessage(`No notes found mentioning '${name}'.`);
        return;
      }
      chat.sendMessage(`Notes mentioning '${name}':`);
      for (const h of hits) {
        const excerpt = (h.rawNotes || "").split(/\r?\n/).filter((l) => l.toLowerCase().includes(name.toLowerCase())).slice(0, 5);
        chat.sendMessage(`- ${h.ts.split("T")[0]}: ${excerpt.join(" | ")}`);
      }
      return;
    }

    const draft = p.match(/^draft\s+email\s+to\s+(.+?)\s+about\s+(.+)$/i);
    if (draft) {
      const toName = draft[1].trim();
      const topic = draft[2].trim();
      const ctx = mem.slice(-1)[0];
      const email = draftEmail(toName, topic, ctx);

      const rec: MemoryRecord = {
        ts: new Date().toISOString(),
        kind: "followup",
        inputHash: sha256(p),
        inputPreview: p.slice(0, 200),
        people: [toName],
        companies: [],
        commitments: [],
        actionItems: [`Drafted email to ${toName} about ${topic}`],
      };
      appendJsonl(rec);

      chat.sendMessage("Draft:");
      chat.sendMessage(`Subject: ${email.subject}\n\n${email.body}`);
      chat.sendMessage(receiptBlock(rec));
      return;
    }

    chat.sendMessage("Unknown command. Type 'help'.");
  });

  await new Promise(() => {});
}

await main();
