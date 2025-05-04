export const URI = "Promise";

export type URI = typeof URI;

declare module "../../hkt.ts" {
  interface URI2HKT<A, B> {
    [URI]: Promise<B>;
  }
}
