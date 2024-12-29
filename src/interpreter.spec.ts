import {describe, expect, it} from "vitest";
import {KIO} from "./kio.ts";
import {DummyInterpreter} from "./interpreter.ts";
import {Right} from "./either.ts";

describe("DummyInterpreter", () => {
  const interpreter = new DummyInterpreter();
  it("test", async () => {
    const result = await KIO
      .succeed('firstNum')(1)
      .map('secondNum')((a) => a + 1)
      .flatMap('thirdNum')((a) => KIO.succeed('')(a + 1).map('')((a) => a + 1))
      .map('forthNum')((_, s) => {
        console.log(s);
        return s.firstNum + 2;
      })
      .flatMap('')(() => KIO.fail('error'))
      .commit(interpreter);
    console.log(result);
    expect(result).toStrictEqual(new Right(3));
  });
});
