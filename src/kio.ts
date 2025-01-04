import { Interpreter } from "./interpreter.ts";
import { Either } from "./either.ts";
import { KData, KRecord, KValue } from "./data.ts";

export type KIOS<T extends string, A, D extends KData<A> = KData<A>> = {
  readonly [K in T]: D;
};

export class KIO<S extends object, E, A, D extends KData<A> = KData<A>> {
  private kioa: KIOA<E, A>;

  private constructor(kioa: KIOA<E, A>) {
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
    f: (a: D, s: S) => KData<B>,
  ) => KIO<S & KIOS<N, B, D1>, E, B, D1> {
    return (f) =>
      this.flatMap(name)((a, s) => {
        return new KIO({ kind: "Succeed", name, value: f(a, s) });
      });
  }

  static getRecord<N extends string>(
    name: N,
  ): <R extends object>(args: {
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

  async commit(interpreter: Interpreter): Promise<Either<E, A>> {
    return interpreter.interpret(this.kioa);
  }
}

export type KIOA<E, A> =
  | {
      kind: "FlatMap";
      name: string;
      self: KIOA<unknown, unknown>;
      f: (a: unknown, s: unknown) => KIOA<E, A>;
    }
  | { kind: "Succeed"; name: string; value: KData<A> }
  | { kind: "Fail"; error: E }
  | {
      kind: "GetRecord";
      name: string;
      app: number | string;
      id: number | string;
    };
