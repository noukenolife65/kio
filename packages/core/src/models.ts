import * as v from "valibot";

/** App ID */
export const AppID = v.union([
  v.pipe(v.number(), v.integer()),
  v.pipe(v.string(), v.digits()),
]);
export type AppID = v.InferOutput<typeof AppID>;

/** Record ID */
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

export type KFields<T> = {
  [K in keyof T]: T[K] extends {
    type?: string | undefined;
    value: unknown;
  }
    ? T[K]
    : never;
};
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
  app: AppID;
  value: R;
};
const _KNewRecordConstructor = v.object({
  app: AppID,
  value: KAnyFields,
}) satisfies v.GenericSchema<KNewRecordConstructor<KAnyFields>>;
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
  app: AppID;
  id: RecordID;
  value: R;
  revision: Revision | undefined;
};
const _KRecordConstructor = v.object({
  app: AppID,
  id: RecordID,
  value: KAnyFields,
  revision: v.undefinedable(Revision),
}) satisfies v.GenericSchema<KRecordConstructor<KAnyFields>>;
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
 * Arguments for getting a single record from Kintone
 */
export const GetRecordArgs = v.object({
  /** The app ID */
  app: AppID,
  /** The record ID */
  id: RecordID,
});
export type GetRecordArgs = v.InferOutput<typeof GetRecordArgs>;

/**
 * Arguments for getting multiple records from Kintone
 */
export const GetRecordsArgs = v.object({
  /** The app ID */
  app: AppID,
  /** Optional list of field codes to retrieve */
  fields: v.optional(v.array(v.pipe(v.string(), v.minLength(1)))),
  /** Optional query string to filter records */
  query: v.optional(v.string()),
});
export type GetRecordsArgs = v.InferOutput<typeof GetRecordsArgs>;

/**
 * Arguments for adding a single record
 */
export type AddRecordArgs<R extends KFields<R>> = { app: AppID; record: R };
export const _AddRecordArgs = v.object({
  app: AppID,
  record: KAnyFields,
}) satisfies v.GenericSchema<AddRecordArgs<KAnyFields>>;

/**
 * Arguments for adding multiple records
 */
export type AddRecordsArgs<R extends KFields<R>> = { app: AppID; records: R[] };
export const _AddRecordsArgs = v.object({
  app: AppID,
  records: v.pipe(v.array(KAnyFields), v.minLength(1)),
}) satisfies v.GenericSchema<AddRecordsArgs<KAnyFields>>;

/**
 * Arguments for updating a single record
 */
export type UpdateRecordArgs<R extends KFields<R>> = {
  record: KRecord<R>;
};
export const _UpdateRecordArgs = v.object({
  record: v.instance(KRecord<KAnyFields>),
});

/**
 * Arguments for updating multiple records
 */
export type UpdateRecordsArgs<R extends KFields<R>> = {
  records: KRecord<R>[];
};
export const _UpdateRecordsArgs = v.object({
  records: v.pipe(v.array(v.instance(KRecord<KAnyFields>)), v.minLength(1)),
});

/**
 * Arguments for deleting a single record
 */
export type DeleteRecordArgs<R extends KFields<R>> = {
  record: KRecord<R>;
};
export const _DeleteRecordArgs = v.object({
  record: v.instance(KRecord<KAnyFields>),
});

/**
 * Arguments for deleting multiple records
 */
export type DeleteRecordsArgs<R extends KFields<R>> = {
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

export const validateKRecord = (record: unknown): void => {
  if (!(record instanceof KRecord)) {
    throw new ValidationError("must be a KRecord instance");
  }
};
