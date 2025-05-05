export type KVPairs<T> = {
  [K in keyof T]: T[K];
};
