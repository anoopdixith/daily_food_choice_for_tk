import { NextResponse } from 'next/server';
import { saveMenuForDate } from '../../../../lib/db';

function monthNumber(name) {
  const idx = [
    'january','february','march','april','may','june',
    'july','august','september','october','november','december'
  ].indexOf(String(name || '').toLowerCase());
  return idx === -1 ? null : idx + 1;
}

function parseMonthAndYear(text) {
  // e.g., "September 2025 Menu:" or "September 2025"
  const m = text.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b\s+(\d{4})/i);
  if (!m) return null;
  const mon = monthNumber(m[1]);
  const year = parseInt(m[2], 10);
  return { month: mon, year };
}

function composeLunch(meat, veg, deli, noSchool) {
  if (noSchool) return 'No School';
  const parts = [];
  parts.push(`Meat: ${meat || 'None'}`);
  parts.push(`Vegetarian: ${veg || 'None'}`);
  parts.push(`Deli: ${deli || 'None'}`);
  return parts.join(' | ');
}

function parseIngestText(text) {
  const header = parseMonthAndYear(text);
  if (!header) throw new Error('Could not find month and year in text');
  const { month, year } = header;

  const isBreakfast = /breakfast\s+menu/i.test(text);
  const isLunch = /lunch\s+menu/i.test(text);
  const mode = isBreakfast && !isLunch ? 'breakfast' : 'lunch';

  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const dayHeaderRe = new RegExp(`^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\\s+\\w+\\s+(\\d+)\\s+Menu:`, 'i');
  const opt1Re = /^Option\s*1\s*[-–]\s*Meat/i;
  const opt2Re = /^Option\s*2\s*[-–]\s*Vegetarian/i;
  const opt3Re = /^Option\s*3\s*[-–]\s*(?:Cold\s+)?Deli/i;
  const noSchoolRe = /^No\s+School$/i;

  const results = {};
  let currentDay = null;
  let section = null; // 'meat' | 'veg' | 'deli'
  let meat = null, veg = null, deli = null, noSchool = false;
  let breakfastItem = null;

  function flushDay() {
    if (currentDay != null) {
      const dateKey = `${year}-${String(month).padStart(2,'0')}-${String(currentDay).padStart(2,'0')}`;
      if (mode === 'lunch') {
        results[dateKey] = { lunch: composeLunch(meat, veg, deli, noSchool) };
      } else {
        results[dateKey] = { breakfast: noSchool ? 'No School' : (breakfastItem || null) };
      }
    }
    currentDay = null; section = null; meat = null; veg = null; deli = null; noSchool = false; breakfastItem = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const dh = line.match(dayHeaderRe);
    if (dh) {
      flushDay();
      currentDay = parseInt(dh[1], 10);
      continue;
    }

    if (currentDay == null) continue;

    if (noSchoolRe.test(line)) { noSchool = true; section = null; continue; }

    if (mode === 'lunch') {
      if (opt1Re.test(line)) { section = 'meat'; continue; }
      if (opt2Re.test(line)) { section = 'veg'; continue; }
      if (opt3Re.test(line)) { section = 'deli'; continue; }
      // Capture content lines for active lunch section
      if (section === 'meat') { if (line && !/^Option\s*\d/.test(line)) meat = line; }
      else if (section === 'veg') { if (line && !/^Option\s*\d/.test(line)) veg = line; }
      else if (section === 'deli') { if (line && !/^Option\s*\d/.test(line)) deli = line; }
    } else {
      // Breakfast: choose the first content line that isn't Fresh Fruits or Milk
      if (!breakfastItem && !/^Option\s*\d/.test(line) && !/^Fresh\s+Fruits$/i.test(line) && !/^Milk$/i.test(line)) {
        breakfastItem = line;
      }
    }
  }

  flushDay();
  return results;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { text } = body || {};
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    const map = parseIngestText(text);
    let saved = 0;
    for (const [dateKey, menu] of Object.entries(map)) {
      await saveMenuForDate(dateKey, menu);
      saved++;
    }
    return NextResponse.json({ saved, dates: Object.keys(map).length });
  } catch (err) {
    console.error('POST /api/menu/ingest-text failed:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
