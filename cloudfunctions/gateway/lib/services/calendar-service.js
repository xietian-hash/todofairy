const { AppError, ERROR_CODES } = require("../errors");
const { assertMonth } = require("../validators");
const { monthStartEnd, listMonthDates, todayStr } = require("../date");
const todoRepo = require("../repositories/todo-repository");
const { resolveCalendarStatus } = require("../calendar-state");

async function getMonthCalendar(userId, month) {
  assertMonth(month, "month");
  const range = monthStartEnd(month);
  if (!range) {
    throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, "month格式错误");
  }
  const todos = await todoRepo.listTodosByDateRange(userId, range.start, range.end);
  const summaryMap = {};
  listMonthDates(month).forEach((date) => {
    summaryMap[date] = {
      total: 0,
      completedCount: 0,
      uncompletedCount: 0,
    };
  });

  todos.forEach((item) => {
    if (!summaryMap[item.todoDate]) return;
    summaryMap[item.todoDate].total += 1;
    if (item.status === 2) {
      summaryMap[item.todoDate].completedCount += 1;
    } else {
      summaryMap[item.todoDate].uncompletedCount += 1;
    }
  });

  const today = todayStr();
  const days = Object.keys(summaryMap).map((date) => {
    const day = summaryMap[date];
    return {
      date,
      status: resolveCalendarStatus(date, today, day.total, day.completedCount, day.uncompletedCount),
      total: day.total,
      completedCount: day.completedCount,
      uncompletedCount: day.uncompletedCount,
    };
  });

  return {
    month,
    today,
    days,
  };
}

module.exports = {
  getMonthCalendar,
};
