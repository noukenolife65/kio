import { Type, URIS } from "../hkt.ts";
import { Effect } from "../effect.ts";
import {
  AddRecordRequest,
  AddRecordsRequest,
  BulkRequest,
  DeleteRecordsRequest,
  KintoneClient,
  UpdateRecordRequest,
  UpdateRecordsRequest,
} from "../client.ts";
import { KIOA } from "../kio.ts";
import { _KFields, KIdField, KRecord, KRevisionField } from "../data.ts";

export class Interpreter<F extends URIS> {
  private readonly client: KintoneClient;
  private readonly F: Effect<F>;

  constructor(F: Effect<F>, client: KintoneClient) {
    this.F = F;
    this.client = client;
  }

  run(
    bulkRequests: BulkRequest[],
    kioa: KIOA<unknown, unknown>,
  ): Type<F, unknown, [BulkRequest[], unknown]> {
    const F = this.F;
    switch (kioa.kind) {
      case "Succeed": {
        return F.succeed([bulkRequests, kioa.value]);
      }
      case "Fail": {
        return F.fail(kioa.error);
      }
      case "Async": {
        const async = F.async(kioa.f);
        return F.flatMap(async, (a) => F.succeed([bulkRequests, a]));
      }
      case "AndThen": {
        const r1 = this.run(bulkRequests, kioa.self);
        return F.flatMap(r1, ([bulkRequests1, a1]) => {
          const kioa2 = kioa.f(a1);
          const r2 = this.run(bulkRequests1, kioa2);
          return F.flatMap(r2, ([bulkRequests2, a2]) => {
            return F.succeed([bulkRequests2, a2]);
          });
        });
      }
      case "Fold": {
        const r = this.run(bulkRequests, kioa.self);
        return F.fold(
          r,
          (e) => this.run(bulkRequests, kioa.failure(e)),
          ([bulkRequests1, a1]) =>
            this.run(bulkRequests1, kioa.success(a1)),
        );
      }
      case "GetRecord": {
        const getRecord = F.async(() =>
          this.client.getRecord({
            app: kioa.app,
            id: kioa.id,
          }),
        );
        return F.flatMap(getRecord, (response) => {
          return (() => {
            switch (response.kind) {
              case "Left": {
                return F.fail(response.value);
              }
              case "Right": {
                const { record } = response.value;
                const revision = record.$revision.value;
                const id = record.$id.value;
                const kRecord = new KRecord(record, kioa.app, id, revision);
                return F.succeed([bulkRequests, kRecord]);
              }
            }
          })();
        });
      }
      case "GetRecords": {
        const { app, fields: orgFields, query } = kioa;
        const fields = orgFields
          ? [...orgFields, "$id", "$revision"]
          : undefined;
        const getRecords = F.async(() =>
          this.client.getRecords<KIdField & KRevisionField>({
            app,
            fields,
            query,
          }),
        );
        return F.flatMap(getRecords, (response) => {
          return (() => {
            switch (response.kind) {
              case "Left": {
                return F.fail(response.value);
              }
              case "Right": {
                const { records } = response.value;
                const kRecordList = records.map(
                  (record) =>
                    new KRecord(
                      record,
                      app,
                      record.$id.value,
                      record.$revision.value,
                    ),
                );
                return F.succeed([bulkRequests, kRecordList]);
              }
            }
          })();
        });
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
        return F.succeed([
          [...bulkRequests, addRecordRequest],
          undefined,
        ]);
      }
      case "AddRecords": {
        const { records } = kioa;
        const [head] = records;
        if (head === undefined) {
          throw new Error(
            "No records provided for the add records operation. Please specify at least one record.",
          );
        }
        const addRecordsRequest: AddRecordsRequest = {
          method: "POST",
          api: "/k/v1/records.json",
          payload: {
            app: head.app,
            records: records.map((record) => record.value),
          },
        };
        return F.succeed([
          [...bulkRequests, addRecordsRequest],
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
        return F.succeed([
          [...bulkRequests, updateRecordRequest],
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
        const [head] = records;
        if (head === undefined) {
          throw new Error(
            "No records provided for the update records operation. Please specify at least one record.",
          );
        }
        const updatingRecords = records.map((record) => {
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
            app: head.app,
            records: updatingRecords,
          },
        };
        return F.succeed([
          [...bulkRequests, updateRecordsRequest],
          records.map(
            (record) =>
              new KRecord(
                record.value,
                record.app,
                record.id,
                Number(record.revision) + 1,
              ),
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
        return F.succeed([
          [...bulkRequests, deleteRecordRequest],
          undefined,
        ]);
      }
      case "DeleteRecords": {
        const { records } = kioa;
        const [head] = records;
        if (head === undefined) {
          throw new Error(
            "No records provided for the delete records operation. Please specify at least one record.",
          );
        }
        const deleteRecordsRequest: DeleteRecordsRequest = {
          method: "DELETE",
          api: "/k/v1/records.json",
          payload: {
            app: head.app,
            ids: records.map((record) => record.id),
            revisions: records.map((record) => record.revision ?? -1),
          },
        };
        return F.succeed([
          [...bulkRequests, deleteRecordsRequest],
          undefined,
        ]);
      }
      case "Commit": {
        if (bulkRequests.length === 0) {
          return F.succeed([[], undefined]);
        }
        const commit = F.async(() =>
          this.client.bulkRequest({ requests: bulkRequests }),
        );
        return F.flatMap(commit, (response) => {
          return (() => {
            switch (response.kind) {
              case "Left": {
                return F.fail(response.value);
              }
              case "Right": {
                return F.succeed([[], undefined]);
              }
            }
          })();
        });
      }
    }
  }

  private removeProhibitedFieldsForUpdate(record: _KFields) {
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
}
