import { sql } from '@vercel/postgres';

const SEED_STUDENTS = [
  'Ava','Liam','Mia','Noah','Emma','Oliver','Sophia','Elijah','Isabella','Lucas',
  'Amelia','Mason','Harper','Logan','Evelyn','James','Abigail','Benjamin','Emily','Henry'
];

async function ensureSchema() {
  await sql`CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    first_name TEXT UNIQUE NOT NULL
  )`;

  await sql`CREATE TABLE IF NOT EXISTS choices (
    id SERIAL PRIMARY KEY,
    choice_date DATE NOT NULL,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    snack TEXT NOT NULL,
    lunch TEXT NOT NULL,
    school_option TEXT,
    milk BOOLEAN NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(choice_date, student_id)
  )`;
}

async function ensureStudents() {
  const { rows } = await sql`SELECT COUNT(*)::int AS count FROM students`;
  if (rows[0]?.count === 0) {
    for (const name of SEED_STUDENTS) {
      await sql`INSERT INTO students (first_name) VALUES (${name}) ON CONFLICT (first_name) DO NOTHING`;
    }
  }
}

export async function pgGetStudents() {
  await ensureSchema();
  await ensureStudents();
  const { rows } = await sql`SELECT first_name FROM students ORDER BY first_name ASC`;
  return rows.map(r => r.first_name);
}

export async function pgGetAllForDate(dateKey) {
  await ensureSchema();
  await ensureStudents();
  const { rows } = await sql`
    SELECT s.first_name AS student, c.snack, c.lunch, c.school_option, c.milk
    FROM students s
    LEFT JOIN choices c ON c.student_id = s.id AND c.choice_date = ${dateKey}::date
    ORDER BY s.first_name ASC
  `;
  return rows.map(r => ({
    student: r.student,
    snack: r.snack || undefined,
    lunch: r.lunch || undefined,
    schoolLunchOption: r.school_option || undefined,
    milk: typeof r.milk === 'boolean' ? r.milk : undefined,
  }));
}

export async function pgSaveChoice(dateKey, studentName, payload) {
  await ensureSchema();
  // Ensure student exists and get id
  const inserted = await sql`
    INSERT INTO students (first_name) VALUES (${studentName})
    ON CONFLICT (first_name) DO UPDATE SET first_name = EXCLUDED.first_name
    RETURNING id
  `;
  const studentId = inserted.rows[0].id;

  await sql`
    INSERT INTO choices (choice_date, student_id, snack, lunch, school_option, milk)
    VALUES (${dateKey}::date, ${studentId}, ${payload.snack}, ${payload.lunch}, ${payload.schoolLunchOption}, ${payload.milk})
    ON CONFLICT (choice_date, student_id)
    DO UPDATE SET snack = EXCLUDED.snack, lunch = EXCLUDED.lunch, school_option = EXCLUDED.school_option, milk = EXCLUDED.milk, updated_at = now()
  `;
}

