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

  private async _interpret(
    bulkRequests: BulkRequest[],
    state: object,
    kioa: KIOA<unknown, unknown>,
  ): Promise<Either<[object, unknown], [BulkRequest[], object, unknown]>> {
    switch (kioa.kind) {
      case "Succeed": {
        return Promise.resolve(new Right([bulkRequests, state, kioa.value]));
      }
      case "Fail": {
        return Promise.resolve(new Left([state, kioa.error]));
      }
      case "Async": {
        try {
          const a = await kioa.f();
          return new Right([bulkRequests, state, a]);
        } catch (e) {
          return new Left([state, e]);
        }
      }
      case "AndThen": {
        const r1 = await this._interpret(bulkRequests, state, kioa.self);
        return (async () => {
          switch (r1.kind) {
            case "Left":
              return r1;
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
                    return new Right([bulkRequests2, s2, a2]);
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
              return new Left([state, response.value]);
            }
            case "Right": {
              const { record } = response.value;
              const revision = record.$revision.value;
              const id = record.$id.value;
              const kRecord = new KRecord(record, kioa.app, id, revision);
              return new Right([bulkRequests, state, kRecord]);
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
              return new Left([state, response.value]);
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
              return new Right([bulkRequests, state, kRecordList]);
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
        ]);
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
        ]);
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
        ]);
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
        ]);
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
        ]);
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
        ]);
      }
      case "Commit": {
        if (bulkRequests.length > 0) {
          const result = await this.client.bulkRequest({
            requests: bulkRequests,
          });
          return (() => {
            switch (result.kind) {
              case "Left": {
                return new Left([state, result.value]);
              }
              case "Right": {
                return new Right([Array<BulkRequest>(), state, undefined]);
              }
            }
          })();
        } else {
          return new Right([Array<BulkRequest>(), state, undefined]);
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
        return new Left(error) as Left<E>;
      }
      case "Right": {
        const [, , a] = result.value;
        return new Right(a) as Right<A>;
      }
    }
  }
}

export const createRunner = (client: KintoneRestAPIClient): KIORunner =>
  new KIORunnerImpl(new KintoneClientImpl(client));
