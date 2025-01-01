export interface KintoneClient {
  getRecord<T extends { [k: string]: any }>(params: {
    app: string | number,
    id: string | number,
  }): Promise<{ record: T }>;
}
