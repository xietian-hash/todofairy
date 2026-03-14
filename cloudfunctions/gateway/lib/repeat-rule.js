const { AppError, ERROR_CODES } = require("./errors");
const { weekdayOfDate } = require("./date");

function normalizeWeekdays(weekdays, strict = false) {
  if (weekdays === undefined || weekdays === null) {
    return [];
  }
  if (!Array.isArray(weekdays)) {
    if (strict) {
      throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, "重复星期必须是数组");
    }
    return [];
  }

  const parsed = weekdays.map((item) => Number(item));
  if (strict && parsed.some((item) => !Number.isInteger(item) || item < 1 || item > 7)) {
    throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, "重复星期仅支持1-7（周一至周日）");
  }

  return [...new Set(parsed.filter((item) => Number.isInteger(item) && item >= 1 && item <= 7))].sort(
    (a, b) => a - b
  );
}

function normalizeRepeatRule(input, strict = false) {
  if (!input || typeof input !== "object") {
    return {
      type: "weekly",
      weekdays: [],
    };
  }

  const type = input.type;
  if (type !== "weekly") {
    if (strict) {
      throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, "当前仅支持weekly重复规则");
    }
    return {
      type: "weekly",
      weekdays: [],
    };
  }

  return {
    type: "weekly",
    weekdays: normalizeWeekdays(input.weekdays, strict),
  };
}

function isSameRepeatRule(left = {}, right = {}) {
  if (left.type !== right.type) {
    return false;
  }
  const leftWeekdays = Array.isArray(left.weekdays) ? left.weekdays : [];
  const rightWeekdays = Array.isArray(right.weekdays) ? right.weekdays : [];
  if (leftWeekdays.length !== rightWeekdays.length) {
    return false;
  }
  for (let i = 0; i < leftWeekdays.length; i += 1) {
    if (Number(leftWeekdays[i]) !== Number(rightWeekdays[i])) {
      return false;
    }
  }
  return true;
}

function shouldTaskGenerateOnDate(task, targetDate, triggerType = "cron_0000") {
  const repeatRule = normalizeRepeatRule(task && task.repeatRule, false);
  const weekdays = repeatRule.weekdays || [];
  if (!weekdays.length) {
    return triggerType === "create_task";
  }
  const weekday = weekdayOfDate(targetDate);
  return weekdays.includes(weekday);
}

module.exports = {
  normalizeRepeatRule,
  normalizeWeekdays,
  isSameRepeatRule,
  shouldTaskGenerateOnDate,
};
