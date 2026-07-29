import {
  readTextResponseWithinLimit,
  TextResponseReadError,
} from "@/lib/azure-devops/text-response";

describe("Azure DevOps text responses", () => {
  it("throws when a response body is interrupted", async () => {
    const response = new Response(
      new ReadableStream({
        pull(controller) {
          controller.error(new TypeError("connection closed"));
        },
      }),
    );

    await expect(
      readTextResponseWithinLimit(response, 1_000, 65_001),
    ).rejects.toBeInstanceOf(TextResponseReadError);
  });

  it("returns null only when content exceeds the byte limit", async () => {
    const response = new Response("content", {
      headers: {
        "Content-Length": "7",
      },
    });

    await expect(
      readTextResponseWithinLimit(response, 3, 65_001),
    ).resolves.toBeNull();
  });
});
