import { attach } from "../../src/util/attach.js";

test("attach creates immutable bindings", () => {
  const obj = {};
  attach(obj, "test", "test");

  expect(obj.test).toBeDefined();
  expect(obj.test).toBe("test");

  expect(() => {
    obj.test = "new";
  }).toThrow();
});
