"use client";

// SECTION: STATE_STORE
// PURPOSE: Floating banner at the bottom that appears when changes are pending, allowing the user to save or reset.

import { useBotDashboardStore } from "@/store/bot-dashboard-store";
import { Loader2, Save, Undo } from "lucide-react";

export function DirtySaveBar() {
  const { dirty, isSaving, saveConfig, resetConfigChanges } = useBotDashboardStore();

  if (!dirty) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1f2833]/90 backdrop-blur-md border border-[#66fcf1]/30 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-8 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300 w-[90%] max-w-2xl">
      <div className="flex-1">
        <h4 className="text-sm font-semibold text-white">Değişiklikleri Kaydedin!</h4>
        <p className="text-xs text-[#c5c6c7] font-light mt-0.5">
          Yapılan değişiklikleri sunucuya kaydetmediniz.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={resetConfigChanges}
          disabled={isSaving}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white disabled:opacity-50 transition-colors"
        >
          <Undo className="w-3.5 h-3.5" />
          <span>Vazgeç</span>
        </button>

        <button
          onClick={saveConfig}
          disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#66fcf1] text-[#0b0c10] hover:bg-[#45f3ff] disabled:bg-gray-600 disabled:text-gray-400 rounded-xl text-xs font-bold shadow-[0_0_20px_rgba(102,252,241,0.2)] hover:shadow-[0_0_25px_rgba(102,252,241,0.35)] disabled:shadow-none transition-all duration-300"
        >
          {isSaving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          <span>Kaydet</span>
        </button>
      </div>
    </div>
  );
}
