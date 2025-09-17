import { NextResponse } from 'next/server';
import { getStudents } from '../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const students = getStudents();
  return NextResponse.json({ students });
}

