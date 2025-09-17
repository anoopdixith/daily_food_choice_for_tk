import fs from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');
const studentsPath = path.join(dataDir, 'students.json');
const choicesPath = path.join(dataDir, 'choices.json');

function ensureFiles() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(studentsPath)) {
    const sample = [
      'Ava','Liam','Mia','Noah','Emma','Oliver','Sophia','Elijah','Isabella','Lucas',
      'Amelia','Mason','Harper','Logan','Evelyn','James','Abigail','Benjamin','Emily','Henry'
    ];
    fs.writeFileSync(studentsPath, JSON.stringify(sample, null, 2));
  }
  if (!fs.existsSync(choicesPath)) {
    fs.writeFileSync(choicesPath, JSON.stringify({}, null, 2));
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

export function getStudents() {
  const data = readJSON(studentsPath);
  return Array.isArray(data) ? data : [];
}

export function getChoicesByDate(dateKey) {
  const all = readJSON(choicesPath) || {};
  return all[dateKey] || {};
}

export function saveChoice(dateKey, student, payload) {
  const all = readJSON(choicesPath) || {};
  if (!all[dateKey]) all[dateKey] = {};
  all[dateKey][student] = payload;
  writeJSON(choicesPath, all);
}

export function getAllForDate(dateKey) {
  const students = getStudents();
  const map = getChoicesByDate(dateKey);
  return students.map((s) => ({ student: s, ...(map[s] || {}) }));
}

