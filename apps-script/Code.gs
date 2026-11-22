// Homework Board – Google Apps Script backend.
// Paste into Extensions > Apps Script of your Google Sheet, change FAMILY_CODE, then deploy as a Web app.

const FAMILY_CODE = 'change-this-to-your-own-long-phrase';

const SHEETS = {
  Kids:  ['id', 'name', 'color'],
  Tasks: ['id', 'kidId', 'title', 'subject', 'week', 'day', 'done', 'doneAt'],
  Notes: ['id', 'kidId', 'week', 'text', 'at'],
};

function doGet() { return out_({ ok: true, message: 'Homework Board is running.' }); }

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: 'bad request' }); }
  if (body.code !== FAMILY_CODE) return out_({ ok: false, error: 'wrong code' });
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (body.action === 'load') return out_({ ok: true, data: readAll_() });
    if (body.action === 'batch') {
      (body.ops || []).forEach(function (op) {
        if (!SHEETS[op.table]) return;
        if (op.op === 'upsert') upsert_(op.table, op.record);
        else if (op.op === 'remove') remove_(op.table, op.id);
      });
      return out_({ ok: true });
    }
    return out_({ ok: false, error: 'unknown action' });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sheet_(name) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    const cols = SHEETS[name];
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, sh.getMaxRows(), cols.length).setNumberFormat('@'); // plain text, so dates stay as typed
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function readAll_() {
  const result = {};
  Object.keys(SHEETS).forEach(function (name) {
    const cols = SHEETS[name];
    const sh = sheet_(name);
    const last = sh.getLastRow();
    const rows = last < 2 ? [] : sh.getRange(2, 1, last - 1, cols.length).getValues();
    result[name] = rows.filter(function (r) { return r[0] !== ''; }).map(function (r) {
      const o = {};
      cols.forEach(function (c, i) { o[c] = String(r[i]); });
      return o;
    });
  });
  return result;
}

function findRow_(sh, id) {
  const last = sh.getLastRow();
  if (last < 2) return -1;
  const ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}

function upsert_(name, record) {
  const cols = SHEETS[name];
  const sh = sheet_(name);
  const row = cols.map(function (c) { return record[c] == null ? '' : String(record[c]); });
  let r = findRow_(sh, record.id);
  if (r === -1) r = Math.max(sh.getLastRow(), 1) + 1;
  sh.getRange(r, 1, 1, cols.length).setValues([row]);
}

function remove_(name, id) {
  const sh = sheet_(name);
  const r = findRow_(sh, id);
  if (r > 1) sh.deleteRow(r);
}
