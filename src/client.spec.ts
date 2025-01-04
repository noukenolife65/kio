import { describe, it } from "vitest";
import { KintoneClientImpl } from "./client.ts";
import { KintoneRestAPIClient } from "@kintone/rest-api-client";

describe("KintoneClientImpl", () => {
  const client = new KintoneClientImpl(
    new KintoneRestAPIClient({
      baseUrl: process.env.KINTONE_BASE_URL,
      auth: {
        apiToken: process.env.KINTONE_API_TOKEN,
      },
    }),
  );

  it("getRecords", async () => {
    const result = await client.getRecords({
      app: 1,
      fields: ["test"],
      totalCount: true,
    });
    console.log(result);
  });
});
