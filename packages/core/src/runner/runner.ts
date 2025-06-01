import { Type, URIS } from "../hkt.ts";
import { KIO } from "../kio.ts";

export interface KIORunner<F extends URIS> {
  run<E, A>(kioa: KIO<E, A>): Type<F, E, A>;
}
