const TZ_OFFSET_MS = 8 * 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

function getNowMs() {
  return Date.now();
}

function toChinaDateParts(date = new Date()) {
  const shifted = new Date(date.getTime() + TZ_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  };
}

function pad2(num) {
  return String(num).padStart(2, "0");
}

function formatDate(parts) {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

function todayStr() {
  return formatDate(toChinaDateParts());
}

function isDateStr(value) {
  return DATE_RE.test(value);
}

function isMonthStr(value) {
  return MONTH_RE.test(value);
}

function parseDateToChinaMidnightMs(dateStr) {
  if (!isDateStr(dateStr)) {
    return NaN;
  }
  const [year, month, day] = dateStr.split("-").map(Number);
  return Date.UTC(year, month - 1, day) - TZ_OFFSET_MS;
}

function compareDateStr(a, b) {
  const aMs = parseDateToChinaMidnightMs(a);
  const bMs = parseDateToChinaMidnightMs(b);
  if (Number.isNaN(aMs) || Number.isNaN(bMs)) {
    return 0;
  }
  if (aMs === bMs) return 0;
  return aMs > bMs ? 1 : -1;
}

function isDateInRange(target, start, end) {
  const startOk = compareDateStr(target, start) >= 0;
  const endOk = !end || compareDateStr(target, end) <= 0;
  return startOk && endOk;
}

function monthStartEnd(monthStr) {
  if (!isMonthStr(monthStr)) {
    return null;
  }
  const [year, month] = monthStr.split("-").map(Number);
  const first = `${year}-${pad2(month)}-01`;
  const nextMonthDate = new Date(Date.UTC(year, month, 1));
  const lastDay = new Date(nextMonthDate.getTime() - 24 * 60 * 60 * 1000);
  const lastParts = toChinaDateParts(lastDay);
  return {
    start: first,
    end: formatDate(lastParts),
  };
}

function listMonthDates(monthStr) {
  const range = monthStartEnd(monthStr);
  if (!range) return [];

  const list = [];
  let currentMs = parseDateToChinaMidnightMs(range.start);
  const endMs = parseDateToChinaMidnightMs(range.end);
  const oneDayMs = 24 * 60 * 60 * 1000;

  while (currentMs <= endMs) {
    const parts = toChinaDateParts(new Date(currentMs));
    list.push(formatDate(parts));
    currentMs += oneDayMs;
  }
  return list;
}

function weekdayOfDate(dateStr) {
  const ms = parseDateToChinaMidnightMs(dateStr);
  if (Number.isNaN(ms)) {
    return 0;
  }
  const weekday = new Date(ms + TZ_OFFSET_MS).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

module.exports = {
  DATE_RE,
  MONTH_RE,
  getNowMs,
  todayStr,
  isDateStr,
  isMonthStr,
  compareDateStr,
  isDateInRange,
  parseDateToChinaMidnightMs,
  weekdayOfDate,
  monthStartEnd,
  listMonthDates,
};
