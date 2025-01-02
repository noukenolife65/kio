export interface KintoneClient {
  getRecord<T extends { [k: string]: unknown }>(params: {
    app: string | number,
    id: string | number,
  }): Promise<{ record: T }>;
}
