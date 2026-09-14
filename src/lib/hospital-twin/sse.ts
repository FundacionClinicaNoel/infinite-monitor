export interface TwinSseMessage {
  event: string;
  data: unknown;
  id?: string | null;
  retry?: number;
}

function sanitizeField(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

export function encodeTwinSseMessage(message: TwinSseMessage): string {
  const lines: string[] = [];

  if (message.id) lines.push(`id: ${sanitizeField(message.id)}`);
  if (message.event) lines.push(`event: ${sanitizeField(message.event)}`);
  if (message.retry && Number.isFinite(message.retry)) {
    lines.push(`retry: ${Math.max(1000, Math.round(message.retry))}`);
  }

  const payload = JSON.stringify(message.data ?? null);
  for (const line of payload.split(/\r?\n/)) lines.push(`data: ${line}`);

  return `${lines.join("\n")}\n\n`;
}

export function encodeTwinSseComment(comment: string): string {
  return `: ${sanitizeField(comment)}\n\n`;
}
