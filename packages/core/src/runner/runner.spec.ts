import { describe, expect, it, onTestFinished } from "vitest";
import { KIO } from "../kio.ts";
import { Either, Right } from "../either.ts";
import {
  BulkRequestResponse,
  GetRecordResponse,
  GetRecordsResponse,
  KintoneClient,
} from "../client.ts";
import { _KFields, KError, KRecord } from "../data.ts";
import { KintoneRestAPIClient } from "@kintone/rest-api-client";
import { KVPairs } from "../helper.ts";
import { createRunner, PromiseRunner } from "./promise/runner.ts";
import SavedFields = kintone.types.SavedFields;
import Fields = kintone.types.Fields;

describe("PromiseRunner", () => {
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
        async getRecords<R extends _KFields>(): Promise<
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
      const runner = new PromiseRunner(fakeClient);
      it("Succeed", async () => {
        const kio = KIO.succeed(1);
        const result = await runner.run(kio);
        expect(result).toBe(1);
      });
      it("Fail", async () => {
        try {
          const kio = KIO.fail("error").map(() => expect.fail());
          await runner.run(kio);
          expect.fail("should throw error");
        } catch (error) {
          expect(error).toBe("error");
        }
      });
      it("Async", async () => {
        const kio = KIO.async(async () => 1);
        const success = await runner.run(kio);
        expect(success).toBe(1);
        try {
          const kio = KIO.async(async () => {
            throw "error";
          });
          await runner.run(kio);
          expect.fail("should throw error");
        } catch (error) {
          expect(error).toBe("error");
        }
      });
      it("AndThen", async () => {
        const kio = KIO.succeed(1)
          .andThen((a) => KIO.succeed(a + 1))
          .andThen((a) => KIO.succeed(a + 1))
          .map((a) => a + 1)
          .map((a) => a + 1);
        const success = await runner.run(kio);
        expect(success).toBe(5);

        try {
          const kio = KIO.succeed(1)
            .andThen(() => KIO.fail("error"))
            .andThen(() => KIO.succeed(1));
          await runner.run(kio);
          expect.fail("should throw error");
        } catch (error) {
          expect(error).toBe("error");
        }
      });
      it("Fold", async () => {
        const kio = KIO.succeed(1)
          .andThen(() => KIO.fail("error"))
          .fold(
            () => {
              expect.fail("should not be called");
            },
            (e) => {
              expect(e).toBe("error");
              return KIO.succeed(2);
            },
          )
          .fold(
            (a) => {
              expect(a).toStrictEqual(2);
              return KIO.succeed(undefined);
            },
            () => {
              expect.fail("should not be called");
            },
          );
        await runner.run(kio);
      });
      it("Retry", async () => {
        let i = 0;
        const kio = KIO.async(async () => i++)
          .andThen(() => KIO.fail("error"))
          .retryN(2)
          .catch(() => KIO.succeed(i));
        const result = await runner.run(kio);
        expect(result).toBe(3);
      });
      it("Catch", async () => {
        const kio = KIO.fail("error").catch(() => KIO.succeed(1));
        const result = await runner.run(kio);
        expect(result).toBe(1);
      });
      it("Gen", async () => {
        const kio1 = KIO.gen(function* () {
          const a = yield* KIO.succeed(1);
          const b = yield* KIO.succeed("2");
          return a + parseInt(b);
        });
        const result1 = await runner.run(kio1);
        expect(result1).toBe(3);

        const kio2 = KIO.gen(function* () {
          const a = yield* KIO.succeed(1);
          yield* KIO.fail("error");
          const b = yield* KIO.succeed("2");
          yield* KIO.fail(1);
          return a + parseInt(b);
        });
        try {
          await runner.run(kio2);
          expect.fail("should throw error");
        } catch (error) {
          expect(error).toBe("error");
        }
      });
    });
    describe("Kintone Operations", () => {
      const app = 1;
      const kClient = new KintoneRestAPIClient({
        baseUrl: process.env["KINTONE_BASE_URL"]!,
        auth: {
          apiToken: process.env["KINTONE_API_TOKEN"]!,
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
          const kio = KIO.getRecord<SavedFields>({
            app,
            id,
          });
          const result = await runner.run(kio);
          // Then
          expect(result).toStrictEqual(
            new KRecord(
              expectedRecord,
              app,
              expectedRecord.$id.value,
              expectedRecord.$revision.value,
            ),
          );
        });
        it("should fail to get a record", async () => {
          cleanUp();
          // When
          const kio = KIO.getRecord({
            app,
            id: 9999,
          });
          try {
            await runner.run(kio);
            expect.fail("should throw error");
          } catch (error) {
            // Then
            expect(error).toStrictEqual({
              id: expect.anything(),
              code: expect.anything(),
              message: expect.anything(),
            });
          }
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
          const kio = KIO.getRecords<SavedFields>({
            app,
            fields: ["text"],
            query: `$id = ${id}`,
          });
          const result = await runner.run(kio);
          // Then
          expect(result).toStrictEqual(
            expectedRecords.map(
              (expectedRecord) =>
                new KRecord(
                  expectedRecord,
                  app,
                  expectedRecord.$id.value,
                  expectedRecord.$revision.value,
                ),
            ),
          );
        });
        it("should fail to get records", async () => {
          cleanUp();
          // When
          const kio = KIO.getRecords({
            app,
            fields: ["text"],
            query: "invalid query",
          });
          try {
            await runner.run(kio);
            expect.fail("should throw error");
          } catch (error) {
            // Then
            expect(error).toStrictEqual({
              id: expect.anything(),
              code: expect.anything(),
              message: expect.anything(),
            });
          }
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
          const kio = KIO.addRecord({ app, record }).andThen(() =>
            KIO.commit(),
          );
          await runner.run(kio);
          // Then
          const savedRecords = await kClient.record.getAllRecords<
            KVPairs<Fields>
          >({ app });
          expect(savedRecords.map((r) => r.text.value)).toStrictEqual([
            record.text.value,
          ]);
        });
        it("should fail to add a record", async () => {
          cleanUp();
          // When
          const kio = KIO.addRecord({
            app,
            record: { invalidField: { value: "" } },
          }).andThen(() => KIO.commit());
          try {
            await runner.run(kio);
            expect.fail("should throw error");
          } catch (error) {
            // Then
            expect(error).toStrictEqual({
              id: expect.anything(),
              code: expect.anything(),
              message: expect.anything(),
            });
          }
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
          const kio = KIO.addRecords({ app, records }).andThen(() =>
            KIO.commit(),
          );
          await runner.run(kio);
          // Then
          const savedRecords = await kClient.record.getAllRecords<
            KVPairs<Fields>
          >({ app });
          expect(savedRecords.map((r) => r.text.value)).toStrictEqual(
            records.map((r) => r.text.value),
          );
        });
        it("should fail to add records", async () => {
          cleanUp();
          // When
          const kio = KIO.addRecords({
            app,
            records: [{ invalidField: { value: "" } }],
          }).andThen(() => KIO.commit());
          try {
            await runner.run(kio);
            expect.fail("should throw error");
          } catch (error) {
            // Then
            expect(error).toStrictEqual({
              id: expect.anything(),
              code: expect.anything(),
              message: expect.anything(),
            });
          }
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
        const kio = KIO.getRecord<Fields>({
          app,
          id: savedRecord!.$id.value,
        })
          .andThen((a) =>
            KIO.updateRecord({
              record: a.update((value) => ({
                ...value,
                text: { value: "updated" },
              })),
            }),
          )
          .andThen(() => KIO.commit());
        await runner.run(kio);
        // Then
        const { record: updatedRecord } = await kClient.record.getRecord({
          app,
          id: savedRecord!.$id.value,
        });
        const expectedRecord = {
          ...savedRecord,
          text: { ...savedRecord!.text, value: "updated" },
          $revision: { ...savedRecord!.$revision, value: "2" },
        };
        expect(updatedRecord).toStrictEqual(expectedRecord);
      });
      it("UpdateRecords", async () => {
        cleanUp();
        // Given
        const records: KVPairs<Fields>[] = [
          { text: { value: `test_${new Date().toTimeString()}` } },
          { text: { value: `test_${new Date().toTimeString()}` } },
        ];
        await kClient.record.addRecords({
          app,
          records,
        });
        const { records: savedRecords } = await kClient.record.getRecords<
          KVPairs<SavedFields>
        >({
          app,
        });
        // When
        const kio = KIO.getRecords<Fields>({
          app,
        })
          .andThen((a) =>
            KIO.updateRecords({
              records: a.map((record) =>
                record.update((value) => ({
                  ...value,
                  text: { value: "updated" },
                })),
              ),
            }),
          )
          .andThen(() => KIO.commit());
        await runner.run(kio);
        // Then
        const updatedRecords = await kClient.record.getRecords({
          app,
        });
        const expectedRecords = savedRecords.map((record) => ({
          ...record,
          text: { ...record.text, value: "updated" },
          $revision: { ...record.$revision, value: "2" },
        }));
        expect(updatedRecords.records).toStrictEqual(expectedRecords);
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
        const kio = KIO.getRecord<Fields>({
          app,
          id: savedRecord!.$id.value,
        })
          .andThen((record) => KIO.deleteRecord({ record }))
          .andThen(() => KIO.commit());
        await runner.run(kio);
        // Then
        const { records: noRecords } = await kClient.record.getRecords<
          KVPairs<SavedFields>
        >({
          app,
        });
        expect(noRecords).toStrictEqual([]);
      });
      describe("DeleteRecords", () => {
        it("should delete records", async () => {
          cleanUp();
          // Given
          const records: KVPairs<Fields>[] = [
            { text: { value: `test_${new Date().toTimeString()}` } },
            { text: { value: `test_${new Date().toTimeString()}` } },
          ];
          await kClient.record.addRecords({
            app,
            records,
          });
          // When
          const kio = KIO.getRecords<Fields>({
            app,
          })
            .andThen((a) => KIO.deleteRecords({ records: a }))
            .andThen(() => KIO.commit());
          await runner.run(kio);
          // Then
          const { records: noRecords } = await kClient.record.getRecords<
            KVPairs<SavedFields>
          >({
            app,
          });
          expect(noRecords).toStrictEqual([]);
        });
      });
      describe("Commit", () => {
        it("should commit", async () => {
          cleanUp();
          // When
          const kio = KIO.succeed({ text: { value: "test" } })
            .andThen((a) =>
              KIO.addRecord({
                app,
                record: a,
              }),
            )
            .andThen(() => KIO.commit())
            .andThen(() => KIO.getRecords({ app }))
            .map((a) => {
              return a.map((record) =>
                record.update((value) => ({
                  ...value,
                  text: { value: "updated" },
                })),
              );
            })
            .andThen((a) => {
              return KIO.updateRecord({ record: a[0]! });
            })
            .andThen((record) => {
              return KIO.deleteRecord({ record });
            })
            .andThen(() => KIO.commit())
            .andThen(() => KIO.getRecords({ app }))
            .map((a) => {
              expect(a).toHaveLength(0);
            });
          await runner.run(kio);
        });
        it("should rollback", async () => {
          cleanUp();
          // When
          const kio = KIO.succeed({ text: { value: "test" } })
            .andThen((a) =>
              KIO.addRecord({
                app,
                record: a,
              }),
            )
            .andThen(() => KIO.commit())
            .andThen(() => KIO.getRecords({ app }))
            .andThen((records) => {
              const record = records[0]!;
              return KIO.updateRecord({
                record: record.update((value) => ({
                  ...value,
                  text: { value: "updated" },
                })),
              });
            })
            .andThen(() => KIO.fail("error"))
            .andThen(() => KIO.commit());
          try {
            await runner.run(kio);
            expect.fail("should throw error");
          } catch {
            // Then
            const { records } = await kClient.record.getRecords({ app });
            expect(records).toHaveLength(1);
            const record = records[0];
            if (record?.["text"]?.value) {
              expect(record["text"].value).toBe("test"); // Verify the record wasn't updated
            } else {
              expect.fail("record should exist with text field");
            }
          }
        });
      });
    });
  });
});
