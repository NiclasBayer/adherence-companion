import React, { useMemo, useState } from 'react';

// ---------------------------------------------------------------------------
// CareCompanion: medication adherence for patients after a heart attack.
// Left: the patient's phone. Right: the care team's dashboard.
// All data is synthetic and generated in the browser.
// ---------------------------------------------------------------------------

const DAYS = 28;
const SLOTS = { morning: '08:00', midday: '13:00', evening: '20:00' };

const MAYA_MEDS = [
  { id: 'asa', name: 'Aspirin', dose: '100 mg', slot: 'morning', purpose: 'Keeps blood from clotting', color: '#e8b80e' },
  { id: 'ticag', name: 'Ticagrelor', dose: '90 mg', slot: 'morning', purpose: 'Protects your new stent', color: '#00bcff' },
  { id: 'bb', name: 'Bisoprolol', dose: '2.5 mg', slot: 'morning', purpose: 'Calms the heart rate', color: '#89d329' },
  { id: 'ticag2', name: 'Ticagrelor', dose: '90 mg', slot: 'evening', purpose: 'Protects your new stent', color: '#00bcff' },
  { id: 'statin', name: 'Atorvastatin', dose: '80 mg', slot: 'evening', purpose: 'Lowers cholesterol', color: '#d30f4b' },
];

const REASONS = ['Forgot', 'Felt dizzy', 'Side effects', 'Ran out', 'Felt fine'];

const PATIENTS = [
  { id: 'p1', name: 'Maya K.', age: 58, condition: 'Heart attack, stent', since: 31, base: 0.93, trend: 0, late: 1 },
  { id: 'p2', name: 'Thomas B.', age: 64, condition: 'Heart failure', since: 120, base: 0.62, trend: -0.012, late: 3, reason: 'Side effects' },
  { id: 'p3', name: 'Aylin D.', age: 47, condition: 'Hypertension', since: 64, base: 0.9, trend: 0.002, late: 2 },
  { id: 'p4', name: 'Robert F.', age: 71, condition: 'Atrial fibrillation', since: 210, base: 0.79, trend: -0.008, late: 5, reason: 'Forgot' },
  { id: 'p5', name: 'Elena S.', age: 53, condition: 'Type 2 diabetes', since: 44, base: 0.97, trend: 0, late: 0 },
  { id: 'p6', name: 'Jonas W.', age: 39, condition: 'After bypass surgery', since: 12, base: 0.83, trend: -0.006, late: 2, reason: 'Ran out' },
  { id: 'p7', name: 'Grace O.', age: 67, condition: 'Hypertension', since: 300, base: 0.71, trend: 0.004, late: 4, reason: 'Felt fine' },
  { id: 'p8', name: 'Peter L.', age: 60, condition: 'Heart attack, stent', since: 90, base: 0.95, trend: 0, late: 1 },
];

function mulberry32(seed) {
  let a = seed;
  return function rnd() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Daily adherence history (share of doses taken) for each patient.
function buildHistory(p, seed) {
  const rnd = mulberry32(seed);
  const days = [];
  for (let d = 0; d < DAYS; d++) {
    const level = Math.min(1, Math.max(0.15, p.base + p.trend * (d - DAYS / 2) + (rnd() - 0.5) * 0.22));
    days.push(level);
  }
  return days;
}

function pct(x) {
  return `${Math.round(x * 100)}%`;
}

function riskOf(p, avg, last7) {
  if (last7 < 0.7 || (p.trend < -0.008 && last7 < 0.8)) return 'high';
  if (last7 < 0.85 || avg < 0.85) return 'medium';
  return 'low';
}

// ---------------------------------------------------------------------------
// Small UI pieces
// ---------------------------------------------------------------------------

function Ring({ value, size = 150, stroke = 14, label, sub }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#e6ecf0" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ringGrad)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#89d329" />
            <stop offset="100%" stopColor="#00bcff" />
          </linearGradient>
        </defs>
      </svg>
      <div className="ring-text">
        <div className="ring-label">{label}</div>
        <div className="ring-sub">{sub}</div>
      </div>
    </div>
  );
}

function Sparkline({ data, width = 120, height = 34, color = '#10384f' }) {
  const max = 1;
  const min = 0.2;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / (max - min)) * height;
      return `${x.toFixed(1)},${Math.max(1, Math.min(height - 1, y)).toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={width} height={height} className="spark">
      <line x1="0" x2={width} y1={height - ((0.8 - min) / (max - min)) * height} y2={height - ((0.8 - min) / (max - min)) * height} className="spark-target" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Heatmap({ days }) {
  return (
    <div className="heat">
      {days.map((v, i) => {
        const tone = v >= 0.95 ? 'h4' : v >= 0.8 ? 'h3' : v >= 0.6 ? 'h2' : v > 0 ? 'h1' : 'h0';
        return <span key={i} className={`heat-cell ${tone}`} title={`Day ${i + 1}: ${pct(v)}`} />;
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Patient phone
// ---------------------------------------------------------------------------

function Phone({ doses, onTake, onSkip, streak, todayShare, weekShare, onReminder, toast }) {
  const [askFor, setAskFor] = useState(null);
  const bySlot = Object.keys(SLOTS).map((slot) => ({ slot, items: MAYA_MEDS.filter((m) => m.slot === slot) })).filter((g) => g.items.length);
  const remaining = MAYA_MEDS.filter((m) => !doses[m.id]).length;

  return (
    <div className="phone">
      <div className="phone-notch" />
      <div className="phone-screen">
        <div className="phone-status">
          <span>9:41</span>
          <span className="phone-icons">●●● ▮</span>
        </div>

        <div className="p-head">
          <div>
            <div className="p-hello">Good morning, Maya</div>
            <div className="p-date">Day 31 after your heart attack</div>
          </div>
          <div className="p-avatar">MK</div>
        </div>

        <div className="p-hero">
          <Ring value={todayShare} label={`${MAYA_MEDS.length - remaining}/${MAYA_MEDS.length}`} sub="taken today" />
          <div className="p-hero-side">
            <div className="p-streak">
              <span className="flame">🔥</span>
              <div>
                <b>{streak} days</b>
                <small>on track</small>
              </div>
            </div>
            <div className="p-week">
              <b>{pct(weekShare)}</b>
              <small>this week</small>
            </div>
          </div>
        </div>

        {toast && <div className="p-toast">{toast}</div>}

        <div className="p-list">
          {bySlot.map((g) => (
            <div key={g.slot} className="p-slot">
              <div className="p-slot-head">
                <span>{g.slot[0].toUpperCase() + g.slot.slice(1)}</span>
                <span className="p-slot-time">{SLOTS[g.slot]}</span>
              </div>
              {g.items.map((m) => {
                const state = doses[m.id];
                return (
                  <div key={m.id} className={`p-med ${state ? `is-${state.type}` : ''}`}>
                    <span className="pill" style={{ background: m.color }} />
                    <div className="p-med-text">
                      <div className="p-med-name">{m.name} <span>{m.dose}</span></div>
                      <div className="p-med-why">
                        {state?.type === 'skipped' ? `Skipped: ${state.reason}` : m.purpose}
                      </div>
                    </div>
                    {!state && (
                      <div className="p-med-actions">
                        <button className="p-skip" onClick={() => setAskFor(m.id)} aria-label="Skip">✕</button>
                        <button className="p-take" onClick={() => onTake(m.id)}>Take</button>
                      </div>
                    )}
                    {state?.type === 'taken' && <span className="p-done">✓ {state.at}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <button className="p-reminder" onClick={onReminder}>Send me a reminder at 20:00</button>

        <div className="p-tip">
          <b>Why it matters</b>
          Taking your stent protection every day lowers the risk of a new heart attack. Missing a few days can be enough to close the stent.
        </div>

        {askFor && (
          <div className="p-sheet-bg" onClick={() => setAskFor(null)}>
            <div className="p-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="p-sheet-title">Why are you skipping?</div>
              <div className="p-sheet-sub">Your care team sees this and can help.</div>
              <div className="p-reasons">
                {REASONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      onSkip(askFor, r);
                      setAskFor(null);
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Care team dashboard
// ---------------------------------------------------------------------------

function Dashboard({ rows, selected, onSelect, mayaToday, events }) {
  const avg = rows.reduce((a, r) => a + r.avg, 0) / rows.length;
  const atRisk = rows.filter((r) => r.risk === 'high').length;
  const onTarget = rows.filter((r) => r.last7 >= 0.8).length;
  const sel = rows.find((r) => r.p.id === selected) || rows[0];

  return (
    <div className="dash">
      <div className="dash-kpis">
        <div className="d-kpi">
          <span>Average adherence</span>
          <b>{pct(avg)}</b>
          <small>last 28 days, {rows.length} patients</small>
        </div>
        <div className="d-kpi good">
          <span>On target (≥ 80%)</span>
          <b>{onTarget}/{rows.length}</b>
          <small>last 7 days</small>
        </div>
        <div className="d-kpi bad">
          <span>Need a call</span>
          <b>{atRisk}</b>
          <small>adherence dropping</small>
        </div>
        <div className="d-kpi">
          <span>Maya today</span>
          <b>{mayaToday}</b>
          <small>doses confirmed</small>
        </div>
      </div>

      <div className="dash-grid">
        <section className="card">
          <div className="card-head">
            <h2>Patients</h2>
            <span className="muted">sorted by risk</span>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Condition</th>
                <th>28-day trend</th>
                <th>7 days</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.p.id} className={r.p.id === sel.p.id ? 'sel' : ''} onClick={() => onSelect(r.p.id)}>
                  <td>
                    <div className="who">
                      <span className="who-av">{r.p.name.split(' ').map((s) => s[0]).join('')}</span>
                      <div>
                        <b>{r.p.name}</b>
                        <small>{r.p.age} years</small>
                      </div>
                    </div>
                  </td>
                  <td className="muted">{r.p.condition}</td>
                  <td><Sparkline data={r.days} color={r.risk === 'high' ? '#d6253c' : r.risk === 'medium' ? '#d69e0b' : '#3f8f1a'} /></td>
                  <td className="num">{pct(r.last7)}</td>
                  <td><span className={`risk ${r.risk}`}>{r.risk}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card detail">
          <div className="card-head">
            <h2>{sel.p.name}</h2>
            <span className={`risk ${sel.risk}`}>{sel.risk} risk</span>
          </div>
          <div className="muted small">{sel.p.condition} · in program for {sel.p.since} days</div>

          <div className="det-stats">
            <div><span>28 days</span><b>{pct(sel.avg)}</b></div>
            <div><span>7 days</span><b>{pct(sel.last7)}</b></div>
            <div><span>Late doses</span><b>{sel.p.late}</b></div>
          </div>

          <div className="det-label">Daily adherence, last 4 weeks</div>
          <Heatmap days={sel.days} />
          <div className="heat-legend">
            <span><i className="heat-cell h1" />missed most</span>
            <span><i className="heat-cell h2" />partial</span>
            <span><i className="heat-cell h3" />most taken</span>
            <span><i className="heat-cell h4" />all taken</span>
          </div>

          <div className="det-label">Suggested next step</div>
          <div className={`next ${sel.risk}`}>
            {sel.risk === 'high' && (
              <>Call {sel.p.name.split(' ')[0]} this week. Most common reason given: <b>{sel.p.reason || 'none recorded'}</b>. Consider a simpler dosing plan.</>
            )}
            {sel.risk === 'medium' && (
              <>Send an encouragement message and check refill dates. Reason given: <b>{sel.p.reason || 'none recorded'}</b>.</>
            )}
            {sel.risk === 'low' && <>Stable. Keep the current plan and review at the next visit.</>}
          </div>
        </section>

        <section className="card feed">
          <div className="card-head"><h2>Live from patients</h2></div>
          {events.length === 0 && <div className="muted small">Confirm a dose on the phone to see it here.</div>}
          {events.map((e, i) => (
            <div className={`ev ${e.kind}`} key={i}>
              <span className="ev-time">{e.at}</span>
              <span>{e.text}</span>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  const [doses, setDoses] = useState({ asa: { type: 'taken', at: '08:04' } });
  const [selected, setSelected] = useState('p2');
  const [events, setEvents] = useState([
    { at: '08:12', text: 'Peter L. took all morning medication', kind: 'ok' },
    { at: '08:04', text: 'Maya K. took Aspirin 100 mg', kind: 'ok' },
    { at: '07:58', text: 'Thomas B. skipped Sacubitril: Side effects', kind: 'warn' },
    { at: '07:31', text: 'Robert F. missed evening dose yesterday', kind: 'warn' },
  ]);
  const [toast, setToast] = useState(null);
  const [clock, setClock] = useState(9 * 60 + 41);

  const histories = useMemo(() => PATIENTS.map((p, i) => buildHistory(p, 11 + i * 7)), []);

  const todayShare = MAYA_MEDS.filter((m) => doses[m.id]?.type === 'taken').length / MAYA_MEDS.length;

  const rows = useMemo(() => {
    const order = { high: 0, medium: 1, low: 2 };
    return PATIENTS.map((p, i) => {
      const days = [...histories[i]];
      if (p.id === 'p1') days[DAYS - 1] = Math.max(todayShare, 0.2);
      const avg = days.reduce((a, v) => a + v, 0) / days.length;
      const last7 = days.slice(-7).reduce((a, v) => a + v, 0) / 7;
      return { p, days, avg, last7, risk: riskOf(p, avg, last7) };
    }).sort((a, b) => order[a.risk] - order[b.risk] || a.last7 - b.last7);
  }, [histories, todayShare]);

  const maya = rows.find((r) => r.p.id === 'p1');
  const streak = 12 + (todayShare === 1 ? 1 : 0);

  function stamp() {
    const t = clock + 1;
    setClock(t);
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  }

  function flash(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  function take(id) {
    const at = stamp();
    const med = MAYA_MEDS.find((m) => m.id === id);
    setDoses((d) => {
      const next = { ...d, [id]: { type: 'taken', at } };
      const all = MAYA_MEDS.every((m) => next[m.id]?.type === 'taken');
      flash(all ? 'All done for today. Great job!' : `${med.name} confirmed`);
      return next;
    });
    setEvents((e) => [{ at, text: `Maya K. took ${med.name} ${med.dose}`, kind: 'ok' }, ...e].slice(0, 8));
  }

  function skip(id, reason) {
    const at = stamp();
    const med = MAYA_MEDS.find((m) => m.id === id);
    setDoses((d) => ({ ...d, [id]: { type: 'skipped', reason, at } }));
    setEvents((e) => [{ at, text: `Maya K. skipped ${med.name}: ${reason}`, kind: 'warn' }, ...e].slice(0, 8));
    flash('Your care team has been informed');
  }

  function reminder() {
    flash('Reminder set for 20:00');
    setEvents((e) => [{ at: stamp(), text: 'Maya K. set an evening reminder', kind: 'info' }, ...e].slice(0, 8));
  }

  function reset() {
    setDoses({ asa: { type: 'taken', at: '08:04' } });
    setClock(9 * 60 + 41);
    setEvents((e) => e.slice(-4));
  }

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <svg viewBox="0 0 40 40" className="logo" aria-hidden="true">
            <rect x="1" y="1" width="38" height="38" rx="11" fill="rgba(255,255,255,0.08)" />
            <circle cx="20" cy="20" r="10" fill="none" stroke="#89d329" strokeWidth="4" strokeDasharray="50 13" strokeLinecap="round" transform="rotate(-90 20 20)" />
            <circle cx="20" cy="20" r="3" fill="#00bcff" />
          </svg>
          <div>
            <div className="brand-name">CareCompanion</div>
            <div className="brand-sub">Medication adherence after a heart attack</div>
          </div>
        </div>
        <div className="top-right">
          <span className="chip">Patient app</span>
          <span className="arrow">⟷</span>
          <span className="chip dark">Care team view</span>
          <button className="btn ghost" onClick={reset}>Reset demo</button>
        </div>
      </header>

      <main className="stage">
        <div className="phone-col">
          <Phone
            doses={doses}
            onTake={take}
            onSkip={skip}
            onReminder={reminder}
            streak={streak}
            todayShare={todayShare}
            weekShare={maya ? maya.last7 : 0.9}
            toast={toast}
          />
          <div className="phone-caption">What the patient sees</div>
        </div>
        <div className="dash-col">
          <Dashboard
            rows={rows}
            selected={selected}
            onSelect={setSelected}
            mayaToday={`${MAYA_MEDS.filter((m) => doses[m.id]?.type === 'taken').length}/${MAYA_MEDS.length}`}
            events={events}
          />
        </div>
      </main>

      <footer className="foot">
        Prototype built in one co-creation session. All patients and numbers are synthetic. No real patient data.
      </footer>
    </div>
  );
}
