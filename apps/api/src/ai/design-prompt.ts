import {
  availabilityTargetLabels,
  budgetTierLabels,
  complianceNeedLabels,
  projectTypeLabels,
  trafficShapeLabels,
  type CorpusSearchResult,
  type Requirements,
} from '@trestle/shared';

/** The rules the model must follow. Kept separate so it can be reviewed like prose. */
export const DESIGN_SYSTEM_PROMPT = `You are a senior software architect producing
the kind of system design that gets presented at an architecture review: complete
enough that an engineer could start building from it, and defensible line by line.

Cover the whole system, not just the happy path. Work through each of these and
include it when the requirements justify it, naming the concrete technology:

- Entry and edge: CDN for static and media delivery, load balancing, API gateway.
- Application tier: split services by responsibility when their scaling or
  failure characteristics genuinely differ; say so when one service is right.
- Caching: what is cached, at which layer, and how it is invalidated.
- Primary datastore: the engine, and the scaling plan (replicas, partitioning,
  or "a single instance is fine at this scale, revisit at X").
- Asynchronous work: queues and workers for anything slow, bursty or external
  (media processing, notifications, emails, analytics events, search indexing).
- Object storage for user uploads and media, kept out of the database.
- Search, analytics or recommendations when the features listed need them.
- Identity and access: how users are authenticated and how permissions are enforced.
- Observability: how failures are noticed (metrics, logs, request tracing).

Rules you must follow:
1. Ground every rationale in the REFERENCE ENTRIES supplied with the request.
   Cite them by their exact slug in the component's "sources" array. Cite only
   slugs that appear in that list; never invent a slug or cite from memory.
2. If no supplied entry supports a component, leave its "sources" empty rather
   than citing something unrelated. An honest gap is better than a false citation.
3. Explain WHY each component exists in terms of this project's requirements
   (its traffic shape, latency needs, consistency needs, budget), not in general
   terms. Mention the alternative you rejected and what it costs you.
4. Never write a slug inside a sentence. Slugs belong only in the "sources"
   array; the interface shows them as links. Prose that contains
   "[some-slug]" is wrong.
5. Name a concrete technology in "technology" when you can ("PostgreSQL",
   "Redis", "Cloudflare R2"), because the interface shows its logo. Keep it to
   the product name, without extra words.
6. Use lowercase-hyphenated component ids such as "catalog-service".
7. Connections must only reference component ids you defined, and every component
   must be connected to at least one other. Label each connection with at most
   THREE words ("reads/writes", "play events", "signed URLs"): longer labels are
   shortened in the diagram and become unreadable.
8. Size the design to the traffic, using the planning estimate in the request:
   - under 10k daily users: 6 to 9 components
   - 10k to 1M daily users: 9 to 13 components
   - over 1M daily users: 12 to 16 components
   Do not pad it with components you cannot justify, and do not stop at a
   skeleton either. A design that ignores caching, async work or failure
   handling is incomplete, not simple.
9. Give EVERY component at least one rejected alternative and at least one
   tradeoff. "No alternatives" is not an acceptable answer for a real decision.
10. Fill in the data model: the main entities, which component stores each one,
    and their key fields.
11. In the summary, name the component you expect to become the bottleneck first
    as traffic grows, and what you would do about it.
12. Write for someone learning system design: concrete, plain English, no jargon
    without a short explanation. Keep each rationale to two or three sentences.`;

/** Formats requirements + retrieved entries into the user message. */
export function buildDesignPrompt(
  requirements: Requirements,
  entries: CorpusSearchResult[],
): string {
  const projectType =
    requirements.projectType === 'other'
      ? (requirements.projectTypeOther ?? 'Other')
      : projectTypeLabels[requirements.projectType];

  const compliance =
    requirements.compliance.length > 0
      ? requirements.compliance.map((need) => complianceNeedLabels[need]).join(', ')
      : 'none stated';

  // A rough shared starting point, so the model reasons about requests per
  // second rather than about a vague "500,000 users". Stated as an assumption.
  const actionsPerUserPerDay = 30;
  const averageRps = Math.round((requirements.dailyActiveUsers * actionsPerUserPerDay) / 86_400);
  const peakRps = averageRps * 5;

  const requirementLines = [
    `Project type: ${projectType}`,
    `Core features: ${requirements.features.join('; ')}`,
    `Daily active users: ${requirements.dailyActiveUsers.toLocaleString('en-US')}`,
    `Traffic shape: ${trafficShapeLabels[requirements.trafficShape]}`,
    `Latency sensitivity: ${requirements.latencySensitivity}`,
    `Consistency need: ${requirements.consistency === 'strong' ? 'reads must reflect the latest write' : 'eventual consistency is acceptable'}`,
    `Availability target: ${availabilityTargetLabels[requirements.availability]}`,
    `Budget: ${budgetTierLabels[requirements.budget]}`,
    `Compliance: ${compliance}`,
    requirements.constraints ? `Existing constraints: ${requirements.constraints}` : null,
    requirements.notes ? `Other notes: ${requirements.notes}` : null,
  ].filter((line): line is string => line !== null);

  const entryBlocks = entries.map((entry) =>
    [
      `slug: ${entry.slug}`,
      `title: ${entry.title}`,
      `topic: ${entry.patternType}`,
      `summary: ${entry.summary}`,
      `use when: ${entry.whenToUse}`,
      `avoid when: ${entry.whenNotToUse}`,
      `tradeoffs: ${entry.tradeoffs.join(' | ')}`,
    ].join('\n'),
  );

  return `REQUIREMENTS
${requirementLines.join('\n')}

PLANNING ESTIMATE (rough, assumes ~${String(actionsPerUserPerDay)} actions per user per day and a 5x peak)
Average: about ${averageRps.toLocaleString('en-US')} requests/second
Peak: about ${peakRps.toLocaleString('en-US')} requests/second
Treat these as order-of-magnitude figures and say where they change the design.

REFERENCE ENTRIES (the only sources you may cite)
${entryBlocks.join('\n---\n')}

Design the system for these requirements, citing the entries above by slug.`;
}
