import { KIOA } from "./kio.ts";
import { Either, Left, Right } from "./either.ts";
import {
  AddRecordRequest,
  BulkRequest,
  DeleteRecordsRequest,
  KintoneClient,
  UpdateRecordRequest,
} from "./client.ts";
import {
  KData,
  KIdField,
  KNothing,
  KRecord,
  KRecordList,
  KRevisionField,
} from "./data.ts";

export interface Interpreter {
  interpret<E, A, D extends KData<A>>(
    kioa: KIOA<E, A, D>,
  ): Promise<Either<E, D extends KRecordList<A> ? A[] : A>>;
}

export class InterpreterImpl implements Interpreter {
  private client: KintoneClient;

  constructor(client: KintoneClient) {
    this.client = client;
  }

  private async _interpret<S extends object, E, A, D extends KData<A>>(
    bulkRequests: BulkRequest[],
    state: S,
    kioa: KIOA<E, A, D>,
  ): Promise<Either<E, [BulkRequest[], S, D]>> {
    switch (kioa.kind) {
      case "Succeed": {
        const newState = kioa.name
          ? { ...state, [kioa.name]: kioa.value }
          : state;
        return Promise.resolve(
          new Right([bulkRequests, newState, kioa.value] as [
            BulkRequest[],
            S,
            D,
          ]),
        );
      }
      case "Fail": {
        return Promise.resolve(new Left(kioa.error));
      }
      case "FlatMap": {
        const r1 = await this._interpret(bulkRequests, state, kioa.self);
        return (async () => {
          switch (r1.kind) {
            case "Left":
              return r1 as Left<E>;
            case "Right": {
              const [bulkRequests1, s1, a1] = r1.value;
              const r2 = await this._interpret(
                bulkRequests1,
                s1,
                kioa.f(a1, s1),
              );
              return (() => {
                switch (r2.kind) {
                  case "Left":
                    return r2;
                  case "Right": {
                    const [bulkRequests2, , a2] = r2.value;
                    const s2 = kioa.name ? { ...s1, [kioa.name]: a2 } : s1;
                    return new Right([
                      [...bulkRequests1, ...bulkRequests2],
                      s2,
                      a2,
                    ] as [BulkRequest[], S, D]);
                  }
                }
              })();
            }
          }
        })();
      }
      case "GetRecord": {
        const { record } = await this.client.getRecord({
          app: kioa.app,
          id: kioa.id,
        });
        const revision = record.$revision.value;
        const id = record.$id.value;
        const kRecord = new KRecord(record, kioa.app, id, revision);
        return new Right([
          bulkRequests,
          kioa.name ? { ...state, [kioa.name]: kRecord } : state,
          kRecord,
        ] as [BulkRequest[], S, D]);
      }
      case "GetRecords": {
        const { name, app, fields: orgFields, query } = kioa;
        const fields = orgFields
          ? [...orgFields, "$id", "$revision"]
          : undefined;
        const result = await this.client.getRecords<KIdField & KRevisionField>({
          app,
          fields,
          query,
        });
        const kRecordList = new KRecordList(
          result.map(
            (record) =>
              new KRecord(
                record,
                app,
                record.$id.value,
                record.$revision.value,
              ),
          ),
        );
        return new Right([
          bulkRequests,
          name ? { ...state, [name]: kRecordList } : state,
          kRecordList,
        ] as [BulkRequest[], S, D]);
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
          new KNothing(),
        ] as [BulkRequest[], S, D]);
      }
      case "UpdateRecord": {
        const { record } = kioa;
        const updatingRecord = Object.fromEntries(
          Object.entries(record.value).filter(([, { type }]) => {
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
          new KNothing(),
        ] as [BulkRequest[], S, D]);
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
          new KNothing(),
        ] as [BulkRequest[], S, D]);
      }
    }
  }

  async interpret<E, A, D extends KData<A>>(
    kioa: KIOA<E, A, D>,
  ): Promise<Either<E, D extends KRecordList<A> ? A[] : A>> {
    const result = await this._interpret([], {}, kioa);
    switch (result.kind) {
      case "Left":
        return result;
      case "Right": {
        const [bulkRequests, , a] = result.value;
        if (bulkRequests.length > 0) {
          await this.client.bulkRequest({ requests: bulkRequests });
        }
        return new Right(a.value as D extends KRecordList<A> ? A[] : A);
      }
    }
  }
}
