import { getAllForDate } from '../../lib/db';

function getPSTDateKey() {
  const pstString = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
  const d = new Date(pstString);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getPSTDisplay() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const dateKey = getPSTDateKey();
  const displayDate = getPSTDisplay();
  const rows = getAllForDate(dateKey);

  return (
    <div className="card">
      <div className="date-block">
        <div className="date-line">Daily choices for: {displayDate} (PST)</div>
        <div className="room-line">Room Number 32</div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Snack</th>
              <th>Lunch</th>
              <th>School Lunch Option</th>
              <th>Milk</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.student}>
                <td>{r.student}</td>
                <td>{r.snack || '-'}</td>
                <td>{r.lunch || '-'}</td>
                <td>{r.schoolLunchOption || '-'}</td>
                <td>{r.milk === true ? 'Yes' : r.milk === false ? 'No' : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
