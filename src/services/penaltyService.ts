import { supabase, getPenaltiesData, addPenaltyRecord, updateStaffStats } from '@/lib/supabase';

export interface Penalty {
  id: string;
  icon?: string;
  avatar?: string;
  staff: string;
  reason: string;
  duration?: string;
  date?: string;
  status: 'DOĞRU' | 'HATALI' | 'İNCELENİYOR';
  isWarning?: boolean;
  isActive?: boolean;
}

// Mock data fallback
const fallbackPenalties = [
  {
    id: '#acZf7HC',
    icon: 'MUTE',
    avatar: 'https://i.pravatar.cc/150?img=1',
    staff: 'Gear_Head',
    reason: 'Kural ihlali - spam mesajları',
    duration: '2 saat',
    date: '2024-01-15',
    status: 'DOĞRU',
    isWarning: false,
    isActive: true
  },
  {
    id: '#bdG8iJK',
    icon: 'WARN',
    avatar: 'https://i.pravatar.cc/150?img=2',
    staff: 'Nadoo',
    reason: 'Küfür ve hakaret',
    duration: '1 gün',
    date: '2024-01-14',
    status: 'DOĞRU',
    isWarning: true,
    isActive: false
  }
];

/**
 * Fetch all penalty records from Supabase, or fall back to mock data
 */
export async function fetchPenaltiesService(): Promise<Penalty[]> {
  try {
    const data = await getPenaltiesData(fallbackPenalties);
    return data as Penalty[];
  } catch (error) {
    console.warn("Service fetch failed, using fallback penalties:", error);
    return fallbackPenalties as Penalty[];
  }
}

/**
 * Add a new penalty to Supabase or handle local insertion fallback
 */
export async function addPenaltyService(penalty: Penalty): Promise<Penalty> {
  try {
    const result = await addPenaltyRecord(penalty);
    if (result && result.length > 0) {
      return result[0] as Penalty;
    }
    return penalty;
  } catch (error) {
    console.warn("Service add failed:", error);
    return penalty;
  }
}

/**
 * Update the verification status of a penalty record (e.g., true or false)
 */
export async function updatePenaltyStatusService(id: string, status: 'DOĞRU' | 'HATALI' | 'İNCELENİYOR'): Promise<boolean> {
  try {
    // 1. Fetch current penalty row to find who the staff is
    const { data: currentPenalty, error: fetchErr } = await supabase
      .from('penalties')
      .select('staff')
      .eq('id', id)
      .single();

    const staffName = currentPenalty?.staff;

    // 2. Perform table status update
    const { error } = await supabase
      .from('penalties')
      .update({ status })
      .eq('id', id);
    
    if (error) {
      console.warn("Failed to update status in Supabase:", error.message);
      return false;
    }

    // 3. Trigger dynamic recalculation of metrics for the staff member
    if (staffName) {
      await updateStaffStats(staffName);
    }

    return true;
  } catch (err) {
    console.warn("Supabase update error:", err);
    return false;
  }
}
