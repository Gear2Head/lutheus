import React, { useState, useEffect } from 'react';

// --- Placeholder UI Components (Assuming Shadcn UI or similar) ---
const Card = ({ children, className }: any) => <div className={`bg-[#171717] border border-neutral-800 rounded-xl overflow-hidden ${className}`}>{children}</div>;
const Button = ({ children, variant, className, ...props }: any) => {
  const base = "px-4 py-2 rounded-md font-medium transition-colors";
  const variants: any = {
    ghost: "hover:bg-neutral-800/50 text-neutral-300",
    outline: "border border-neutral-700 text-neutral-300 hover:bg-neutral-800",
    default: "bg-violet-600 text-white hover:bg-violet-700 hover:shadow-[0_0_15px_rgba(124,58,237,0.5)]"
  };
  return <button className={`${base} ${variants[variant || 'default']} ${className}`} {...props}>{children}</button>;
};
const Select = ({ children, className, ...props }: any) => <select className={`bg-neutral-900 border border-neutral-800 text-white px-3 py-2 rounded-md focus:outline-none focus:ring-1 focus:ring-violet-500 ${className}`} {...props}>{children}</select>;

import { fetchPointTrainData, PointTrainResult } from '../services/pointTrainService';

export default function PointTrainDashboard() {
  const [dateRange, setDateRange] = useState('this_week');
  const [selectedMod, setSelectedMod] = useState('all');
  const [data, setData] = useState<PointTrainResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      // Determine date range
      const end = new Date();
      const start = new Date();
      if (dateRange === 'this_week') start.setDate(start.getDate() - 7);
      else if (dateRange === 'last_week') { start.setDate(start.getDate() - 14); end.setDate(end.getDate() - 7); }
      else if (dateRange === 'this_month') start.setMonth(start.getMonth() - 1);
      else if (dateRange === 'all_time') start.setFullYear(2020); // Arbitrary old date
      
      const results = await fetchPointTrainData(start, end, selectedMod);
      setData(results);
      setLoading(false);
    };
    
    loadData();
  }, [dateRange, selectedMod]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-neutral-200 p-8 flex flex-col">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Point Train (PT) İnceleme</h1>
          <p className="text-neutral-500 text-sm mt-1">Haftalık ve aylık ceza arama, yetkili performans ölçümü.</p>
        </div>
        <div className="flex gap-4">
          <Select value={dateRange} onChange={(e: any) => setDateRange(e.target.value)}>
            <option value="this_week">Bu Hafta</option>
            <option value="last_week">Geçen Hafta</option>
            <option value="this_month">Bu Ay</option>
            <option value="all_time">Tüm Zamanlar</option>
          </Select>
          <Select value={selectedMod} onChange={(e: any) => setSelectedMod(e.target.value)}>
            <option value="all">Tüm Yetkililer</option>
            <option value="Admin1">Admin1</option>
            <option value="Mod2">Mod2</option>
            <option value="Mod3">Mod3</option>
          </Select>
          <Button variant="default">Rapor Al</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="p-6">
          <h3 className="text-neutral-400 text-sm font-medium mb-1">Toplam İşlem (Case)</h3>
          <p className="text-3xl font-bold text-white">{data.reduce((acc, curr) => acc + curr.totalCases, 0)}</p>
        </Card>
        <Card className="p-6">
          <h3 className="text-neutral-400 text-sm font-medium mb-1">Kazanılan Toplam PT</h3>
          <p className="text-3xl font-bold text-violet-400">{data.reduce((acc, curr) => acc + curr.totalPT, 0)}</p>
        </Card>
        <Card className="p-6">
          <h3 className="text-neutral-400 text-sm font-medium mb-1">En Sık İhlal</h3>
          <p className="text-lg font-medium text-white mt-1">A1 - Yetkiliye Hakaret</p>
        </Card>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-neutral-800 flex justify-between items-center bg-neutral-900/50">
          <span className="font-semibold text-white">Yetkili Sıralaması (Leaderboard)</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-neutral-500">Yükleniyor...</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 text-neutral-400 text-sm">
                  <th className="p-4 font-medium">Sıra</th>
                  <th className="p-4 font-medium">Yetkili</th>
                  <th className="p-4 font-medium">İşlem Sayısı</th>
                  <th className="p-4 font-medium text-violet-400">Toplam PT</th>
                  <th className="p-4 font-medium">Sık Karşılaştığı İhlal</th>
                </tr>
              </thead>
              <tbody>
                {data.sort((a, b) => b.totalPT - a.totalPT).map((mod, idx) => (
                  <tr key={mod.moderatorId} className="border-b border-neutral-800/50 hover:bg-neutral-800/20 transition-colors">
                    <td className="p-4 text-neutral-300">#{idx + 1}</td>
                    <td className="p-4 font-medium text-white">{mod.moderatorId}</td>
                    <td className="p-4 text-neutral-300">{mod.totalCases}</td>
                    <td className="p-4 font-bold text-violet-400">{mod.totalPT} PT</td>
                    <td className="p-4 text-sm text-neutral-400">{mod.topRule}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
