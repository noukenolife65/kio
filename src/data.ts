export class KValue<T> {
  readonly kind: "KValue" = "KValue" as const;
  readonly value: T;
  constructor(value: T) {
    this.value = value;
  }

  update(f: (value: T) => T): KValue<T> {
    return new KValue(f(this.value));
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

  update(f: (value: T) => T): KRecord<T> {
    return new KRecord(f(this.value), this.app, this.revision);
  }
}

export class KRecordList<T> {
  readonly kind: "KRecordList" = "KRecordList" as const;
  readonly records: KRecord<T>[];
  constructor(records: KRecord<T>[]) {
    this.records = records;
  }
  get value(): T[] {
    return this.records.map((record) => record.value);
  }

  update(f: (value: T) => T): KRecordList<T> {
    return new KRecordList(this.records.map((record) => record.update(f)));
  }
}

export type KData<T> = KValue<T> | KRecord<T> | KRecordList<T>;
