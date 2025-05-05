import { Type, URIS } from "../hkt.ts";
import { KIO } from "../kio.ts";

export interface KIORunner<F extends URIS> {
  run<S extends object, E, A>(kioa: KIO<S, E, A>): Type<F, E, A>;
}
