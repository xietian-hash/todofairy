const assert = require("assert");
const { normalizeRepeatRule, shouldTaskGenerateOnDate } = require("../../cloudfunctions/gateway/lib/repeat-rule");

function runRepeatRuleNormalizeTest() {
  const normalizedLegacy = normalizeRepeatRule({ type: "daily" }, false);
  assert.deepStrictEqual(normalizedLegacy, {
    type: "weekly",
    weekdays: [],
  });

  const normalizedWeekly = normalizeRepeatRule(
    {
      type: "weekly",
      weekdays: [3, "1", 3],
    },
    true
  );
  assert.deepStrictEqual(normalizedWeekly, {
    type: "weekly",
    weekdays: [1, 3],
  });

  assert.throws(
    () =>
      normalizeRepeatRule(
        {
          type: "weekly",
          weekdays: [1, 8],
        },
        true
      ),
    /重复星期仅支持1-7/
  );

  assert.throws(
    () =>
      normalizeRepeatRule(
        {
          type: "weekly",
          weekdays: "1,2,3",
        },
        true
      ),
    /重复星期必须是数组/
  );
}

function runRepeatGenerateRuleTest() {
  const noneRepeatTask = {
    repeatRule: {
      type: "weekly",
      weekdays: [],
    },
  };
  assert.strictEqual(shouldTaskGenerateOnDate(noneRepeatTask, "2026-03-16", "create_task"), true);
  assert.strictEqual(shouldTaskGenerateOnDate(noneRepeatTask, "2026-03-16", "cron_0000"), false);

  const weeklyTask = {
    repeatRule: {
      type: "weekly",
      weekdays: [1, 3, 5],
    },
  };
  assert.strictEqual(shouldTaskGenerateOnDate(weeklyTask, "2026-03-16", "cron_0000"), true);
  assert.strictEqual(shouldTaskGenerateOnDate(weeklyTask, "2026-03-17", "cron_0000"), false);
}

module.exports = {
  runRepeatRuleNormalizeTest,
  runRepeatGenerateRuleTest,
};
