"use client";

// SECTION: STATE_STORE
// PURPOSE: Floating save bar — clean pill design that appears when config changes are pending.

import { useBotDashboardStore } from "@/store/bot-dashboard-store";
import { Loader2, Save, Undo2 } from "lucide-react";

export function DirtySaveBar() {
  const { dirty, isSaving, saveConfig, resetConfigChanges } = useBotDashboardStore();

  if (!dirty) return null;

  return (
    <div
      className="fixed bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-6 z-50 animate-slide-up"
      style={{
        background: "rgba(10, 14, 20, 0.94)",
        backdropFilter: "blur(20px) saturate(1.5)",
        WebkitBackdropFilter: "blur(20px) saturate(1.5)",
        border: "1px solid var(--border-accent)",
        borderRadius: "16px",
        boxShadow: "var(--shadow-lg), 0 0 30px rgba(102,252,241,0.06)",
        padding: "14px 20px",
        minWidth: "340px",
        maxWidth: "500px",
        width: "90%",
      }}
    >
      {/* Indicator dot */}
      <div
        className="w-2 h-2 rounded-full shrink-0 animate-glow"
        style={{ background: "var(--warning)" }}
      />

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p
          className="text-[13px] font-semibold"
          style={{ color: "var(--text-main)" }}
        >
          Kaydedilmemiş değişiklikler
        </p>
        <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
          Değişiklikler sunucuya uygulanmadı.
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={resetConfigChanges}
          disabled={isSaving}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium transition-all duration-150 disabled:opacity-40"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
            (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-hover)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          }}
        >
          <Undo2 className="w-3.5 h-3.5" />
          <span>Vazgeç</span>
        </button>

        <button
          onClick={saveConfig}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold transition-all duration-150 disabled:opacity-40"
          style={{
            background: "var(--accent)",
            color: "#080a0e",
            boxShadow: "0 0 16px rgba(102,252,241,0.2)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 24px rgba(102,252,241,0.35)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 16px rgba(102,252,241,0.2)";
          }}
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
