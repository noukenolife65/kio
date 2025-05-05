export type KFields<T> = {
  [K in keyof T]: T[K] extends {
    type?: string;
    value: unknown;
  }
    ? T[K]
    : never;
};
export type _KFields = {
  [k: string]: {
    type?: string;
    value: unknown;
  };
};
export type KIdField = { $id: { value: string | number } };
export type KRevisionField = { $revision: { value: string | number } };

export class KNewRecord<T> {
  readonly kind: "KNewRecord" = "KNewRecord" as const;
  readonly value: T;
  readonly app: string | number;
  constructor(value: T, app: string | number) {
    this.value = value;
    this.app = app;
  }

  update(f: (value: T) => T): KNewRecord<T> {
    return new KNewRecord(f(this.value), this.app);
  }
}

export class KRecord<T> {
  readonly kind: "KRecord" = "KRecord" as const;
  readonly value: T;
  readonly app: string | number;
  readonly id: string | number;
  readonly revision?: string | number;
  constructor(
    value: T,
    app: string | number,
    id: string | number,
    revision?: string | number,
  ) {
    this.value = value;
    this.app = app;
    this.id = id;
    this.revision = revision;
  }

  update(f: (value: T) => T): KRecord<T> {
    return new KRecord(f(this.value), this.app, this.id, this.revision);
  }
}

export type KData<T> = KRecord<T> | KNewRecord<T>;

export type KError = {
  id: string;
  code: string;
  message: string;
};
