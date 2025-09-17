import { NextResponse } from 'next/server';
import { getMenuForDate, saveMenuForDate } from '../../../lib/db';
import { scrapeForDate } from '../../../lib/menu-scraper';

const DEFAULT_MENU_SOURCE = 'https://www.schoolnutritionandfitness.com/webmenus2/#/ocr-pdf?id=689ecc6ac503dc2f970dd833';

function normalizeText(t) {
  return (t || '').replace(/\s+/g, ' ').trim();
}

function buildDateTokens(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const month = date.toLocaleString('en-US', { month: 'long', timeZone: 'America/Los_Angeles' });
  const monthShort = date.toLocaleString('en-US', { month: 'short', timeZone: 'America/Los_Angeles' });
  const day = d;
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return [
    `${month} ${day}`.toLowerCase(),
    `${monthShort} ${day}`.toLowerCase(),
    `${m}/${d}`,
    `${mm}/${dd}`
  ];
}

function flattenStrings(node, out = []) {
  if (!node) return out;
  const t = typeof node;
  if (t === 'string') out.push(node);
  else if (t === 'number' || t === 'boolean') out.push(String(node));
  else if (Array.isArray(node)) node.forEach((v) => flattenStrings(v, out));
  else if (t === 'object') Object.values(node).forEach((v) => flattenStrings(v, out));
  return out;
}

function extractFromLines(dateTokens, lines) {
  const lowerLines = lines.map((l) => l.toLowerCase());
  let idx = -1;
  for (let i = 0; i < lowerLines.length; i++) {
    if (dateTokens.some((tok) => lowerLines[i].includes(tok))) { idx = i; break; }
  }
  // Search window around date
  const start = Math.max(0, idx === -1 ? 0 : idx - 20);
  const end = Math.min(lowerLines.length, idx === -1 ? lowerLines.length : idx + 40);
  let breakfast = null, lunch = null;
  for (let i = start; i < end; i++) {
    const l = lowerLines[i];
    if (!breakfast) {
      const m = l.match(/breakfast[^:]*:\s*(.*)/);
      if (m && lines[i]) breakfast = normalizeText(lines[i].split(':').slice(1).join(':'));
    }
    if (!lunch) {
      const m2 = l.match(/\blunch[^:]*:\s*(.*)/);
      if (m2 && lines[i]) lunch = normalizeText(lines[i].split(':').slice(1).join(':'));
    }
    if (breakfast && lunch) break;
  }
  // If still missing, try generic search anywhere
  if (!breakfast) {
    for (let i = 0; i < lowerLines.length; i++) {
      const l = lowerLines[i];
      const m = l.match(/breakfast[^:]*:\s*(.*)/);
      if (m && lines[i]) { breakfast = normalizeText(lines[i].split(':').slice(1).join(':')); break; }
    }
  }
  if (!lunch) {
    for (let i = 0; i < lowerLines.length; i++) {
      const l = lowerLines[i];
      const m = l.match(/\blunch[^:]*:\s*(.*)/);
      if (m && lines[i]) { lunch = normalizeText(lines[i].split(':').slice(1).join(':')); break; }
    }
  }
  if (breakfast || lunch) return { breakfast: breakfast || null, lunch: lunch || null };
  return null;
}

async function tryScrape(dateKey) {
  const source = process.env.MENU_SOURCE_URL || DEFAULT_MENU_SOURCE;
  const dateTokens = buildDateTokens(dateKey);
  try {
    const res = await fetch(source, { cache: 'no-store' });
    const html = await res.text();

    // 1) Find candidate JSON URLs in HTML
    const urlRe = /(https?:\/\/[^"'\s>]+\.json)|((?:\/[^"'\s>]+)\.json)/gi;
    const found = new Set();
    let m;
    while ((m = urlRe.exec(html)) !== null) {
      const u = m[1] || m[2];
      if (u) found.add(u);
    }

    const base = new URL(source);
    const candidates = Array.from(found).map((u) => {
      try { return new URL(u, base).toString(); } catch { return null; }
    }).filter(Boolean);

    // 2) Fetch and parse candidates
    for (const u of candidates) {
      try {
        const r = await fetch(u, { cache: 'no-store' });
        const ct = r.headers.get('content-type') || '';
        if (!ct.includes('application/json')) continue;
        const j = await r.json();
        const lines = flattenStrings(j).map(normalizeText).filter(Boolean);
        const extracted = extractFromLines(dateTokens, lines);
        if (extracted) return extracted;
      } catch {}
    }

    // 3) Fallback to naive HTML heuristics
    const lower = html.toLowerCase();
    let breakfast = null;
    let lunch = null;
    const bMatch = lower.match(/breakfast[^<>{}\n\r\t]*[:\-]\s*([^<>{}\n\r]+)/);
    const lMatch = lower.match(/\blunch[^<>{}\n\r\t]*[:\-]\s*([^<>{}\n\r]+)/);
    if (bMatch && bMatch[1]) breakfast = normalizeText(bMatch[1]);
    if (lMatch && lMatch[1]) lunch = normalizeText(lMatch[1]);
    if (breakfast || lunch) return { breakfast, lunch };
  } catch {
    // ignore network or parse errors
  }
  return null;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    if (!date) return NextResponse.json({ error: 'Missing date' }, { status: 400 });

    // 1) Check DB/cache
    const existing = await getMenuForDate(date);
    if (existing && (existing.breakfast || existing.lunch)) {
      return NextResponse.json({ date, ...existing, source: 'cache' });
    }

    // 2) Best-effort scrape
    const scraped = await scrapeForDate(date);
    if (scraped) {
      await saveMenuForDate(date, scraped); // cache for next time when DB available
      return NextResponse.json({ date, ...scraped, source: 'scraped' });
    }

    // 3) As a fallback, try scraping the whole month once and caching
    try {
      const [y, m] = date.split('-');
      const monthKey = `${y}-${m}`;
      const { scrapeForMonth } = await import('../../../lib/menu-scraper');
      const map = await scrapeForMonth(monthKey);
      let used = false;
      for (const [dk, menu] of Object.entries(map)) {
        await saveMenuForDate(dk, menu);
        if (dk === date) used = true;
      }
      if (used) {
        const cached = await getMenuForDate(date);
        if (cached) return NextResponse.json({ date, ...cached, source: 'scraped-month' });
      }
    } catch {}

    // 4) No data
    return NextResponse.json({ date, breakfast: null, lunch: null, source: 'none' });
  } catch (err) {
    console.error('GET /api/menu failed:', err);
    return NextResponse.json({ error: 'Server error fetching menu' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { date, breakfast, lunch, pin } = body || {};
    if (!date) return NextResponse.json({ error: 'Missing date' }, { status: 400 });

    const requiredPin = process.env.MENU_ADMIN_PIN || '';
    if (requiredPin && pin !== requiredPin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await saveMenuForDate(date, { breakfast: breakfast || null, lunch: lunch || null });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/menu failed:', err);
    return NextResponse.json({ error: 'Server error saving menu' }, { status: 500 });
  }
}
