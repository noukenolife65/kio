import {Interpreter} from "./interpreter.ts";
import {Either} from "./either.ts";

export class KIO<E, A> {
  private kioa: KIOA<E, A>;

  private constructor(kioa: KIOA<E, A>) {
    this.kioa = kioa;
  }
  
  static succeed<A>(a: A): KIO<unknown, A> {
    return new KIO({ kind: 'Succeed', value: a });
  }

  static fail<E>(e: E): KIO<E, unknown> {
    return new KIO({ kind: 'Fail', error: e });
  }

  flatMap<E1, B>(f: (a: A) => KIO<E1, B>): KIO<E1, B> {
    return new KIO<E1, B>({ kind: 'FlatMap', self: this.kioa, f: (a) => f(a).kioa });
  }

  map<B>(f: (a: A) => B): KIO<E, B> {
    return this.flatMap((a) => new KIO({ kind: 'Succeed', value: f(a) }));
  }

  async commit(interpreter: Interpreter): Promise<Either<E, A>> {
    return interpreter.interpret(this.kioa);
  }
}

export type KIOA<E, A> =
  | { kind: 'FlatMap', self: KIOA<any, any>, f: (a: any) => KIOA<E, A> }
  | { kind: 'Succeed'; value: A }
  | { kind: 'Fail'; error: E };
