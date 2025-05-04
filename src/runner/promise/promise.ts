export const URI = "Promise";

export type URI = typeof URI;

declare module "../../hkt.ts" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface URI2HKT<A, B> {
    [URI]: Promise<B>;
  }
}
