const assert = require("assert");
const {
  isDateStr,
  isMonthStr,
  compareDateStr,
  isDateInRange,
  monthStartEnd,
  listMonthDates,
} = require("../../cloudfunctions/gateway/lib/date");

function runDateUtilsTest() {
  assert.strictEqual(isDateStr("2026-03-09"), true);
  assert.strictEqual(isDateStr("2026/03/09"), false);
  assert.strictEqual(isMonthStr("2026-03"), true);
  assert.strictEqual(isMonthStr("2026-3"), false);

  assert.strictEqual(compareDateStr("2026-03-09", "2026-03-09"), 0);
  assert.strictEqual(compareDateStr("2026-03-10", "2026-03-09"), 1);
  assert.strictEqual(compareDateStr("2026-03-08", "2026-03-09"), -1);

  assert.strictEqual(isDateInRange("2026-03-09", "2026-03-01", "2026-03-31"), true);
  assert.strictEqual(isDateInRange("2026-04-01", "2026-03-01", "2026-03-31"), false);
  assert.strictEqual(isDateInRange("2026-03-09", "2026-03-01", null), true);

  const range = monthStartEnd("2026-02");
  assert.deepStrictEqual(range, { start: "2026-02-01", end: "2026-02-28" });
  assert.strictEqual(listMonthDates("2026-02").length, 28);
}

module.exports = {
  runDateUtilsTest,
};
