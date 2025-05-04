export interface HKT<F, A, B> {
  readonly _URI: F;
  readonly _A: A;
  readonly _B: B;
}
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface URI2HKT<A, B> {
  readonly _A: A;
  readonly _B: B;
}

export type URIS = keyof URI2HKT<unknown, unknown>;
export type Type<URI extends URIS, A, B> = URI2HKT<A, B>[URI];
