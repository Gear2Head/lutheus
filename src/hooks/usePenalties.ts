import { useState, useEffect, useCallback } from 'react';
import { Penalty, fetchPenaltiesService, addPenaltyService, updatePenaltyStatusService } from '@/services/penaltyService';
import { supabase } from '@/lib/supabase';

export function usePenalties() {
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchPenaltiesService();
      setPenalties(data);
    } catch (err: any) {
      console.error("Hook fetch error:", err);
      setError(err?.message || "Cezalar yüklenirken bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addPenalty = useCallback(async (newPenalty: Penalty) => {
    try {
      const saved = await addPenaltyService(newPenalty);
      setPenalties(prev => [saved, ...prev]);
      return true;
    } catch (err) {
      console.error("Hook add error:", err);
      return false;
    }
  }, []);

  const updateStatus = useCallback(async (id: string, newStatus: 'DOĞRU' | 'HATALI' | 'İNCELENİYOR') => {
    // Optimistic UI update
    setPenalties(prev => 
      prev.map(p => p.id === id ? { ...p, status: newStatus } : p)
    );
    try {
      const success = await updatePenaltyStatusService(id, newStatus);
      if (!success) {
        // Option to reload if backend failed
        await loadData();
      }
      return success;
    } catch (err) {
      console.error("Hook update error:", err);
      await loadData();
      return false;
    }
  }, [loadData]);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('realtime-penalties-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'penalties' },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  return {
    penalties,
    isLoading,
    error,
    refetch: loadData,
    addPenalty,
    updateStatus
  };
}
