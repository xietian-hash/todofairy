const { runDateUtilsTest } = require("./date-utils.test");
const { runCalendarStateTest } = require("./calendar-state.test");

function run() {
  runDateUtilsTest();
  runCalendarStateTest();
  console.log("unit tests passed");
}

run();
