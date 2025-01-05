import { KintoneRestAPIClient } from "@kintone/rest-api-client";

export type RevisionField = { $revision: { value: string | number } };
export type GetRecordParams = {
  app: string | number;
  id: string | number;
};
export type GetRecordResponseRecord = { [k: string]: unknown } & RevisionField;
export type GetRecordResponse = {
  record: GetRecordResponseRecord;
};
export type GetRecordsParams = {
  app: string | number;
  fields?: string[];
  query?: string;
  totalCount?: boolean;
};
export type GetRecordsResponse = ({ [k: string]: unknown } & RevisionField)[];

export interface KintoneClient {
  getRecord(params: GetRecordParams): Promise<GetRecordResponse>;
  getRecords(params: GetRecordsParams): Promise<GetRecordsResponse>;
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

  async getRecords(params: GetRecordsParams): Promise<GetRecordsResponse> {
    const { records } = await this.client.record.getRecords(params);
    return records as unknown as GetRecordsResponse;
  }
}
