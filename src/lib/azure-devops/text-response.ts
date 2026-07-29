export function getTextEncodingLabel(encoding: number | null) {
  switch (encoding) {
    case 1_200:
      return "utf-16le";
    case 1_201:
      return "utf-16be";
    case 20_127:
      return "ascii";
    case 28_591:
      return "iso-8859-1";
    case 65_001:
    case null:
      return "utf-8";
    default:
      return encoding >= 1_250 && encoding <= 1_258
        ? `windows-${encoding}`
        : "utf-8";
  }
}

export class TextResponseReadError extends Error {
  constructor(cause: unknown) {
    super("The response body could not be read.", { cause });
    this.name = "TextResponseReadError";
  }
}

export async function readTextResponseWithinLimit(
  response: Response,
  maxBytes: number,
  encoding: number | null,
  options: {
    fatal?: boolean;
    signal?: AbortSignal;
  } = {},
) {
  const declaredLength = Number(response.headers.get("content-length"));

  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    await response.body?.cancel();
    return null;
  }

  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder(getTextEncodingLabel(encoding), {
    fatal: options.fatal ?? false,
  });
  let byteLength = 0;
  let content = "";

  try {
    while (true) {
      let chunk: ReadableStreamReadResult<Uint8Array>;

      try {
        chunk = await reader.read();
      } catch (error) {
        if (options.signal?.aborted) {
          throw error;
        }

        throw new TextResponseReadError(error);
      }

      const { done, value } = chunk;

      if (done) {
        return content + decoder.decode();
      }

      byteLength += value.byteLength;

      if (byteLength > maxBytes) {
        await reader.cancel();
        return null;
      }

      content += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}
