import {
  KAnyFields,
  KError,
  KFields,
  KNewRecord,
  KRecord,
  GetRecordArgs,
  GetRecordsArgs,
  AddRecordArgs,
  AddRecordsArgs,
  _UpdateRecordArgs,
  _UpdateRecordsArgs,
  DeleteRecordArgs,
  _DeleteRecordArgs,
  DeleteRecordsArgs,
  _DeleteRecordsArgs,
  validate,
  _AddRecordArgs,
  _AddRecordsArgs,
  UpdateRecordArgs,
  UpdateRecordsArgs,
} from "./models.ts";

/**
 * Represents all possible KIO operations.
 * @template E - Failure type
 * @template A - Success type
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
      record: KNewRecord<KAnyFields>;
    }
  | {
      kind: "AddRecords";
      records: KNewRecord<KAnyFields>[];
    }
  | {
      kind: "UpdateRecord";
      record: KRecord<KAnyFields>;
    }
  | {
      kind: "UpdateRecords";
      records: KRecord<KAnyFields>[];
    }
  | {
      kind: "DeleteRecord";
      record: KRecord<KAnyFields>;
    }
  | {
      kind: "DeleteRecords";
      records: KRecord<KAnyFields>[];
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
 * @template E - Failure type
 * @template A - Success type
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
   * Creates a successful effect with a value.
   * @template A - Success type
   * @param a - Success value
   * @returns Effect that succeeds with the given value
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
   * Creates a failed effect with an error.
   * @template E - Failure type
   * @param e - Error value
   * @returns Effect that fails with the given error
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
   * @template A - Success type
   * @param f - Async function to execute
   * @returns Effect that succeeds with the async function result
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
   * Handles both success and failure cases.
   * @template E1 - New failure type
   * @template B - New success type
   * @param success - Function to handle success case
   * @param failure - Function to handle failure case
   * @returns Effect that transforms both success and failure cases into a new result
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
    failure: (e: E) => KIO<E1, B>
  ): KIO<E1, B> {
    return new KIO({
      kind: "Fold",
      self: this.kioa,
      success: (a) => success(a as A).kioa,
      failure: (e) => failure(e as E).kioa,
    });
  }

  /**
   * Handles the failure case.
   * @template E1 - New failure type
   * @template B - New success type
   * @param f - Function to handle the error
   * @returns Effect that handles failures
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
   * Chains effects sequentially based on current result.
   * @template E1 - New failure type
   * @template B - New success type
   * @param f - Function that returns the next effect
   * @returns Chained effect
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
   * Transforms the current result using the given function.
   * @template B - New success type
   * @param f - Function to transform the current result
   * @returns Effect that succeeds with the transformed result
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
   * Retries the effect the specified number of times on failure.
   * @param times - Number of times to retry
   * @returns Effect that succeeds on any attempt or fails after all attempts
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
   * Creates an effect from a generator function. Allows writing effects in direct style using yield.
   * @template K - Effects yielded by the generator
   * @template A - Final value type
   * @param f - Generator function that yields effects
   * @returns Effect built with the given generator function
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
    f: () => Generator<K, A>
  ): KIO<K extends KIO<infer E, any> ? E : never, A> {
    const loop = (
      itr: Generator<K, A>,
      a?: any
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
   * TODO: Start working on this doc.
   *
   * Gets a single record.
   * @template R - Record type
   * @param args - Arguments for getting the record
   * @returns Effect that succeeds with the record or fails with error
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
    args: GetRecordArgs
  ): KIO<KError, KRecord<R>> {
    validate(GetRecordArgs, args);
    return new KIO({ kind: "GetRecord", ...args });
  }

  /**
   * Gets multiple records.
   * @template R - Record type
   * @param args - Arguments for getting the records
   * @returns Effect that succeeds with the records or fails with error
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
    args: GetRecordsArgs
  ): KIO<KError, KRecord<R>[]> {
    validate(GetRecordsArgs, args);
    return new KIO({ kind: "GetRecords", ...args });
  }

  /**
   * Adds a new record. Won't be executed until commit is called.
   * @template R - Record type
   * @param args - Arguments for adding the record
   * @returns Effect that succeeds immediately (actual add happens at commit)
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
  static addRecord<R extends KFields<R>>(
    args: AddRecordArgs<R>
  ): KIO<never, void> {
    validate(_AddRecordArgs, args);
    const { app, record } = args;
    const kRecord = new KNewRecord({
      app,
      value: record,
    });
    return new KIO({
      kind: "AddRecord",
      record: kRecord,
    });
  }

  /**
   * Adds multiple records. Won't be executed until commit is called.
   * @template R - Record type
   * @param args - Arguments for adding the records
   * @returns Effect that succeeds immediately (actual add happens at commit)
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
  static addRecords<R extends KFields<R>>(
    args: AddRecordsArgs<R>
  ): KIO<never, void> {
    validate(_AddRecordsArgs, args);
    const { app, records } = args;
    const kNewRecords = records.map(
      (record) =>
        new KNewRecord({
          app,
          value: record,
        })
    );
    return new KIO({
      kind: "AddRecords",
      records: kNewRecords,
    });
  }

  /**
   * Updates an existing record. Won't be executed until commit is called.
   * @template R - Record type
   * @param args - Arguments for updating the record
   * @returns Effect that succeeds with updated record (actual update happens at commit)
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
  static updateRecord<R extends KFields<R>>(
    args: UpdateRecordArgs<R>
  ): KIO<never, KRecord<R>> {
    validate(_UpdateRecordArgs, args);
    return new KIO({
      kind: "UpdateRecord",
      ...args,
    });
  }

  /**
   * Updates multiple records. Won't be executed until commit is called.
   * @template R - Record type
   * @param args - Arguments for updating the records
   * @returns Effect that succeeds with updated records (actual update happens at commit)
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
  static updateRecords<R extends KFields<R>>(
    args: UpdateRecordsArgs<R>
  ): KIO<never, KRecord<R>[]> {
    validate(_UpdateRecordsArgs, args);
    return new KIO({
      kind: "UpdateRecords",
      ...args,
    });
  }

  /**
   * Deletes a record. Won't be executed until commit is called.
   * @template R - Record type
   * @param args - Arguments for deleting the record
   * @returns Effect that succeeds immediately (actual delete happens at commit)
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
  static deleteRecord<R extends KFields<R>>(
    args: DeleteRecordArgs<R>
  ): KIO<never, void> {
    validate(_DeleteRecordArgs, args);
    return new KIO({
      kind: "DeleteRecord",
      ...args,
    });
  }

  /**
   * Deletes multiple records. Won't be executed until commit is called.
   * @template R - Record type
   * @param args - Arguments for deleting the records
   * @returns Effect that succeeds immediately (actual delete happens at commit)
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
  static deleteRecords<R extends KFields<R>>(
    args: DeleteRecordsArgs<R>
  ): KIO<never, void> {
    validate(_DeleteRecordsArgs, args);
    return new KIO({
      kind: "DeleteRecords",
      ...args,
    });
  }

  /**
   * Commits all pending changes. Required to execute any add, update, or delete operations.
   * Multiple write operations can be stacked and executed together when commit is called.
   * @returns Effect that succeeds when all changes are committed or fails with error
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
   * Transforms the current result using the given function.
   * @template E - Failure type
   * @template A - Input type
   * @template B - Output type
   * @param f - Function to transform the result
   * @returns Function that creates an effect succeeding with the transformed result
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
   * Chains effects sequentially based on current result.
   * @template E - Input failure type
   * @template A - Input type
   * @template E1 - Output failure type
   * @template B - Output type
   * @param f - Function that returns the next effect
   * @returns Function that creates chained effect
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
    f: (a: A) => KIO<E1, B>
  ): <E>(kio: KIO<E, A>) => KIO<E | E1, B>;
  static andThen<N extends string, A, E1, B>(
    name: Exclude<N, keyof A>,
    f: (a: A) => KIO<E1, B>
  ): <E>(
    kio: KIO<E, A>
  ) => KIO<
    E | E1,
    { readonly [K in keyof A | N]: K extends keyof A ? A[K] : B }
  >;
  static andThen<N extends string, A, E1, B>(
    nameOrF: Exclude<N, keyof A> | ((a: A) => KIO<E1, B>),
    f?: (a: A) => KIO<E1, B>
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
    this: KIO<E, A>
  ) {
    return yield this;
  };
}
