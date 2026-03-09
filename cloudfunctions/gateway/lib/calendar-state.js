function resolveCalendarStatus(dayDate, today, total, completedCount, uncompletedCount) {
  if (total <= 0) {
    return "no_todo";
  }
  if (completedCount === total) {
    return "completed";
  }
  if (dayDate === today && uncompletedCount > 0) {
    return "today_uncompleted";
  }
  return "history_uncompleted";
}

module.exports = {
  resolveCalendarStatus,
};
