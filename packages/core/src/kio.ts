import { _KFields, KError, KFields, KNewRecord, KRecord } from "./data.ts";

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
  fields?: string[] | undefined;
  /** Optional query string to filter records */
  query?: string | undefined;
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
      fields?: string[] | undefined;
      query?: string | undefined;
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
 * Composable operations for interacting with Kintone records.
 *
 * - Operations can be chained together using `pipe()` and methods like `andThen()`, `map()`, and `catch()`.
 * - Write operations (add, update, delete) are batched and only saved to Kintone when `commit()` is called.
 * - If an operation fails or `fail()` is called before commit, no changes are made to your data. After commit succeeds, changes are permanent.
 *
 * @template E - The error type
 * @template A - The success value type
 *
 * @example Basic record operations with error handling
 * ```typescript
 * import { pipe } from "./pipe.ts";
 * import { runner } from "./runner.ts";
 *
 * const updateTask = pipe(
 *   KIO.getRecord({ app: 1, id: 1 }),
 *   KIO.andThen((record) =>
 *     KIO.updateRecord({
 *       record: record.update({
 *         title: "Updated Title",
 *         status: "In Progress"
 *       })
 *     })
 *   ),
 *   KIO.andThen(() => KIO.commit())
 * ).catch((error) => {
 *   console.error("Failed to update record:", error);
 *   return KIO.succeed({ error: error.message });
 * });
 *
 * const result = await runner.run(updateTask);
 * ```
 *
 * @example Batch operations
 * ```typescript
 * const batchOperations = pipe(
 *   KIO.getRecords({ app: 1, query: "status = \"Pending\"" }),
 *   KIO.andThen((records) => {
 *     const updates = records.map(record =>
 *       record.update({ status: "Processing" })
 *     );
 *     return KIO.updateRecords({ records: updates });
 *   }),
 *   KIO.andThen(() => KIO.addRecord({
 *     app: 1,
 *     record: { title: "Batch Complete", status: "Done" }
 *   })),
 *   KIO.andThen(() => KIO.commit())
 * );
 *
 * const batchResult = await runner.run(batchOperations);
 * ```
 *
 * @example Rollback behavior - queued operations are discarded on failure
 * ```typescript
 * const safeUpdate = pipe(
 *   KIO.getRecord({ app: 1, id: 1 }),
 *   KIO.andThen((record) => KIO.updateRecord({ record: record.update({ status: "Processing" }) })),
 *   KIO.andThen(() => KIO.addRecord({ app: 1, record: { title: "Log Entry" } })),
 *   KIO.andThen(() => {
 *     // Some validation that might fail
 *     if (Math.random() < 0.5) {
 *       return KIO.fail(new Error("Validation failed"));
 *     }
 *     return KIO.succeed(undefined);
 *   }),
 *   KIO.andThen(() => KIO.commit()) // If validation fails, no changes will be made to Kintone
 * );
 * ```
 */
export class KIO<E, A> {
  readonly kioa: KIOA<E, A>;

  /** @private */
  private constructor(kioa: KIOA<E, A>) {
    this.kioa = kioa;
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
  andThen<E1, B>(f: (a: A) => KIO<E1, B>): KIO<E | E1, B> {
    return KIO.andThen(f)(this);
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
  map<B>(f: (a: A) => B): KIO<E, B> {
    return KIO.map(f)(this);
  }

  /**
   * Retries a KIO operation the specified number of times on failure.
   * @param times - The number of times to retry
   * @returns An effect that will retry on failure the specified number of times
   *
   * @example
   * ```typescript
   * const kio = KIO.getRecord({ app: 1, id: 1 })
   *   .retryN(3);
   * ```
   */
  retryN(times: number): KIO<E, A> {
    const loop = (n: number): KIO<E, A> => {
      return this.catch((e) => (n === 0 ? KIO.fail(e) : loop(n - 1)));
    };
    return loop(times);
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
   *   const record1 = yield *KIO.getRecord({ app: 1, id: 1 });
   *   const record2 = yield *KIO.getRecord({ app: 1, id: 2 });
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
    return loop(f());
  }

  /**
   * Gets a single record from Kintone.
   * @template R - The record type
   * @param args - The arguments for getting the record
   * @returns An effect that will get the record
   *
   * @example
   * ```typescript
   * import { pipe } from "./pipe.ts";
   *
   * const kio = KIO.getRecord({ app: 1, id: 1 });
   * const record = await runner.run(kio);
   *
   * // Or with transformation
   * const result = pipe(
   *   KIO.getRecord({ app: 1, id: 1 }),
   *   KIO.map((record) => record.fields)
   * );
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
   * import { pipe } from "./pipe.ts";
   *
   * const kio = KIO.getRecords({
   *   app: 1,
   *   query: "title = \"Example\"",
   *   fields: ["title", "description"]
   * });
   * const records = await runner.run(kio);
   *
   * // Or with processing
   * const result = pipe(
   *   KIO.getRecords({ app: 1 }),
   *   KIO.map((records) => records.length)
   * );
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
   * import { pipe } from "./pipe.ts";
   *
   * const kio = pipe(
   *   KIO.addRecord({
   *     app: 1,
   *     record: { title: "New Record", description: "Example" }
   *   }),
   *   KIO.andThen(() => KIO.commit())
   * );
   * await runner.run(kio);
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
   * import { pipe } from "./pipe.ts";
   *
   * const kio = pipe(
   *   KIO.addRecords({
   *     app: 1,
   *     records: [
   *       { title: "First Record", description: "Example 1" },
   *       { title: "Second Record", description: "Example 2" }
   *     ]
   *   }),
   *   KIO.andThen(() => KIO.commit())
   * );
   * await runner.run(kio);
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
   * import { pipe } from "./pipe.ts";
   *
   * const kio = pipe(
   *   KIO.getRecord({ app: 1, id: 1 }),
   *   KIO.andThen((record) => {
   *     // Update the record content using the update method
   *     const updatedRecord = record.update({ title: "Updated Title" });
   *     return KIO.updateRecord({ record: updatedRecord });
   *   }),
   *   KIO.andThen(() => KIO.commit())
   * );
   * await runner.run(kio);
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
   * import { pipe } from "./pipe.ts";
   *
   * const kio = pipe(
   *   KIO.getRecords({ app: 1 }),
   *   KIO.andThen((records) => {
   *     // Update the record content using the update method
   *     const updatedRecords = records.map(record =>
   *       record.update({ status: "Updated" })
   *     );
   *     return KIO.updateRecords({ records: updatedRecords });
   *   }),
   *   KIO.andThen(() => KIO.commit())
   * );
   * await runner.run(kio);
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
   * import { pipe } from "./pipe.ts";
   *
   * const kio = pipe(
   *   KIO.deleteRecord({
   *     record: existingRecord
   *   }),
   *   KIO.andThen(() => KIO.commit())
   * );
   * await runner.run(kio);
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
   * import { pipe } from "./pipe.ts";
   *
   * const kio = pipe(
   *   KIO.deleteRecords({
   *     records: recordsToDelete
   *   }),
   *   KIO.andThen(() => KIO.commit())
   * );
   * await runner.run(kio);
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
   * import { pipe } from "./pipe.ts";
   *
   * // Stack multiple operations and commit them together
   * const kio = pipe(
   *   KIO.getRecord({ app: 1, id: 1 }),
   *   KIO.andThen((record) => KIO.updateRecord({ record: record.update({ title: "Updated" }) })),
   *   KIO.andThen(() => KIO.addRecord({ app: 1, record: { title: "New Record" } })),
   *   KIO.andThen(() => KIO.deleteRecord({ record: anotherRecord })),
   *   KIO.andThen(() => KIO.commit())
   * );
   * await runner.run(kio);
   * ```
   */
  static commit(): KIO<KError, void> {
    return new KIO({ kind: "Commit" });
  }

  /**
   * Transforms the result of a KIO operation.
   * @template E - The error type
   * @template A - The input type
   * @template B - The output type
   * @param f - Function to transform the result
   * @returns A function that can be used in pipe
   *
   * @example
   * ```typescript
   * const result = pipe(
   *   KIO.succeed(1),
   *   KIO.map((a) => a + 1),
   *   KIO.map((a) => a * 2)
   * );
   * ```
   */
  static map<A, B>(f: (a: A) => B) {
    return <E>(kio: KIO<E, A>): KIO<E, B> =>
      new KIO({
        kind: "AndThen",
        self: kio.kioa,
        f: (a) => KIO.succeed(f(a as A)).kioa,
      });
  }

  /**
   * Chains KIO operations together.
   * @template E - The input error type
   * @template A - The input type
   * @template E1 - The output error type
   * @template B - The output type
   * @param f - Function to transform the result into a new KIO operation
   * @returns A function that can be used in pipe
   *
   * @example
   * ```typescript
   * const result = pipe(
   *   KIO.succeed(1),
   *   KIO.andThen((a) => KIO.succeed(a + 1)),
   *   KIO.andThen((a) => KIO.succeed(a * 2))
   * );
   * ```
   */
  static andThen<A, E1, B>(
    f: (a: A) => KIO<E1, B>,
  ): <E>(kio: KIO<E, A>) => KIO<E | E1, B>;
  static andThen<N extends string, A, E1, B>(
    name: Exclude<N, keyof A>,
    f: (a: A) => KIO<E1, B>,
  ): <E>(
    kio: KIO<E, A>,
  ) => KIO<
    E | E1,
    { readonly [K in keyof A | N]: K extends keyof A ? A[K] : B }
  >;
  static andThen<N extends string, A, E1, B>(
    nameOrF: Exclude<N, keyof A> | ((a: A) => KIO<E1, B>),
    f?: (a: A) => KIO<E1, B>,
  ) {
    if (typeof nameOrF === "string" && f) {
      const name = nameOrF;
      return <E>(kio: KIO<E, A>) =>
        new KIO({
          kind: "AndThen",
          self: kio.kioa,
          f: (a) => f(a as A).map((b) => ({ ...(a as any), [name]: b })).kioa,
        });
    } else {
      const fn = nameOrF as (a: A) => KIO<E1, B>;
      return <E>(kio: KIO<E, A>): KIO<E | E1, B> =>
        new KIO({
          kind: "AndThen",
          self: kio.kioa,
          f: (a) => fn(a as A).kioa,
        });
    }
  }

  [Symbol.iterator]: () => Iterator<KIO<E, A>, A> = function* (
    this: KIO<E, A>,
  ) {
    return yield this;
  };
}
