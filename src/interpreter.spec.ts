import { describe, expect, it } from "vitest";
import { KIO } from "./kio.ts";
import { InterpreterImpl } from "./interpreter.ts";
import { Left, Right } from "./either.ts";
import {
  GetRecordParams,
  GetRecordResponse,
  GetRecordsParams,
  GetRecordsResponse,
  KintoneClient,
} from "./client.ts";
import { KRecord, KValue } from "./data.ts";

describe("InterpreterImpl", () => {
  class FakeKintoneClient implements KintoneClient {
    async getRecord(_params: GetRecordParams): Promise<GetRecordResponse> {
      return {
        record: {
          test: { value: 1 },
          $revision: { value: 2 },
        },
      };
    }
    async getRecords(_params: GetRecordsParams): Promise<GetRecordsResponse> {
      return [
        {
          test: { value: 1 },
          $revision: { value: 2 },
        },
      ];
    }
  }
  const client = new FakeKintoneClient();

  const interpreter = new InterpreterImpl(client);
  describe("interpret", () => {
    it("Succeed", async () => {
      const result = await KIO.succeed("succeed")(1)
        .map("map")((a, s) => {
          expect(s).toStrictEqual({ succeed: new KValue(1) });
          return a;
        })
        .commit(interpreter);
      expect(result).toStrictEqual(new Right(1));
    });
    it("Fail", async () => {
      const result = await KIO.fail("error")
        .map("map")(() => {
          expect.fail();
        })
        .commit(interpreter);
      expect(result).toStrictEqual(new Left("error"));
    });
    it("FlatMap", async () => {
      const success = await KIO.succeed("succeed1")(1)
        .flatMap("flatMap")((a, s) => {
          expect(s).toStrictEqual({ succeed1: new KValue(1) });
          return KIO.succeed("succeed2")(a.value + 1);
        })
        .commit(interpreter);
      expect(success).toStrictEqual(new Right(2));

      const failure = await KIO.succeed("succeed1")(1)
        .flatMap("flatMap1")(() => KIO.fail("error"))
        .flatMap("flatMap2")(() => {
          return KIO.succeed("succeed2")(1);
        })
        .commit(interpreter);
      expect(failure).toStrictEqual(new Left("error"));
    });
    it("GetRecord", async () => {
      const expectedRecord = { test: { value: 1 }, $revision: { value: 2 } };
      const result = await KIO.succeed("succeed")(1)
        .flatMap("record")(() =>
          KIO.getRecord("record")<typeof expectedRecord>({ app: 1, id: 1 }),
        )
        .map("map")((a, s) => {
          expect(s).toStrictEqual({
            succeed: new KValue(1),
            record: new KRecord(expectedRecord, 1, 2),
          });
          return a;
        })
        .commit(interpreter);
      expect(result).toStrictEqual(new Right(expectedRecord));
    });
  });
});
