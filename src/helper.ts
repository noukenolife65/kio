export type KVPairs<T> = {
  [K in keyof T]: T[K];
};

export type ArrayElm<T> = T extends (infer E)[] ? E : never;
