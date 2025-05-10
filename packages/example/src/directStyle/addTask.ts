import TaskRegistrationStatus = kintone.types.TaskRegistrationStatus;
import { KIO } from "@kio/core";

export const addTask = (taskName: string) =>
  KIO.gen(function* () {
    const now = new Date();
    const startsAt = new Date("2025-03-30T07:00:00Z");
    const endsAt = new Date("2025-03-30T08:00:00Z");

    console.log(`Adding task: ${taskName}`);

    const statuses = yield *KIO.getRecords<TaskRegistrationStatus>({
      app: process.env.TASK_REG_STATUS_APP_ID ?? "",
    });
    const status = statuses[0];
    yield *KIO.updateRecord({
      record: status.update((status) => ({
        ...status,
        lastUpdatedAt: { value: now.toISOString() },
      })),
    });

    const existingTasks = yield *KIO.getRecords({
      app: process.env.TASK_APP_ID ?? "",
      query: `endsAt > "${startsAt.toISOString()}" and startsAt < "${endsAt.toISOString()}"`,
    });

    if (existingTasks.length === 0) {
      yield *KIO.addRecord({
        app: process.env.TASK_APP_ID ?? "",
        record: {
          taskName: { value: taskName },
          startsAt: { value: startsAt.toISOString() },
          endsAt: { value: endsAt.toISOString() },
        },
      });
    } else {
      yield *KIO.fail("There is a task that overlaps with the specified time.");
    }

    yield *KIO.commit();

    return;
  });
