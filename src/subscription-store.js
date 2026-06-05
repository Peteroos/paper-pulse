import { BlobNotFoundError, get, put } from "@vercel/blob";

const SUBSCRIPTIONS_PATH = "paper-pulse/subscriptions.json";

export async function readSubscriptions() {
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) {
    throw new Error("Vercel Blob is not configured");
  }

  let result;
  try {
    result = await get(SUBSCRIPTIONS_PATH, {
      access: "private",
      useCache: false,
    });
  } catch (error) {
    if (error instanceof BlobNotFoundError) {
      return [];
    }
    throw error;
  }

  if (!result) {
    return [];
  }

  const text = await streamToText(result.stream);
  const payload = JSON.parse(text || "[]");
  return Array.isArray(payload) ? payload : [];
}

export async function writeSubscriptions(subscriptions) {
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) {
    throw new Error("Vercel Blob is not configured");
  }

  await put(SUBSCRIPTIONS_PATH, `${JSON.stringify(subscriptions, null, 2)}\n`, {
    access: "private",
    allowOverwrite: true,
    contentType: "application/json",
  });
}

async function streamToText(stream) {
  const reader = stream.getReader();
  const chunks = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  return new TextDecoder().decode(concatUint8Arrays(chunks));
}

function concatUint8Arrays(chunks) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  return output;
}
