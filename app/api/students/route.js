import { NextResponse } from 'next/server';
import { getStudents } from '../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const students = await getStudents();
    return NextResponse.json({ students });
  } catch (err) {
    console.error('GET /api/students failed:', err);
    return NextResponse.json({ error: 'Server error fetching students' }, { status: 500 });
  }
}
