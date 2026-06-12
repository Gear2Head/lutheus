import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch("https://discord.com/api/v9/invites/lutheus?with_counts=true", {
      next: { revalidate: 60 } // cache for 60 seconds
    });
    if (!res.ok) {
      throw new Error(`Discord API error: ${res.status}`);
    }
    const data = await res.json();
    return NextResponse.json({
      online: data.approximate_presence_count || 0,
      total: data.approximate_member_count || 0
    });
  } catch (err) {
    console.error("Failed to fetch Discord invite stats:", err);
    return NextResponse.json({ online: 0, total: 0 }, { status: 500 });
  }
}
