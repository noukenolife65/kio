import { Type, URIS } from "./hkt.ts";

export interface Effect<F extends URIS> {
  succeed: <A>(a: A) => Type<F, never, A>;
  fail: <E>(e: E) => Type<F, E, never>;
  flatMap: <A, B, E1, E2>(
    fa: Type<F, E1, A>,
    f: (a: A) => Type<F, E2, B>,
  ) => Type<F, E1 | E2, B>;
  async: <A>(f: () => Promise<A>) => Type<F, never, A>;
  fold: <A, B, E1, E2>(
    fa: Type<F, E1, A>,
    failure: (e: E1) => Type<F, E2, B>,
    success: (a: A) => Type<F, E2, B>,
  ) => Type<F, E2, B>;
}
