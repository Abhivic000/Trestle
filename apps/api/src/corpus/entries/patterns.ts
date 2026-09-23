import type { CorpusEntry } from '@trestle/shared';

/*
 * Reference library: general patterns.
 *
 * Every entry is written from scratch as an extracted pattern. Nothing here is
 * copied from a source. `sourceNote` says which well-known material the idea
 * comes from ("based on"), not a precise citation.
 */
export const patternEntries: CorpusEntry[] = [
  {
    slug: 'caching-read-through',
    kind: 'pattern',
    patternType: 'caching',
    title: 'Read-through cache in front of a database',
    summary:
      'A cache sits between the application and the database. On a read the application asks the cache first; on a miss it reads the database and stores the result before returning it. This works because real traffic is rarely uniform: a small share of items usually accounts for most reads, so a cache holding only that share can absorb the majority of requests. Caches are measured by hit rate, and a few percentage points of hit rate can be the difference between one database and a fleet of them.',
    whenToUse:
      'Read-heavy workloads where the same items are requested over and over and the database has become the bottleneck: popular products, profiles, trending songs or videos, busy feeds, configuration. Typical symptoms are database load dominated by repeated reads of a small set of rows, and latency that rises with traffic even though the data itself rarely changes.',
    whenNotToUse:
      'Write-heavy workloads, data that must be exactly current on every read, or access patterns with no repetition, where the cache adds latency and cost without improving hit rate.',
    tradeoffs: [
      'Cached data can be out of date until it expires or is invalidated.',
      'A cold or failed cache sends full load to the database, so capacity planning must assume misses.',
      'Adds a component to operate, monitor and secure.',
    ],
    sourceNote:
      'Based on: Designing Data-Intensive Applications (Kleppmann), and common caching practice described in public engineering write-ups.',
  },
  {
    slug: 'caching-invalidation-strategies',
    kind: 'pattern',
    patternType: 'caching',
    title: 'Choosing how cached data expires',
    summary:
      'Cached copies go stale, and the strategy for refreshing them is the real design decision. Time-based expiry (TTL) is simplest: entries live for a fixed period and staleness is bounded by that period. Write-through or write-around updates the cache when the underlying data changes, giving fresher reads at the cost of coupling writes to the cache. Explicit invalidation deletes affected keys when something changes, which is precise but easy to get wrong when one change affects many keys. Most systems combine a short TTL as a safety net with explicit invalidation for important changes.',
    whenToUse:
      'As soon as a cache holds anything that changes. Pick TTL for tolerant data, and add explicit invalidation for data users notice immediately, such as their own edits.',
    whenNotToUse:
      'Precise invalidation is not worth its complexity for data that is naturally short-lived or where a short TTL already meets the freshness requirement.',
    tradeoffs: [
      'Short TTLs keep data fresh but lower the hit rate.',
      'Explicit invalidation is precise but a missed path silently serves stale data.',
      'Write-through keeps the cache warm but makes writes depend on cache availability.',
    ],
    sourceNote:
      'Based on: standard caching literature, including Designing Data-Intensive Applications (Kleppmann).',
  },
  {
    slug: 'sharding-by-entity-key',
    kind: 'pattern',
    patternType: 'sharding',
    title: 'Shard by a natural entity key',
    summary:
      'When one database can no longer hold the data or absorb the writes, the table is split across several databases, each holding a subset of rows. The split key decides everything: choosing a natural entity that most queries already filter by, such as user, tenant or conversation, keeps typical queries on a single shard. A poorly chosen key forces queries to fan out to every shard and combine results, which is slower than the single database you started with. Hash-based keys spread load evenly; range-based keys keep related rows together but risk hot spots.',
    whenToUse:
      'When a single primary database is genuinely the bottleneck on writes or storage, and most queries can be expressed in terms of one entity key.',
    whenNotToUse:
      'Before simpler options are exhausted: read replicas, caching, better indexes and archiving old data usually buy more time at far lower complexity.',
    tradeoffs: [
      'Queries and transactions spanning shards become much harder.',
      'Rebalancing shards later is operationally painful, so the key choice is near-permanent.',
      'Uneven usage creates hot shards that need special handling.',
    ],
    sourceNote:
      'Based on: Designing Data-Intensive Applications (Kleppmann), ch. 6, and publicly described sharded architectures.',
  },
  {
    slug: 'replication-read-replicas',
    kind: 'pattern',
    patternType: 'replication',
    title: 'Read replicas to scale reads',
    summary:
      'A primary database takes all writes and copies them to one or more replicas that serve reads. Because most applications read far more than they write, this often multiplies capacity with no change to the data model, which makes it the first thing to reach for before sharding. The catch is replication lag: a replica may be milliseconds or seconds behind, so a user can write something and then not see it on the next read. The usual fix is to route reads that must reflect a just-completed write back to the primary.',
    whenToUse:
      'Read-heavy systems where a single database is near its read limit, and most reads tolerate being slightly behind.',
    whenNotToUse:
      'Write-bound systems (replicas do not help writes), or when nearly every read must reflect the newest write, which pushes all traffic back to the primary anyway.',
    tradeoffs: [
      'Replication lag means reads can be stale right after a write.',
      'Failover and promotion add operational work.',
      'Each replica costs the same as the primary in infrastructure terms.',
    ],
    sourceNote: 'Based on: Designing Data-Intensive Applications (Kleppmann), ch. 5.',
  },
  {
    slug: 'queuing-decouple-slow-work',
    kind: 'pattern',
    patternType: 'queuing',
    title: 'Move slow work behind a queue',
    summary:
      'Instead of doing everything before responding, the request writes a message to a queue and returns; a separate worker performs the slow part later. Emails, image processing, analytics and third-party calls are classic candidates. This keeps request latency stable and stops a slow or broken downstream service from blocking user-facing traffic: the queue absorbs the backlog instead. It also changes the user experience, because the work is no longer finished when the response arrives, so the interface has to represent "in progress" honestly.',
    whenToUse:
      'Work that is slow, bursty, retryable or dependent on an external system, and that the user does not need completed before their next action.',
    whenNotToUse:
      'Work whose result the user needs immediately, or systems small enough that an extra queue and worker are more operational burden than the latency they save.',
    tradeoffs: [
      'The system becomes eventually consistent: results appear after a delay.',
      'Requires handling retries, duplicate delivery and poison messages.',
      'Debugging spans more components than a single request.',
    ],
    sourceNote:
      'Based on: standard asynchronous-processing practice, including Designing Data-Intensive Applications (Kleppmann), ch. 11.',
  },
  {
    slug: 'cdn-serve-static-and-media',
    kind: 'pattern',
    patternType: 'cdn',
    title: 'Serve static files and media from a CDN',
    summary:
      'A content delivery network caches files at locations close to users, so images, video, scripts and stylesheets are served from nearby rather than from the origin. Two things improve at once: latency drops because the distance is shorter, and origin load drops because most requests never reach it. For media-heavy products this is usually the single highest-leverage component, and also the largest line on the bill, because delivery cost scales with bytes served rather than with requests.',
    whenToUse:
      'Any product serving images, video, audio or front-end assets to users spread across regions.',
    whenNotToUse:
      'Highly personalised or private responses that cannot be cached, and internal tools with a small user base in one location.',
    tradeoffs: [
      'Cached files can be stale until they expire, so releases need cache-busting file names.',
      'Bandwidth is charged per byte and can dominate the bill.',
      'Another layer to configure correctly for authentication and private content.',
    ],
    sourceNote:
      'Based on: public CDN documentation and widely described media delivery architectures.',
  },
  {
    slug: 'storage-blobs-outside-the-database',
    kind: 'pattern',
    patternType: 'storage',
    title: 'Keep large files out of the database',
    summary:
      'Large binary files (images, video, documents, backups) are stored in object storage, and the database keeps only a reference: a key, size, type and owner. Databases are optimised for small structured rows and transactions; large binaries inflate backups, slow restores and waste expensive database memory. Object storage is far cheaper per gigabyte, integrates with CDNs, and lets clients upload and download directly using short-lived signed links, which keeps the traffic off the application servers entirely.',
    whenToUse:
      'Any user-uploaded media, exports or documents, and generally anything larger than a few hundred kilobytes.',
    whenNotToUse:
      'Small values that are genuinely part of a row, such as a short text field or a thumbnail of a few kilobytes, where an extra round trip is not worth it.',
    tradeoffs: [
      'Two stores must be kept consistent: orphaned files and dangling references are common bugs.',
      'Access control has to be enforced separately, usually with signed URLs.',
      'Deletes become two-step and can leave storage to clean up later.',
    ],
    sourceNote: 'Based on: public object-storage documentation and common file-handling practice.',
  },
  {
    slug: 'consistency-eventual-vs-strong',
    kind: 'pattern',
    patternType: 'consistency',
    title: 'Choosing eventual or strong consistency per feature',
    summary:
      'Consistency is a per-feature decision, not a system-wide one. Strong consistency means every read sees the latest write, which usually requires coordination and costs latency and availability during network problems. Eventual consistency allows replicas to converge over time, which is cheaper and more available, but a user can briefly see old data. Most products mix the two: money, inventory and permissions get strong guarantees, while feeds, counters, recommendations and analytics are fine being seconds behind.',
    whenToUse:
      'At design time for each piece of data: ask what actually goes wrong if a reader sees a value a few seconds out of date.',
    whenNotToUse:
      'Strong consistency should not be applied globally by default; it buys correctness for a few features while making everything else slower and less available.',
    tradeoffs: [
      'Strong consistency reduces availability during partitions and adds latency.',
      'Eventual consistency pushes complexity into the interface, which must show stale or pending states.',
      'Mixed models need clear documentation, or developers assume the wrong guarantee.',
    ],
    sourceNote:
      'Based on: Designing Data-Intensive Applications (Kleppmann), ch. 5 and 9, and the CAP theorem literature.',
  },
  {
    slug: 'rate-limiting-token-bucket',
    kind: 'pattern',
    patternType: 'rate-limiting',
    title: 'Rate limit with a token bucket',
    summary:
      'Each client is given tokens that refill at a steady rate up to a maximum; a request spends a token, and requests with no tokens available are rejected or delayed. This allows short bursts, which real users produce, while capping sustained throughput. Limits are usually applied per user or per API key rather than per IP address, because many users share addresses. Rejections should say when to retry, so well-behaved clients can back off instead of hammering.',
    whenToUse:
      'Public or authenticated APIs, expensive operations such as AI calls, sign-in attempts, and anything where one client can degrade service for everyone.',
    whenNotToUse:
      'Internal traffic between trusted services, where queueing and backpressure usually fit better than rejecting requests.',
    tradeoffs: [
      'Shared counters need a fast central store, which becomes a dependency on the request path.',
      'Limits that are too tight break legitimate bursty use.',
      'Per-user limits require identifying users before doing the expensive work.',
    ],
    sourceNote: 'Based on: standard rate-limiting algorithms and public API design guidance.',
  },
  {
    slug: 'auth-use-managed-identity-provider',
    kind: 'pattern',
    patternType: 'auth',
    title: 'Use a managed identity provider instead of building auth',
    summary:
      'Authentication looks simple and is not: password storage, reset flows, email verification, session revocation, multi-factor, breach detection and social sign-in all have sharp edges, and mistakes are severe. A managed provider handles them and issues signed tokens the application verifies on every request. The application still owns authorisation, that is, what a verified user is allowed to do, which should be enforced on the server and ideally in the database as well, never only in the interface.',
    whenToUse:
      'Nearly every product, especially small teams, where authentication is not the differentiator.',
    whenNotToUse:
      'Environments with unusual identity requirements or strict rules against third-party identity storage, where self-hosted identity software is the alternative rather than writing it from scratch.',
    tradeoffs: [
      'A third party sits on the critical path for sign-in and its outages become yours.',
      'Provider-specific integration is work to migrate away from later.',
      'Signed tokens stay valid until they expire, so sign-out is not instant everywhere.',
    ],
    sourceNote:
      'Based on: OWASP authentication guidance and public identity-provider documentation.',
  },
  {
    slug: 'observability-request-ids-and-golden-signals',
    kind: 'pattern',
    patternType: 'observability',
    title: 'Tag every request and watch the four golden signals',
    summary:
      'Each incoming request is given an identifier that is logged by every component that handles it and returned to the client, so one user complaint can be traced to the exact path it took. On top of that, four signals summarise health: traffic, error rate, latency (looking at high percentiles rather than averages) and saturation of the limiting resource. Averages hide the slow requests that users actually notice, which is why the 95th or 99th percentile is the number worth alerting on.',
    whenToUse:
      'From the first deployment. Retrofitting request identifiers and useful logs after an incident is much harder than adding them early.',
    whenNotToUse:
      'Heavy distributed tracing of every call is usually overkill for a small single-service product; start with request ids, structured logs and a few metrics.',
    tradeoffs: [
      'Logs and metrics cost storage and money, so sampling and retention need thought.',
      'Logs easily capture secrets or personal data unless fields are redacted deliberately.',
      'Too many alerts train people to ignore them.',
    ],
    sourceNote:
      'Based on: Google SRE Book (golden signals) and common structured-logging practice.',
  },
  {
    slug: 'cost-egress-and-managed-services-dominate',
    kind: 'pattern',
    patternType: 'cost',
    title: 'Data transfer and managed services usually dominate the bill',
    summary:
      'Early infrastructure bills are rarely dominated by compute. Bandwidth out of the platform, especially media delivery, is charged per gigabyte and grows directly with usage. Managed databases, search clusters and logging pipelines are typically the next largest lines, because they are priced for availability rather than for the raw work done. Compute is often the smallest share, and cross-region traffic is the classic surprise. A rough model of bytes served, rows stored and requests made predicts a bill better than instance counts.',
    whenToUse:
      'When estimating a design that serves media, has multi-region ambitions, or leans on managed services, and to identify what to attack first when the bill matters.',
    whenNotToUse:
      'Detailed cost modelling is premature for internal tools or early prototypes with little traffic, where developer time is the expensive resource.',
    tradeoffs: [
      'Cheaper self-managed components trade money for operational work and risk.',
      'Committed-use discounts lower unit costs but reduce flexibility.',
      'Aggressive caching saves bandwidth but adds staleness and complexity.',
    ],
    sourceNote: 'Based on: public cloud pricing pages and widely reported cost breakdowns.',
  },
];
