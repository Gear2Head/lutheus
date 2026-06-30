"use client";

import { useBotDashboardStore } from "@/store/bot-dashboard-store";
import { Loader2, Save, Undo2 } from "lucide-react";

export function DirtySaveBar() {
  const { dirty, isSaving, saveConfig, resetConfigChanges } = useBotDashboardStore();

  if (!dirty) return null;

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 z-50 animate-slide-up"
      style={{
        background: "rgba(14,14,18,0.96)",
        backdropFilter: "blur(24px) saturate(1.5)",
        WebkitBackdropFilter: "blur(24px) saturate(1.5)",
        border: "1px solid var(--accent-border)",
        borderRadius: "var(--radius-xl)",
        boxShadow: "var(--shadow-lg), 0 0 32px rgba(102,252,241,0.06)",
        padding: "12px 18px",
        minWidth: "320px",
        maxWidth: "480px",
        width: "90%",
      }}
    >
      {/* Warning dot */}
      <span
        className="animate-dot-pulse shrink-0"
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: "var(--warning)",
          boxShadow: "0 0 8px var(--warning)",
          flexShrink: 0,
        }}
      />

      {/* Message */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
          Kaydedilmemiş değişiklikler
        </p>
        <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
          Değişiklikler sunucuya uygulanmadı.
        </p>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
        <button
          onClick={resetConfigChanges}
          disabled={isSaving}
          className="btn btn-ghost"
          style={{
            fontSize: "12px",
            padding: "7px 14px",
            height: "34px",
            borderRadius: "var(--radius-md)",
            opacity: isSaving ? 0.4 : 1,
          }}
        >
          <Undo2 style={{ width: "13px", height: "13px" }} />
          <span>Vazgeç</span>
        </button>

        <button
          onClick={saveConfig}
          disabled={isSaving}
          className="btn btn-primary"
          style={{
            fontSize: "12px",
            padding: "7px 16px",
            height: "34px",
            borderRadius: "var(--radius-md)",
            boxShadow: "0 0 18px rgba(102,252,241,0.22)",
            opacity: isSaving ? 0.7 : 1,
          }}
        >
          {isSaving ? (
            <Loader2 style={{ width: "13px", height: "13px" }} className="animate-spin" />
          ) : (
            <Save style={{ width: "13px", height: "13px" }} />
          )}
          <span>Kaydet</span>
        </button>
      </div>
    </div>
  );
}
