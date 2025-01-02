import {describe, expect, it} from "vitest";
import {KIO} from "./kio.ts";
import {InterpreterImpl} from "./interpreter.ts";
import {Left, Right} from "./either.ts";
import {KintoneClient} from "./client.ts";

describe("InterpreterImpl", () => {

  class FakeKintoneClient implements KintoneClient {
      async getRecord<T extends { [k: string]: unknown; }>(params: { app: string | number; id: string | number; }): Promise<{ record: T; }> {
        return {
          record: params as unknown as T
        }
      }
  }
  const client = new FakeKintoneClient()

  const interpreter = new InterpreterImpl(client);
  describe("interpret", () => {
    it('Succeed', async () => {
      const result = await KIO
        .succeed('succeed')(1)
        .map('map')((a, s) => {
          expect(s).toStrictEqual({ 'succeed': 1 });
          return a;
        })
        .commit(interpreter);
      expect(result).toStrictEqual(new Right(1));
    });
    it('Fail', async () => {
      const result = await KIO
        .fail('error')
        .map('map')(() => {
          expect.fail();
        })
        .commit(interpreter);
      expect(result).toStrictEqual(new Left('error'));
    });
    it('FlatMap', async () => {
      const success = await KIO
        .succeed('succeed1')(1)
        .flatMap('flatMap')((a, s) => {
          expect(s).toStrictEqual({ 'succeed1': 1 });
          return KIO.succeed('succeed2')(a + 1);
        })
        .commit(interpreter);
      expect(success).toStrictEqual(new Right(2));

      const failure = await KIO
        .succeed('succeed1')(1)
        .flatMap('flatMap1')(() => KIO.fail('error'))
        .flatMap('flatMap2')(() => {
          return KIO.succeed('succeed2')(1);
        })
        .commit(interpreter);
      expect(failure).toStrictEqual(new Left('error'));
    });
    it('GetRecord', async () => {
      const expectedRecord = { app: 1, id: 1 };
      const result = await KIO
        .succeed('succeed')(1)
        .flatMap('record')(() => KIO.getRecord('record')<typeof expectedRecord>({ app: 1, id: 1 }))
        .map('map')((a, s) => {
          expect(s).toStrictEqual({ 'succeed': 1, 'record': expectedRecord });
          return a;
        })
        .commit(interpreter);
      expect(result).toStrictEqual(new Right(expectedRecord));
    });
  });
});
