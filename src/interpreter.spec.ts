import { describe, expect, it } from "vitest";
import { KIO } from "./kio.ts";
import { InterpreterImpl } from "./interpreter.ts";
import { Left, Right } from "./either.ts";
import {
  GetRecordResponse,
  GetRecordsResponse,
  KintoneClient,
  KintoneClientImpl,
} from "./client.ts";
import { KRecord, KValue } from "./data.ts";
import { KintoneRestAPIClient } from "@kintone/rest-api-client";
import { ArrayElm, KVPairs } from "./helper.ts";
import SavedFields = kintone.types.SavedFields;

describe("InterpreterImpl", () => {
  describe("interpret", () => {
    describe("Basic Operations", () => {
      class FakeKintoneClient implements KintoneClient {
        async getRecord(): Promise<GetRecordResponse> {
          return {
            record: {
              test: { value: 1 },
              $id: { value: 1 },
              $revision: { value: 2 },
            },
          };
        }
        async getRecords<R>(): Promise<GetRecordsResponse<R>> {
          return [
            {
              test: { value: 1 },
              $revision: { value: 2 },
            },
          ] as unknown as GetRecordsResponse<R>;
        }
      }
      const fakeClient = new FakeKintoneClient();
      const interpreter = new InterpreterImpl(fakeClient);
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
    });
    describe("Kintone Operations", () => {
      const kClient = new KintoneRestAPIClient({
        baseUrl: process.env.KINTONE_BASE_URL,
        auth: {
          apiToken: process.env.KINTONE_API_TOKEN,
        },
      });
      const client = new KintoneClientImpl(kClient);
      const interpreter = new InterpreterImpl(client);
      it("GetRecord", async () => {
        const { record: expectedRecord } = await kClient.record.getRecord<
          KVPairs<SavedFields>
        >({
          app: 1,
          id: 1,
        });
        const result = await KIO.succeed("succeed")(1)
          .flatMap("record")(() =>
            KIO.getRecord("record")<typeof expectedRecord>({ app: 1, id: 1 }),
          )
          .map("map")((a, s) => {
            expect(s).toStrictEqual({
              succeed: new KValue(1),
              record: new KRecord(
                expectedRecord,
                1,
                expectedRecord.$id.value,
                expectedRecord.$revision.value,
              ),
            });
            return a;
          })
          .commit(interpreter);
        expect(result).toStrictEqual(new Right(expectedRecord));
      });
      it("GetRecords", async () => {
        const { records: expectedRecords } = await kClient.record.getRecords<
          Pick<KVPairs<SavedFields>, "text" | "$revision">
        >({
          app: 1,
          fields: ["text", "$revision", "$id"],
          query: "$id = 1",
        });
        const result = await KIO.succeed("succeed")(1)
          .flatMap("records")(() =>
            KIO.getRecords("records")<ArrayElm<typeof expectedRecords>>({
              app: 1,
              fields: ["text"],
              query: "$id = 1",
            }),
          )
          .commit(interpreter);
        expect(result).toStrictEqual(new Right(expectedRecords));
      });
    });
  });
});
