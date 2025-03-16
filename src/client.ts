import {
  KintoneRestAPIClient,
  KintoneRestAPIError,
} from "@kintone/rest-api-client";
import { KError, KFields, KIdField, KRevisionField } from "./data.ts";
import { Either, Left, Right } from "./either.ts";

export type GetRecordParams = {
  app: string | number;
  id: string | number;
};
export type GetRecordResponseRecord = KFields & KIdField & KRevisionField;
export type GetRecordResponse = {
  record: GetRecordResponseRecord;
};
export type GetRecordsParams = {
  app: string | number;
  fields?: string[];
  query?: string;
  totalCount?: boolean;
};
export type GetRecordsResponse<R extends KFields> = {
  records: R[];
};
export type AddRecordRequest = {
  method: "POST";
  api: "/k/v1/record.json";
  payload: {
    app: string | number;
    record: KFields;
  };
};
export type AddRecordsRequest = {
  method: "POST";
  api: "/k/v1/records.json";
  payload: {
    app: string | number;
    records: KFields[];
  };
};
export type UpdateRecordRequest = {
  method: "PUT";
  api: "/k/v1/record.json";
  payload: {
    app: string | number;
    id: string | number;
    record: KFields;
    revision?: string | number;
  };
};
export type UpdateRecordsRequest = {
  method: "PUT";
  api: "/k/v1/records.json";
  payload: {
    app: string | number;
    records: {
      id: string | number;
      record: KFields;
      revision?: string | number;
    }[];
  };
};
export type DeleteRecordsRequest = {
  method: "DELETE";
  api: "/k/v1/records.json";
  payload: {
    app: string | number;
    ids: (string | number)[];
    revisions?: (string | number)[];
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
  getRecords<R extends KFields>(
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

  async getRecords<R extends KFields>(
    params: GetRecordsParams,
  ): Promise<Either<KError, GetRecordsResponse<R>>> {
    try {
      const result = await this.client.record.getRecords(params);
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
