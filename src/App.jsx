import { useEffect, useState } from 'react'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const COLORS = ['#e4572e', '#2a9d8f', '#7b5cd6', '#f2a900', '#3a86ff', '#d6336c']
const KEY = 'homework-board-v1'
const uid = () => Math.random().toString(36).slice(2, 10)

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const mondayOf = (d) => {
  const x = new Date(d); x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x
}
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const fmt = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || { kids: [], tasks: [], notes: [] } }
  catch { return { kids: [], tasks: [], notes: [] } }
}

export default function App() {
  const [data, setData] = useState(load)
  const [view, setView] = useState('board') // board | parents
  const [kidId, setKidId] = useState(null)
  const [week, setWeek] = useState(iso(mondayOf(new Date())))

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(data)) } catch {} }, [data])
  useEffect(() => { if (!data.kids.find((k) => k.id === kidId)) setKidId(data.kids[0]?.id ?? null) }, [data.kids, kidId])

  const update = (fn) => setData((d) => fn(d))
  const monday = new Date(week + 'T00:00:00')
  const thisMonday = iso(mondayOf(new Date()))
  const todayIdx = week === thisMonday ? (new Date().getDay() + 6) % 7 : -1
  const weekTasks = data.tasks.filter((t) => t.week === week)

  const addTask = (t) => update((d) => ({ ...d, tasks: [...d.tasks, { id: uid(), week, done: false, ...t }] }))
  const patchTask = (id, p) => update((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, ...p } : t)) }))
  const delTask = (id) => update((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }))

  const carryOver = () => {
    const next = iso(addDays(monday, 7))
    update((d) => ({
      ...d,
      tasks: d.tasks.map((t) => (t.week === week && !t.done ? { ...t, week: next, day: null } : t)),
    }))
    setWeek(next)
  }

  const backup = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    a.download = `homework-board-${iso(new Date())}.json`; a.click()
  }
  const restore = (e) => {
    const f = e.target.files[0]; if (!f) return
    f.text().then((txt) => {
      try { const j = JSON.parse(txt); if (j.kids && j.tasks) setData({ notes: [], ...j }); else alert('That file is not a Homework Board backup.') }
      catch { alert('Could not read that file.') }
    }); e.target.value = ''
  }

  if (data.kids.length === 0) return <Setup onAdd={(k) => update((d) => ({ ...d, kids: [...d.kids, k] }))} />

  return (
    <div className="app">
      <header className="top">
        <h1>Homework Board</h1>
        <nav className="tabs">
          <button className={view === 'board' ? 'on' : ''} onClick={() => setView('board')}>Kid board</button>
          <button className={view === 'parents' ? 'on' : ''} onClick={() => setView('parents')}>Parent dashboard</button>
        </nav>
      </header>

      <div className="weekbar">
        <button onClick={() => setWeek(iso(addDays(monday, -7)))} aria-label="Previous week">‹</button>
        <strong>{fmt(monday)} – {fmt(addDays(monday, 6))}{week === thisMonday ? ' (this week)' : ''}</strong>
        <button onClick={() => setWeek(iso(addDays(monday, 7)))} aria-label="Next week">›</button>
        {week !== thisMonday && <button className="link" onClick={() => setWeek(thisMonday)}>Jump to this week</button>}
      </div>

      {view === 'board' ? (
        <Board {...{ data, kidId, setKidId, weekTasks, todayIdx, addTask, patchTask, delTask }} />
      ) : (
        <Parents {...{ data, update, week, weekTasks, todayIdx, carryOver }} />
      )}

      <footer>
        <ManageKids data={data} update={update} />
        <div className="row">
          <button className="ghost" onClick={backup}>Backup</button>
          <label className="ghost btn">Restore<input type="file" accept="application/json" onChange={restore} hidden /></label>
        </div>
        <p className="hint">Data is saved in this browser only. Use Backup / Restore to move it to another device.</p>
      </footer>
    </div>
  )
}

function Setup({ onAdd }) {
  const [name, setName] = useState('')
  const [list, setList] = useState([])
  const add = () => { if (name.trim()) { setList([...list, name.trim()]); setName('') } }
  const start = () => list.forEach((n, i) => onAdd({ id: uid(), name: n, color: COLORS[i % COLORS.length] }))
  return (
    <div className="app setup">
      <h1>Homework Board</h1>
      <p>Who is using the board? Add each child.</p>
      <div className="row">
        <input value={name} placeholder="Child's name" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button onClick={add}>Add child</button>
      </div>
      <ul className="chips">{list.map((n, i) => <li key={i} style={{ background: COLORS[i % COLORS.length] }}>{n}</li>)}</ul>
      {list.length > 0 && <button className="primary" onClick={start}>Start planning</button>}
    </div>
  )
}

function Board({ data, kidId, setKidId, weekTasks, todayIdx, addTask, patchTask, delTask }) {
  const kid = data.kids.find((k) => k.id === kidId)
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [day, setDay] = useState('')
  const mine = weekTasks.filter((t) => t.kidId === kidId)
  const submit = (e) => {
    e.preventDefault(); if (!title.trim()) return
    addTask({ kidId, title: title.trim(), subject: subject.trim(), day: day === '' ? null : Number(day) })
    setTitle(''); setSubject('')
  }
  const cols = [{ label: 'To plan', idx: null }, ...DAYS.map((d, i) => ({ label: d, idx: i }))]
  return (
    <>
      <div className="kids">
        {data.kids.map((k) => (
          <button key={k.id} className={k.id === kidId ? 'kid on' : 'kid'} style={{ '--c': k.color }} onClick={() => setKidId(k.id)}>{k.name}</button>
        ))}
      </div>
      <form className="add" onSubmit={submit}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`What does ${kid?.name} need to do?`} aria-label="Task" />
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject (e.g. Maths)" aria-label="Subject" />
        <select value={day} onChange={(e) => setDay(e.target.value)} aria-label="Day">
          <option value="">Plan later</option>
          {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
        </select>
        <button className="primary">Add task</button>
      </form>
      <div className="grid">
        {cols.map((c) => {
          const items = mine.filter((t) => (t.day ?? null) === c.idx)
          return (
            <section key={c.label} className={'col' + (c.idx === todayIdx ? ' today' : '') + (c.idx === null ? ' plan' : '')}>
              <h3>{c.label}</h3>
              {items.length === 0 && <p className="empty">{c.idx === null ? 'Nothing waiting' : 'Free day'}</p>}
              {items.map((t) => (
                <article key={t.id} className={'task' + (t.done ? ' done' : '')} style={{ '--c': kid?.color }}>
                  <label>
                    <input type="checkbox" checked={t.done} onChange={(e) => patchTask(t.id, { done: e.target.checked, doneAt: e.target.checked ? new Date().toISOString() : null })} />
                    <span>{t.title}</span>
                  </label>
                  {t.subject && <small>{t.subject}</small>}
                  <div className="row small">
                    <select value={t.day ?? ''} onChange={(e) => patchTask(t.id, { day: e.target.value === '' ? null : Number(e.target.value) })} aria-label="Move to day">
                      <option value="">To plan</option>
                      {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                    </select>
                    <button className="x" onClick={() => delTask(t.id)} aria-label="Delete task">Delete</button>
                  </div>
                </article>
              ))}
            </section>
          )
        })}
      </div>
    </>
  )
}

function Parents({ data, update, week, weekTasks, todayIdx, carryOver }) {
  const [drafts, setDrafts] = useState({})
  const saveNote = (kidId) => {
    const text = (drafts[kidId] || '').trim(); if (!text) return
    update((d) => ({ ...d, notes: [...d.notes, { id: uid(), kidId, week, text, at: new Date().toISOString() }] }))
    setDrafts({ ...drafts, [kidId]: '' })
  }
  const open = weekTasks.filter((t) => !t.done).length
  return (
    <div className="parents">
      {data.kids.map((k) => {
        const ts = weekTasks.filter((t) => t.kidId === k.id)
        const done = ts.filter((t) => t.done).length
        const pct = ts.length ? Math.round((done / ts.length) * 100) : 0
        const behind = ts.filter((t) => !t.done && t.day !== null && t.day < todayIdx)
        const unplanned = ts.filter((t) => !t.done && t.day === null)
        const notes = data.notes.filter((n) => n.kidId === k.id && n.week === week)
        return (
          <section key={k.id} className="card" style={{ '--c': k.color }}>
            <h2>{k.name}</h2>
            <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100"><i style={{ width: pct + '%' }} /></div>
            <p>{done} of {ts.length} done ({pct}%)</p>
            <div className="days">
              {DAYS.map((d, i) => {
                const day = ts.filter((t) => t.day === i)
                const dn = day.filter((t) => t.done).length
                const state = day.length === 0 ? 'none' : dn === day.length ? 'full' : i < todayIdx ? 'late' : 'open'
                return <div key={d} className={'day ' + state + (i === todayIdx ? ' now' : '')}><b>{d}</b><span>{day.length ? `${dn}/${day.length}` : '–'}</span></div>
              })}
            </div>
            {behind.length > 0 && <p className="warn">Behind: {behind.map((t) => t.title).join(', ')}</p>}
            {unplanned.length > 0 && <p className="note">Not planned yet: {unplanned.map((t) => t.title).join(', ')}</p>}
            <h4>Checkpoint notes</h4>
            {notes.map((n) => <p key={n.id} className="nt"><small>{new Date(n.at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</small> {n.text}</p>)}
            <div className="row">
              <input value={drafts[k.id] || ''} onChange={(e) => setDrafts({ ...drafts, [k.id]: e.target.value })} placeholder="Add a note after checking in" onKeyDown={(e) => e.key === 'Enter' && saveNote(k.id)} />
              <button onClick={() => saveNote(k.id)}>Save note</button>
            </div>
          </section>
        )
      })}
      <button className="ghost" disabled={open === 0} onClick={carryOver}>Move {open} unfinished task{open === 1 ? '' : 's'} to next week</button>
    </div>
  )
}

function ManageKids({ data, update }) {
  const [name, setName] = useState('')
  const add = () => {
    if (!name.trim()) return
    update((d) => ({ ...d, kids: [...d.kids, { id: uid(), name: name.trim(), color: COLORS[d.kids.length % COLORS.length] }] })); setName('')
  }
  const remove = (k) => {
    if (confirm(`Remove ${k.name} and all their tasks?`))
      update((d) => ({ ...d, kids: d.kids.filter((x) => x.id !== k.id), tasks: d.tasks.filter((t) => t.kidId !== k.id), notes: d.notes.filter((n) => n.kidId !== k.id) }))
  }
  return (
    <details>
      <summary>Manage children</summary>
      <ul className="chips">{data.kids.map((k) => <li key={k.id} style={{ background: k.color }}>{k.name} <button onClick={() => remove(k)} aria-label={`Remove ${k.name}`}>×</button></li>)}</ul>
      <div className="row"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a child" /><button onClick={add}>Add</button></div>
    </details>
  )
}
