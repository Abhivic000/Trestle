import type { CorpusEntry } from '@trestle/shared';

/*
 * Reference library: patterns, batch 2. Same rules as patterns.ts: written from
 * scratch as extracted patterns, attributed with "based on", never copied.
 */
export const advancedPatternEntries: CorpusEntry[] = [
  {
    slug: 'search-start-with-the-database',
    kind: 'pattern',
    patternType: 'search',
    title: "Use the database's own text search before adding a search engine",
    summary:
      'Relational databases include full-text search: text is turned into searchable tokens, indexed, and ranked at query time. For a few million rows with modest query volume this is usually fast enough, and it avoids running a second datastore and keeping it in step with the source of truth. A dedicated search engine earns its place when you need typo tolerance, faceted filters, custom relevance tuning, or search traffic large enough to disturb the main database.',
    whenToUse:
      'Early and mid-sized products with straightforward search over their own records, where search is a feature rather than the product.',
    whenNotToUse:
      'Search-centric products, very large corpora, or requirements like fuzzy matching, synonyms and relevance tuning that database search does not do well.',
    tradeoffs: [
      'Search queries compete with normal traffic for the same database resources.',
      'Relevance tuning options are limited compared with a dedicated engine.',
      'Index maintenance adds write cost to every insert and update.',
    ],
    sourceNote: 'Based on: PostgreSQL full-text search documentation and common practice.',
  },
  {
    slug: 'search-dedicated-engine-and-sync',
    kind: 'pattern',
    patternType: 'search',
    title: 'Keeping a dedicated search index in step with the database',
    summary:
      'A separate search engine holds a copy of the data, shaped for searching. The hard part is not querying it but keeping it current: the application must publish changes to the index, usually asynchronously, and accept that the index lags slightly behind the database. Because the index is a derived copy, it must be rebuildable from the source of truth at any time, and a reindex procedure should exist before launch rather than being invented during an incident.',
    whenToUse:
      'When search is a core feature needing relevance tuning, facets or typo tolerance, or when search load would otherwise threaten the main database.',
    whenNotToUse:
      'When database search already meets the need: a second datastore doubles the operational surface and introduces a class of consistency bugs.',
    tradeoffs: [
      'The index is eventually consistent, so new records appear in search with a delay.',
      'Failed index updates cause silent drift unless reconciliation exists.',
      'Another cluster to size, secure, monitor and pay for.',
    ],
    sourceNote: 'Based on: public search-engine documentation and widely used indexing pipelines.',
  },
  {
    slug: 'consistency-idempotency-keys',
    kind: 'pattern',
    patternType: 'consistency',
    title: 'Make retries safe with idempotency keys',
    summary:
      'Networks fail after a request has been processed but before the response arrives, so clients retry and risk performing the action twice. The fix is a client-generated key sent with the request: the server records the outcome against that key and returns the stored result for any repeat, instead of doing the work again. Keys are kept for a bounded period, and a repeat with the same key but different parameters is rejected, because that indicates a bug rather than a retry.',
    whenToUse:
      'Any operation that costs money, sends messages or creates records, especially payments, sign-ups and anything a mobile client might retry on a flaky connection.',
    whenNotToUse:
      'Reads and operations that are naturally repeatable (setting a value to a fixed state), where an extra key adds bookkeeping for no gain.',
    tradeoffs: [
      'Requires storing keys and results, with expiry.',
      'Clients must generate and reuse keys correctly, which is easy to get wrong.',
      'Concurrent retries need locking or a unique constraint to avoid a race.',
    ],
    sourceNote: 'Based on: Stripe API documentation on idempotent requests.',
    sourceUrl: 'https://docs.stripe.com/api/idempotent_requests',
  },
  {
    slug: 'consistency-transactional-outbox',
    kind: 'pattern',
    patternType: 'consistency',
    title: 'Write the event in the same transaction as the data (outbox)',
    summary:
      'When a change must both be stored and announced to other systems, doing the database write and the message publish separately means one can succeed while the other fails, leaving the system inconsistent. The outbox pattern writes the event into a table in the same transaction as the data change, and a separate process reads that table and publishes the events. Because the event and the data commit together, nothing is lost; consumers must tolerate receiving an event more than once.',
    whenToUse:
      'Whenever a state change has to trigger work elsewhere and losing that trigger would be a real problem: orders, payments, provisioning, notifications.',
    whenNotToUse:
      'Systems with no external consumers, or where losing an occasional event is genuinely acceptable and simplicity matters more.',
    tradeoffs: [
      'Delivery is at-least-once, so consumers must be idempotent.',
      'Adds a publisher process and a table to monitor for backlog.',
      'Events are published slightly after the change, not instantly.',
    ],
    sourceNote:
      'Based on: the transactional outbox pattern as described in microservices literature.',
  },
  {
    slug: 'queuing-retries-backoff-dead-letter',
    kind: 'pattern',
    patternType: 'queuing',
    title: 'Retries, backoff and a dead-letter queue',
    summary:
      'Background work fails for two different reasons: temporary problems, which succeed on a retry, and permanent ones, which never will. Retrying with growing delays (and a little randomness so retries do not arrive in lockstep) handles the first. The second needs a limit: after a few attempts the message is moved to a dead-letter queue for inspection, rather than being retried forever. Without that split, one bad message can consume a worker indefinitely and hide the rest of the backlog.',
    whenToUse:
      'Every queue-and-worker system, from the first version. Retry policy is not an optimisation; it is part of making the queue correct.',
    whenNotToUse:
      "Nothing here is optional for real queues, though a simple system may use its provider's built-in retry and dead-letter settings rather than writing its own.",
    tradeoffs: [
      'Retries multiply load on an already struggling downstream system.',
      'Dead-letter queues need someone to actually look at them.',
      'Delayed retries make end-to-end timing harder to reason about.',
    ],
    sourceNote: 'Based on: public managed-queue documentation and common worker practice.',
  },
  {
    slug: 'storage-hot-and-cold-data',
    kind: 'pattern',
    patternType: 'storage',
    title: 'Separate hot data from cold history',
    summary:
      'Most systems read recent data constantly and old data almost never, yet keep both in the same expensive database, where the old rows slow down queries, backups and restores. Moving history to cheaper storage, or to a table partitioned by time, keeps the working set small and predictable. The usual pattern is partition by period, keep recent partitions in the primary database, and archive or drop older ones on a schedule agreed with whoever owns the legal retention requirements.',
    whenToUse:
      'Append-heavy data with a natural time dimension: events, logs, messages, orders, audit trails.',
    whenNotToUse:
      'Small datasets, or data that is genuinely queried uniformly across its whole history.',
    tradeoffs: [
      'Queries spanning hot and cold storage become more complex.',
      'Restoring archived data for a user request can be slow.',
      'Retention rules must be agreed, not invented by engineers.',
    ],
    sourceNote:
      'Based on: PostgreSQL partitioning documentation and common data-retention practice.',
  },
  {
    slug: 'replication-multi-region-tradeoffs',
    kind: 'pattern',
    patternType: 'replication',
    title: 'What multi-region really costs',
    summary:
      'Serving users from several regions shortens the network path and survives a regional outage, but the database is where the idea gets expensive. Keeping one primary region means writes still cross an ocean, so latency improves only for reads. Allowing writes in several regions means either accepting conflicts and resolving them, or paying coordination latency on every write. Most products get the benefit far more cheaply by putting static content and media on a CDN and keeping one database region until there is a concrete reason not to.',
    whenToUse:
      'When there is a genuine requirement: users concentrated in distant regions with latency-sensitive writes, or a regulatory or availability requirement for regional failover.',
    whenNotToUse:
      'As a default "for scale". Multi-region multiplies cost and operational complexity long before most products need it.',
    tradeoffs: [
      'Cross-region traffic is charged and adds latency to every hop.',
      'Multi-primary writes bring conflict resolution into application logic.',
      'Testing failover properly is a project in itself.',
    ],
    sourceNote:
      'Based on: cloud provider multi-region guidance and Designing Data-Intensive Applications (Kleppmann), ch. 5.',
  },
  {
    slug: 'auth-enforce-authorization-server-side',
    kind: 'pattern',
    patternType: 'auth',
    title: 'Enforce permissions on the server, ideally in the database too',
    summary:
      'Hiding a button is not access control. Every request must be checked on the server against the identity in the token, because anyone can call the API directly. A second layer inside the database, such as row-level rules tying rows to their owner, turns a single forgotten check from a data breach into a failed query. The common failure is trusting an identifier supplied by the client: ownership must be derived from the verified token, never from a field in the request body.',
    whenToUse:
      'Every product with more than one user. The database layer is especially valuable where clients talk to the data platform directly.',
    whenNotToUse:
      'Nothing exempts the server-side check. Database-level rules can be skipped where every query already goes through one audited server path, but then that path must be genuinely the only one.',
    tradeoffs: [
      'Rules in two places can drift apart and need tests that cover both.',
      'Database-level rules can be harder to debug and to reason about in queries.',
      'Fine-grained permissions grow complicated quickly; keep the model as small as possible.',
    ],
    sourceNote:
      'Based on: OWASP access-control guidance and PostgreSQL row-level security documentation.',
  },
  {
    slug: 'observability-alert-on-symptoms',
    kind: 'pattern',
    patternType: 'observability',
    title: 'Alert on user-visible symptoms, not on internal causes',
    summary:
      'Alerting on every internal signal (CPU, memory, queue depth) produces noise, because those numbers move for harmless reasons. Alerting on what users experience, such as error rate and slow requests measured at a high percentile, produces far fewer pages and each one matters. The internal metrics stay valuable for diagnosis once an alert fires. A simple target, like "99.9% of requests succeed in under 300ms", gives a clear line and makes it obvious how much room is left before users notice.',
    whenToUse:
      'As soon as anyone is expected to respond to problems, and before adding more dashboards.',
    whenNotToUse:
      'Capacity signals still deserve alerts when they predict imminent failure, such as a disk that will fill within hours.',
    tradeoffs: [
      'Symptom alerts detect problems slightly later than leading indicators.',
      'Choosing targets requires a real conversation about acceptable failure.',
      'High percentiles need enough traffic to be meaningful.',
    ],
    sourceNote: 'Based on: Google SRE Book, alerting and service-level objectives.',
  },
  {
    slug: 'cost-back-of-envelope-capacity',
    kind: 'pattern',
    patternType: 'cost',
    title: 'Estimate capacity from users, not from instance sizes',
    summary:
      'A usable estimate starts from user behaviour: daily users, actions per user per day, and the resulting requests per second, which for most products is a far smaller number than people expect. Peaks matter more than averages, so multiply by a peak factor. Storage follows the same route: rows or files per user per day, times retention, times average size. This produces numbers that can be sanity-checked and challenged, which is exactly what makes an architecture defensible in a review or an interview.',
    whenToUse:
      'Before choosing components, and whenever someone claims a design "will not scale" without numbers attached.',
    whenNotToUse:
      'Precision is not the goal: order of magnitude is what decides architecture. Do not spend days modelling what a factor-of-ten estimate already answers.',
    tradeoffs: [
      'Estimates are only as good as the usage assumptions behind them.',
      'Peak behaviour is often far spikier than a simple factor suggests.',
      'Growth can invalidate the estimate quickly, so revisit it.',
    ],
    sourceNote: 'Based on: standard back-of-the-envelope capacity estimation practice.',
  },
  {
    slug: 'caching-layers-and-where-to-cache',
    kind: 'pattern',
    patternType: 'caching',
    title: 'Choosing which layer to cache at',
    summary:
      'Caching happens at several layers, and the right one depends on who shares the result. The browser caches per user, a CDN caches what is identical for everyone, a shared cache such as Redis serves all application servers, and an in-process cache is fastest but private to one server and inconsistent across a fleet. Caching as close to the user as the data allows saves the most work, so the real question is how personalised the response is: fully shared responses belong at the edge, per-user data belongs in a shared cache behind the application.',
    whenToUse:
      'Whenever adding a cache: decide the layer deliberately rather than defaulting to one shared cache for everything.',
    whenNotToUse:
      'Personalised or permission-dependent responses must not be cached at shared layers, which is a classic and serious data-leak bug.',
    tradeoffs: [
      'More layers mean more places for stale data to hide.',
      'In-process caches are fast but diverge between servers.',
      "Edge caching of private data risks showing one user another's content.",
    ],
    sourceNote: 'Based on: HTTP caching specifications and common multi-layer caching practice.',
  },
  {
    slug: 'rate-limiting-shed-load-gracefully',
    kind: 'pattern',
    patternType: 'rate-limiting',
    title: 'Shed load deliberately instead of collapsing',
    summary:
      'Past a certain load every system degrades, and the choice is whether that degradation is designed or accidental. Deliberate load shedding rejects or queues low-value work quickly, keeping capacity for what matters: sign-ins and checkouts continue while recommendations and analytics are dropped. Bounded queues and timeouts are what make this possible, because unbounded queues simply convert overload into growing latency until everything times out anyway. Clients should retry with growing delays and randomness so that recovery does not trigger a second stampede.',
    whenToUse:
      'Systems with variable or bursty traffic, especially those with expensive operations such as AI calls or report generation.',
    whenNotToUse:
      'Low-traffic internal systems where the complexity of prioritising work outweighs the risk of a brief overload.',
    tradeoffs: [
      'Deciding what to drop first requires product input, not just engineering.',
      'Aggressive shedding can reject legitimate traffic during short spikes.',
      'Retry storms can undo the benefit unless clients back off properly.',
    ],
    sourceNote: 'Based on: Google SRE Book (handling overload) and common resilience practice.',
  },
];
