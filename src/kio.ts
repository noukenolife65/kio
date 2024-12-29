import {Interpreter} from "./interpreter.ts";
import {Either} from "./either.ts";

export type KIOS<T extends string, A> = {
  [K in T]: A
};

export class KIO<S extends {}, E, A> {
  private kioa: KIOA<E, A>;

  private constructor(kioa: KIOA<E, A>) {
    this.kioa = kioa;
  }

  static succeed<N extends string>(name: N): <A>(a: A) => KIO<KIOS<N, A>, unknown, A> {
    return (a) => new KIO({ name, kind: 'Succeed', value: a });
  }

  static fail<E>(e: E): KIO<{}, E, unknown> {
    return new KIO({ kind: 'Fail', error: e });
  }

  flatMap<N extends string>(name: N): <S1 extends {}, E1, B>(f: (a: A, s: S) => KIO<S1, E1, B>) => KIO<S & KIOS<N, B>, E1, B> {
    return (f) => new KIO({
      kind: 'FlatMap',
      name,
      self: this.kioa,
      f: (a, s) => f(a, s).kioa,
    });
  }

  map<N extends string>(name: N): <E1, B>(f: (a: A, s: S) => B) => KIO<S & KIOS<N, B>, E1, B> {
    return (f) => this.flatMap(name)((a, s) => new KIO({ kind: 'Succeed', name, value: f(a, s) }));
  }

  async commit(interpreter: Interpreter): Promise<Either<E, A>> {
    return interpreter.interpret(this.kioa);
  }
}

export type KIOA<E, A> =
  | { kind: 'FlatMap', name: string, self: KIOA<any, any>, f: (a: any, s: any) => KIOA<E, A> }
  | { kind: 'Succeed', name: string, value: A }
  | { kind: 'Fail'; error: E };
