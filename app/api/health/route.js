import { NextResponse } from 'next/server';
import { Pool } from 'pg';

function getDbUrl() {
  return (
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
  const url = getDbUrl();
  const dateKey = getPSTDateKey();

  if (!url) {
    return NextResponse.json({ backend: 'file', envDetected: false, dateKey, ok: true });
  }

  let client;
  try {
    const pool = new Pool({ connectionString: url, max: 1 });
    client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    await pool.end();
    return NextResponse.json({ backend: 'postgres', envDetected: true, dateKey, ok: true });
  } catch (err) {
    try { client?.release?.(); } catch {}
    return NextResponse.json({ backend: 'postgres', envDetected: true, dateKey, ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
