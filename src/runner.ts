import { KIOA } from "./kio.ts";
import { Either, Left, Right } from "./either.ts";
import {
  AddRecordRequest,
  AddRecordsRequest,
  BulkRequest,
  DeleteRecordsRequest,
  KintoneClient,
  KintoneClientImpl,
  UpdateRecordRequest,
  UpdateRecordsRequest,
} from "./client.ts";
import {
  KFields,
  KIdField,
  KRecord,
  KRecordList,
  KRevisionField,
} from "./data.ts";
import { KintoneRestAPIClient } from "@kintone/rest-api-client";

export interface KIORunner {
  run<E, A>(kioa: KIOA<E, A>): Promise<Either<E, A>>;
}

export class KIORunnerImpl implements KIORunner {
  private client: KintoneClient;

  constructor(client: KintoneClient) {
    this.client = client;
  }

  private async _interpret<S extends object, E, A>(
    bulkRequests: BulkRequest[],
    state: S,
    kioa: KIOA<E, A>,
  ): Promise<Either<[S, E], [BulkRequest[], S, A]>> {
    switch (kioa.kind) {
      case "Succeed": {
        return Promise.resolve(
          new Right([bulkRequests, state, kioa.value] as [BulkRequest[], S, A]),
        );
      }
      case "Fail": {
        return Promise.resolve(new Left([state, kioa.error] as [S, E]));
      }
      case "FlatMap": {
        const r1 = await this._interpret(bulkRequests, state, kioa.self);
        return (async () => {
          switch (r1.kind) {
            case "Left":
              return r1 as Left<[S, E]>;
            case "Right": {
              const [bulkRequests1, s1, a1] = r1.value;
              const kioa2 = kioa.f(a1, s1);
              const r2 = await this._interpret(bulkRequests1, s1, kioa2);
              return (() => {
                switch (r2.kind) {
                  case "Left":
                    return r2;
                  case "Right": {
                    const [bulkRequests2, , a2] = r2.value;
                    const s2 = kioa.name ? { ...s1, [kioa.name]: a2 } : s1;
                    return new Right([bulkRequests2, s2, a2] as [
                      BulkRequest[],
                      S,
                      A,
                    ]);
                  }
                }
              })();
            }
          }
        })();
      }
      case "Fold": {
        const r = await this._interpret(bulkRequests, state, kioa.self);
        return (() => {
          switch (r.kind) {
            case "Left": {
              const [s, e] = r.value;
              return this._interpret(bulkRequests, s, kioa.failure(e, s));
            }
            case "Right": {
              const [bulkRequests1, s1, a1] = r.value;
              return this._interpret(bulkRequests1, s1, kioa.success(a1, s1));
            }
          }
        })();
      }
      case "GetRecord": {
        const response = await this.client.getRecord({
          app: kioa.app,
          id: kioa.id,
        });
        return (() => {
          switch (response.kind) {
            case "Left": {
              return new Left([state, response.value] as [S, E]);
            }
            case "Right": {
              const { record } = response.value;
              const revision = record.$revision.value;
              const id = record.$id.value;
              const kRecord = new KRecord(record, kioa.app, id, revision);
              return new Right([bulkRequests, state, kRecord] as [
                BulkRequest[],
                S,
                A,
              ]);
            }
          }
        })();
      }
      case "GetRecords": {
        const { app, fields: orgFields, query } = kioa;
        const fields = orgFields
          ? [...orgFields, "$id", "$revision"]
          : undefined;
        const response = await this.client.getRecords<
          KIdField & KRevisionField
        >({
          app,
          fields,
          query,
        });
        return (() => {
          switch (response.kind) {
            case "Left": {
              return new Left([state, response.value] as [S, E]);
            }
            case "Right": {
              const { records } = response.value;
              const kRecordList = new KRecordList(
                app,
                records.map(
                  (record) =>
                    new KRecord(
                      record,
                      app,
                      record.$id.value,
                      record.$revision.value,
                    ),
                ),
              );
              return new Right([bulkRequests, state, kRecordList] as [
                BulkRequest[],
                S,
                A,
              ]);
            }
          }
        })();
      }
      case "AddRecord": {
        const { record } = kioa;
        const addRecordRequest: AddRecordRequest = {
          method: "POST",
          api: "/k/v1/record.json",
          payload: {
            app: record.app,
            record: record.value,
          },
        };
        return new Right([
          [...bulkRequests, addRecordRequest],
          state,
          undefined,
        ] as [BulkRequest[], S, A]);
      }
      case "AddRecords": {
        const { records } = kioa;
        const addRecordsRequest: AddRecordsRequest = {
          method: "POST",
          api: "/k/v1/records.json",
          payload: {
            app: records.app,
            records: records.value,
          },
        };
        return new Right([
          [...bulkRequests, addRecordsRequest],
          state,
          undefined,
        ] as [BulkRequest[], S, A]);
      }
      case "UpdateRecord": {
        const { record } = kioa;
        const updatingRecord = this.removeProhibitedFieldsForUpdate(
          record.value,
        );
        const updateRecordRequest: UpdateRecordRequest = {
          method: "PUT",
          api: "/k/v1/record.json",
          payload: {
            app: record.app,
            id: record.id,
            record: updatingRecord,
            revision: record.revision,
          },
        };
        return new Right([
          [...bulkRequests, updateRecordRequest],
          state,
          new KRecord(
            record.value,
            record.app,
            record.id,
            Number(record.revision) + 1,
          ),
        ] as [BulkRequest[], S, A]);
      }
      case "UpdateRecords": {
        const { records } = kioa;
        const updatingRecords = records.records.map((record) => {
          const updatingRecord = this.removeProhibitedFieldsForUpdate(
            record.value,
          );
          return {
            id: record.id,
            record: updatingRecord,
            revision: record.revision,
          };
        });
        const updateRecordsRequest: UpdateRecordsRequest = {
          method: "PUT",
          api: "/k/v1/records.json",
          payload: {
            app: records.app,
            records: updatingRecords,
          },
        };
        return new Right([
          [...bulkRequests, updateRecordsRequest],
          state,
          new KRecordList(
            records.app,
            records.records.map((record) => {
              return new KRecord(
                record.value,
                records.app,
                record.id,
                Number(record.revision) + 1,
              );
            }),
          ),
        ] as [BulkRequest[], S, A]);
      }
      case "DeleteRecord": {
        const { record } = kioa;
        const deleteRecordRequest: DeleteRecordsRequest = {
          method: "DELETE",
          api: "/k/v1/records.json",
          payload: {
            app: record.app,
            ids: [record.id],
            revisions: [record.revision ?? -1],
          },
        };
        return new Right([
          [...bulkRequests, deleteRecordRequest],
          state,
          undefined,
        ] as [BulkRequest[], S, A]);
      }
      case "DeleteRecords": {
        const { records } = kioa;
        const deleteRecordsRequest: DeleteRecordsRequest = {
          method: "DELETE",
          api: "/k/v1/records.json",
          payload: {
            app: records.app,
            ids: records.records.map((record) => record.id),
            revisions: records.records.map((record) => record.revision ?? -1),
          },
        };
        return new Right([
          [...bulkRequests, deleteRecordsRequest],
          state,
          undefined,
        ] as [BulkRequest[], S, A]);
      }
      case "Commit": {
        if (bulkRequests.length > 0) {
          const result = await this.client.bulkRequest({
            requests: bulkRequests,
          });
          return (() => {
            switch (result.kind) {
              case "Left": {
                return new Left([state, result.value] as [S, E]);
              }
              case "Right": {
                return new Right([Array<BulkRequest>(), state, undefined] as [
                  BulkRequest[],
                  S,
                  A,
                ]);
              }
            }
          })();
        } else {
          return new Right([Array<BulkRequest>(), state, undefined] as [
            BulkRequest[],
            S,
            A,
          ]);
        }
      }
    }
  }

  private removeProhibitedFieldsForUpdate(record: KFields) {
    return Object.fromEntries(
      Object.entries(record).filter(([, { type }]) => {
        return (
          !type ||
          ![
            "RECORD_NUMBER",
            "MODIFIER",
            "CREATOR",
            "UPDATED_TIME",
            "CREATED_TIME",
          ].includes(type)
        );
      }),
    );
  }

  async run<E, A>(kioa: KIOA<E, A>): Promise<Either<E, A>> {
    const result = await this._interpret([], {}, kioa);
    switch (result.kind) {
      case "Left": {
        const [, error] = result.value;
        return new Left(error);
      }
      case "Right": {
        const [, , a] = result.value;
        return new Right(a);
      }
    }
  }
}

export const createRunner = (client: KintoneRestAPIClient): KIORunner =>
  new KIORunnerImpl(new KintoneClientImpl(client));
