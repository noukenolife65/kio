import { describe, expect, it, onTestFinished } from "vitest";
import { KIO } from "./kio.ts";
import { createRunner, KIORunnerImpl } from "./runner.ts";
import { Either, Left, Right } from "./either.ts";
import {
  BulkRequestResponse,
  GetRecordResponse,
  GetRecordsResponse,
  KintoneClient,
} from "./client.ts";
import {
  KError,
  KFields,
  KNothing,
  KRecord,
  KRecordList,
  KValue,
} from "./data.ts";
import { KintoneRestAPIClient } from "@kintone/rest-api-client";
import { ArrayElm, KVPairs } from "./helper.ts";
import SavedFields = kintone.types.SavedFields;
import Fields = kintone.types.Fields;

describe("KIORunnerImpl", () => {
  describe("run", () => {
    describe("Basic Operations", () => {
      class FakeKintoneClient implements KintoneClient {
        async getRecord(): Promise<Either<KError, GetRecordResponse>> {
          return new Right({
            record: {
              test: { value: 1 },
              $id: { value: 1 },
              $revision: { value: 2 },
            },
          });
        }
        async getRecords<R extends KFields>(): Promise<
          Either<KError, GetRecordsResponse<R>>
        > {
          return new Right([
            {
              test: { value: 1 },
              $revision: { value: 2 },
            },
          ] as unknown as GetRecordsResponse<R>);
        }
        async bulkRequest(): Promise<Either<KError, BulkRequestResponse>> {
          return new Right(undefined);
        }
      }
      const fakeClient = new FakeKintoneClient();
      const runner = new KIORunnerImpl(fakeClient);
      it("Succeed", async () => {
        const result = await KIO.succeed(1).run(runner);
        expect(result).toStrictEqual(new Right(1));
      });
      it("Fail", async () => {
        const result = await KIO.fail("error")
          .map(() => expect.fail())
          .run(runner);
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
          .run(runner);
        expect(success).toStrictEqual(new Right(5));

        const failure = await KIO.succeed(1)
          .flatMap(() => KIO.fail("error"))
          .flatMap(() => KIO.succeed(1))
          .run(runner);
        expect(failure).toStrictEqual(new Left("error"));
      });
      it("Fold", async () => {
        await KIO.start()
          .flatMap("value", () => KIO.succeed(1))
          .flatMap(() => KIO.fail("error"))
          .fold(
            () => {
              expect.fail("should not be called");
            },
            (e, s) => {
              expect(e).toBe("error");
              expect(s).toStrictEqual({ value: new KValue(1) });
              return KIO.succeed(2);
            },
          )
          .fold(
            (a, s) => {
              expect(a).toStrictEqual(new KValue(2));
              expect(s).toStrictEqual({ value: new KValue(1) });
              return KIO.succeed(undefined);
            },
            () => {
              expect.fail("should not be called");
            },
          )
          .run(runner);
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
      const runner = createRunner(kClient);
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
      describe("GetRecord", () => {
        it("should get a record", async () => {
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
          const result = await KIO.getRecord<typeof expectedRecord>({ app, id })
            .map((a) => {
              expect(a).toStrictEqual(
                new KRecord(
                  expectedRecord,
                  app,
                  expectedRecord.$id.value,
                  expectedRecord.$revision.value,
                ),
              );
              return a;
            })
            .run(runner);
          // Then
          expect(result).toStrictEqual(new Right(expectedRecord));
        });
        it("should fail to get a record", async () => {
          cleanUp();
          // When
          const result = await KIO.getRecord({
            app,
            id: 9999,
          }).run(runner);
          // Then
          expect(result).toStrictEqual(
            new Left({
              id: expect.anything(),
              code: expect.anything(),
              message: expect.anything(),
            }),
          );
        });
      });
      describe("GetRecords", () => {
        it("should get records", async () => {
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
          const result = await KIO.getRecords<ArrayElm<typeof expectedRecords>>(
            {
              app,
              fields: ["text"],
              query: `$id = ${id}`,
            },
          )
            .map((a) => {
              expect(a).toStrictEqual(
                new KRecordList(
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
              );
              return a;
            })
            .run(runner);
          // Then
          expect(result).toStrictEqual(new Right(expectedRecords));
        });
        it("should fail to get records", async () => {
          cleanUp();
          // When
          const result = await KIO.getRecords({
            app,
            fields: ["text"],
            query: "invalid query",
          }).run(runner);
          // Then
          expect(result).toStrictEqual(
            new Left({
              id: expect.anything(),
              code: expect.anything(),
              message: expect.anything(),
            }),
          );
        });
      });
      describe("AddRecord", () => {
        it("should add a record", async () => {
          cleanUp();
          // Given
          const record: KVPairs<Fields> = {
            text: { value: `test_${new Date().toTimeString()}` },
          };
          // When
          const result = await KIO.addRecord({ app, record })
            .flatMap(() => KIO.commit())
            .run(runner);
          // Then
          const savedRecords = await kClient.record.getAllRecords<
            KVPairs<Fields>
          >({ app });
          expect(savedRecords.map((r) => r.text.value)).toStrictEqual([
            record.text.value,
          ]);
          expect(result).toStrictEqual(new Right(undefined));
        });
        it("should fail to add a record", async () => {
          cleanUp();
          // When
          const result = await KIO.addRecord({
            app,
            record: { invalidField: { value: "" } },
          })
            .flatMap(() => KIO.commit())
            .run(runner);
          // Then
          expect(result).toStrictEqual(
            new Left({
              id: expect.anything(),
              code: expect.anything(),
              message: expect.anything(),
            }),
          );
        });
      });
      describe("AddRecords", () => {
        it("should add records", async () => {
          cleanUp();
          // Given
          const records: KVPairs<Fields>[] = [
            { text: { value: `test_${new Date().toTimeString()}` } },
            { text: { value: `test_${new Date().toTimeString()}` } },
          ];
          // When
          const result = await KIO.addRecords({ app, records })
            .flatMap(() => KIO.commit())
            .run(runner);
          // Then
          const savedRecords = await kClient.record.getAllRecords<
            KVPairs<Fields>
          >({ app });
          expect(savedRecords.map((r) => r.text.value)).toStrictEqual(
            records.map((r) => r.text.value),
          );
          expect(result).toStrictEqual(new Right(undefined));
        });
        it("should fail to add records", async () => {
          cleanUp();
          // When
          const result = await KIO.addRecords({
            app,
            records: [{ invalidField: { value: "" } }],
          })
            .flatMap(() => KIO.commit())
            .run(runner);
          // Then
          expect(result).toStrictEqual(
            new Left({
              id: expect.anything(),
              code: expect.anything(),
              message: expect.anything(),
            }),
          );
        });
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
        const result = await KIO.getRecord<KVPairs<Fields>>({
          app,
          id: savedRecord.$id.value,
        })
          .flatMap((a) =>
            KIO.updateRecord({
              record: a.update((value) => ({
                ...value,
                text: { value: "updated" },
              })),
            }),
          )
          .flatMap(() => KIO.commit())
          .run(runner);
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
        const result = await KIO.getRecord<KVPairs<Fields>>({
          app,
          id: savedRecord.$id.value,
        })
          .flatMap((record) => KIO.deleteRecord({ record }))
          .flatMap(() => KIO.commit())
          .run(runner);
        // Then
        const { records: noRecords } = await kClient.record.getRecords<
          KVPairs<SavedFields>
        >({
          app,
        });
        expect(noRecords).toStrictEqual([]);
        expect(result).toStrictEqual(new Right(undefined));
      });
      describe("Commit", () => {
        it("should commit", async () => {
          cleanUp();
          // When
          const result = await KIO.succeed({ text: { value: "test" } })
            .flatMap("newRecord", (a) =>
              KIO.addRecord({
                app,
                record: a.value,
              }),
            )
            .flatMap(() => KIO.commit())
            .flatMap("savepoint1", () => KIO.getRecords({ app }))
            .map((a) => {
              return a.update((record) => ({
                ...record,
                text: { value: "updated" },
              }));
            })
            .flatMap((a) => {
              return KIO.updateRecord({ record: a.records[0] });
            })
            // .flatMap(() => KIO.commit())
            .flatMap((record) => {
              return KIO.deleteRecord({ record });
            })
            .flatMap(() => KIO.commit())
            .flatMap("savepoint2", () => KIO.getRecords({ app }))
            .map((_a, s) => {
              expect(s.savepoint2.records).toHaveLength(0);
              return new KNothing();
            })
            .run(runner);
          // Then
          expect(result).toStrictEqual(new Right(undefined));
        });
        it("should rollback", async () => {
          cleanUp();
          // When
          await KIO.succeed({ text: { value: "test" } })
            .flatMap((a) =>
              KIO.addRecord({
                app,
                record: a.value,
              }),
            )
            .flatMap(() => KIO.commit())
            .flatMap("savepoint1", () => KIO.getRecords({ app }))
            .flatMap((_, s) =>
              KIO.deleteRecord({ record: s.savepoint1.records[0] }),
            )
            .flatMap((_, s) =>
              KIO.updateRecord({ record: s.savepoint1.records[0] }),
            )
            .flatMap(() => KIO.commit())
            .run(runner);
          // Then
          const { records } = await kClient.record.getRecords({ app });
          expect(records).toHaveLength(1);
        });
      });
    });
  });
});
