export interface KintoneClient {
  getRecord<
    T extends { [k: string]: unknown } & {
      $revision: { value: string | number };
    },
  >(params: {
    app: string | number;
    id: string | number;
  }): Promise<{ record: T }>;
}
