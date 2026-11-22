import { useEffect, useRef, useState } from 'react'
import { call, normalize, allOps, up, rm } from './sync.js'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const COLORS = ['#e4572e', '#2a9d8f', '#7b5cd6', '#f2a900', '#3a86ff', '#d6336c']
const KEY = 'homework-board-v1'
const CFG_KEY = 'homework-board-cfg'
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3)

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const mondayOf = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x }
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const fmt = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

const EMPTY = { kids: [], tasks: [], notes: [] }
const load = () => { try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY)) } } catch { return EMPTY } }
const loadCfg = () => { try { return JSON.parse(localStorage.getItem(CFG_KEY)) } catch { return null } }

export default function App() {
  const [cfg, setCfg] = useState(loadCfg)
  const [data, setData] = useState(load)
  const [loaded, setLoaded] = useState(false)
  const [status, setStatus] = useState('idle')
  const [err, setErr] = useState('')
  const [view, setView] = useState('board')
  const [scope, setScope] = useState('day')
  const [kidId, setKidId] = useState(null)
  const [week, setWeek] = useState(iso(mondayOf(new Date())))
  const [dayIdx, setDayIdx] = useState((new Date().getDay() + 6) % 7)

  const dataRef = useRef(data); dataRef.current = data
  const outbox = useRef([]); const busy = useRef(false)
  const online = !!cfg?.url

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(data)) } catch {} }, [data])
  useEffect(() => { if (!data.kids.find((k) => k.id === kidId)) setKidId(data.kids[0]?.id ?? null) }, [data.kids, kidId])

  // ---- sync with Google Sheet ----
  const flush = async () => {
    if (busy.current || !online) return
    busy.current = true; setStatus('saving')
    while (outbox.current.length) {
      const ops = outbox.current.splice(0)
      try { await call(cfg, { action: 'batch', ops }) }
      catch (e) { outbox.current.unshift(...ops); busy.current = false; setErr(e.message); setStatus('error'); return }
    }
    busy.current = false; setStatus('synced')
  }
  const send = (ops) => { if (!online) return; outbox.current.push(...ops); flush() }
  const refresh = async () => {
    if (!online || busy.current || outbox.current.length) { if (outbox.current.length) flush(); return }
    try {
      const j = await call(cfg, { action: 'load' })
      if (busy.current || outbox.current.length) return
      const server = normalize(j.data)
      if (server.kids.length === 0 && dataRef.current.kids.length > 0) send(allOps(dataRef.current)) // sheet is empty: seed it from this device
      else setData(server)
      setLoaded(true); setStatus('synced'); setErr('')
    } catch (e) { setErr(e.message); setStatus('error') }
  }
  useEffect(() => {
    if (!online) return
    refresh()
    const id = setInterval(refresh, 20000)
    const vis = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', vis)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', vis) }
  }, [cfg])

  // ---- changes ----
  const commit = (next, ops) => { dataRef.current = next; setData(next); send(ops) }
  const D = () => dataRef.current
  const monday = new Date(week + 'T00:00:00')
  const thisMonday = iso(mondayOf(new Date()))
  const todayIdx = week === thisMonday ? (new Date().getDay() + 6) % 7 : -1
  const weekTasks = data.tasks.filter((t) => t.week === week)

  const addKid = (name) => { const k = { id: uid(), name, color: COLORS[D().kids.length % COLORS.length] }; commit({ ...D(), kids: [...D().kids, k] }, [up('Kids', k)]) }
  const removeKid = (k) => {
    const d = D()
    commit({ kids: d.kids.filter((x) => x.id !== k.id), tasks: d.tasks.filter((t) => t.kidId !== k.id), notes: d.notes.filter((n) => n.kidId !== k.id) },
      [rm('Kids', k.id), ...d.tasks.filter((t) => t.kidId === k.id).map((t) => rm('Tasks', t.id)), ...d.notes.filter((n) => n.kidId === k.id).map((n) => rm('Notes', n.id))])
  }
  const addTask = (t) => { const task = { id: uid(), week, done: false, doneAt: '', ...t }; commit({ ...D(), tasks: [...D().tasks, task] }, [up('Tasks', task)]) }
  const patchTask = (id, p) => {
    const old = D().tasks.find((t) => t.id === id); if (!old) return
    const t = { ...old, ...p }; commit({ ...D(), tasks: D().tasks.map((x) => (x.id === id ? t : x)) }, [up('Tasks', t)])
  }
  const delTask = (id) => commit({ ...D(), tasks: D().tasks.filter((t) => t.id !== id) }, [rm('Tasks', id)])
  const addNote = (note) => commit({ ...D(), notes: [...D().notes, note] }, [up('Notes', note)])
  const carryOver = () => {
    const next = iso(addDays(monday, 7))
    const moved = D().tasks.filter((t) => t.week === week && !t.done).map((t) => ({ ...t, week: next, day: null }))
    const byId = Object.fromEntries(moved.map((t) => [t.id, t]))
    commit({ ...D(), tasks: D().tasks.map((t) => byId[t.id] || t) }, moved.map((t) => up('Tasks', t)))
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
      try {
        const j = JSON.parse(txt)
        if (!j.kids || !j.tasks) return alert('That file is not a Homework Board backup.')
        commit({ ...EMPTY, ...j }, allOps({ ...EMPTY, ...j }))
      } catch { alert('Could not read that file.') }
    }); e.target.value = ''
  }
  const connect = (c) => { localStorage.setItem(CFG_KEY, JSON.stringify(c)); setLoaded(false); setErr(''); setCfg(c) }
  const disconnect = () => { localStorage.removeItem(CFG_KEY); outbox.current = []; busy.current = false; setLoaded(false); setStatus('idle'); setCfg(null) }

  if (!cfg) return <Connect onConnect={connect} />
  if (online && !loaded && data.kids.length === 0)
    return (
      <div className="app setup">
        <h1>Homework Board</h1>
        {status === 'error'
          ? <><p className="warn">Could not reach your Google Sheet: {err}</p><div className="row"><button onClick={refresh}>Try again</button><button className="ghost" onClick={disconnect}>Change connection</button></div></>
          : <p>Loading from Google Sheets…</p>}
      </div>
    )
  if (data.kids.length === 0) return <Setup onAdd={addKid} />

  const pill = !online ? ['local', 'This device only'] : { saving: ['saving', 'Saving…'], synced: ['synced', 'Synced'], error: ['error', 'Offline, will retry'], idle: ['saving', 'Connecting…'] }[status]

  return (
    <div className="app">
      <header className="top">
        <h1>Homework Board</h1>
        <span className={'pill ' + pill[0]} title={err}>{pill[1]}</span>
        <nav className="tabs">
          <button className={view === 'board' ? 'on' : ''} onClick={() => setView('board')}>Kid board</button>
          <button className={view === 'parents' ? 'on' : ''} onClick={() => setView('parents')}>Parent dashboard</button>
        </nav>
      </header>

      <div className="weekbar">
        <button onClick={() => setWeek(iso(addDays(monday, -7)))} aria-label="Previous week">‹</button>
        <strong>{fmt(monday)} – {fmt(addDays(monday, 6))}{week === thisMonday ? ' (this week)' : ''}</strong>
        <button onClick={() => setWeek(iso(addDays(monday, 7)))} aria-label="Next week">›</button>
        {week !== thisMonday && <button className="link" onClick={() => { setWeek(thisMonday); setDayIdx((new Date().getDay() + 6) % 7) }}>Jump to this week</button>}
        <span className="scope" role="group" aria-label="View">
          <button className={scope === 'day' ? 'on' : ''} onClick={() => setScope('day')}>Day</button>
          <button className={scope === 'week' ? 'on' : ''} onClick={() => setScope('week')}>Week</button>
        </span>
      </div>

      {scope === 'day' && (
        <div className="daypick" role="group" aria-label="Choose a day">
          {DAYS.map((d, i) => (
            <button key={d} className={(i === dayIdx ? 'on ' : '') + (i === todayIdx ? 'now' : '')} onClick={() => setDayIdx(i)}>
              <b>{d}</b><small>{addDays(monday, i).getDate()}</small>
            </button>
          ))}
        </div>
      )}

      {view === 'board'
        ? <Board {...{ data, kidId, setKidId, weekTasks, todayIdx, scope, dayIdx, addTask, patchTask, delTask }} />
        : <Parents {...{ data, week, weekTasks, todayIdx, scope, dayIdx, addNote, carryOver }} />}

      <footer>
        <ManageKids data={data} addKid={addKid} removeKid={removeKid} />
        <details>
          <summary>Connection</summary>
          <p className="hint">{online ? 'Connected to your Google Sheet.' : 'Not connected: data stays on this device only.'}</p>
          <button className="ghost" onClick={disconnect}>{online ? 'Change or disconnect' : 'Connect a Google Sheet'}</button>
        </details>
        <div className="row">
          <button className="ghost" onClick={backup}>Backup</button>
          <label className="ghost btn">Restore<input type="file" accept="application/json" onChange={restore} hidden /></label>
        </div>
      </footer>
    </div>
  )
}

function Connect({ onConnect }) {
  const [url, setUrl] = useState('')
  const [code, setCode] = useState('')
  const ok = url.trim().startsWith('https://script.google.com/') && code.trim()
  return (
    <div className="app setup">
      <h1>Homework Board</h1>
      <p>Connect your Google Sheet so every device shows the same board. The README explains how to get the web app URL.</p>
      <label className="field">Web app URL<input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" /></label>
      <label className="field">Family code<input value={code} onChange={(e) => setCode(e.target.value)} placeholder="The code you set in the script" /></label>
      <div className="row">
        <button className="primary" disabled={!ok} onClick={() => onConnect({ url: url.trim(), code: code.trim() })}>Connect</button>
        <button className="ghost" onClick={() => onConnect({ local: true })}>Use on this device only</button>
      </div>
    </div>
  )
}

function Setup({ onAdd }) {
  const [name, setName] = useState('')
  const [list, setList] = useState([])
  const add = () => { if (name.trim()) { setList([...list, name.trim()]); setName('') } }
  return (
    <div className="app setup">
      <h1>Homework Board</h1>
      <p>Who is using the board? Add each child.</p>
      <div className="row">
        <input value={name} placeholder="Child's name" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button onClick={add}>Add child</button>
      </div>
      <ul className="chips">{list.map((n, i) => <li key={i} style={{ background: COLORS[i % COLORS.length] }}>{n}</li>)}</ul>
      {list.length > 0 && <button className="primary" onClick={() => list.forEach(onAdd)}>Start planning</button>}
    </div>
  )
}

function TaskCard({ t, color, big, patchTask, delTask }) {
  return (
    <article className={'task' + (big ? ' big' : '') + (t.done ? ' done' : '')} style={{ '--c': color }}>
      <label>
        <input type="checkbox" checked={t.done} onChange={(e) => patchTask(t.id, { done: e.target.checked, doneAt: e.target.checked ? new Date().toISOString() : '' })} />
        <span>{t.title}</span>
      </label>
      {t.subject && <small>{t.subject}</small>}
      <div className="row small">
        <select value={t.day ?? ''} onChange={(e) => patchTask(t.id, { day: e.target.value === '' ? null : Number(e.target.value) })} aria-label="Move to day">
          <option value="">To plan</option>
          {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
        </select>
        <button className="x" onClick={() => delTask(t.id)} aria-label={`Delete ${t.title}`}>Delete</button>
      </div>
    </article>
  )
}

function Board({ data, kidId, setKidId, weekTasks, todayIdx, scope, dayIdx, addTask, patchTask, delTask }) {
  const kid = data.kids.find((k) => k.id === kidId)
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [day, setDay] = useState('')
  useEffect(() => { setDay(scope === 'day' ? String(dayIdx) : '') }, [scope, dayIdx])
  const mine = weekTasks.filter((t) => t.kidId === kidId)
  const submit = (e) => {
    e.preventDefault(); if (!title.trim()) return
    addTask({ kidId, title: title.trim(), subject: subject.trim(), day: day === '' ? null : Number(day) })
    setTitle(''); setSubject('')
  }
  const card = (t, big) => <TaskCard key={t.id} t={t} color={kid?.color} big={big} patchTask={patchTask} delTask={delTask} />

  let body
  if (scope === 'day') {
    const today = mine.filter((t) => t.day === dayIdx)
    const done = today.filter((t) => t.done).length
    const overdue = dayIdx === todayIdx ? mine.filter((t) => !t.done && t.day !== null && t.day < todayIdx) : []
    const toPlan = mine.filter((t) => t.day === null && !t.done)
    body = (
      <div className="daylist">
        <h2>{FULL[dayIdx]}{dayIdx === todayIdx ? ' (today)' : ''}</h2>
        <p className="count">{today.length === 0 ? 'Nothing planned for this day.' : done === today.length ? 'All done. Great work!' : `${done} of ${today.length} done`}</p>
        {today.map((t) => card(t, true))}
        {overdue.length > 0 && <>
          <h3>Still to do from earlier</h3>
          {overdue.map((t) => <div key={t.id} className="with-btn">{card(t, true)}<button onClick={() => patchTask(t.id, { day: dayIdx })}>Do it today</button></div>)}
        </>}
        {toPlan.length > 0 && <>
          <h3>Not planned yet</h3>
          {toPlan.map((t) => <div key={t.id} className="with-btn">{card(t)}<button onClick={() => patchTask(t.id, { day: dayIdx })}>Add to {DAYS[dayIdx]}</button></div>)}
        </>}
      </div>
    )
  } else {
    const cols = [{ label: 'To plan', idx: null }, ...DAYS.map((d, i) => ({ label: d, idx: i }))]
    body = (
      <div className="grid">
        {cols.map((c) => {
          const items = mine.filter((t) => (t.day ?? null) === c.idx)
          return (
            <section key={c.label} className={'col' + (c.idx === todayIdx ? ' today' : '') + (c.idx === null ? ' plan' : '')}>
              <h3>{c.label}</h3>
              {items.length === 0 && <p className="empty">{c.idx === null ? 'Nothing waiting' : 'Free day'}</p>}
              {items.map((t) => card(t))}
            </section>
          )
        })}
      </div>
    )
  }
  return (
    <>
      <div className="kids">
        {data.kids.map((k) => <button key={k.id} className={k.id === kidId ? 'kid on' : 'kid'} style={{ '--c': k.color }} onClick={() => setKidId(k.id)}>{k.name}</button>)}
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
      {body}
    </>
  )
}

function Parents({ data, week, weekTasks, todayIdx, scope, dayIdx, addNote, carryOver }) {
  const [drafts, setDrafts] = useState({})
  const saveNote = (kidId) => {
    const text = (drafts[kidId] || '').trim(); if (!text) return
    addNote({ id: uid(), kidId, week, text, at: new Date().toISOString() })
    setDrafts({ ...drafts, [kidId]: '' })
  }
  const open = weekTasks.filter((t) => !t.done).length
  return (
    <div className="parents">
      {data.kids.map((k) => {
        const ts = weekTasks.filter((t) => t.kidId === k.id)
        const scoped = scope === 'day' ? ts.filter((t) => t.day === dayIdx) : ts
        const done = scoped.filter((t) => t.done).length
        const pct = scoped.length ? Math.round((done / scoped.length) * 100) : 0
        const behind = ts.filter((t) => !t.done && t.day !== null && t.day < todayIdx)
        const unplanned = ts.filter((t) => !t.done && t.day === null)
        const notes = data.notes.filter((n) => n.kidId === k.id && n.week === week)
        return (
          <section key={k.id} className="card" style={{ '--c': k.color }}>
            <h2>{k.name}</h2>
            <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100"><i style={{ width: pct + '%' }} /></div>
            <p>{scope === 'day' ? `${FULL[dayIdx]}: ` : 'This week: '}{done} of {scoped.length} done ({pct}%)</p>
            {scope === 'day' ? (
              <ul className="dlist">
                {scoped.length === 0 && <li className="empty">Nothing planned for this day.</li>}
                {scoped.map((t) => <li key={t.id} className={t.done ? 'ok' : ''}><span aria-hidden="true">{t.done ? '✓' : '○'}</span> {t.title}{t.subject && <small> {t.subject}</small>}</li>)}
              </ul>
            ) : (
              <div className="days">
                {DAYS.map((d, i) => {
                  const day = ts.filter((t) => t.day === i)
                  const dn = day.filter((t) => t.done).length
                  const state = day.length === 0 ? 'none' : dn === day.length ? 'full' : i < todayIdx ? 'late' : 'open'
                  return <div key={d} className={'day ' + state + (i === todayIdx ? ' now' : '')}><b>{d}</b><span>{day.length ? `${dn}/${day.length}` : '–'}</span></div>
                })}
              </div>
            )}
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

function ManageKids({ data, addKid, removeKid }) {
  const [name, setName] = useState('')
  const add = () => { if (name.trim()) { addKid(name.trim()); setName('') } }
  const remove = (k) => { if (confirm(`Remove ${k.name} and all their tasks?`)) removeKid(k) }
  return (
    <details>
      <summary>Manage children</summary>
      <ul className="chips">{data.kids.map((k) => <li key={k.id} style={{ background: k.color }}>{k.name} <button onClick={() => remove(k)} aria-label={`Remove ${k.name}`}>×</button></li>)}</ul>
      <div className="row"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a child" /><button onClick={add}>Add</button></div>
    </details>
  )
}
