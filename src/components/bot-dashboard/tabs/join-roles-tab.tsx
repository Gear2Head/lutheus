"use client";

// SECTION: ROLE_GUARDS
// PURPOSE: Configuration for auto-assignment of roles on guild member join.

import { useBotDashboardStore } from "@/store/bot-dashboard-store";
import { UserPlus, HelpCircle } from "lucide-react";

export default function JoinRolesPage() {
  const { config, updateConfig, roles } = useBotDashboardStore();

  if (!config) return null;

  const handleToggle = () => {
    updateConfig((prev) => ({
      ...prev,
      modules: { ...prev.modules, joinRoles: !prev.modules.joinRoles },
    }));
  };

  const settings = config.joinRolesSettings || {
    roles: [],
    delayedRoles: [],
    delaySeconds: 0,
  };

  const handleRoleSelect = (roleId: string) => {
    const exists = settings.roles.includes(roleId);
    const updatedRoles = exists
      ? settings.roles.filter(id => id !== roleId)
      : [...settings.roles, roleId];

    updateConfig((prev) => ({
      ...prev,
      joinRolesSettings: {
        ...settings,
        roles: updatedRoles,
      },
    }));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center justify-between border-b border-[#2f3e46] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-[#66fcf1]" />
            <span>Join Roles (Giriş Rolleri)</span>
          </h1>
          <p className="text-xs text-[#c5c6c7] font-light mt-1">
            Sunucuya yeni katılan kullanıcılara otomatik olarak atanacak rolleri belirleyin.
          </p>
        </div>

        <button
          onClick={handleToggle}
          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
            config.modules.joinRoles
              ? "bg-[#66fcf1]/10 text-[#66fcf1] border border-[#66fcf1]/30 shadow-[0_0_15px_rgba(102,252,241,0.05)]"
              : "bg-[#1f2833]/40 text-gray-500 border border-[#2f3e46]"
          }`}
        >
          {config.modules.joinRoles ? "Modül Aktif" : "Modül Devre Dışı"}
        </button>
      </div>

      {config.modules.joinRoles ? (
        <div className="bg-[#1f2833]/40 border border-[#2f3e46] p-6 rounded-2xl space-y-6">
          <div>
            <label className="block text-xs font-semibold text-[#c5c6c7] mb-3">Otomatik Atanacak Rol Seçimi</label>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
              {roles.map((role) => {
                const isSelected = settings.roles.includes(role.id);
                return (
                  <button
                    key={role.id}
                    onClick={() => handleRoleSelect(role.id)}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border text-xs font-semibold transition-all ${
                      isSelected
                        ? "bg-[#66fcf1]/10 text-[#66fcf1] border-[#66fcf1]/40"
                        : "bg-[#1c2331] text-gray-400 border-[#2f3e46] hover:border-gray-500"
                    }`}
                  >
                    <span>{role.name}</span>
                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-[#66fcf1]" />}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-gray-500 font-light mt-2">
              Seçilen roller kullanıcı sunucuya girdiği anda bot tarafından otomatik olarak atanır.
            </p>
          </div>
        </div>
      ) : (
        <div className="h-64 flex flex-col items-center justify-center p-8 bg-[#1f2833]/10 border border-[#2f3e46]/40 rounded-2xl text-center">
          <HelpCircle className="w-12 h-12 text-gray-600 mb-3" />
          <h3 className="text-sm font-bold text-gray-400">Join Roles Modülü Kapalı</h3>
          <p className="text-xs text-gray-500 font-light mt-1 max-w-sm">
            Ayarları değiştirebilmek için sağ üst köşeden "Modülü Aktif" butonuna basarak aktifleştirin.
          </p>
        </div>
      )}
    </div>
  );
}
