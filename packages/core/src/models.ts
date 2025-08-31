import * as v from "valibot";

export const AppID = v.union([
  v.pipe(v.number(), v.integer()),
  v.pipe(v.string(), v.digits()),
]);
export type AppID = v.InferOutput<typeof AppID>;

export const RecordID = v.union([
  v.pipe(v.number(), v.integer()),
  v.pipe(v.string(), v.digits()),
]);
export type RecordID = v.InferOutput<typeof RecordID>;

export const Revision = v.union([
  v.pipe(v.number(), v.integer()),
  v.pipe(v.string(), v.digits()),
]);
export type Revision = v.InferOutput<typeof Revision>;

/**
 * Type constraint for Kintone field objects.
 * @template T - Record type, typically generated with @kintone/dts-gen
 */
export type KFields<T> = {
  [K in keyof T]: T[K] extends {
    type?: string | undefined;
    value: unknown;
  }
    ? T[K]
    : never;
};

/**
 * Generic Kintone field objects.
 */
export const KAnyFields = v.record(
  v.string(),
  v.object({
    type: v.optional(v.string()),
    value: v.unknown(),
  })
);
export type KAnyFields = v.InferOutput<typeof KAnyFields>;

export type KIdField = { $id: { value: AppID } };
export type KRevisionField = { $revision: { value: Revision } };

export type KNewRecordConstructor<R extends KFields<R>> = {
  /** App ID */
  app: AppID;
  /** Field objects for the record */
  value: R;
};
const _KNewRecordConstructor = v.object({
  app: AppID,
  value: KAnyFields,
}) satisfies v.GenericSchema<KNewRecordConstructor<KAnyFields>>;

/**
 * New record not yet saved to Kintone.
 * @template R - Record type
 */
export class KNewRecord<R extends KFields<R>> {
  readonly kind: "KNewRecord" = "KNewRecord" as const;
  readonly value: R;
  readonly app: AppID;
  constructor(args: KNewRecordConstructor<R>) {
    validate(_KNewRecordConstructor, args);
    this.value = args.value;
    this.app = args.app;
  }

  update(f: (value: R) => R): KNewRecord<R> {
    return new KNewRecord({
      app: this.app,
      value: f(this.value),
    });
  }
}

export type KRecordConstructor<R extends KFields<R>> = {
  /** App ID */
  app: AppID;
  /** Record ID */
  id: RecordID;
  /** Field objects for the record */
  value: R;
  /** Record revision for optimistic locking */
  revision: Revision | undefined;
};
const _KRecordConstructor = v.object({
  app: AppID,
  id: RecordID,
  value: KAnyFields,
  revision: v.undefinedable(Revision),
}) satisfies v.GenericSchema<KRecordConstructor<KAnyFields>>;

/**
 * Existing record saved to Kintone.
 * @template R - Record type
 */
export class KRecord<R extends KFields<R>> {
  readonly kind: "KRecord" = "KRecord" as const;
  readonly value: R;
  readonly app: AppID;
  readonly id: RecordID;
  readonly revision: Revision | undefined;
  constructor(args: KRecordConstructor<R>) {
    validate(_KRecordConstructor, args);
    this.value = args.value;
    this.app = args.app;
    this.id = args.id;
    this.revision = args.revision;
  }

  update(f: (value: R) => R): KRecord<R> {
    return new KRecord({
      app: this.app,
      id: this.id,
      value: f(this.value),
      revision: this.revision,
    });
  }
}

export type KError = {
  id: string;
  code: string;
  message: string;
};

/**
 * Get single record arguments
 * @inline
 */
export const GetRecordArgs = v.object({
  /** App ID */
  app: AppID,
  /** Record ID */
  id: RecordID,
});
export type GetRecordArgs = v.InferOutput<typeof GetRecordArgs>;

/**
 * Get multiple records arguments
 * @inline
 */
export const GetRecordsArgs = v.object({
  /** App ID */
  app: AppID,
  /** Optional field codes to retrieve */
  fields: v.optional(v.array(v.pipe(v.string(), v.minLength(1)))),
  /** Optional query string to filter records */
  query: v.optional(v.string()),
});
export type GetRecordsArgs = v.InferOutput<typeof GetRecordsArgs>;

/**
 * Add single record arguments
 * @template R - Record type
 * @inline
 */
export type AddRecordArgs<R extends KFields<R>> = {
  /** App ID */
  app: AppID;
  /** Field objects for the new record */
  record: R;
};
export const _AddRecordArgs = v.object({
  app: AppID,
  record: KAnyFields,
}) satisfies v.GenericSchema<AddRecordArgs<KAnyFields>>;

/**
 * Add multiple records arguments
 * @template R - Record type
 * @inline
 */
export type AddRecordsArgs<R extends KFields<R>> = {
  /** App ID */
  app: AppID;
  /** Array of field objects for the new records */
  records: R[];
};
export const _AddRecordsArgs = v.object({
  app: AppID,
  records: v.pipe(v.array(KAnyFields), v.minLength(1)),
}) satisfies v.GenericSchema<AddRecordsArgs<KAnyFields>>;

/**
 * Update single record arguments
 * @template R - Record type
 * @inline
 */
export type UpdateRecordArgs<R extends KFields<R>> = {
  /** KRecord instance to update */
  record: KRecord<R>;
};
export const _UpdateRecordArgs = v.object({
  record: v.instance(KRecord<KAnyFields>),
});

/**
 * Update multiple records arguments
 * @template R - Record type
 * @inline
 */
export type UpdateRecordsArgs<R extends KFields<R>> = {
  /** Array of KRecord instances to update */
  records: KRecord<R>[];
};
export const _UpdateRecordsArgs = v.object({
  records: v.pipe(v.array(v.instance(KRecord<KAnyFields>)), v.minLength(1)),
});

/**
 * Delete single record arguments
 * @template R - Record type
 * @inline
 */
export type DeleteRecordArgs<R extends KFields<R>> = {
  /** KRecord instance to delete */
  record: KRecord<R>;
};
export const _DeleteRecordArgs = v.object({
  record: v.instance(KRecord<KAnyFields>),
});

/**
 * Delete multiple records arguments
 * @template R - Record type
 * @inline
 */
export type DeleteRecordsArgs<R extends KFields<R>> = {
  /** Array of KRecord instances to delete */
  records: KRecord<R>[];
};
export const _DeleteRecordsArgs = v.object({
  records: v.pipe(v.array(v.instance(KRecord<KAnyFields>)), v.minLength(1)),
});

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export const validate = <
  S extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
>(
  schema: S,
  input: unknown
) => {
  try {
    return v.parse(schema, input);
  } catch (e) {
    if (e instanceof v.ValiError) {
      throw new ValidationError(e.message);
    } else {
      throw e;
    }
  }
};
