const attach = require('../../src/util/attach.js');

test("attach creates immutable bindings", () => {
    const obj = {};
    attach(obj, "test", "test");

    expect(obj.test).toBeDefined();
    expect(obj.test).toBe("test");

    obj.test = "new";
    expect(obj.test).toBe("test");
});
