import { NextResponse } from 'next/server';
import { getChoicesByDate, getStudents, saveChoice } from '../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  if (!date) return NextResponse.json({ error: 'Missing date' }, { status: 400 });

  const students = getStudents();
  const map = getChoicesByDate(date);
  const choices = students.map((s) => ({ student: s, ...(map[s] || {}) }));
  return NextResponse.json({ date, choices });
}

export async function POST(req) {
  const body = await req.json();
  const { date, student, snack, lunch, schoolLunchOption, milk } = body || {};

  if (!date || !student || !snack || !lunch || typeof milk !== 'boolean') {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (lunch === 'School lunch' && !schoolLunchOption) {
    return NextResponse.json({ error: 'School lunch option is required when choosing School lunch' }, { status: 400 });
  }

  const normalized = {
    snack,
    lunch,
    schoolLunchOption: lunch === 'School lunch' ? (schoolLunchOption || null) : null,
    milk,
  };

  saveChoice(date, student, normalized);
  return NextResponse.json({ ok: true });
}
