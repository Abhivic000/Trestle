import type { CorpusSearchResult, Design } from '@trestle/shared';

export const CHANGE_SYSTEM_PROMPT = `You are a senior software architect reviewing a
change request against an EXISTING system design.

You propose the smallest set of changes that genuinely delivers what was asked,
and you never quietly rework unrelated parts of the design. The user reviews every
operation and can accept some and reject others, so each one must stand alone.

Rules you must follow:
1. Return OPERATIONS against the current design, not a new design. Touch only what
   the request requires.
2. Use the exact component ids from the current design when modifying, removing
   or connecting to existing components. Never invent an id for something that
   already exists.
3. New components get a lowercase-hyphenated id, a concrete technology, a
   responsibility, and a rationale explaining why THIS change needs them.
4. Connect every new component to the design: an orphan component is never useful.
5. Explain each operation in one or two sentences, in terms of the user's request
   and the existing design. That explanation is what the user reads before
   accepting it.
6. Ground your reasoning in the REFERENCE ENTRIES supplied and cite them by exact
   slug in "sources". Cite only slugs from that list; leave it empty rather than
   citing something unrelated. Never write a slug inside a sentence.
7. If the request would be a bad idea, still propose the smallest sensible version
   of it and say what it costs in the explanation. Do not silently refuse.
8. Connection labels are at most THREE words.`;

/** The current design, the request, and what the library says about it. */
export function buildChangePrompt(
  prompt: string,
  design: Design,
  entries: CorpusSearchResult[],
): string {
  const components = design.components
    .map(
      (component) =>
        `- id: ${component.id} | ${component.kind}${component.technology ? ` (${component.technology})` : ''} | ${component.label}: ${component.responsibility}`,
    )
    .join('\n');

  const connections = design.connections
    .map(
      (connection) =>
        `- id: ${connection.id} | ${connection.from} -> ${connection.to} (${connection.kind})${connection.label ? ` "${connection.label}"` : ''}`,
    )
    .join('\n');

  const entryBlocks = entries
    .map((entry) =>
      [
        `slug: ${entry.slug}`,
        `title: ${entry.title}`,
        `summary: ${entry.summary}`,
        `use when: ${entry.whenToUse}`,
        `avoid when: ${entry.whenNotToUse}`,
      ].join('\n'),
    )
    .join('\n---\n');

  return `CURRENT DESIGN
${design.summary}

COMPONENTS
${components}

CONNECTIONS
${connections || '(none)'}

REFERENCE ENTRIES (the only sources you may cite)
${entryBlocks || '(none available)'}

CHANGE REQUESTED BY THE USER
"${prompt}"

Propose the operations that deliver this change.`;
}
