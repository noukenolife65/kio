import { promiseEither, URI as PromiseEitherURI } from "./promiseEither.ts";
import { KIORunner } from "../runner.ts";
import { KIO } from "../../kio.ts";
import { Interpreter } from "../interpreter.ts";
import { KintoneClient, KintoneClientImpl } from "../../client.ts";
import { URI as PromiseURI } from "./promise.ts";
import { KintoneRestAPIClient } from "@kintone/rest-api-client";

export class PromiseRunner implements KIORunner<PromiseURI> {
  private interpreter: Interpreter<PromiseEitherURI>;

  constructor(client: KintoneClient) {
    this.interpreter = new Interpreter(promiseEither, client);
  }

  async run<S extends object, E, A>(kio: KIO<S, E, A>): Promise<A> {
    const result = await this.interpreter.run([], {}, kio.kioa);
    return (() => {
      switch (result.kind) {
        case "Left":
          throw result.value[1] as E;
        case "Right":
          return result.value[2] as A;
      }
    })();
  }
}

export const createRunner = (client: KintoneRestAPIClient): PromiseRunner =>
  new PromiseRunner(new KintoneClientImpl(client));
