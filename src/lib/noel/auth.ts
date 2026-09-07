import { createHmac, timingSafeEqual } from "node:crypto";

export class NoelError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function signingInput(timestamp: string, nonce: string, body: string, path = "/api/noel/generate"): string {
  return ["v1", "POST", path, timestamp, nonce, body].join("\n");
}

// Una instancia por proceso. Desplegar una sola réplica en fase 2 (ver documentación).
export function createVerifier(path = "/api/noel/generate") {
  const seen = new Map<string, number>();
  return (headers: Headers, body: string, secret: string, now = Math.floor(Date.now() / 1000)) => {
    if (secret.length < 32) throw new NoelError(503, "Integración no configurada.");
    const timestamp = headers.get("x-noel-timestamp") || "";
    const nonce = headers.get("x-noel-nonce") || "";
    const signature = headers.get("x-noel-signature") || "";
    if (!/^\d{10}$/.test(timestamp) || Math.abs(now - Number(timestamp)) > 60
      || !/^[a-f0-9-]{36}$/i.test(nonce) || !/^[a-f0-9]{64}$/.test(signature)) {
      throw new NoelError(401, "Solicitud no autorizada.");
    }
    const expected = createHmac("sha256", secret).update(signingInput(timestamp, nonce, body, path)).digest();
    if (!timingSafeEqual(expected, Buffer.from(signature, "hex"))) throw new NoelError(401, "Solicitud no autorizada.");
    for (const [key, expires] of seen) if (expires < now) seen.delete(key);
    if (seen.has(nonce)) throw new NoelError(409, "Solicitud ya utilizada.");
    if (seen.size >= 10000) throw new NoelError(503, "Servicio temporalmente ocupado.");
    seen.set(nonce, now + 121);
  };
}

export async function readLimitedBody(request: Request): Promise<string> {
  const limit = 65536;
  if (Number(request.headers.get("content-length") || 0) > limit) throw new NoelError(413, "Solicitud demasiado grande.");
  const reader = request.body?.getReader();
  if (!reader) throw new NoelError(400, "Solicitud vacía.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new NoelError(413, "Solicitud demasiado grande.");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks).toString("utf8");
}
