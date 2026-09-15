import { z } from "zod";

export const metrics = ["capacidad_maxima_min", "ocupado_min", "disponible_min", "porcentaje_ocupacion"] as const;
export const specSchema = z.object({
  schema_version: z.literal(1),
  widgets: z.array(z.object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
    title: z.string().min(1).max(120),
    dataset: z.literal("cirugia.ocupacion"),
    metric: z.enum(metrics),
    visualization: z.enum(["bar", "table"]),
  }).strict()).min(1).max(12),
}).strict();

export const proposalSchema = z.object({
  status: z.enum(["ready", "unsupported"]),
  title: z.string().min(1).max(150).nullable(),
  spec: specSchema.nullable(),
}).strict();

export const envelopeSchema = z.object({
  request_id: z.string().uuid(),
  user_id: z.number().int().positive(),
  prompt: z.string().min(1).max(4000),
  current: z.object({ title: z.string().min(1).max(150), spec: specSchema }).strict().nullable(),
  catalog: z.array(z.object({
    id: z.literal("cirugia.ocupacion"),
    title: z.string().max(200),
    description: z.string().max(1000),
    metrics: z.array(z.object({
      key: z.enum(metrics), label: z.string().max(120), unit: z.string().max(30),
    }).strict()).min(1).max(4),
  }).passthrough()).length(1),
  dataset: z.object({
    dataset: z.literal("cirugia.ocupacion"),
    schema_version: z.literal(1),
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    updated_at: z.string().max(50),
    rows: z.array(z.object({
      codigo: z.string().max(100),
      nombre: z.string().max(200).nullable().optional(),
      capacidad_maxima_min: z.number().finite(),
      ocupado_min: z.number().finite(),
      disponible_min: z.number().finite(),
      porcentaje_ocupacion: z.number().finite(),
    }).strict()).max(200),
  }).strict(),
}).strict();

export type Envelope = z.infer<typeof envelopeSchema>;
export type Proposal = z.infer<typeof proposalSchema>;
