"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet, apiPost } from "@/lib/api";

interface Integration {
  name: string;
  label: string;
  icon: string;
  description: string;
  connected: boolean;
}

const FALLBACK_INTEGRATIONS: Integration[] = [
  { name: "gmail", label: "Gmail", icon: "\u2709\uFE0F", description: "Draft & send emails, search inbox", connected: false },
  { name: "google_calendar", label: "Google Calendar", icon: "\uD83D\uDCC5", description: "Schedule meetings, find free time", connected: false },
  { name: "github", label: "GitHub", icon: "\uD83D\uDCBB", description: "Create issues, open PRs", connected: false },
  { name: "slack", label: "Slack", icon: "\uD83D\uDCAC", description: "Send messages, search channels", connected: false },
];

export function IntegrationsPanel() {
  const [integrations, setIntegrations] = useState<Integration[]>(FALLBACK_INTEGRATIONS);

  const load = useCallback(async () => {
    try {
      const data = await apiGet<{ integrations: Integration[] }>("/api/integrations");
      if (data.integrations?.length) {
        setIntegrations(data.integrations);
      }
    } catch {
      // Use fallback
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (name: string, connected: boolean) => {
    const endpoint = connected ? "/api/integrations/disconnect" : "/api/integrations/connect";
    try {
      await apiPost(endpoint, { integration: name });
      await load();
    } catch (err) {
      console.error("Integration toggle failed:", err);
    }
  };

  return (
    <div className="px-6 py-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-light text-neutral-400">Connect your apps via One</p>
        <a
          href="https://www.withone.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-neutral-300 hover:text-neutral-500"
        >
          powered by One
        </a>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {integrations.map((i) => (
          <div
            key={i.name}
            className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-all ${
              i.connected
                ? "border-green-200 bg-green-50/50"
                : "border-neutral-100 bg-white"
            }`}
          >
            <span className="text-lg">{i.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-neutral-700 truncate">{i.label}</p>
              <p className="text-[10px] text-neutral-400 truncate">{i.description}</p>
            </div>
            <button
              onClick={() => toggle(i.name, i.connected)}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium transition-all ${
                i.connected
                  ? "bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-600"
                  : "bg-neutral-900 text-white hover:bg-neutral-700"
              }`}
            >
              {i.connected ? "Connected" : "Connect"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
