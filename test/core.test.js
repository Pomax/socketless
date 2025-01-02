import { createPatch } from "rfc6902";
import { patchToChangeFlags } from "../src/utils.js";
import { assert } from "chai";

describe("core library tests", () => {
  it("converts patches to change flags", () => {
    const patch = createPatch(
      {
        b: [],
        c: [],
        d: [1, 2, 3],
        e: [1, 2, 3],
        f: [1, 2, 3],
        g: [1, 2, 3, 4],
      },
      {
        a: [],
        b: {},
        d: [1, 2, 3, 4],
        e: [1, 2, "a"],
        f: [1, 2],
        g: [1, 2, 100, 3, 4],
      },
    );

    assert.deepEqual(patch, [
      { op: "remove", path: "/c" },
      { op: "add", path: "/a", value: [] },
      { op: "replace", path: "/b", value: {} },
      { op: "add", path: "/d/-", value: 4 },
      { op: "replace", path: "/e/2", value: "a" },
      { op: "remove", path: "/f/2" },
      { op: "add", path: "/g/2", value: 100 },
    ]);

    const changeFlags = patchToChangeFlags(patch);

    assert.deepEqual(changeFlags, {
      c: 3,
      a: 1,
      b: {},
      d: 4,
      e: { 2: 5 },
      f: { 2: 6 },
      g: { 2: 4 },
    });
  });
});
