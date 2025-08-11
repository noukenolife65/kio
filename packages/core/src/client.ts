import {
  KintoneRestAPIClient,
  KintoneRestAPIError,
} from "@kintone/rest-api-client";
import { KError, _KFields, KIdField, KRevisionField } from "./data.ts";
import { Either, Left, Right } from "./either.ts";

export type GetRecordParams = {
  app: string | number;
  id: string | number;
};
export type GetRecordResponseRecord = _KFields & KIdField & KRevisionField;
export type GetRecordResponse = {
  record: GetRecordResponseRecord;
};
export type GetRecordsParams = {
  app: string | number;
  fields?: string[] | undefined;
  query?: string | undefined;
  totalCount?: boolean | undefined;
};
export type GetRecordsResponse<R extends _KFields> = {
  records: R[];
};
export type AddRecordRequest = {
  method: "POST";
  api: "/k/v1/record.json";
  payload: {
    app: string | number;
    record: _KFields;
  };
};
export type AddRecordsRequest = {
  method: "POST";
  api: "/k/v1/records.json";
  payload: {
    app: string | number;
    records: _KFields[];
  };
};
export type UpdateRecordRequest = {
  method: "PUT";
  api: "/k/v1/record.json";
  payload: {
    app: string | number;
    id: string | number;
    record: _KFields;
    revision?: string | number | undefined;
  };
};
export type UpdateRecordsRequest = {
  method: "PUT";
  api: "/k/v1/records.json";
  payload: {
    app: string | number;
    records: {
      id: string | number;
      record: _KFields;
      revision?: string | number | undefined;
    }[];
  };
};
export type DeleteRecordsRequest = {
  method: "DELETE";
  api: "/k/v1/records.json";
  payload: {
    app: string | number;
    ids: (string | number)[];
    revisions?: (string | number)[] | undefined;
  };
};
export type BulkRequest =
  | AddRecordRequest
  | AddRecordsRequest
  | UpdateRecordRequest
  | UpdateRecordsRequest
  | DeleteRecordsRequest;
export type BulkRequestParams = {
  requests: BulkRequest[];
};
export type BulkRequestResponse = void;

export interface KintoneClient {
  getRecord(
    params: GetRecordParams,
  ): Promise<Either<KError, GetRecordResponse>>;
  getRecords<R extends _KFields>(
    params: GetRecordsParams,
  ): Promise<Either<KError, GetRecordsResponse<R>>>;
  bulkRequest(
    params: BulkRequestParams,
  ): Promise<Either<KError, BulkRequestResponse>>;
}

export class KintoneClientImpl implements KintoneClient {
  private client: KintoneRestAPIClient;

  constructor(client: KintoneRestAPIClient) {
    this.client = client;
  }

  async getRecord<T extends GetRecordResponseRecord>(
    params: GetRecordParams,
  ): Promise<Either<KError, GetRecordResponse>> {
    try {
      const result = await this.client.record.getRecord(params);
      return new Right(result as unknown as { record: T });
    } catch (e) {
      if (e instanceof KintoneRestAPIError) {
        return new Left({
          id: e.id,
          code: e.code,
          message: e.message,
        });
      } else {
        throw e;
      }
    }
  }

  async getRecords<R extends _KFields>(
    params: GetRecordsParams,
  ): Promise<Either<KError, GetRecordsResponse<R>>> {
    try {
      const result = await this.client.record.getRecords({
        app: params.app,
        ...(params.fields !== undefined ? { fields: params.fields } : {}),
        ...(params.query !== undefined ? { query: params.query } : {}),
        ...(params.totalCount !== undefined ? { totalCount: params.totalCount } : {}),
      });
      return new Right(result as unknown as GetRecordsResponse<R>);
    } catch (e) {
      if (e instanceof KintoneRestAPIError) {
        return new Left({
          id: e.id,
          code: e.code,
          message: e.message,
        });
      } else {
        throw e;
      }
    }
  }

  async bulkRequest(
    params: BulkRequestParams,
  ): Promise<Either<KError, BulkRequestResponse>> {
    try {
      await this.client.bulkRequest(params);
      return new Right(undefined);
    } catch (e) {
      if (e instanceof KintoneRestAPIError) {
        return new Left({
          id: e.id,
          code: e.code,
          message: e.message,
        });
      } else {
        throw e;
      }
    }
  }
}
