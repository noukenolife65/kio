import { _KFields, KError, KFields, KNewRecord, KRecord } from "./data.ts";
import { RetryPolicy } from "./retry/policy.ts";

/**
 * A type that preserves named state in KIO operations.
 * @template T - The name of the state property
 * @template A - The type of the state value
 *
 * @example
 * ```typescript
 * // When using andThen with a name:
 * KIO.succeed(1)
 *   .andThen("x", (a) => KIO.succeed(a + 1))  // State becomes { x: number }
 *   .andThen("y", (a, s) => KIO.succeed(s.x + 1))  // State becomes { x: number, y: number }
 * ```
 */
export type KIOS<T extends string, A> = {
  readonly [K in T]: A;
};

/**
 * Arguments for getting a single record from Kintone
 */
type GetRecordArgs = {
  /** The app ID */
  app: number | string;
  /** The record ID */
  id: number | string;
};

/**
 * Arguments for getting multiple records from Kintone
 */
type GetRecordsArgs = {
  /** The app ID */
  app: number | string;
  /** Optional list of field codes to retrieve */
  fields?: string[];
  /** Optional query string to filter records */
  query?: string;
};

/**
 * Represents the algebraic data type for all possible KIO operations.
 * @template E - The error type
 * @template A - The success value type
 */
export type KIOA<E, A> =
  | {
      kind: "AndThen";
      self: KIOA<unknown, unknown>;
      f: (a: unknown) => KIOA<E, A>;
    }
  | { kind: "Succeed"; value: A }
  | { kind: "Fail"; error: E }
  | {
      kind: "Async";
      f: () => Promise<A>;
    }
  | {
      kind: "Fold";
      self: KIOA<unknown, unknown>;
      success: (a: unknown) => KIOA<E, A>;
      failure: (e: unknown) => KIOA<E, A>;
    }
  | {
      kind: "GetRecord";
      app: number | string;
      id: number | string;
    }
  | {
      kind: "GetRecords";
      app: number | string;
      fields?: string[];
      query?: string;
    }
  | {
      kind: "AddRecord";
      record: KNewRecord<_KFields>;
    }
  | {
      kind: "AddRecords";
      records: KNewRecord<_KFields>[];
    }
  | {
      kind: "UpdateRecord";
      record: KRecord<_KFields>;
    }
  | {
      kind: "UpdateRecords";
      records: KRecord<_KFields>[];
    }
  | {
      kind: "DeleteRecord";
      record: KRecord<_KFields>;
    }
  | {
      kind: "DeleteRecords";
      records: KRecord<_KFields>[];
    }
  | {
      kind: "Commit";
    };

/**
 * A functional programming interface for Kintone operations.
 * @template E - The error type
 * @template A - The success value type
 *
 * @example
 * ```typescript
 * // Basic usage
 * const kio = KIO.getRecord({ app: 1, id: 1 })
 *   .andThen((record) => KIO.updateRecord({ record: { ...record, title: "Updated" } }));
 *
 * const result = await runner.run(kio);
 * ```
 */
export class KIO<E, A> {
  readonly kioa: KIOA<E, A>;

  /** @private */
  private constructor(kioa: KIOA<E, A>) {
    this.kioa = kioa;
  }

  /**
   * Creates an effect that represents a successful operation with no value.
   * @returns An effect with no value
   *
   * @example
   * ```typescript
   * const kio = KIO.start();
   * ```
   */
  static start(): KIO<never, void> {
    return new KIO({ kind: "Succeed", value: undefined });
  }

  /**
   * Creates an effect that represents a successful operation with a value.
   * @template A - The type of the success value
   * @param a - The success value
   * @returns An effect with the given value
   *
   * @example
   * ```typescript
   * const kio = KIO.succeed(42);
   * ```
   */
  static succeed<A>(a: A): KIO<never, A> {
    return new KIO({ kind: "Succeed", value: a });
  }

  /**
   * Creates an effect that represents a failed operation.
   * @template E - The type of the error
   * @param e - The error value
   * @returns An effect with the given error
   *
   * @example
   * ```typescript
   * const kio = KIO.fail(new Error("Something went wrong"));
   * ```
   */
  static fail<E>(e: E): KIO<E, never> {
    return new KIO({ kind: "Fail", error: e });
  }

  /**
   * Creates an effect from an async function.
   * @template A - The type of the success value
   * @template E - The type of the error (defaults to unknown)
   * @param f - The async function to execute
   * @returns An effect that will execute the async function
   *
   * @example
   * ```typescript
   * const kio = KIO.async(async () => {
   *   const response = await fetch("https://api.example.com");
   *   return response.json();
   * });
   * ```
   */
  static async<A>(f: () => Promise<A>): KIO<never, A> {
    return new KIO({ kind: "Async", f });
  }

  /**
   * Handles both success and failure cases of a KIO operation.
   * @template E1 - The new error type
   * @template B - The new success value type
   * @param success - Function to handle success case
   * @param failure - Function to handle failure case
   * @returns An effect with the transformed result
   *
   * @example
   * ```typescript
   * const kio = KIO.getRecord({ app: 1, id: 1 })
   *   .fold(
   *     (record) => KIO.succeed(record.title),
   *     (error) => KIO.succeed("Default Title")
   *   );
   * ```
   */
  fold<E1, B>(
    success: (a: A) => KIO<E1, B>,
    failure: (e: E) => KIO<E1, B>,
  ): KIO<E1, B> {
    return new KIO({
      kind: "Fold",
      self: this.kioa,
      success: (a) => success(a as A).kioa,
      failure: (e) => failure(e as E).kioa,
    });
  }

  /**
   * Handles the failure case of a KIO operation.
   * @template E1 - The new error type
   * @template B - The new success value type
   * @param f - Function to handle the error
   * @returns An effect that handles the error case
   *
   * @example
   * ```typescript
   * const kio = KIO.getRecord({ app: 1, id: 1 })
   *   .catch((error) => KIO.succeed({ error: "Record not found" }));
   * ```
   */
  catch<E1, B>(f: (e: E) => KIO<E1, B>): KIO<E1, A | B> {
    return this.fold<E1, A | B>((a) => KIO.succeed(a), f);
  }

  /**
   * Chains KIO operations together.
   * @template E1 - The new error type
   * @template B - The new success value type
   * @param f - Function to transform the current result into a new KIO operation
   * @returns An effect that chains the operations
   *
   * @example
   * ```typescript
   * const kio = KIO.succeed(1)
   *   .andThen((a) => KIO.succeed(a + 1))
   *   .andThen((a) => KIO.succeed(a * 2));
   * ```
   */
  andThen<E1, B>(
    f: (a: A) => KIO<E1, B>,
  ): KIO<E | E1, B> {
    return new KIO({
      kind: "AndThen",
      self: this.kioa,
      f: (a) => f(a as A).kioa,
    });
  }

  /**
   * Transforms the result of a KIO operation.
   * @template B - The new success value type
   * @param f - Function to transform the current result
   * @returns An effect with the transformed result
   *
   * @example
   * ```typescript
   * const kio = KIO.succeed(1)
   *   .map((a) => a + 1)
   *   .map((a) => a * 2);
   * ```
   */
  map<B>(
    f: (a: A) => B,
  ): KIO<E, B> {
    return this.andThen((a) => KIO.succeed(f(a)));
  }

  /**
   * Applies a retry policy to a KIO operation.
   * @param policy - The retry policy to apply
   * @returns An effect that will retry on failure according to the policy
   *
   * @example
   * ```typescript
   * const kio = KIO.getRecord({ app: 1, id: 1 })
   *   .retry({ kind: "Recurs", times: 3 });
   * ```
   */
  retry(policy: RetryPolicy): KIO<E, A> {
    return (() => {
      switch (policy.kind) {
        case "Recurs": {
          const { times } = policy;
          const loop = (n: number): KIO<E, A> => {
            return this.catch((e) => (n === 0 ? KIO.fail(e) : loop(n - 1)));
          };
          return loop(times);
        }
      }
    })();
  }

  /**
   * Creates an effect from a generator function.
   * @template K - The type of KIO operations yielded by the generator
   * @template A - The type of the final value
   * @param f - The generator function that yields KIO operations
   * @returns An effect that will execute the generator's operations in sequence
   *
   * @example
   * ```typescript
   * const kio = KIO.gen(function* () {
   *   const record1 = yield KIO.getRecord({ app: 1, id: 1 });
   *   const record2 = yield KIO.getRecord({ app: 1, id: 2 });
   *   return [record1, record2];
   * });
   * ```
   */
  static gen<K extends KIO<any, any>, A>(
    f: () => Generator<K, A>,
  ): KIO<K extends KIO<infer E, any> ? E : never, A> {
    const loop = (
      itr: Generator<K, A>,
      a?: any,
    ): KIO<K extends KIO<infer E, any> ? E : never, A> => {
      const next = itr.next(a);
      if (next.done) {
        return KIO.succeed(next.value);
      } else {
        return next.value.andThen((a) => loop(itr, a));
      }
    };
    return KIO.start().andThen(() => loop(f()));
  }

  /**
   * Gets a single record from Kintone.
   * @template R - The record type
   * @param args - The arguments for getting the record
   * @returns An effect that will get the record
   *
   * @example
   * ```typescript
   * const kio = KIO.getRecord({ app: 1, id: 1 });
   * const record = await kio.run(runner);
   * ```
   */
  static getRecord<R extends KFields<R>>(
    args: GetRecordArgs,
  ): KIO<KError, KRecord<R>> {
    return new KIO({ kind: "GetRecord", ...args });
  }

  /**
   * Gets multiple records from Kintone.
   * @template R - The record type
   * @param args - The arguments for getting the records
   * @returns An effect that will get the records
   *
   * @example
   * ```typescript
   * const kio = KIO.getRecords({
   *   app: 1,
   *   query: "title = \"Example\"",
   *   fields: ["title", "description"]
   * });
   * const records = await kio.run(runner);
   * ```
   */
  static getRecords<R extends KFields<R>>(
    args: GetRecordsArgs,
  ): KIO<KError, KRecord<R>[]> {
    return new KIO({ kind: "GetRecords", ...args });
  }

  /**
   * Adds a new record to Kintone. The operation won't be executed until commit is called.
   * @template R - The record type
   * @param args - The arguments for adding the record
   * @returns An effect that will add the record when committed
   *
   * @example
   * ```typescript
   * const kio = KIO.addRecord({
   *   app: 1,
   *   record: { title: "New Record", description: "Example" }
   * })
   *   .andThen(() => KIO.commit());
   * await kio.run(runner);
   * ```
   */
  static addRecord<R extends KFields<R>>(args: {
    app: number | string;
    record: R;
  }): KIO<never, void> {
    const { app, record } = args;
    const kRecord = new KNewRecord(record, app);
    return new KIO({
      kind: "AddRecord",
      record: kRecord,
    });
  }

  /**
   * Adds multiple records to Kintone. The operations won't be executed until commit is called.
   * @template R - The record type
   * @param args - The arguments for adding the records
   * @returns An effect that will add the records when committed
   *
   * @example
   * ```typescript
   * const kio = KIO.addRecords({
   *   app: 1,
   *   records: [
   *     { title: "First Record", description: "Example 1" },
   *     { title: "Second Record", description: "Example 2" }
   *   ]
   * })
   *   .andThen(() => KIO.commit());
   * await kio.run(runner);
   * ```
   */
  static addRecords<R extends KFields<R>>(args: {
    app: number | string;
    records: R[];
  }): KIO<never, void> {
    const { app, records } = args;
    const kNewRecords = records.map((record) => new KNewRecord(record, app));
    return new KIO({
      kind: "AddRecords",
      records: kNewRecords,
    });
  }

  /**
   * Updates an existing record in Kintone. The operation won't be executed until commit is called.
   * @template R - The record type
   * @param args - The arguments for updating the record
   * @returns An effect that will update the record when committed
   *
   * @example
   * ```typescript
   * const kio = KIO.getRecord({ app: 1, id: 1 })
   *   .andThen((record) => {
   *     // Update the record content using the update method
   *     const updatedRecord = record.update({ title: "Updated Title" });
   *     return KIO.updateRecord({ record: updatedRecord });
   *   })
   *   .andThen(() => KIO.commit());
   * await kio.run(runner);
   * ```
   */
  static updateRecord<R extends KFields<R>>(args: {
    record: KRecord<R>;
  }): KIO<never, KRecord<R>> {
    return new KIO({
      kind: "UpdateRecord",
      ...args,
    });
  }

  /**
   * Updates multiple records in Kintone. The operations won't be executed until commit is called.
   * @template R - The record type
   * @param args - The arguments for updating the records
   * @returns An effect that will update the records when committed
   *
   * @example
   * ```typescript
   * const kio = KIO.getRecords({ app: 1 })
   *   .andThen((records) => {
   *     // Update the record content using the update method
   *     const updatedRecords = records.map(record =>
   *       record.update({ status: "Updated" })
   *     );
   *     return KIO.updateRecords({ records: updatedRecords });
   *   })
   *   .andThen(() => KIO.commit());
   * await kio.run(runner);
   * ```
   */
  static updateRecords<R extends KFields<R>>(args: {
    records: KRecord<R>[];
  }): KIO<never, KRecord<R>[]> {
    return new KIO({
      kind: "UpdateRecords",
      ...args,
    });
  }

  /**
   * Deletes a record from Kintone. The operation won't be executed until commit is called.
   * @template R - The record type
   * @param args - The arguments for deleting the record
   * @returns An effect that will delete the record when committed
   *
   * @example
   * ```typescript
   * const kio = KIO.deleteRecord({
   *   record: existingRecord
   * })
   *   .andThen(() => KIO.commit());
   * await kio.run(runner);
   * ```
   */
  static deleteRecord<R extends KFields<R>>(args: {
    record: KRecord<R>;
  }): KIO<never, void> {
    return new KIO({
      kind: "DeleteRecord",
      ...args,
    });
  }

  /**
   * Deletes multiple records from Kintone. The operations won't be executed until commit is called.
   * @template R - The record type
   * @param args - The arguments for deleting the records
   * @returns An effect that will delete the records when committed
   *
   * @example
   * ```typescript
   * const kio = KIO.deleteRecords({
   *   records: recordsToDelete
   * })
   *   .andThen(() => KIO.commit());
   * await kio.run(runner);
   * ```
   */
  static deleteRecords<R extends KFields<R>>(args: {
    records: KRecord<R>[];
  }): KIO<never, void> {
    return new KIO({
      kind: "DeleteRecords",
      ...args,
    });
  }

  /**
   * Commits all pending changes to Kintone. This is required to execute any add, update, or delete operations.
   * Multiple write operations can be stacked and will be executed together when commit is called.
   * @returns An effect that will commit all pending changes
   *
   * @example
   * ```typescript
   * // Stack multiple operations and commit them together
   * const kio = KIO.getRecord({ app: 1, id: 1 })
   *   .andThen((record) => KIO.updateRecord({ record: { ...record, title: "Updated" } }))
   *   .andThen(() => KIO.addRecord({ app: 1, record: { title: "New Record" } }))
   *   .andThen(() => KIO.deleteRecord({ record: anotherRecord }))
   *   .andThen(() => KIO.commit());
   * await kio.run(runner);
   * ```
   */
  static commit(): KIO<KError, void> {
    return new KIO({ kind: "Commit" });
  }

  [Symbol.iterator]: () => Iterator<KIO<E, A>, A> = function* (
    this: KIO<E, A>,
  ) {
    return yield this;
  };
}
