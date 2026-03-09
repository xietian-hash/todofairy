const assert = require("assert");
const { resolveCalendarStatus } = require("../../cloudfunctions/gateway/lib/calendar-state");

function runCalendarStateTest() {
  const today = "2026-03-09";
  assert.strictEqual(resolveCalendarStatus(today, today, 0, 0, 0), "no_todo");
  assert.strictEqual(resolveCalendarStatus(today, today, 3, 3, 0), "completed");
  assert.strictEqual(resolveCalendarStatus(today, today, 3, 1, 2), "today_uncompleted");
  assert.strictEqual(
    resolveCalendarStatus("2026-03-08", today, 3, 1, 2),
    "history_uncompleted"
  );
}

module.exports = {
  runCalendarStateTest,
};
