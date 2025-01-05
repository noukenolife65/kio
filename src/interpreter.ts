import { KIOA } from "./kio.ts";
import { Either, Left, Right } from "./either.ts";
import { KintoneClient } from "./client.ts";
import { KData, KRecord, KRecordList } from "./data.ts";

export interface Interpreter {
  interpret<E, A, D extends KData<A>>(
    kioa: KIOA<E, A, D>,
  ): Promise<Either<E, D extends KRecordList<A> ? A[] : A>>;
}

export class InterpreterImpl implements Interpreter {
  private client: KintoneClient;

  constructor(client: KintoneClient) {
    this.client = client;
  }

  private async _interpret<S extends object, E, A, D extends KData<A>>(
    state: S,
    kioa: KIOA<E, A, D>,
  ): Promise<Either<E, [S, D]>> {
    switch (kioa.kind) {
      case "Succeed": {
        const newState = { ...state, [kioa.name]: kioa.value };
        return Promise.resolve(new Right([newState, kioa.value] as [S, D]));
      }
      case "Fail": {
        return Promise.resolve(new Left(kioa.error));
      }
      case "FlatMap": {
        const r1 = await this._interpret(state, kioa.self);
        return (async () => {
          switch (r1.kind) {
            case "Left":
              return r1 as Left<E>;
            case "Right": {
              const [s1, a1] = r1.value;
              const r2 = await this._interpret(s1, kioa.f(a1, s1));
              return (() => {
                switch (r2.kind) {
                  case "Left":
                    return r2;
                  case "Right": {
                    const [, a2] = r2.value;
                    const s2 = { ...s1, [kioa.name]: a2 };
                    return new Right([s2, a2] as [S, D]);
                  }
                }
              })();
            }
          }
        })();
      }
      case "GetRecord": {
        const { record } = await this.client.getRecord({
          app: kioa.app,
          id: kioa.id,
        });
        const revision = record.$revision.value;
        const kRecord = new KRecord(record, kioa.app, revision);
        return new Right([{ ...state, [kioa.name]: kRecord }, kRecord] as [
          S,
          D,
        ]);
      }
      case "GetRecords": {
        const { name, app, fields: orgFields, query } = kioa;
        const fields = orgFields ? [...orgFields, "$revision"] : undefined;
        const result = await this.client.getRecords({
          app,
          fields,
          query,
        });
        const kRecordList = new KRecordList(
          result.map(
            (record) => new KRecord(record, app, record.$revision.value),
          ),
        );
        return new Right([{ ...state, [name]: kRecordList }, kRecordList] as [
          S,
          D,
        ]);
      }
    }
  }

  async interpret<E, A, D extends KData<A>>(
    kioa: KIOA<E, A, D>,
  ): Promise<Either<E, D extends KRecordList<A> ? A[] : A>> {
    const result = await this._interpret({}, kioa);
    switch (result.kind) {
      case "Left":
        return result;
      case "Right": {
        const [, a] = result.value;
        return new Right(a.value as D extends KRecordList<A> ? A[] : A);
      }
    }
  }
}
