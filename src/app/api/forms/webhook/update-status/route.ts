import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const LUTHEUS_AUTH_TOKEN = "7f8a9c2b4d5e6f1a3b5c7d9e0f2a4b6c8d0e1f3a";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || authHeader !== `Bearer ${LUTHEUS_AUTH_TOKEN}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { id, status } = payload;

    if (!id || !status) {
      return NextResponse.json({ error: 'Missing applicant ID or status' }, { status: 400 });
    }

    // Update status in staff_applications
    const { data, error } = await supabase
      .from('staff_applications')
      .update({ status: status })
      .eq('applicant_id', id)
      .select();

    if (error) {
      console.error('Supabase error updating status:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('Webhook status update error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
