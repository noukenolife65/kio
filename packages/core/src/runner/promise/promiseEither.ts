import { Effect } from "../../effect.ts";
import { Either, Left, Right } from "../../either.ts";

export const URI = "PromiseEither";

export type URI = typeof URI;

declare module "../../hkt.ts" {
  interface URI2HKT<A, B> {
    [URI]: Promise<Either<A, B>>;
  }
}

export const promiseEither: Effect<URI> = {
  succeed: <A>(a: A) => Promise.resolve(new Right(a)),
  fail: <E>(e: E) => Promise.resolve(new Left(e)),
  flatMap: <A, B, E1, E2>(
    fa: Promise<Either<E1, A>>,
    f: (a: A) => Promise<Either<E2, B>>,
  ): Promise<Either<E1 | E2, B>> =>
    fa.then((a) => {
      const result: Promise<Either<E1 | E2, B>> = (() => {
        switch (a.kind) {
          case "Left":
            return Promise.resolve(new Left(a.value));
          case "Right":
            return f(a.value);
        }
      })();
      return result;
    }),
  async: <A>(f: () => Promise<A>): Promise<Either<never, A>> =>
    f().then((a) => new Right(a)),
  fold: <A, B, E1, E2>(
    fa: Promise<Either<E1, A>>,
    failure: (e: E1) => Promise<Either<E2, B>>,
    success: (a: A) => Promise<Either<E2, B>>,
  ): Promise<Either<E2, B>> =>
    fa.then((a) => {
      switch (a.kind) {
        case "Left":
          return failure(a.value);
        case "Right":
          return success(a.value);
      }
    }),
};
