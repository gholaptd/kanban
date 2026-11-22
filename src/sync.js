export const up = (table, record) => ({ op: 'upsert', table, record })
export const rm = (table, id) => ({ op: 'remove', table, id })

// No Content-Type header on purpose: keeps this a "simple" request so Apps Script accepts it from the browser.
export async function call(cfg, body) {
  const res = await fetch(cfg.url, { method: 'POST', body: JSON.stringify({ code: cfg.code, ...body }) })
  let j
  try { j = await res.json() } catch {
    throw new Error('No valid reply. Check the web app URL and that access is set to "Anyone".')
  }
  if (!j.ok) throw new Error(j.error === 'wrong code' ? 'The family code does not match the one in your script.' : j.error || 'Sync failed')
  return j
}

const pad = (n) => String(n).padStart(2, '0')
// Accepts "2026-11-16" and, as a safety net, any date text the Sheet may have produced.
const toWeek = (w) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(w)) return w
  const d = new Date(w)
  return isNaN(d) ? w : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const normalize = (raw) => ({
  kids: raw.Kids || [],
  tasks: (raw.Tasks || []).map((t) => ({
    ...t,
    week: toWeek(t.week),
    day: t.day === '' ? null : Number(t.day),
    done: String(t.done).toLowerCase() === 'true',
  })),
  notes: (raw.Notes || []).map((n) => ({ ...n, week: toWeek(n.week) })),
})

export const allOps = (d) => [
  ...d.kids.map((k) => up('Kids', k)),
  ...d.tasks.map((t) => up('Tasks', t)),
  ...d.notes.map((n) => up('Notes', n)),
]
