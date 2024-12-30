import {describe, expect, it} from "vitest";
import {KIO} from "./kio.ts";
import {InterpreterImpl} from "./interpreter.ts";
import {Right} from "./either.ts";
import {KintoneRestAPIClient} from "@kintone/rest-api-client";

describe("DummyInterpreter", () => {
  const client = new KintoneRestAPIClient({
    baseUrl: process.env.KINTONE_BASE_URL,
    auth: {
      apiToken: process.env.KINTONE_API_TOKEN
    }
  });
  const interpreter = new InterpreterImpl(client);
  it("test", async () => {
    const result = await KIO
      .succeed('firstNum')(1)
      .map('secondNum')((a) => a + 1)
      .flatMap('thirdNum')((a) => KIO.succeed('')(a + 1).map('')((a) => a + 1))
      .map('forthNum')((_, s) => {
        console.log(s);
        return s.firstNum + 2;
      })
      .getRecord('record')<{ $id: { value: string } }>({ app: 1, id: 1 })
      .map('mapRecord')((_, s) => s.record.$id.value)
      .commit(interpreter);
    expect(result).toStrictEqual(new Right(3));
  });
});
