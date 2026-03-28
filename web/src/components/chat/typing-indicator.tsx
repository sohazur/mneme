"use client";

import { motion } from "motion/react";
import { Loader2 } from "lucide-react";

export function TypingIndicator() {
  return (
    <div className="flex items-center gap-3 py-4">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      >
        <Loader2 size={16} className="text-neutral-300" />
      </motion.div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-sm font-light italic text-neutral-400"
      >
        Thinking...
      </motion.p>
    </div>
  );
}
