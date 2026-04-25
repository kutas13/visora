"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const AIAssistant = dynamic(() => import("@/components/ai/AIAssistant"), {
  ssr: false,
  loading: () => (
    <div className="bg-gradient-to-b from-[#0f172a] to-[#1e293b] border border-white/[0.06] rounded-2xl h-full min-h-[200px] flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary-400/30 border-t-primary-400 rounded-full animate-spin mx-auto mb-2" />
        <p className="text-[10px] text-slate-500">AI yükleniyor...</p>
      </div>
    </div>
  ),
});

type Props = { isAdmin?: boolean };

export default function SidebarAiPanel({ isAdmin = false }: Props) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="flex-1 p-3 pt-0 min-h-[120px] flex flex-col justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-xl border border-navy-600 bg-navy-800/80 px-3 py-3 text-left text-sm font-medium text-navy-200 transition-colors hover:border-primary-500/40 hover:bg-navy-800 hover:text-white"
        >
          <span className="block text-white">Visora AI Asistan</span>
          <span className="mt-0.5 block text-[11px] font-normal text-navy-400">İhtiyaç duyduğunuzda açın</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 p-3 pt-0 min-h-[260px] flex flex-col justify-end">
      <AIAssistant isAdmin={isAdmin} />
    </div>
  );
}
