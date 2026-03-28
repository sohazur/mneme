"use client";

import { useState, useRef } from "react";
import { ArrowUp } from "lucide-react";

export function MessageInput({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    inputRef.current?.focus();
  };

  return (
    <div className="px-6 py-4">
      <div className="relative mx-auto max-w-xl group">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Message Mneme..."
          disabled={disabled}
          autoFocus
          className="w-full rounded-full border border-neutral-200 bg-white px-8 py-5 text-lg font-light shadow-sm transition-all placeholder:text-neutral-300 focus:border-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-100 disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full bg-neutral-900 p-3 text-white transition-all hover:bg-neutral-800 hover:shadow-lg active:scale-95 disabled:opacity-30 disabled:hover:bg-neutral-900 disabled:hover:shadow-none"
        >
          <ArrowUp size={18} />
        </button>
      </div>
    </div>
  );
}
