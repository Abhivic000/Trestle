import type { ComponentKind, Design, DesignComponent } from '@trestle/shared';

/*
 * Pure helpers for editing a design in the browser. Kept free of React so they
 * can be unit tested directly: every one takes a design and returns a new one.
 */

/** Turns a label into a url-safe id that doesn't clash with an existing one. */
export function componentIdFromLabel(label: string, taken: Iterable<string>): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'component';

  const existing = new Set(taken);
  if (!existing.has(base)) return base;

  for (let suffix = 2; suffix < 100; suffix++) {
    const candidate = `${base}-${String(suffix)}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${base}-${String(Date.now())}`;
}

export interface NewComponentInput {
  label: string;
  kind: ComponentKind;
  technology?: string;
  responsibility?: string;
}

/**
 * Adds a component the user created by hand. Its rationale says plainly that a
 * person added it: we never invent reasoning the AI did not produce.
 */
export function addComponent(design: Design, input: NewComponentInput): Design {
  const id = componentIdFromLabel(
    input.label,
    design.components.map((c) => c.id),
  );
  const rightmost = design.components.reduce(
    (max, component) => Math.max(max, component.position.x),
    0,
  );

  const technology = input.technology?.trim();
  const responsibility = input.responsibility?.trim();

  const component: DesignComponent = {
    id,
    kind: input.kind,
    label: input.label.trim(),
    technology: technology === '' ? undefined : technology,
    responsibility:
      responsibility === undefined || responsibility === ''
        ? 'Added by hand; describe what this does.'
        : responsibility,
    rationale: 'Added manually. No AI reasoning or source is attached to this component.',
    alternatives: [],
    tradeoffs: [],
    sources: [],
    position: { x: rightmost + 296, y: 0 },
  };

  return { ...design, components: [...design.components, component] };
}

/** Removes a component and every connection or data entity that referenced it. */
export function removeComponent(design: Design, componentId: string): Design {
  return {
    ...design,
    components: design.components.filter((component) => component.id !== componentId),
    connections: design.connections.filter(
      (connection) => connection.from !== componentId && connection.to !== componentId,
    ),
    dataModel: design.dataModel.filter((entity) => entity.storedIn !== componentId),
  };
}

export function moveComponent(
  design: Design,
  componentId: string,
  position: { x: number; y: number },
): Design {
  return {
    ...design,
    components: design.components.map((component) =>
      component.id === componentId ? { ...component, position } : component,
    ),
  };
}

/** Renames a component, or changes the technology shown on it. */
export function updateComponent(
  design: Design,
  componentId: string,
  changes: Partial<Pick<DesignComponent, 'label' | 'technology'>>,
): Design {
  return {
    ...design,
    components: design.components.map((component) =>
      component.id === componentId
        ? {
            ...component,
            ...changes,
            technology: changes.technology?.trim() ? changes.technology.trim() : undefined,
          }
        : component,
    ),
  };
}

/** Connects two components, ignoring duplicates and self-links. */
export function connectComponents(design: Design, from: string, to: string): Design {
  if (from === to) return design;
  const id = `${from}__${to}`;
  if (design.connections.some((connection) => connection.id === id)) return design;

  return {
    ...design,
    connections: [...design.connections, { id, from, to, kind: 'sync' }],
  };
}

export function removeConnection(design: Design, connectionId: string): Design {
  return {
    ...design,
    connections: design.connections.filter((connection) => connection.id !== connectionId),
  };
}
