"use client";

import { useEffect, useMemo, useState } from 'react';

function getPSTDateObj() {
  const now = new Date();
  const pstString = now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
  return new Date(pstString);
}

function getDateKeyPST() {
  const d = getPSTDateObj();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getTomorrowDateKeyPST() {
  const d = getPSTDateObj();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function HomePage() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [menu, setMenu] = useState({ breakfast: null, lunch: null, source: null });
  const [menuTomorrow, setMenuTomorrow] = useState({ breakfast: null, lunch: null, source: null });

  function lunchDetails(l) {
    if (!l) return [];
    const lower = String(l).toLowerCase();
    if (lower.includes('no school')) return [{ label: 'Status', value: 'No School', kind: 'status' }];
    return String(l)
      .split(' | ')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((part) => {
        const [rawLabel, ...rest] = part.split(':');
        const label = (rawLabel || '').trim();
        const value = rest.join(':').trim();
        const kind = label.toLowerCase().includes('meat')
          ? 'meat'
          : label.toLowerCase().includes('vegetarian')
          ? 'vegetarian'
          : label.toLowerCase().includes('deli')
          ? 'deli'
          : 'status';
        return { label, value, kind };
      });
  }

  // Form state
  const [student, setStudent] = useState('');
  const [snack, setSnack] = useState('School Snack');
  const [lunch, setLunch] = useState('Home lunch');
  const [schoolLunchOption, setSchoolLunchOption] = useState('');
  const [milk, setMilk] = useState(true);

  const pstDateObj = useMemo(() => getPSTDateObj(), []);
  const displayDate = useMemo(
    () => pstDateObj.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: 'long', day: 'numeric' }),
    [pstDateObj]
  );

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/students', { cache: 'no-store' });
        const data = await res.json();
        setStudents(data.students || []);
        setStudent((data.students || [])[0] || '');
      } catch (e) {
        setError('Failed to load students');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    async function loadMenu() {
      try {
        const dateKey = getDateKeyPST();
        const res = await fetch(`/api/menu?date=${dateKey}`, { cache: 'no-store' });
        const data = await res.json();
        setMenu({ breakfast: data.breakfast ?? null, lunch: data.lunch ?? null, source: data.source || null });
      } catch {
        setMenu({ breakfast: null, lunch: null, source: null });
      }
      try {
        const tomorrowKey = getTomorrowDateKeyPST();
        const res2 = await fetch(`/api/menu?date=${tomorrowKey}`, { cache: 'no-store' });
        const data2 = await res2.json();
        setMenuTomorrow({ breakfast: data2.breakfast ?? null, lunch: data2.lunch ?? null, source: data2.source || null });
      } catch {
        setMenuTomorrow({ breakfast: null, lunch: null, source: null });
      }
    }
    loadMenu();
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (lunch === 'School lunch' && !schoolLunchOption) {
      setError('Please choose a school lunch option.');
      return;
    }
    try {
      const dateKey = getDateKeyPST();
      const payload = { date: dateKey, student, snack, lunch, schoolLunchOption, milk };
      const res = await fetch('/api/choices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Submission failed');
      }
      setSuccess('Submitted! Thank you.');
    } catch (e) {
      setError(e.message || 'Something went wrong');
    }
  }

  return (
    <div className="card">
      <div className="date-block">
        <div className="date-line">Date: {displayDate} (PST)</div>
        <div className="room-line">Room Number 32</div>
      </div>
      <form onSubmit={onSubmit}>
        <div className="row">
          <div className="field">
            <label className="label" htmlFor="student">Student</label>
            <select id="student" value={student} onChange={(e) => setStudent(e.target.value)} disabled={loading}>
              {students.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="snack">Choose snack</label>
            <select id="snack" value={snack} onChange={(e) => setSnack(e.target.value)}>
              <option>School Snack</option>
              <option>Home Snack</option>
            </select>
          </div>
        </div>
        

        <div className="row">
          <div className="field">
            <label className="label" htmlFor="lunch">Choose lunch</label>
            <select id="lunch" value={lunch} onChange={(e) => setLunch(e.target.value)}>
              <option>School lunch</option>
              <option>Home lunch</option>
            </select>
          </div>
          {lunch === 'School lunch' && (
            <div className="field">
              <label className="label" htmlFor="schoolLunchOption">School lunch option (required)</label>
              <select id="schoolLunchOption" value={schoolLunchOption} onChange={(e) => setSchoolLunchOption(e.target.value)}>
                <option value="" disabled>Select a school lunch option</option>
                <option>Option 1 (Meat)</option>
                <option>Option 2 (Vegetarian)</option>
                <option>Option 3 (Deli)</option>
              </select>
            </div>
          )}
        </div>

        <div className="row">
          <div className="field">
            <span className="label">Is milk okay?</span>
            <div className="radio-group">
              <label className="radio-option"><input type="radio" name="milk" checked={milk} onChange={() => setMilk(true)} /> Yes</label>
              <label className="radio-option"><input type="radio" name="milk" checked={!milk} onChange={() => setMilk(false)} /> No</label>
            </div>
          </div>
        </div>

        <div className="actions">
          <button className="primary" type="submit" disabled={
            loading || !student || (lunch === 'School lunch' && !schoolLunchOption)
          }>Submit</button>
          {loading && <span className="meta">Loading students…</span>}
          {error && <span className="meta" style={{ color: '#b91c1c' }}>{error}</span>}
          {success && <span className="meta" style={{ color: '#166534' }}>{success}</span>}
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-title">Today's menu at school</div>
          <div className="row">
            <div className="field">
              <span className="label">Breakfast</span>
              <div>{menu.breakfast || 'Not available'}</div>
            </div>
            <div className="field">
              <span className="label">Lunch</span>
              {menu.lunch ? (
                <div className="menu-lines">
                  {lunchDetails(menu.lunch).map((it, idx) => (
                    <div className="menu-line" key={idx}>
                      <span className={`menu-label ${it.kind}`}>{it.label}:</span>
                      <span className="menu-value">{it.value || 'None'}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div>Not available</div>
              )}
            </div>
          </div>
        </div>
      </form>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title">Tomorrow's menu at school</div>
        <div className="row">
          <div className="field">
            <span className="label">Breakfast</span>
            <div>{menuTomorrow.breakfast || 'Not available'}</div>
          </div>
          <div className="field">
            <span className="label">Lunch</span>
            {menuTomorrow.lunch ? (
              <div className="menu-lines">
                {lunchDetails(menuTomorrow.lunch).map((it, idx) => (
                  <div className="menu-line" key={idx}>
                    <span className={`menu-label ${it.kind}`}>{it.label}:</span>
                    <span className="menu-value">{it.value || 'None'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div>Not available</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
