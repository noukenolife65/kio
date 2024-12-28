import {KIOA} from "./kio.ts";
import {Either, Left, Right} from "./either.ts";

export interface Interpreter {
  interpret<E, A>(kioa: KIOA<E, A>): Promise<Either<E, A>>;
}

export class DummyInterpreter implements Interpreter {
  async interpret<E, A>(kioa: KIOA<E, A>): Promise<Either<E, A>> {
    switch (kioa.kind) {
      case 'Succeed': return Promise.resolve(new Right(kioa.value));
      case 'Fail': return Promise.resolve(new Left(kioa.error));
      case 'FlatMap':
        const result = await this.interpret(kioa.self);
        return (() => {
          switch (result.kind) {
            case 'Left': return Promise.resolve(result);
            case 'Right': return this.interpret(kioa.f(result.value));
          }
        })();
    }
  }
}
