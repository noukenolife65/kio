import TaskRegistrationStatus = kintone.types.TaskRegistrationStatus;
import { KIO, pipe } from "@kio/core";

export const addTask = (taskName: string) => {
  const now = new Date();
  const startsAt = new Date("2025-03-30T07:00:00Z");
  const endsAt = new Date("2025-03-30T08:00:00Z");

  return pipe(
    KIO.async(async () => console.log(`Adding task: ${taskName}`)),
    KIO.andThen(() =>
      KIO.getRecords<TaskRegistrationStatus>({
        app: process.env.TASK_REG_STATUS_APP_ID ?? "",
      }),
    ),
    KIO.andThen((records) => {
      const record = records[0];
      return KIO.updateRecord({
        record: record.update((record) => {
          return {
            ...record,
            lastUpdatedAt: { value: now.toISOString() },
          };
        }),
      });
    }),
    KIO.andThen(() =>
      KIO.getRecords({
        app: process.env.TASK_APP_ID ?? "",
        query: `endsAt > "${startsAt.toISOString()}" and startsAt < "${endsAt.toISOString()}"`,
      }),
    ),
    KIO.andThen((records) => {
      if (records.length === 0) {
        return KIO.addRecord({
          app: process.env.TASK_APP_ID ?? "",
          record: {
            taskName: { value: taskName },
            startsAt: { value: startsAt.toISOString() },
            endsAt: { value: endsAt.toISOString() },
          },
        });
      } else {
        return KIO.fail(
          "There is a task that overlaps with the specified time.",
        );
      }
    }),
    KIO.andThen(() => KIO.commit())
  );
};