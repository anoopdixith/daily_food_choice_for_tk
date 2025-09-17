const DEFAULT_MENU_SOURCE = 'https://www.schoolnutritionandfitness.com/webmenus2/#/ocr-pdf?id=689ecc6ac503dc2f970dd833';

export function normalizeText(t) {
  return (t || '').replace(/\s+/g, ' ').trim();
}

export function buildDateTokens(dateKey) {
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
    `${mm}/${dd}`,
  ];
}

export function flattenStrings(node, out = []) {
  if (!node) return out;
  const t = typeof node;
  if (t === 'string') out.push(node);
  else if (t === 'number' || t === 'boolean') out.push(String(node));
  else if (Array.isArray(node)) node.forEach((v) => flattenStrings(v, out));
  else if (t === 'object') Object.values(node).forEach((v) => flattenStrings(v, out));
  return out;
}

export function extractFromLines(dateTokens, lines) {
  const lowerLines = lines.map((l) => l.toLowerCase());
  let idx = -1;
  for (let i = 0; i < lowerLines.length; i++) {
    if (dateTokens.some((tok) => lowerLines[i].includes(tok))) { idx = i; break; }
  }
  const start = Math.max(0, idx === -1 ? 0 : idx - 30);
  const end = Math.min(lowerLines.length, idx === -1 ? lowerLines.length : idx + 60);
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

async function fetchSource() {
  const source = process.env.MENU_SOURCE_URL || DEFAULT_MENU_SOURCE;
  const res = await fetch(source, { cache: 'no-store' });
  const html = await res.text();
  return { html, source };
}

function findJsonCandidates(html, sourceUrl) {
  const urlRe = /(https?:\/\/[^"'\s>]+\.json)|((?:\/[^"'\s>]+)\.json)/gi;
  const found = new Set();
  let m;
  while ((m = urlRe.exec(html)) !== null) {
    const u = m[1] || m[2];
    if (u) found.add(u);
  }
  const base = new URL(sourceUrl);
  return Array.from(found)
    .map((u) => { try { return new URL(u, base).toString(); } catch { return null; } })
    .filter(Boolean);
}

export async function scrapeForDate(dateKey) {
  try {
    const { html, source } = await fetchSource();
    const candidates = findJsonCandidates(html, source);
    const dateTokens = buildDateTokens(dateKey);

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

    // Fallback: parse HTML
    const lower = html.toLowerCase();
    let breakfast = null;
    let lunch = null;
    const bMatch = lower.match(/breakfast[^<>{}\n\r\t]*[:\-]\s*([^<>{}\n\r]+)/);
    const lMatch = lower.match(/\blunch[^<>{}\n\r\t]*[:\-]\s*([^<>{}\n\r]+)/);
    if (bMatch && bMatch[1]) breakfast = normalizeText(bMatch[1]);
    if (lMatch && lMatch[1]) lunch = normalizeText(lMatch[1]);
    if (breakfast || lunch) return { breakfast, lunch };
  } catch {}
  return null;
}

export async function scrapeForMonth(monthKey /* YYYY-MM */) {
  const [y, m] = monthKey.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  const { html, source } = await fetchSource();
  const candidates = findJsonCandidates(html, source);
  const results = {};

  // Fetch JSONs once
  const jsons = [];
  for (const u of candidates) {
    try {
      const r = await fetch(u, { cache: 'no-store' });
      const ct = r.headers.get('content-type') || '';
      if (!ct.includes('application/json')) continue;
      jsons.push(await r.json());
    } catch {}
  }

  const lines = jsons.flatMap((j) => flattenStrings(j)).map(normalizeText).filter(Boolean);

  for (let d = 1; d <= end.getUTCDate(); d++) {
    const dateKey = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const tokens = buildDateTokens(dateKey);
    const ext = extractFromLines(tokens, lines);
    if (ext) results[dateKey] = ext;
  }

  // If nothing extracted, try naive HTML once for entire month (unlikely to be helpful)
  return results;
}

