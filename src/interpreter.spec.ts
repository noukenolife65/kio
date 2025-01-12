import { describe, expect, it, onTestFinished } from "vitest";
import { KIO } from "./kio.ts";
import { InterpreterImpl } from "./interpreter.ts";
import { Left, Right } from "./either.ts";
import {
  BulkRequestResponse,
  GetRecordResponse,
  GetRecordsResponse,
  KintoneClient,
  KintoneClientImpl,
} from "./client.ts";
import { KFields, KRecord, KRecordList, KValue } from "./data.ts";
import { KintoneRestAPIClient } from "@kintone/rest-api-client";
import { ArrayElm, KVPairs } from "./helper.ts";
import SavedFields = kintone.types.SavedFields;
import Fields = kintone.types.Fields;

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
        async getRecords<R extends KFields>(): Promise<GetRecordsResponse<R>> {
          return [
            {
              test: { value: 1 },
              $revision: { value: 2 },
            },
          ] as unknown as GetRecordsResponse<R>;
        }
        async bulkRequest(): Promise<BulkRequestResponse> {
          return;
        }
      }
      const fakeClient = new FakeKintoneClient();
      const interpreter = new InterpreterImpl(fakeClient);
      describe("Succeed", () => {
        it("with state", async () => {
          const result = await KIO.succeed("succeed", 1)
            .map((a, s) => {
              expect(s).toStrictEqual({ succeed: new KValue(1) });
              return a;
            })
            .commit(interpreter);
          expect(result).toStrictEqual(new Right(1));
        });
        it("without state", async () => {
          const result = await KIO.succeed(1)
            .map((a, s) => {
              expect(s).toStrictEqual({});
              return a;
            })
            .commit(interpreter);
          expect(result).toStrictEqual(new Right(1));
        });
      });
      it("Fail", async () => {
        const result = await KIO.fail("error")
          .map(() => expect.fail())
          .commit(interpreter);
        expect(result).toStrictEqual(new Left("error"));
      });
      it("FlatMap", async () => {
        const success = await KIO.succeed(1)
          .flatMap((a) => KIO.succeed(a.value + 1))
          .flatMap("flatMap", (a) => KIO.succeed(a.value + 1))
          .map((a) => a.update((value) => value + 1))
          .map("map", (a) => a.update((value) => value + 1))
          .map((a, s) => {
            expect(s).toStrictEqual({
              flatMap: new KValue(3),
              map: new KValue(5),
            });
            return a;
          })
          .commit(interpreter);
        expect(success).toStrictEqual(new Right(5));

        const failure = await KIO.succeed(1)
          .flatMap(() => KIO.fail("error"))
          .flatMap(() => KIO.succeed(1))
          .commit(interpreter);
        expect(failure).toStrictEqual(new Left("error"));
      });
    });
    describe("Kintone Operations", () => {
      const app = 1;
      const kClient = new KintoneRestAPIClient({
        baseUrl: process.env.KINTONE_BASE_URL,
        auth: {
          apiToken: process.env.KINTONE_API_TOKEN,
        },
      });
      const client = new KintoneClientImpl(kClient);
      const interpreter = new InterpreterImpl(client);
      const cleanUp = () => {
        onTestFinished(async () => {
          const records = await kClient.record.getAllRecords<{
            $id: { type: "__ID__"; value: string };
          }>({
            app,
            fields: ["$id"],
          });
          if (records.length > 0) {
            await kClient.record.deleteRecords({
              app,
              ids: records.map(({ $id }) => $id.value),
            });
          }
        });
      };
      it("GetRecord", async () => {
        cleanUp();
        // Given
        const record: KVPairs<Fields> = {
          text: { value: `test_${new Date().toTimeString()}` },
        };
        const { id } = await kClient.record.addRecord({
          app,
          record,
        });
        const { record: expectedRecord } = await kClient.record.getRecord<
          KVPairs<SavedFields>
        >({
          app,
          id,
        });
        // When
        const result = await KIO.getRecord<"record", typeof expectedRecord>(
          "record",
          {
            app: 1,
            id,
          },
        )
          .map((a, s) => {
            expect(s).toStrictEqual({
              record: new KRecord(
                expectedRecord,
                app,
                expectedRecord.$id.value,
                expectedRecord.$revision.value,
              ),
            });
            return a;
          })
          .commit(interpreter);
        // Then
        expect(result).toStrictEqual(new Right(expectedRecord));
      });
      it("GetRecords", async () => {
        cleanUp();
        // Given
        const record: KVPairs<Fields> = {
          text: { value: `test_${new Date().toTimeString()}` },
        };
        const { id } = await kClient.record.addRecord({
          app,
          record,
        });
        const { records: expectedRecords } = await kClient.record.getRecords<
          Pick<KVPairs<SavedFields>, "text" | "$revision" | "$id">
        >({
          app,
          fields: ["text", "$revision", "$id"],
          query: `$id = ${id}`,
        });
        // When
        const result = await KIO.getRecords<
          "records",
          ArrayElm<typeof expectedRecords>
        >("records", {
          app,
          fields: ["text"],
          query: `$id = ${id}`,
        })
          .map((a, s) => {
            expect(s).toStrictEqual({
              records: new KRecordList(
                expectedRecords.map(
                  (expectedRecord) =>
                    new KRecord(
                      expectedRecord,
                      app,
                      expectedRecord.$id.value,
                      expectedRecord.$revision.value,
                    ),
                ),
              ),
            });
            return a;
          })
          .commit(interpreter);
        // Then
        expect(result).toStrictEqual(new Right(expectedRecords));
      });
      it("AddRecord", async () => {
        cleanUp();
        // Given
        const record: KVPairs<Fields> = {
          text: { value: `test_${new Date().toTimeString()}` },
        };
        // When
        const result = await KIO.succeed(1)
          .flatMap("addRecord", () =>
            KIO.addRecord({
              app,
              record,
            }),
          )
          .commit(interpreter);
        // Then
        const savedRecords = await kClient.record.getAllRecords<
          KVPairs<Fields>
        >({ app });
        expect(savedRecords.map((r) => r.text.value)).toStrictEqual([
          record.text.value,
        ]);
        expect(result).toStrictEqual(new Right(undefined));
      });
      it("UpdateRecord", async () => {
        cleanUp();
        // Given
        const record: KVPairs<Fields> = {
          text: { value: `test_${new Date().toTimeString()}` },
        };
        await kClient.record.addRecord({
          app,
          record,
        });
        const {
          records: [savedRecord],
        } = await kClient.record.getRecords<KVPairs<SavedFields>>({
          app,
        });
        // When
        const result = await KIO.succeed(1)
          .flatMap("getRecord", () =>
            KIO.getRecord<KVPairs<Fields>>({
              app,
              id: savedRecord.$id.value,
            }),
          )
          .flatMap("updateRecord", (a) =>
            KIO.updateRecord({
              record: a.update((value) => ({
                ...value,
                text: { value: "updated" },
              })),
            }),
          )
          .commit(interpreter);
        // Then
        const { record: updatedRecord } = await kClient.record.getRecord({
          app,
          id: savedRecord.$id.value,
        });
        const expectedRecord = {
          ...savedRecord,
          text: { ...savedRecord.text, value: "updated" },
          $revision: { ...savedRecord.$revision, value: "2" },
        };
        expect(updatedRecord).toStrictEqual(expectedRecord);
        expect(result).toStrictEqual(new Right(undefined));
      });
      it("DeleteRecord", async () => {
        cleanUp();
        // Given
        const record: KVPairs<Fields> = {
          text: { value: `test_${new Date().toTimeString()}` },
        };
        await kClient.record.addRecord({
          app,
          record,
        });
        const {
          records: [savedRecord],
        } = await kClient.record.getRecords<KVPairs<SavedFields>>({
          app,
        });
        // When
        const result = await KIO.succeed(1)
          .flatMap("getRecord", () =>
            KIO.getRecord<KVPairs<Fields>>({
              app,
              id: savedRecord.$id.value,
            }),
          )
          .flatMap("deleteRecord", (record) =>
            KIO.deleteRecord("deleteRecord")({
              record,
            }),
          )
          .commit(interpreter);
        // Then
        const { records: noRecords } = await kClient.record.getRecords<
          KVPairs<SavedFields>
        >({
          app,
        });
        expect(noRecords).toStrictEqual([]);
        expect(result).toStrictEqual(new Right(undefined));
      });
    });
  });
});
