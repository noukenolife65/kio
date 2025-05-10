import { KintoneRestAPIClient } from "@kintone/rest-api-client";
import { addTask } from "./directStyle/addTask.ts";
import { createRunner, KIO } from "@kio/core";

const client = new KintoneRestAPIClient({
  baseUrl: process.env.KINTONE_BASE_URL,
  auth: {
    apiToken: [
      process.env.TASK_APP_TOKEN,
      process.env.TASK_REG_STATUS_APP_TOKEN,
    ],
  },
});
const runner = createRunner(client);

const action = (taskName: string) =>
  addTask(taskName).retry({ kind: "Recurs", times: 2 });

const result = await Promise.all([
  runner.run(action("Task 1").catch((e) => KIO.succeed(e))),
  runner.run(action("Task 2").catch((e) => KIO.succeed(e))),
  runner.run(action("Task 3").catch((e) => KIO.succeed(e))),
]);

console.log(result);
