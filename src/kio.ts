import { KIORunner } from "./runner.ts";
import { Either } from "./either.ts";
import {
  KError,
  KFields,
  KNewRecord,
  KNewRecordList,
  KRecord,
  KRecordList,
} from "./data.ts";

export type KIOS<T extends string, A> = {
  readonly [K in T]: A;
};

type GetRecordArgs = {
  app: number | string;
  id: number | string;
};
type GetRecordsArgs = {
  app: number | string;
  fields?: string[];
  query?: string;
};

export class KIO<S extends object, E, A> {
  private kioa: KIOA<E, A>;

  private constructor(kioa: KIOA<E, A>) {
    this.kioa = kioa;
  }

  static start(): KIO<object, never, void> {
    return new KIO({ kind: "Succeed", value: undefined });
  }

  static succeed<A>(a: A): KIO<object, never, A> {
    return new KIO({ kind: "Succeed", value: a });
  }

  static fail<E>(e: E): KIO<object, E, never> {
    return new KIO({ kind: "Fail", error: e });
  }

  fold<S1 extends object, E1, B>(
    success: (a: A, s: S) => KIO<S1, E1, B>,
    failure: (e: E, s: S) => KIO<S1, E1, B>,
  ): KIO<S1, E | E1, B> {
    return new KIO({
      kind: "Fold",
      self: this.kioa,
      success: (a, s) => success(a as A, s as S).kioa,
      failure: (e, s) => failure(e as E, s as S).kioa,
    });
  }

  flatMap<S1 extends object, E1, B>(
    f: (a: A, s: S) => KIO<S1, E1, B>,
  ): KIO<S, E | E1, B>;
  flatMap<N extends string, S1 extends object, E1, B>(
    name: N,
    f: (a: A, s: S) => KIO<S1, E1, B>,
  ): KIO<S & KIOS<N, B>, E | E1, B>;
  flatMap<N extends string, S1 extends object, E1, B>(
    nameOrF: N | ((a: A, s: S) => KIO<S1, E1, B>),
    f?: (a: A, s: S) => KIO<S1, E1, B>,
  ): KIO<S, E | E1, B> | KIO<S & KIOS<N, B>, E | E1, B> {
    if (arguments.length === 1 && typeof nameOrF === "function") {
      return new KIO({
        kind: "FlatMap",
        self: this.kioa,
        f: (a, s) => nameOrF(a as A, s as S).kioa,
      });
    } else if (arguments.length === 2 && typeof nameOrF === "string") {
      return new KIO({
        kind: "FlatMap",
        name: nameOrF,
        self: this.kioa,
        f: (a, s) => f!(a as A, s as S).kioa,
      });
    } else {
      throw new Error("Invalid arguments");
    }
  }

  map<B>(f: (a: A, s: S) => B): KIO<S, E, B>;
  map<N extends string, B>(
    name: N,
    f: (a: A, s: S) => B,
  ): KIO<S & KIOS<N, B>, E, B>;
  map<N extends string, B>(
    nameOrF: N | ((a: A, s: S) => B),
    f?: (a: A, s: S) => B,
  ): KIO<S, E, B> | KIO<S & KIOS<N, B>, E, B> {
    if (arguments.length === 1 && typeof nameOrF === "function") {
      return this.flatMap((a, s) => {
        return new KIO({ kind: "Succeed", value: nameOrF(a, s) });
      });
    } else if (arguments.length === 2 && typeof nameOrF === "string") {
      return this.flatMap(nameOrF, (a, s) => {
        return new KIO({ kind: "Succeed", value: f!(a, s) });
      });
    } else {
      throw new Error("Invalid arguments");
    }
  }

  static getRecord<R extends KFields>(
    args: GetRecordArgs,
  ): KIO<object, KError, KRecord<R>> {
    return new KIO({ kind: "GetRecord", ...args });
  }

  static getRecords<R extends KFields>(
    args: GetRecordsArgs,
  ): KIO<object, KError, KRecordList<R>> {
    return new KIO({ kind: "GetRecords", ...args });
  }

  static addRecord<R extends KFields>(args: {
    app: number | string;
    record: R;
  }): KIO<object, never, void> {
    const { app, record } = args;
    const kRecord = new KNewRecord(record, app);
    return new KIO({
      kind: "AddRecord",
      record: kRecord,
    });
  }

  static addRecords<R extends KFields>(args: {
    app: number | string;
    records: R[];
  }): KIO<object, never, void> {
    const { app, records } = args;
    const kNewRecords = new KNewRecordList(
      app,
      records.map((record) => new KNewRecord(record, app)),
    );
    return new KIO({
      kind: "AddRecords",
      records: kNewRecords,
    });
  }

  static updateRecord<R extends KFields>(args: {
    record: KRecord<R>;
  }): KIO<object, never, KRecord<R>> {
    return new KIO({
      kind: "UpdateRecord",
      ...args,
    });
  }

  static updateRecords<R extends KFields>(args: {
    records: KRecordList<R>;
  }): KIO<object, never, KRecordList<R>> {
    return new KIO({
      kind: "UpdateRecords",
      ...args,
    });
  }

  static deleteRecord<R extends KFields>(args: {
    record: KRecord<R>;
  }): KIO<object, never, void> {
    return new KIO({
      kind: "DeleteRecord",
      ...args,
    });
  }

  static deleteRecords<R extends KFields>(args: {
    records: KRecordList<R>;
  }): KIO<object, never, void> {
    return new KIO({
      kind: "DeleteRecords",
      ...args,
    });
  }

  static commit(): KIO<object, KError, void> {
    return new KIO({ kind: "Commit" });
  }

  async run(runner: KIORunner): Promise<Either<E, A>> {
    return runner.run(this.kioa);
  }
}

export type KIOA<E, A> =
  | {
      kind: "FlatMap";
      name?: string;
      self: KIOA<unknown, unknown>;
      f: (a: unknown, s: unknown) => KIOA<E, A>;
    }
  | { kind: "Succeed"; value: A }
  | { kind: "Fail"; error: E }
  | {
      kind: "Fold";
      self: KIOA<unknown, unknown>;
      success: (a: unknown, s: unknown) => KIOA<E, A>;
      failure: (e: unknown, s: unknown) => KIOA<E, A>;
    }
  | {
      kind: "GetRecord";
      app: number | string;
      id: number | string;
    }
  | {
      kind: "GetRecords";
      app: number | string;
      fields?: string[];
      query?: string;
    }
  | {
      kind: "AddRecord";
      record: KNewRecord<KFields>;
    }
  | {
      kind: "AddRecords";
      records: KNewRecordList<KFields>;
    }
  | {
      kind: "UpdateRecord";
      record: KRecord<KFields>;
    }
  | {
      kind: "UpdateRecords";
      records: KRecordList<KFields>;
    }
  | {
      kind: "DeleteRecord";
      record: KRecord<KFields>;
    }
  | {
      kind: "DeleteRecords";
      records: KRecordList<KFields>;
    }
  | {
      kind: "Commit";
    };
