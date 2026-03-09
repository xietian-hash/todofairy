const { runRouterMatchTest, runRequestNormalizeTest } = require("./router.test");

function run() {
  runRouterMatchTest();
  runRequestNormalizeTest();
  console.log("api tests passed");
}

run();
