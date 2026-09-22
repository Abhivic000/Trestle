import { z } from 'zod';

/*
 * The design contract: the structured shape of a system design.
 *
 * This is the single source of truth. The API stores it as `design_json`, the
 * canvas renders it, and the AI layer is told to produce exactly this shape.
 * Every stored design carries `schemaVersion`, so the format can evolve without
 * breaking designs saved earlier.
 */

export const DESIGN_SCHEMA_VERSION = 1;

/** What kind of box this is. Drives the canvas icon/colour and cost estimates. */
export const componentKinds = [
  'client',
  'gateway',
  'service',
  'worker',
  'database',
  'cache',
  'queue',
  'storage',
  'search',
  'cdn',
  'external',
] as const;
export type ComponentKind = (typeof componentKinds)[number];

/** How two components talk to each other. */
export const connectionKinds = ['sync', 'async', 'data'] as const;
export type ConnectionKind = (typeof connectionKinds)[number];

/** Where a design came from. `placeholder` is the sample used before AI generation exists. */
export const designOrigins = ['placeholder', 'generated', 'edited'] as const;
export type DesignOrigin = (typeof designOrigins)[number];

const componentId = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9-]+$/, 'use lowercase letters, numbers and hyphens');

export const alternativeSchema = z.object({
  option: z.string().min(2).max(120),
  whyNot: z.string().min(2).max(500),
});

export const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const designComponentSchema = z.object({
  id: componentId,
  kind: z.enum(componentKinds),
  label: z.string().min(2).max(80),
  /** Concrete technology, e.g. "PostgreSQL". Optional: the AI may stay generic. */
  technology: z.string().max(80).optional(),
  responsibility: z.string().min(10).max(600),
  rationale: z.string().min(10).max(1200),
  alternatives: z.array(alternativeSchema).max(5).default([]),
  tradeoffs: z.array(z.string().min(5).max(400)).max(5).default([]),
  /** Reference-library entry ids backing the rationale. Empty = ungrounded, flagged in the UI. */
  sources: z.array(z.uuid()).max(10).default([]),
  position: positionSchema,
});
export type DesignComponent = z.infer<typeof designComponentSchema>;

export const designConnectionSchema = z.object({
  id: z.string().min(2).max(130),
  from: componentId,
  to: componentId,
  kind: z.enum(connectionKinds),
  /** Short edge label, e.g. "REST", "play events". */
  label: z.string().max(60).optional(),
});
export type DesignConnection = z.infer<typeof designConnectionSchema>;

export const dataEntitySchema = z.object({
  name: z.string().min(2).max(60),
  /** Component that owns this data. */
  storedIn: componentId,
  keyFields: z.array(z.string().min(1).max(60)).max(15).default([]),
  notes: z.string().max(400).optional(),
});
export type DataEntity = z.infer<typeof dataEntitySchema>;

export const designSchema = z
  .object({
    schemaVersion: z.literal(DESIGN_SCHEMA_VERSION),
    origin: z.enum(designOrigins),
    summary: z.string().min(10).max(1500),
    components: z.array(designComponentSchema).min(1).max(40),
    connections: z.array(designConnectionSchema).max(120).default([]),
    dataModel: z.array(dataEntitySchema).max(40).default([]),
  })
  // Referential integrity: ids must line up, or the canvas would draw edges into nowhere.
  .superRefine((design, ctx) => {
    const ids = new Set<string>();
    design.components.forEach((component, index) => {
      if (ids.has(component.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['components', index, 'id'],
          message: `duplicate component id "${component.id}"`,
        });
      }
      ids.add(component.id);
    });

    design.connections.forEach((connection, index) => {
      for (const end of ['from', 'to'] as const) {
        if (!ids.has(connection[end])) {
          ctx.addIssue({
            code: 'custom',
            path: ['connections', index, end],
            message: `unknown component id "${connection[end]}"`,
          });
        }
      }
      if (connection.from === connection.to) {
        ctx.addIssue({
          code: 'custom',
          path: ['connections', index],
          message: 'a component cannot connect to itself',
        });
      }
    });

    design.dataModel.forEach((entity, index) => {
      if (!ids.has(entity.storedIn)) {
        ctx.addIssue({
          code: 'custom',
          path: ['dataModel', index, 'storedIn'],
          message: `unknown component id "${entity.storedIn}"`,
        });
      }
    });
  });

export type Design = z.infer<typeof designSchema>;
