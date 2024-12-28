import {describe, expect, it} from "vitest";
import {KIO} from "./kio.ts";
import {DummyInterpreter} from "./interpreter.ts";
import {Right} from "./either.ts";

describe("DummyInterpreter", () => {
  const interpreter = new DummyInterpreter();
  it("test", async () => {
    const result = await KIO
      .succeed(1)
      .map((a) => a + 1)
      .flatMap((a) => KIO.succeed(a + 1))
      .commit(interpreter);
    expect(result).toStrictEqual(new Right(3));
  });
});
