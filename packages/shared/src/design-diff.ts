import type { Design } from './design';

/**
 * What changed between two versions of a design. Used for the automatic change
 * summary on a save, and (in step 6.6) for showing a proposed change as a diff.
 */
export interface DesignChange {
  addedComponents: string[];
  removedComponents: string[];
  /** Components whose label, technology or wiring changed (not just position). */
  changedComponents: string[];
  movedComponents: string[];
  addedConnections: string[];
  removedConnections: string[];
}

export function diffDesigns(previous: Design, next: Design): DesignChange {
  const before = new Map(previous.components.map((component) => [component.id, component]));
  const after = new Map(next.components.map((component) => [component.id, component]));

  const addedComponents = [...after.keys()].filter((id) => !before.has(id));
  const removedComponents = [...before.keys()].filter((id) => !after.has(id));

  const changedComponents: string[] = [];
  const movedComponents: string[] = [];
  for (const [id, component] of after) {
    const original = before.get(id);
    if (!original) continue;
    if (
      original.label !== component.label ||
      original.technology !== component.technology ||
      original.kind !== component.kind
    ) {
      changedComponents.push(id);
    }
    if (
      Math.round(original.position.x) !== Math.round(component.position.x) ||
      Math.round(original.position.y) !== Math.round(component.position.y)
    ) {
      movedComponents.push(id);
    }
  }

  const beforeConnections = new Set(previous.connections.map((connection) => connection.id));
  const afterConnections = new Set(next.connections.map((connection) => connection.id));

  return {
    addedComponents,
    removedComponents,
    changedComponents,
    movedComponents,
    addedConnections: [...afterConnections].filter((id) => !beforeConnections.has(id)),
    removedConnections: [...beforeConnections].filter((id) => !afterConnections.has(id)),
  };
}

const plural = (count: number, word: string) => `${String(count)} ${word}${count === 1 ? '' : 's'}`;

/** A short, human sentence for the version list, e.g. "Added 2 components, moved 3". */
export function summariseDesignChange(previous: Design, next: Design): string {
  const change = diffDesigns(previous, next);
  const parts: string[] = [];

  if (change.addedComponents.length) {
    parts.push(`added ${plural(change.addedComponents.length, 'component')}`);
  }
  if (change.removedComponents.length) {
    parts.push(`removed ${plural(change.removedComponents.length, 'component')}`);
  }
  if (change.changedComponents.length) {
    parts.push(`edited ${plural(change.changedComponents.length, 'component')}`);
  }
  if (change.addedConnections.length) {
    parts.push(`added ${plural(change.addedConnections.length, 'connection')}`);
  }
  if (change.removedConnections.length) {
    parts.push(`removed ${plural(change.removedConnections.length, 'connection')}`);
  }
  if (change.movedComponents.length) {
    parts.push(`moved ${plural(change.movedComponents.length, 'component')}`);
  }

  if (parts.length === 0) return 'Saved with no changes';

  const sentence = parts.join(', ');
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}
