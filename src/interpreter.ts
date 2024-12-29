import {KIOA} from "./kio.ts";
import {Either, Left, Right} from "./either.ts";

export interface Interpreter {
  interpret<E, A>(kioa: KIOA<E, A>): Promise<Either<E, A>>;
}

export class DummyInterpreter implements Interpreter {
  async _interpret<S extends {}, E, A>(state: S, kioa: KIOA<E, A>): Promise<Either<E, [S, A]>> {
    switch (kioa.kind) {
      case 'Succeed':
        const newState = { ...state, [kioa.name]: kioa.value }
        return Promise.resolve(new Right([ newState, kioa.value ] as [S, A]));
      case 'Fail': return Promise.resolve(new Left(kioa.error));
      case 'FlatMap':
        const r1 = await this._interpret(state, kioa.self);
        const result = (async () => {
          switch (r1.kind) {
            case 'Left': return r1;
            case 'Right':
              const [s, a1] = r1.value
              const s1 = { ...s, [kioa.name]: a1 }
              const r2 = await this._interpret(s1, kioa.f(a1, s1));
              return (() => {
                switch (r2.kind) {
                  case 'Left':
                    return r2;
                  case 'Right':
                    const [_, a2] = r2.value
                    const s2 = { ...s1, [kioa.name]: a2 };
                    return new Right([s2, a2]);
                }
              })();
          }
        })();
        return result as Promise<Either<E, [S, A]>>;
    }
  }

  async interpret<E, A>(kioa: KIOA<E, A>): Promise<Either<E, A>> {
    const result = await this._interpret({}, kioa);
    switch (result.kind) {
      case "Left": return result;
      case "Right":
        const [_, a] = result.value
        return new Right(a);
    }
  }
}
