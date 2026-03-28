"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { TrustReceipt as TrustReceiptType } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TrustReceipt({ receipt }: { receipt: TrustReceiptType }) {
  const [open, setOpen] = useState(false);
  const modelShort = receipt.model?.split("/").pop() ?? "unknown";

  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs text-neutral-400 transition-colors hover:bg-neutral-50"
      >
        <div className="flex items-center gap-1.5">
          <ChevronRight
            size={12}
            className={cn("transition-transform", open && "rotate-90")}
          />
          <span className="font-mono font-light">Trust Receipt</span>
        </div>
        <div className="flex gap-1.5">
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-mono text-[10px]">
            {receipt.latencyMs}ms
          </span>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-mono text-[10px]">
            {modelShort}
          </span>
          {receipt.memoryStored && (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-mono text-[10px] text-neutral-600">
              memory
            </span>
          )}
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-neutral-100 px-3 py-2 font-mono text-[11px] text-neutral-400">
              <div className="space-y-1">
                <Row label="Time" value={new Date(receipt.timestamp).toLocaleString()} />
                <Row label="Model" value={receipt.model} />
                <Row label="Latency" value={`${receipt.latencyMs}ms`} />
                <Row label="Memory" value={receipt.memoryStored ? "Stored" : "Not stored"} />
                {receipt.memoriesRecalled.length > 0 && (
                  <>
                    <Row label="Recalled" value={`${receipt.memoriesRecalled.length}`} />
                    {receipt.memoriesRecalled.map((m, i) => (
                      <div key={i} className="ml-16 rounded-lg bg-neutral-50 px-2 py-1 text-[10px]">
                        [{m.score.toFixed(2)}] {m.text}
                      </div>
                    ))}
                  </>
                )}
                {receipt.toolsCalled.length > 0 && (
                  <>
                    <Row label="Tools" value={`${receipt.toolsCalled.length}`} />
                    {receipt.toolsCalled.map((t, i) => (
                      <div key={i} className="ml-16 border-l border-neutral-200 pl-2 text-[10px]">
                        <span className="text-neutral-700">{t.name}</span>
                        ({JSON.stringify(t.args)})
                        {t.result && <div className="text-neutral-300">{t.result}</div>}
                      </div>
                    ))}
                  </>
                )}
                {receipt.actionsPerformed.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {receipt.actionsPerformed.map((a, i) => (
                      <span key={i} className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px]">
                        {a}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-14 shrink-0 text-neutral-300 uppercase tracking-wide">
        {label}
      </span>
      <span>{value}</span>
    </div>
  );
}
