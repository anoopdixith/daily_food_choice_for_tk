import { NextResponse } from 'next/server';
import { saveMenuForDate } from '../../../../lib/db';
import { scrapeForMonth } from '../../../../lib/menu-scraper';

function getPSTMonthKey() {
  const now = new Date();
  const pst = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const y = pst.getFullYear();
  const m = String(pst.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export async function POST(req) {
  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month') || getPSTMonthKey(); // YYYY-MM
    const results = await scrapeForMonth(month);
    let saved = 0;
    for (const [dateKey, menu] of Object.entries(results)) {
      await saveMenuForDate(dateKey, menu);
      saved++;
    }
    return NextResponse.json({ month, saved });
  } catch (err) {
    console.error('POST /api/menu/ingest failed:', err);
    return NextResponse.json({ error: 'Server error ingesting month' }, { status: 500 });
  }
}

