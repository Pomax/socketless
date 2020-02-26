const getAllFunctions = require("../../src/util/get-all-functions.js");

test("getAllFunctions should only get async API functions", () => {
  class TestClass {

    test1() { }          // should be ignored: not async, no namespacing
    ":test2"() { }       // should be ignored: not async, no namespace
    $test3() { }         // should be ignored: not async, no namespace
    async ":test4"() { } // should be ignored: async but no namespace
    async $test5() { }   // should be ignored: async but no namespace
    test$fn6() {}        // should be ignored: namespace, but not async
    "test:fn7"() {}      // should be ignored: namespace, but not async

    // only these two should end up getting accepted:

    async test$fn8() {}
    async "test:fn9"() {}
  }
  const functions = getAllFunctions(TestClass);
  expect(functions.length).toBe(2);
});
