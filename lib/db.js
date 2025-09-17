import fs from 'fs';
import path from 'path';

// Decide storage backend at runtime. Use dynamic import so local dev
// doesn’t require @vercel/postgres when a Postgres URL is not set.
function hasPostgresEnv() {
  return !!(
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL
  );
}

async function loadPg() {
  // Only import when needed to avoid bundling errors locally
  return await import('./db-postgres');
}

// File-based fallback (for local dev only)
const dataDir = path.join(process.cwd(), 'data');
const studentsPath = path.join(dataDir, 'students.json');
const choicesPath = path.join(dataDir, 'choices.json');

const SAMPLE_STUDENTS = [
  'Ava','Liam','Mia','Noah','Emma','Oliver','Sophia','Elijah','Isabella','Lucas',
  'Amelia','Mason','Harper','Logan','Evelyn','James','Abigail','Benjamin','Emily','Henry'
];

function ensureFiles() {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(studentsPath)) {
      fs.writeFileSync(studentsPath, JSON.stringify(SAMPLE_STUDENTS, null, 2));
    }
    if (!fs.existsSync(choicesPath)) {
      fs.writeFileSync(choicesPath, JSON.stringify({}, null, 2));
    }
  } catch {
    // Likely read-only filesystem (e.g., Vercel). We'll operate in read-only mode.
  }
}

function readJSON(file) {
  ensureFiles();
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    return JSON.parse(raw || 'null');
  } catch {
    return null;
  }
}

function writeJSON(file, data) {
  ensureFiles();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

export async function getStudents() {
  if (hasPostgresEnv()) {
    const { pgGetStudents } = await loadPg();
    return pgGetStudents();
  }
  const data = readJSON(studentsPath);
  return Array.isArray(data) && data.length ? data : SAMPLE_STUDENTS;
}

export async function getAllForDate(dateKey) {
  if (hasPostgresEnv()) {
    const { pgGetAllForDate } = await loadPg();
    return pgGetAllForDate(dateKey);
  }
  const students = await getStudents();
  const all = readJSON(choicesPath) || {};
  const map = all[dateKey] || {};
  return students.map((s) => ({ student: s, ...(map[s] || {}) }));
}

export async function saveChoice(dateKey, student, payload) {
  if (hasPostgresEnv()) {
    const { pgSaveChoice } = await loadPg();
    return pgSaveChoice(dateKey, student, payload);
  }
  try {
    const all = readJSON(choicesPath) || {};
    if (!all[dateKey]) all[dateKey] = {};
    all[dateKey][student] = payload;
    writeJSON(choicesPath, all);
  } catch (e) {
    throw new Error('File storage not available in this environment; configure Postgres via POSTGRES_URL on Vercel.');
  }
}
