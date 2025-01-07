import { Interpreter } from "./interpreter.ts";
import { Either } from "./either.ts";
import {
  KData,
  KFields,
  KNewRecord,
  KRecord,
  KRecordList,
  KValue,
} from "./data.ts";

export type KIOS<T extends string, A, D extends KData<A> = KData<A>> = {
  readonly [K in T]: D;
};

export class KIO<S extends object, E, A, D extends KData<A> = KData<A>> {
  private kioa: KIOA<E, A, D>;

  private constructor(kioa: KIOA<E, A, D>) {
    this.kioa = kioa;
  }

  static succeed<N extends string>(
    name: N,
  ): <A>(a: A) => KIO<KIOS<N, A, KValue<A>>, never, A, KValue<A>> {
    return (a) => new KIO({ name, kind: "Succeed", value: new KValue(a) });
  }

  static fail<E>(e: E): KIO<object, E, never, never> {
    return new KIO({ kind: "Fail", error: e });
  }

  flatMap<N extends string>(
    name: N,
  ): <S1 extends object, E1, B, D1 extends KData<B>>(
    f: (a: D, s: S) => KIO<S1, E1, B, D1>,
  ) => KIO<S & KIOS<N, B, D1>, E | E1, B, D1> {
    return (f) =>
      new KIO({
        kind: "FlatMap",
        name,
        self: this.kioa,
        f: (a, s) => f(a as D, s as S).kioa,
      });
  }

  map<N extends string>(
    name: N,
  ): <B, D1 extends KData<B>>(
    f: (a: D, s: S) => D1,
  ) => KIO<S & KIOS<N, B, D1>, E, B, D1> {
    return (f) =>
      this.flatMap(name)((a, s) => {
        return new KIO({ kind: "Succeed", name, value: f(a, s) });
      });
  }

  static getRecord<N extends string>(
    name: N,
  ): <R extends KFields>(args: {
    app: number | string;
    id: number | string;
  }) => KIO<object, never, R, KRecord<R>> {
    return (args) =>
      new KIO({
        kind: "GetRecord",
        name,
        ...args,
      });
  }

  static getRecords<N extends string>(
    name: N,
  ): <R extends KFields>(args: {
    app: number | string;
    fields?: string[];
    query?: string;
  }) => KIO<object, never, R, KRecordList<R>> {
    return (args) =>
      new KIO({
        kind: "GetRecords",
        name,
        ...args,
      });
  }

  static addRecord<N extends string>(
    name: N,
  ): <R extends KFields>(args: {
    app: number | string;
    record: R;
  }) => KIO<object, never, R, KNewRecord<R>> {
    return ({ app, record }) => {
      const kRecord = new KNewRecord(record, app);
      return new KIO({
        kind: "AddRecord",
        name,
        record: kRecord,
      });
    };
  }

  static updateRecord<N extends string>(
    name: N,
  ): <R extends KFields>(args: {
    record: KRecord<R>;
  }) => KIO<object, never, R, KRecord<R>> {
    return (args) =>
      new KIO({
        kind: "UpdateRecord",
        name,
        ...args,
      });
  }

  async commit(
    interpreter: Interpreter,
  ): Promise<Either<E, D extends KRecordList<A> ? A[] : A>> {
    return interpreter.interpret(this.kioa);
  }
}

export type KIOA<E, A, D extends KData<A>> =
  | {
      kind: "FlatMap";
      name: string;
      self: KIOA<unknown, unknown, KData<unknown>>;
      f: (a: unknown, s: unknown) => KIOA<E, A, D>;
    }
  | { kind: "Succeed"; name: string; value: D }
  | { kind: "Fail"; error: E }
  | {
      kind: "GetRecord";
      name: string;
      app: number | string;
      id: number | string;
    }
  | {
      kind: "GetRecords";
      name: string;
      app: number | string;
      fields?: string[];
      query?: string;
    }
  | {
      kind: "AddRecord";
      name: string;
      record: KNewRecord<KFields>;
    }
  | {
      kind: "UpdateRecord";
      name: string;
      record: KRecord<KFields>;
    };
