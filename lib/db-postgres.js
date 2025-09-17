import { Pool } from 'pg';

const SEED_STUDENTS = [
  'Ava','Liam','Mia','Noah','Emma','Oliver','Sophia','Elijah','Isabella','Lucas',
  'Amelia','Mason','Harper','Logan','Evelyn','James','Abigail','Benjamin','Emily','Henry'
];

function getDbUrl() {
  return (
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL
  );
}

function getPool() {
  const url = getDbUrl();
  if (!url) throw new Error('No Postgres connection string found');

  if (!globalThis.__pgPool) {
    globalThis.__pgPool = new Pool({ connectionString: url, max: 1 });
  }
  return globalThis.__pgPool;
}

async function ensureSchema(client) {
  await client.query(`CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    first_name TEXT UNIQUE NOT NULL
  )`);

  await client.query(`CREATE TABLE IF NOT EXISTS choices (
    id SERIAL PRIMARY KEY,
    choice_date DATE NOT NULL,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    snack TEXT NOT NULL,
    lunch TEXT NOT NULL,
    school_option TEXT,
    milk BOOLEAN NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(choice_date, student_id)
  )`);
}

async function ensureStudents(client) {
  const res = await client.query('SELECT COUNT(*)::int AS count FROM students');
  if (res.rows[0]?.count === 0) {
    for (const name of SEED_STUDENTS) {
      await client.query('INSERT INTO students (first_name) VALUES ($1) ON CONFLICT (first_name) DO NOTHING', [name]);
    }
  }
}

export async function pgGetStudents() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureSchema(client);
    await ensureStudents(client);
    const { rows } = await client.query('SELECT first_name FROM students ORDER BY first_name ASC');
    return rows.map(r => r.first_name);
  } finally {
    client.release();
  }
}

export async function pgGetAllForDate(dateKey) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureSchema(client);
    await ensureStudents(client);
    const { rows } = await client.query(
      `SELECT s.first_name AS student, c.snack, c.lunch, c.school_option, c.milk
       FROM students s
       LEFT JOIN choices c ON c.student_id = s.id AND c.choice_date = $1::date
       ORDER BY s.first_name ASC`,
      [dateKey]
    );
    return rows.map(r => ({
      student: r.student,
      snack: r.snack || undefined,
      lunch: r.lunch || undefined,
      schoolLunchOption: r.school_option || undefined,
      milk: typeof r.milk === 'boolean' ? r.milk : undefined,
    }));
  } finally {
    client.release();
  }
}

export async function pgSaveChoice(dateKey, studentName, payload) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureSchema(client);
    // Ensure student exists and get id
    const inserted = await client.query(
      `INSERT INTO students (first_name) VALUES ($1)
       ON CONFLICT (first_name) DO UPDATE SET first_name = EXCLUDED.first_name
       RETURNING id`,
      [studentName]
    );
    const studentId = inserted.rows[0].id;

    await client.query(
      `INSERT INTO choices (choice_date, student_id, snack, lunch, school_option, milk)
       VALUES ($1::date, $2, $3, $4, $5, $6)
       ON CONFLICT (choice_date, student_id)
       DO UPDATE SET snack = EXCLUDED.snack, lunch = EXCLUDED.lunch, school_option = EXCLUDED.school_option, milk = EXCLUDED.milk, updated_at = now()`,
      [dateKey, studentId, payload.snack, payload.lunch, payload.schoolLunchOption, payload.milk]
    );
  } finally {
    client.release();
  }
}
