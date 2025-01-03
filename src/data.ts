export class KValue<T> {
  readonly kind: "KValue" = "KValue" as const;
  readonly value: T;
  constructor(value: T) {
    this.value = value;
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
}

export type KData<T> = KValue<T> | KRecord<T>;
