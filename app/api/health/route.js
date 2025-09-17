import { NextResponse } from 'next/server';

function hasPostgresEnv() {
  return !!(
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL
  );
}

function getPSTDateKey() {
  const pstString = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
  const d = new Date(pstString);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function GET() {
  const envDetected = hasPostgresEnv();
  const dateKey = getPSTDateKey();

  if (!envDetected) {
    return NextResponse.json({ backend: 'file', envDetected, dateKey, ok: true });
  }

  try {
    const { sql } = await import('@vercel/postgres');
    await sql`SELECT 1 as ok`;
    return NextResponse.json({ backend: 'postgres', envDetected, dateKey, ok: true });
  } catch (err) {
    return NextResponse.json({ backend: 'postgres', envDetected, dateKey, ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}

