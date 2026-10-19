/**
 * ふせん（Googleカレンダー連携のリマインドメモ）
 * 専用カレンダー「🐱ふせん」に予定として登録し、
 * カレンダーのポップアップ通知でお知らせします。
 */

const CAL_NAME = '🐱ふせん';
const EVENT_MINUTES = 15; // 予定の長さ（分）

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('ふせん')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .addMetaTag('apple-mobile-web-app-capable', 'yes');
}

// 専用カレンダーを取得（なければ作る）
function getCal_() {
  const found = CalendarApp.getCalendarsByName(CAL_NAME);
  if (found.length > 0) return found[0];
  return CalendarApp.createCalendar(CAL_NAME, { timeZone: 'Asia/Tokyo' });
}

function setReminders_(ev, minutesList) {
  ev.removeAllReminders();
  (minutesList || []).forEach(function (m) {
    ev.addPopupReminder(Number(m));
  });
}

function toNote_(ev) {
  const doneAt = ev.getTag('doneAt');
  let rem = [];
  try { rem = JSON.parse(ev.getTag('rem') || '[]'); } catch (e) { rem = []; }
  return {
    id: ev.getId(),
    title: ev.getTitle(),
    start: ev.getStartTime().getTime(),
    done: !!doneAt,
    doneAt: doneAt ? Number(doneAt) : null,
    rem: rem,
    deadline: ev.getTag('deadline') ? Number(ev.getTag('deadline')) : null,
    color: ev.getTag('color') ? Number(ev.getTag('color')) : 0
  };
}

// 日本語の日時表記（23:59は日付だけ表示）
function fmtJa_(ms) {
  const d = new Date(ms);
  const dow = Number(Utilities.formatDate(d, 'Asia/Tokyo', 'u')) % 7; // 1=月 ... 7=日
  const WD = ['日', '月', '火', '水', '木', '金', '土'];
  const base = Utilities.formatDate(d, 'Asia/Tokyo', 'M/d') + '(' + WD[dow] + ')';
  const hm = Utilities.formatDate(d, 'Asia/Tokyo', 'HH:mm');
  return hm === '23:59' ? base : base + ' ' + hm;
}

// 一覧（過去1年〜2年先）
function listNotes() {
  const cal = getCal_();
  const now = Date.now();
  const from = new Date(now - 365 * 24 * 3600 * 1000);
  const to = new Date(now + 730 * 24 * 3600 * 1000);
  return cal.getEvents(from, to).map(toNote_);
}

// 追加
function addNote(title, startMs, remMinutes, deadlineMs, color) {
  const cal = getCal_();
  const start = new Date(Number(startMs));
  const end = new Date(start.getTime() + EVENT_MINUTES * 60 * 1000);
  const ev = cal.createEvent(title, start, end);
  const rem = (remMinutes && remMinutes.length) ? remMinutes : [0];
  setReminders_(ev, rem);
  ev.setTag('rem', JSON.stringify(rem));
  ev.setTag('color', String(Number(color) || 0));
  if (deadlineMs) {
    ev.setTag('deadline', String(Number(deadlineMs)));
    ev.setDescription('🏁 締切 ' + fmtJa_(Number(deadlineMs)));
  }
  return toNote_(ev);
}

// 付箋の色を変える
function setColor(id, color) {
  const ev = getCal_().getEventById(id);
  if (!ev) throw new Error('見つかりませんでした');
  ev.setTag('color', String(Number(color) || 0));
  return toNote_(ev);
}

// 完了／未完了の切り替え
function setDone(id, done) {
  const ev = getCal_().getEventById(id);
  if (!ev) throw new Error('見つかりませんでした');
  if (done) {
    ev.setTag('doneAt', String(Date.now()));
    ev.removeAllReminders(); // 完了したら通知を止める
  } else {
    ev.deleteTag('doneAt');
    let rem = [0];
    try { rem = JSON.parse(ev.getTag('rem') || '[0]'); } catch (e) {}
    setReminders_(ev, rem);
  }
  return toNote_(ev);
}

// あとで（再通知）：予定の時刻を動かす
function snoozeNote(id, startMs) {
  const ev = getCal_().getEventById(id);
  if (!ev) throw new Error('見つかりませんでした');
  const start = new Date(Number(startMs));
  ev.setTime(start, new Date(start.getTime() + EVENT_MINUTES * 60 * 1000));
  if (ev.getTag('doneAt')) {
    ev.deleteTag('doneAt');
  }
  let rem = [0];
  try { rem = JSON.parse(ev.getTag('rem') || '[0]'); } catch (e) {}
  setReminders_(ev, rem);
  return toNote_(ev);
}

// 削除
function deleteNote(id) {
  const ev = getCal_().getEventById(id);
  if (ev) ev.deleteEvent();
  return true;
}
