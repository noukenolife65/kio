import { Interpreter } from "./interpreter.ts";
import { Either } from "./either.ts";
import {
  KData,
  KError,
  KFields,
  KNewRecord,
  KNothing,
  KRecord,
  KRecordList,
  KValue,
} from "./data.ts";

export type KIOS<T extends string, A, D extends KData<A> = KData<A>> = {
  readonly [K in T]: D;
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

export class KIO<S extends object, E, A, D extends KData<A> = KData<A>> {
  private kioa: KIOA<E, A, D>;

  private constructor(kioa: KIOA<E, A, D>) {
    this.kioa = kioa;
  }

  static succeed<A>(a: A): KIO<object, never, A, KValue<A>>;
  static succeed<N extends string, A>(
    name: N,
    a: A,
  ): KIO<KIOS<N, A, KValue<A>>, never, A, KValue<A>>;
  static succeed<N extends string, A>(
    nameOrA: N | A,
    a?: A,
  ):
    | KIO<object, never, A, KValue<A>>
    | KIO<KIOS<N, A, KValue<A>>, never, A, KValue<A>> {
    if (arguments.length === 1) {
      return new KIO({ kind: "Succeed", value: new KValue(nameOrA as A) });
    } else if (arguments.length === 2 && typeof nameOrA === "string") {
      return new KIO({ name: nameOrA, kind: "Succeed", value: new KValue(a!) });
    } else {
      throw new Error("Invalid arguments");
    }
  }

  static fail<E>(e: E): KIO<object, E, never, never> {
    return new KIO({ kind: "Fail", error: e });
  }

  flatMap<S1 extends object, E1, B, D1 extends KData<B>>(
    f: (a: D, s: S) => KIO<S1, E1, B, D1>,
  ): KIO<S, E | E1, B, D1>;
  flatMap<N extends string, S1 extends object, E1, B, D1 extends KData<B>>(
    name: N,
    f: (a: D, s: S) => KIO<S1, E1, B, D1>,
  ): KIO<S & KIOS<N, B, D1>, E | E1, B, D1>;
  flatMap<N extends string, S1 extends object, E1, B, D1 extends KData<B>>(
    nameOrF: N | ((a: D, s: S) => KIO<S1, E1, B, D1>),
    f?: (a: D, s: S) => KIO<S1, E1, B, D1>,
  ): KIO<S, E | E1, B, D1> | KIO<S & KIOS<N, B, D1>, E | E1, B, D1> {
    if (arguments.length === 1 && typeof nameOrF === "function") {
      return new KIO({
        kind: "FlatMap",
        self: this.kioa,
        f: (a, s) => nameOrF(a as D, s as S).kioa,
      });
    } else if (arguments.length === 2 && typeof nameOrF === "string") {
      return new KIO({
        kind: "FlatMap",
        name: nameOrF,
        self: this.kioa,
        f: (a, s) => f!(a as D, s as S).kioa,
      });
    } else {
      throw new Error("Invalid arguments");
    }
  }

  map<B, D1 extends KData<B>>(
    f: (a: D, s: S) => D1,
  ): KIO<S, E, D1["value"], D1>;
  map<N extends string, B, D1 extends KData<B>>(
    name: N,
    f: (a: D, s: S) => D1,
  ): KIO<S & KIOS<N, D1["value"], D1>, E, D1["value"], D1>;
  map<N extends string, B, D1 extends KData<B>>(
    nameOrF: N | ((a: D, s: S) => D1),
    f?: (a: D, s: S) => D1,
  ):
    | KIO<S, E, D1["value"], D1>
    | KIO<S & KIOS<N, D1["value"], D1>, E, D1["value"], D1> {
    if (arguments.length === 1 && typeof nameOrF === "function") {
      return this.flatMap((a, s) => {
        return new KIO({ kind: "Succeed", value: nameOrF(a, s) });
      });
    } else if (arguments.length === 2 && typeof nameOrF === "string") {
      return this.flatMap(nameOrF, (a, s) => {
        return new KIO({ kind: "Succeed", name: nameOrF, value: f!(a, s) });
      });
    } else {
      throw new Error("Invalid arguments");
    }
  }

  static getRecord<R extends KFields>(
    args: GetRecordArgs,
  ): KIO<object, KError, R, KRecord<R>>;
  static getRecord<N extends string, R extends KFields>(
    name: N,
    args: GetRecordArgs,
  ): KIO<KIOS<N, R, KRecord<R>>, KError, R, KRecord<R>>;
  static getRecord<N extends string, R extends KFields>(
    nameOrArgs: N | GetRecordArgs,
    args?: GetRecordArgs,
  ):
    | KIO<object, KError, R, KRecord<R>>
    | KIO<KIOS<N, R, KRecord<R>>, KError, R, KRecord<R>> {
    if (arguments.length === 1 && typeof nameOrArgs === "object") {
      return new KIO({
        kind: "GetRecord",
        ...nameOrArgs,
      });
    } else if (arguments.length === 2 && typeof nameOrArgs === "string") {
      return new KIO({
        kind: "GetRecord",
        name: nameOrArgs,
        ...args!,
      });
    } else {
      throw new Error("Invalid arguments");
    }
  }

  static getRecords<R extends KFields>(
    args: GetRecordsArgs,
  ): KIO<object, KError, R, KRecordList<R>>;
  static getRecords<N extends string, R extends KFields>(
    name: N,
    args: GetRecordsArgs,
  ): KIO<KIOS<N, R, KRecordList<R>>, KError, R, KRecordList<R>>;
  static getRecords<N extends string, R extends KFields>(
    nameOrArgs: N | GetRecordsArgs,
    args?: GetRecordsArgs,
  ):
    | KIO<object, KError, R, KRecordList<R>>
    | KIO<KIOS<N, R, KRecordList<R>>, KError, R, KRecordList<R>> {
    if (arguments.length === 1 && typeof nameOrArgs === "object") {
      return new KIO({
        kind: "GetRecords",
        ...nameOrArgs,
      });
    } else if (arguments.length === 2 && typeof nameOrArgs === "string") {
      return new KIO({
        kind: "GetRecords",
        name: nameOrArgs,
        ...args!,
      });
    } else {
      throw new Error("Invalid arguments");
    }
  }

  static addRecord<R extends KFields>(args: {
    app: number | string;
    record: R;
  }): KIO<object, never, void, KNothing> {
    const { app, record } = args;
    const kRecord = new KNewRecord(record, app);
    return new KIO({
      kind: "AddRecord",
      record: kRecord,
    });
  }

  static updateRecord<R extends KFields>(args: {
    record: KRecord<R>;
  }): KIO<object, never, void, KNothing> {
    return new KIO({
      kind: "UpdateRecord",
      ...args,
    });
  }

  static deleteRecord<R extends KFields>(args: {
    record: KRecord<R>;
  }): KIO<object, never, void, KNothing> {
    return new KIO({
      kind: "DeleteRecord",
      ...args,
    });
  }

  static commit(): KIO<object, KError, void, KNothing> {
    return new KIO({ kind: "Commit" });
  }

  async run(
    interpreter: Interpreter,
  ): Promise<Either<E, D extends KRecordList<A> ? A[] : A>> {
    return interpreter.interpret(this.kioa);
  }
}

export type KIOA<E, A, D extends KData<A>> =
  | {
      kind: "FlatMap";
      name?: string;
      self: KIOA<unknown, unknown, KData<unknown>>;
      f: (a: unknown, s: unknown) => KIOA<E, A, D>;
    }
  | { kind: "Succeed"; name?: string; value: D }
  | { kind: "Fail"; error: E }
  | {
      kind: "GetRecord";
      name?: string;
      app: number | string;
      id: number | string;
    }
  | {
      kind: "GetRecords";
      name?: string;
      app: number | string;
      fields?: string[];
      query?: string;
    }
  | {
      kind: "AddRecord";
      record: KNewRecord<KFields>;
    }
  | {
      kind: "UpdateRecord";
      record: KRecord<KFields>;
    }
  | {
      kind: "DeleteRecord";
      record: KRecord<KFields>;
    }
  | {
      kind: "Commit";
    };
