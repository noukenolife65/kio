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
 * Arguments for getting a single record from kintone
 */
type GetRecordArgs = {
  /** The app ID */
  app: number | string;
  /** The record ID */
  id: number | string;
};

/**
 * Arguments for getting multiple records from kintone
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
      name?: string;
      self: KIOA<unknown, unknown>;
      f: (a: unknown, s: unknown) => KIOA<E, A>;
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
      success: (a: unknown, s: unknown) => KIOA<E, A>;
      failure: (e: unknown, s: unknown) => KIOA<E, A>;
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
 * A functional programming interface for kintone operations.
 * @template S - The state type
 * @template E - The error type
 * @template A - The success value type
 *
 * @example
 * ```typescript
 * // Basic usage
 * const kio = KIO.getRecord({ app: 1, id: 1 })
 *   .andThen("record", (record) => KIO.updateRecord({ record: { ...record, title: "Updated" } }));
 * 
 * const result = await runner.run(kio);
 * ```
 */
export class KIO<S extends object, E, A> {
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
  static start(): KIO<object, never, void> {
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
  static succeed<A>(a: A): KIO<object, never, A> {
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
  static fail<E>(e: E): KIO<object, E, never> {
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
  static async<A>(f: () => Promise<A>): KIO<object, never, A> {
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
    success: (a: A, s: S) => KIO<object, E1, B>,
    failure: (e: E, s: S) => KIO<object, E1, B>,
  ): KIO<S, E1, B> {
    return new KIO({
      kind: "Fold",
      self: this.kioa,
      success: (a, s) => success(a as A, s as S).kioa,
      failure: (e, s) => failure(e as E, s as S).kioa,
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
  catch<E1, B>(f: (e: E, s: S) => KIO<object, E1, B>): KIO<S, E1, A | B> {
    return this.fold<E1, A | B>((a) => KIO.succeed(a), f);
  }

  /**
   * Chains KIO operations together, with optional naming of intermediate results.
   * @template S1 - The new state type
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
  andThen<S1 extends object, E1, B>(
    f: (a: A, s: S) => KIO<S1, E1, B>,
  ): KIO<S, E | E1, B>;
  /**
   * Chains KIO operations together, with optional naming of intermediate results.
   * @template N - The name type for the intermediate result
   * @template S1 - The new state type
   * @template E1 - The new error type
   * @template B - The new success value type
   * @param name - The name to give to the intermediate result
   * @param f - Function to transform the current result into a new KIO operation
   * @returns An effect that chains the operations and names the intermediate result
   *
   * @example
   * ```typescript
   * const kio = KIO.succeed(1)
   *   .andThen("x", (a) => KIO.succeed(a + 1))
   *   .andThen("y", (a, s) => KIO.succeed(s.x + 1));
   * ```
   */
  andThen<N extends string, S1 extends object, E1, B>(
    name: N,
    f: (a: A, s: S) => KIO<S1, E1, B>,
  ): KIO<S & KIOS<N, B>, E | E1, B>;
  andThen<N extends string, S1 extends object, E1, B>(
    nameOrF: N | ((a: A, s: S) => KIO<S1, E1, B>),
    f?: (a: A, s: S) => KIO<S1, E1, B>,
  ): KIO<S, E | E1, B> | KIO<S & KIOS<N, B>, E | E1, B> {
    if (arguments.length === 1 && typeof nameOrF === "function") {
      return new KIO({
        kind: "AndThen",
        self: this.kioa,
        f: (a, s) => nameOrF(a as A, s as S).kioa,
      });
    } else if (arguments.length === 2 && typeof nameOrF === "string") {
      return new KIO({
        kind: "AndThen",
        name: nameOrF,
        self: this.kioa,
        f: (a, s) => f!(a as A, s as S).kioa,
      });
    } else {
      throw new Error("Invalid arguments");
    }
  }

  /**
   * Transforms the result of a KIO operation, with optional naming of the result.
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
  map<B>(f: (a: A, s: S) => B): KIO<S, E, B>;
  /**
   * Transforms the result of a KIO operation, with optional naming of the result.
   * @template N - The name type for the result
   * @template B - The new success value type
   * @param name - The name to give to the result
   * @param f - Function to transform the current result
   * @returns An effect with the named and transformed result
   *
   * @example
   * ```typescript
   * const kio = KIO.succeed(1)
   *   .map("x", (a) => a + 1)
   *   .map("y", (a, s) => s.x + 1);
   * ```
   */
  map<N extends string, B>(
    name: N,
    f: (a: A, s: S) => B,
  ): KIO<S & KIOS<N, B>, E, B>;
  map<N extends string, B>(
    nameOrF: N | ((a: A, s: S) => B),
    f?: (a: A, s: S) => B,
  ): KIO<S, E, B> | KIO<S & KIOS<N, B>, E, B> {
    if (arguments.length === 1 && typeof nameOrF === "function") {
      return this.andThen((a, s) => {
        return new KIO({ kind: "Succeed", value: nameOrF(a, s) });
      });
    } else if (arguments.length === 2 && typeof nameOrF === "string") {
      return this.andThen(nameOrF, (a, s) => {
        return new KIO({ kind: "Succeed", value: f!(a, s) });
      });
    } else {
      throw new Error("Invalid arguments");
    }
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
  retry(policy: RetryPolicy): KIO<S, E, A> {
    return (() => {
      switch (policy.kind) {
        case "Recurs": {
          const { times } = policy;
          const loop = (n: number): KIO<S, E, A> => {
            return this.catch((e) => (n === 0 ? KIO.fail(e) : loop(n - 1)));
          };
          return loop(times);
        }
      }
    })();
  }

  /**
   * Gets a single record from kintone.
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
  ): KIO<object, KError, KRecord<R>> {
    return new KIO({ kind: "GetRecord", ...args });
  }

  /**
   * Gets multiple records from kintone.
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
  ): KIO<object, KError, KRecord<R>[]> {
    return new KIO({ kind: "GetRecords", ...args });
  }

  /**
   * Adds a new record to kintone. The operation won't be executed until commit is called.
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
  }): KIO<object, never, void> {
    const { app, record } = args;
    const kRecord = new KNewRecord(record, app);
    return new KIO({
      kind: "AddRecord",
      record: kRecord,
    });
  }

  /**
   * Adds multiple records to kintone. The operations won't be executed until commit is called.
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
  }): KIO<object, never, void> {
    const { app, records } = args;
    const kNewRecords = records.map((record) => new KNewRecord(record, app));
    return new KIO({
      kind: "AddRecords",
      records: kNewRecords,
    });
  }

  /**
   * Updates an existing record in kintone. The operation won't be executed until commit is called.
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
  }): KIO<object, never, KRecord<R>> {
    return new KIO({
      kind: "UpdateRecord",
      ...args,
    });
  }

  /**
   * Updates multiple records in kintone. The operations won't be executed until commit is called.
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
  }): KIO<object, never, KRecord<R>[]> {
    return new KIO({
      kind: "UpdateRecords",
      ...args,
    });
  }

  /**
   * Deletes a record from kintone. The operation won't be executed until commit is called.
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
  }): KIO<object, never, void> {
    return new KIO({
      kind: "DeleteRecord",
      ...args,
    });
  }

  /**
   * Deletes multiple records from kintone. The operations won't be executed until commit is called.
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
  }): KIO<object, never, void> {
    return new KIO({
      kind: "DeleteRecords",
      ...args,
    });
  }

  /**
   * Commits all pending changes to kintone. This is required to execute any add, update, or delete operations.
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
  static commit(): KIO<object, KError, void> {
    return new KIO({ kind: "Commit" });
  }
}
