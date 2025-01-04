export class KValue<T> {
  readonly kind: "KValue" = "KValue" as const;
  readonly value: T;
  constructor(value: T) {
    this.value = value;
  }

  update(value: T): KValue<T> {
    return new KValue(value);
  }
}

export class KRecord<T> {
  readonly kind: "KRecord" = "KRecord" as const;
  readonly value: T;
  readonly app: string | number;
  readonly revision?: string | number;
  constructor(value: T, app: string | number, revision?: string | number) {
    this.value = value;
    this.app = app;
    this.revision = revision;
  }

  update(value: T): KRecord<T> {
    return new KRecord(value, this.app, this.revision);
  }
}

export type KData<T> = KValue<T> | KRecord<T>;
