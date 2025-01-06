import { KintoneRestAPIClient } from "@kintone/rest-api-client";

export type KFields = {
  [k: string]: {
    type?: string;
    value: unknown;
  };
};
export type IdField = { $id: { value: string | number } };
export type RevisionField = { $revision: { value: string | number } };
export type GetRecordParams = {
  app: string | number;
  id: string | number;
};
export type GetRecordResponseRecord = KFields & IdField & RevisionField;
export type GetRecordResponse = {
  record: GetRecordResponseRecord;
};
export type GetRecordsParams = {
  app: string | number;
  fields?: string[];
  query?: string;
  totalCount?: boolean;
};
export type GetRecordsResponse<R extends KFields> = R[];
export type UpdateRecordRequest = {
  method: "PUT";
  api: "/k/v1/record.json";
  payload: {
    app: string | number;
    id: string | number;
    record?: KFields;
    revision?: string | number;
  };
};
export type BulkRequest = UpdateRecordRequest;
export type BulkRequestParams = {
  requests: BulkRequest[];
};
export type BulkRequestResponse = void;

export interface KintoneClient {
  getRecord(params: GetRecordParams): Promise<GetRecordResponse>;
  getRecords<R extends KFields>(
    params: GetRecordsParams,
  ): Promise<GetRecordsResponse<R>>;
  bulkRequest(params: BulkRequestParams): Promise<BulkRequestResponse>;
}

export class KintoneClientImpl implements KintoneClient {
  private client: KintoneRestAPIClient;

  constructor(client: KintoneRestAPIClient) {
    this.client = client;
  }

  async getRecord<T extends GetRecordResponseRecord>(
    params: GetRecordParams,
  ): Promise<GetRecordResponse> {
    const result = await this.client.record.getRecord(params);
    return result as unknown as { record: T };
  }

  async getRecords<R extends KFields>(
    params: GetRecordsParams,
  ): Promise<GetRecordsResponse<R>> {
    const { records } = await this.client.record.getRecords(params);
    return records as unknown as GetRecordsResponse<R>;
  }

  async bulkRequest(params: BulkRequestParams): Promise<BulkRequestResponse> {
    await this.client.bulkRequest(params);
    // TODO: Extract error responses from results
    return;
  }
}
