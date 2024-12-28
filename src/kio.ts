import {Interpreter} from "./interpreter.ts";
import {Either} from "./either.ts";

export class KIO<E, A1, A2 = unknown> {
  private kioa: KIOA<E, A1, A2>;

  private constructor(kioa: KIOA<E, A1, A2>) {
    this.kioa = kioa;
  }
  
  static succeed<A>(a: A): KIO<unknown, A, A> {
    return new KIO({ kind: 'Succeed', value: a });
  }

  static fail<E>(e: E): KIO<E, unknown> {
    return new KIO({ kind: 'Fail', error: e });
  }

  flatMap<B>(f: (a: A2) => KIO<E, A2, B>): KIO<E, A2, B> {
    return new KIO<E, A2, B>({ kind: 'FlatMap', self: this.kioa, f: (a) => f(a).kioa });
  }

  map<B>(f: (a: A2) => B): KIO<E, A2, B> {
    return this.flatMap((a) => new KIO({ kind: 'Succeed', value: f(a) }));
  }

  async commit(interpreter: Interpreter): Promise<Either<E, A2>> {
    return interpreter.interpret(this.kioa);
  }
}

export type KIOA<E, A1, A2 = unknown> =
  | { kind: 'FlatMap', self: KIOA<E, any, any>, f: (a: A1) => KIOA<E, A1, A2> }
  | { kind: 'Succeed'; value: A2 }
  | { kind: 'Fail'; error: E };
