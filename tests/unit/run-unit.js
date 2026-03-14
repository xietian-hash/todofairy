const { runDateUtilsTest } = require("./date-utils.test");
const { runCalendarStateTest } = require("./calendar-state.test");
const { runRepeatRuleNormalizeTest, runRepeatGenerateRuleTest } = require("./repeat-rule.test");

function run() {
  runDateUtilsTest();
  runCalendarStateTest();
  runRepeatRuleNormalizeTest();
  runRepeatGenerateRuleTest();
  console.log("unit tests passed");
}

run();
