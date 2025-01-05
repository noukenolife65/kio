import { KintoneRestAPIClient } from "@kintone/rest-api-client";

export type IdField = { $id: { value: string | number } };
export type RevisionField = { $revision: { value: string | number } };
export type GetRecordParams = {
  app: string | number;
  id: string | number;
};
export type GetRecordResponseRecord = { [k: string]: unknown } & IdField &
  RevisionField;
export type GetRecordResponse = {
  record: GetRecordResponseRecord;
};
export type GetRecordsParams = {
  app: string | number;
  fields?: string[];
  query?: string;
  totalCount?: boolean;
};
export type GetRecordsResponse<R> = (R & { [k: string]: unknown })[];

export interface KintoneClient {
  getRecord(params: GetRecordParams): Promise<GetRecordResponse>;
  getRecords<R>(params: GetRecordsParams): Promise<GetRecordsResponse<R>>;
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

  async getRecords<R>(
    params: GetRecordsParams,
  ): Promise<GetRecordsResponse<R>> {
    const { records } = await this.client.record.getRecords(params);
    return records as unknown as GetRecordsResponse<R>;
  }
}
