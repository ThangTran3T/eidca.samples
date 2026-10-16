/**
 * Time-zone aware date/time formatting with a tiny token language
 * (DD, MM, YYYY, HH, mm, ss, Z) plus named presets. Uses Intl only — no
 * locale-dependent output, so results are deterministic across browsers.
 */

function parts(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const out = {};
  for (const p of fmt.formatToParts(date)) out[p.type] = p.value;
  return out;
}

/** UTC offset (minutes) of `timeZone` at `date`. */
export function timeZoneOffsetMinutes(date, timeZone) {
  const p = parts(date, timeZone);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

export function formatOffset(minutes) {
  const sign = minutes >= 0 ? '+' : '-';
  const abs = Math.abs(minutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

export function isValidTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function parseTimestamp(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const PRESETS = {
  ISO8601: 'YYYY-MM-DDTHH:mm:ssZ',
  'vi-long': '[ngày] DD [tháng] MM [năm] YYYY',
};

/**
 * Format `date` in `timeZone` using `pattern`.
 * Literal text can be wrapped in [brackets].
 */
export function formatDateTime(date, pattern, timeZone = 'Asia/Ho_Chi_Minh') {
  const d = parseTimestamp(date);
  if (!d) return '';
  const tz = isValidTimeZone(timeZone) ? timeZone : 'Asia/Ho_Chi_Minh';
  const p = parts(d, tz);
  const offset = formatOffset(timeZoneOffsetMinutes(d, tz));
  const tokens = { YYYY: p.year, MM: p.month, DD: p.day, HH: p.hour, mm: p.minute, ss: p.second, Z: offset };
  const fmt = PRESETS[pattern] ?? pattern;
  return fmt.replace(/\[([^\]]*)\]|YYYY|MM|DD|HH|mm|ss|Z/g, (m, literal) => (literal !== undefined ? literal : tokens[m]));
}

/**
 * Derive signing.date / signing.time / signing.datetime from a timestamp and
 * the template's date-time settings. Hidden parts resolve to ''.
 */
export function signingDateParts(timestamp, settings) {
  const { dateFormat = 'DD/MM/YYYY', timeFormat = 'HH:mm:ss', timeZone = 'Asia/Ho_Chi_Minh', showDate = true, showTime = true } = settings ?? {};
  const d = parseTimestamp(timestamp);
  if (!d) return { date: '', time: '', datetime: '' };
  const date = showDate ? formatDateTime(d, dateFormat, timeZone) : '';
  // ISO 8601 as a date format already contains the time; avoid duplicating it.
  const time = showTime && dateFormat !== 'ISO8601' ? formatDateTime(d, timeFormat, timeZone) : '';
  let datetime;
  if (dateFormat === 'ISO8601') {
    datetime = showDate || showTime ? formatDateTime(d, 'ISO8601', timeZone) : '';
  } else {
    datetime = [date, time].filter(Boolean).join(' ');
  }
  return { date, time, datetime };
}
