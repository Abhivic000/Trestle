import type { CorpusEntry } from '@trestle/shared';

/*
 * Reference library: how named real systems solve a problem. These feed the
 * Compare tab. Each one is summarised in our own words from a public
 * engineering write-up, and every `sourceUrl` here was checked to resolve.
 */
export const comparisonEntries: CorpusEntry[] = [
  {
    slug: 'comparison-discord-message-storage',
    kind: 'comparison',
    patternType: 'sharding',
    title: 'Discord: partitioning chat messages by channel and time',
    summary:
      'Discord moved message storage from MongoDB to Cassandra to hold billions of messages with predictable performance. Messages are keyed by channel together with a time bucket, and ordered within that by a sortable message id, so reading recent history in a channel touches one partition. The time bucket exists because very large partitions caused problems during compaction, so bucketing keeps each partition small. The result scales by adding nodes rather than by re-sharding by hand as data grows.',
    whenToUse:
      'Chat, comments, activity feeds and other append-heavy histories that are almost always read by one container (channel, thread, document) and in time order.',
    whenNotToUse:
      'Modest message volumes, or queries that cut across containers (such as global search), which this key layout does not serve.',
    tradeoffs: [
      'The access pattern is fixed by the key: queries that do not match it are expensive or impossible.',
      'Operating a distributed store is a bigger commitment than a managed relational database.',
      'Bucketing adds application logic to pick and iterate buckets.',
    ],
    sourceNote: 'Based on: Discord engineering blog, "How Discord Stores Billions of Messages".',
    sourceUrl: 'https://discord.com/blog/how-discord-stores-billions-of-messages',
  },
  {
    slug: 'comparison-netflix-open-connect',
    kind: 'comparison',
    patternType: 'cdn',
    title: 'Netflix: putting video caches inside ISP networks',
    summary:
      "Rather than serving video from its own data centres, Netflix runs Open Connect: purpose-built caching appliances placed inside internet providers' networks, plus direct peering at exchange points. Popular titles are pushed to those appliances ahead of demand, so a stream is usually served from within the viewer's own provider network. This cuts transit costs and congestion for both sides and shortens the path to the viewer. It is the extreme version of the general CDN pattern: move bytes as close to the user as possible, and treat the origin as a fallback.",
    whenToUse:
      'As the reference point for any product where media delivery dominates traffic and cost, and for reasoning about why edge caching matters more than origin capacity.',
    whenNotToUse:
      'As something to copy directly. Dedicated hardware inside ISPs is only justified at enormous scale; a commercial CDN is the equivalent for everyone else.',
    tradeoffs: [
      'Pre-positioning content requires predicting what will be popular.',
      'A large fleet of distributed appliances is significant operational work.',
      'Strongly personalised or live content benefits far less than a fixed catalogue.',
    ],
    sourceNote: 'Based on: Netflix Open Connect public documentation.',
    sourceUrl: 'https://openconnect.netflix.com/en/',
  },
  {
    slug: 'comparison-shopify-pods',
    kind: 'comparison',
    patternType: 'sharding',
    title: 'Shopify: isolating tenants into self-contained pods',
    summary:
      'After sharding its database by shop, Shopify found that a failing shard could still affect the wider platform, so it grouped shops into "pods": a set of shops living on a fully isolated set of datastores. Serving a request only requires that one pod to be healthy, which turns a platform-wide outage into a problem for a subset of shops. Pods can also be moved and recovered independently, which helps both with rebalancing and with disaster recovery. It shows that partitioning is not only about capacity: it is also a blast-radius decision.',
    whenToUse:
      'Multi-tenant products where one tenant is a natural boundary and where reducing the blast radius of a failure matters as much as capacity.',
    whenNotToUse:
      'Single-tenant products, or early-stage systems where one database is nowhere near its limits and isolation adds cost without benefit.',
    tradeoffs: [
      'Cross-tenant features and reporting become harder, needing a separate path.',
      'Capacity is managed per pod, so utilisation is less even than one shared pool.',
      'Moving tenants between pods needs dedicated tooling.',
    ],
    sourceNote:
      'Based on: Shopify engineering blog, "A Pods Architecture to Allow Shopify to Scale".',
    sourceUrl: 'https://shopify.engineering/a-pods-architecture-to-allow-shopify-to-scale',
  },
  {
    slug: 'comparison-notion-workspace-sharding',
    kind: 'comparison',
    patternType: 'sharding',
    title: 'Notion: sharding Postgres by workspace',
    summary:
      "Notion partitioned Postgres by workspace id, because every block belongs to exactly one workspace and people work inside a single workspace at a time, so ordinary queries stay on one shard. They created 480 logical shards spread across 32 physical databases, choosing 480 because it divides neatly many ways, which lets them move to 40 or 48 hosts later without doubling the fleet. It is a good illustration that the shard key should come from the product's own structure, and that logical shards give room to grow without re-sharding.",
    whenToUse:
      'Multi-tenant products with a natural container (workspace, team, account) that nearly all queries already filter by.',
    whenNotToUse:
      'Products whose queries routinely cut across tenants, or which are nowhere near the limits of a single database.',
    tradeoffs: [
      'Cross-workspace features need a separate path or fan-out.',
      'A single huge tenant can still overload one shard.',
      'The migration itself is a large, carefully staged project.',
    ],
    sourceNote: 'Based on: Notion engineering blog, "Sharding Postgres at Notion".',
    sourceUrl: 'https://www.notion.com/blog/sharding-postgres-at-notion',
  },
  {
    slug: 'comparison-figma-vertical-then-horizontal',
    kind: 'comparison',
    patternType: 'sharding',
    title: 'Figma: splitting by domain first, sharding second',
    summary:
      'Figma first scaled Postgres by vertical partitioning: moving groups of related tables (files, organisations and so on) into their own databases, which bought time without changing the data model. When that plateaued they moved to horizontal sharding on keys such as user id and file id, routing queries through a proxy that knows which physical shard holds the data and can gather results from several. They deliberately separated logical sharding in the application from physical sharding in the database, so the risky failover could be rehearsed before it was real.',
    whenToUse:
      'As a staged plan for a growing product: exhaust the simpler split by domain before committing to a shard key.',
    whenNotToUse:
      'Small systems, and teams without the capacity to build or adopt query routing, which is a substantial piece of infrastructure.',
    tradeoffs: [
      'Vertical partitioning removes cross-database joins and transactions between the split groups.',
      'A routing proxy becomes critical infrastructure of its own.',
      'The two-phase approach takes longer than sharding directly.',
    ],
    sourceNote:
      'Based on: Figma engineering blog, "How Figma\'s Databases Team Lived to Tell the Scale".',
    sourceUrl: 'https://www.figma.com/blog/how-figmas-databases-team-lived-to-tell-the-scale/',
  },
  {
    slug: 'comparison-stripe-idempotency-keys',
    kind: 'comparison',
    patternType: 'consistency',
    title: 'Stripe: idempotency keys on every write API',
    summary:
      'Stripe accepts a client-supplied idempotency key on POST requests and stores the status code and body of the first request made with that key, including failures. A retry with the same key returns the saved response instead of charging a customer twice, which makes network timeouts safe to retry. Keys can be pruned after about a day, and a reused key with different parameters is rejected, since that signals a client bug rather than a retry. It is the clearest public example of making an API safe to retry by design rather than by hope.',
    whenToUse:
      'Any API where a repeated request could take money, send a message or create a duplicate record.',
    whenNotToUse: 'Read-only endpoints, which are already safe to repeat.',
    tradeoffs: [
      'The server must store keys and responses, and expire them.',
      'Clients have to generate and reuse keys correctly.',
      'Concurrent duplicates still need careful handling.',
    ],
    sourceNote: 'Based on: Stripe API documentation on idempotent requests.',
    sourceUrl: 'https://docs.stripe.com/api/idempotent_requests',
  },
  {
    slug: 'comparison-facebook-memcache-lookaside',
    kind: 'comparison',
    patternType: 'caching',
    title: 'Facebook: running memcached as a look-aside cache at scale',
    summary:
      'Facebook put a very large fleet of memcached servers in front of its databases as a look-aside cache: the application asks the cache first, and on a miss reads the database and puts the value back. Two problems dominate at that size. A popular key expiring lets thousands of requests stampede the database at once, and a slow database read can put a stale value back into the cache after a newer write. Both are handled with leases: the cache hands exactly one client a token permitting it to refill a key, so others wait briefly instead of piling on, and a refill whose lease was invalidated by a write is thrown away. Invalidations are driven from the database commit log rather than from application code, so a write that lands is guaranteed to clear the cache.',
    whenToUse:
      'Read-heavy workloads where the same rows are fetched constantly, and where a brief window of slightly stale data is acceptable in exchange for a large drop in database load.',
    whenNotToUse:
      'Write-heavy or strongly consistent workloads, and small systems where the database is nowhere near its limits: a cache adds a second source of truth to keep honest.',
    tradeoffs: [
      'Every cache adds an invalidation problem, which is where most cache bugs live.',
      'Look-aside means the application, not the cache, owns the refill logic.',
      'Driving invalidation from the database log is reliable but needs extra plumbing.',
      'A cold or flushed cache can overwhelm the database it was protecting.',
    ],
    sourceNote: 'Based on: "Scaling Memcache at Facebook", USENIX NSDI 2013.',
    sourceUrl: 'https://www.usenix.org/system/files/conference/nsdi13/nsdi13-final170.pdf',
  },
  {
    slug: 'comparison-slack-job-queue-kafka-buffer',
    kind: 'comparison',
    patternType: 'queuing',
    title: 'Slack: putting Kafka in front of a Redis job queue',
    summary:
      'Slack originally held its background jobs entirely in Redis. When a database slowdown made workers execute jobs more slowly than the web app enqueued them, Redis hit its memory limit, and because it was full the system could neither add new jobs nor drain existing ones: the queue deadlocked itself. The redesign put Kafka in front as durable storage that grows on disk instead of in memory, with a relay service moving jobs from Kafka into Redis at a controlled rate. Redis now only holds work that is actively being executed. The lesson is that a queue whose backlog lives in memory turns a slowdown into an outage, and that separating "accepted" from "in progress" lets the two sides run at different speeds.',
    whenToUse:
      'Any system where work is enqueued by user-facing requests and executed by workers, especially when a downstream dependency can slow execution down without warning.',
    whenNotToUse:
      'Small job volumes that comfortably fit in memory with headroom, where a second piece of infrastructure costs more than it saves.',
    tradeoffs: [
      'Two systems to operate and monitor instead of one.',
      'A relay between them is another moving part that can fall behind.',
      'Durable buffering hides backpressure, so the backlog must be watched deliberately.',
    ],
    sourceNote: 'Based on: Slack engineering blog, "Scaling Slack\'s Job Queue".',
    sourceUrl: 'https://slack.engineering/scaling-slacks-job-queue/',
  },
  {
    slug: 'comparison-github-code-search-ngrams',
    kind: 'comparison',
    patternType: 'search',
    title: 'GitHub: building a purpose-built index for code search',
    summary:
      'GitHub repeatedly tried general-purpose text search engines for code and found them a poor fit: code search needs substring and regular-expression matching, punctuation is meaningful, and word stemming actively hurts. It eventually built Blackbird, a dedicated engine that indexes overlapping character sequences (ngrams) so an arbitrary substring can be looked up quickly, and shards the index by content hash so identical files across forks are stored once. Documents flow through Kafka into the shards, each consuming its own partition. The general point is that search is not one product: the shape of the queries decides whether an off-the-shelf engine fits or whether the index has to be designed around the data.',
    whenToUse:
      'As the reference point when deciding between a managed search service and something custom: compare the query shapes you need against what the general engines are optimised for.',
    whenNotToUse:
      'As a template to copy. Ordinary product search over titles and descriptions is exactly what off-the-shelf engines are good at; building your own is rarely justified.',
    tradeoffs: [
      'A custom index is a large, permanent engineering commitment.',
      'Ngram indices are fast to query but considerably larger than word indices.',
      'Keeping a separate index in step with the source of truth is ongoing work.',
    ],
    sourceNote: 'Based on: GitHub engineering blog on the technology behind GitHub code search.',
    sourceUrl: 'https://github.blog/engineering/the-technology-behind-githubs-new-code-search/',
  },
  {
    slug: 'comparison-dropbox-magic-pocket-blocks',
    kind: 'comparison',
    patternType: 'storage',
    title: 'Dropbox: immutable block storage in Magic Pocket',
    summary:
      'Dropbox stores file contents in Magic Pocket, a system built around blocks of up to four megabytes that are encrypted and never modified once written. Mutability is handled above the storage layer, so a file edit writes new blocks rather than changing old ones, which removes a whole class of concurrency problems from the storage system. Freshly uploaded blocks are replicated onto several machines for durability, then converted to erasure coding once they cool down, which keeps the same durability for far less raw capacity. Blocks are grouped into buckets and volumes, spread over cells of roughly fifty petabytes, and every block is kept in at least two geographic zones.',
    whenToUse:
      'As the reference model for content-addressed, immutable object storage: treat uploads as blocks that are written once and referenced, rather than files edited in place.',
    whenNotToUse:
      'As something to build. For almost everyone the equivalent is a managed object store; running storage hardware only makes sense at extraordinary scale.',
    tradeoffs: [
      'Immutability simplifies storage but pushes versioning and garbage collection upward.',
      'Erasure coding saves space but makes recovering a single block more expensive.',
      'Operating physical storage is a large, permanent commitment of people, not just money.',
    ],
    sourceNote: 'Based on: Dropbox engineering blog, "Inside the Magic Pocket".',
    sourceUrl: 'https://dropbox.tech/infrastructure/inside-the-magic-pocket',
  },
  {
    slug: 'comparison-stripe-rate-limiters-and-shedders',
    kind: 'comparison',
    patternType: 'rate-limiting',
    title: 'Stripe: layered rate limiters and load shedders',
    summary:
      'Stripe distinguishes rate limiting, which protects the service from a single noisy caller, from load shedding, which decides what to sacrifice when the whole fleet is under strain. It runs four layers: a request rate limiter using a token bucket per user, which refills steadily and tolerates short bursts; a concurrency limiter capping how many requests a user may have in flight, aimed at expensive endpoints; a fleet usage shedder that reserves capacity for critical traffic and returns 503 to non-critical traffic beyond its share; and a worker utilisation shedder that, as workers saturate, drops traffic by priority, shedding test-mode and read traffic before writes and critical operations. The limiters are implemented on Redis.',
    whenToUse:
      'Any public or multi-tenant API. Start with the per-user request limiter, and add the others as real traffic shows where the pain is.',
    whenNotToUse:
      'Internal endpoints with a small number of trusted callers, where a limiter mostly adds a new way to cause an incident.',
    tradeoffs: [
      'Limits that are too tight break legitimate clients; too loose and they protect nothing.',
      'Shared counters need a fast store, which becomes a dependency on the hot path.',
      'Prioritising traffic requires deciding in advance what is genuinely critical.',
    ],
    sourceNote: 'Based on: Stripe engineering blog, "Scaling your API with rate limiters".',
    sourceUrl: 'https://stripe.com/blog/rate-limiters',
  },
  {
    slug: 'comparison-google-beyondcorp-perimeterless',
    kind: 'comparison',
    patternType: 'auth',
    title: 'Google: dropping the network perimeter in BeyondCorp',
    summary:
      'Google moved away from treating its internal network as trusted. In the traditional model, being inside the corporate network implies permission, so a single breach of the perimeter gives an attacker easy movement across internal systems. BeyondCorp removes that assumption: applications are reached through an access proxy, and every request is authorised on the identity of the user and the state of the device rather than on where the connection originates. The consequence for ordinary systems is the principle rather than the machinery: network position should not be an authorisation decision. A service that trusts any caller who reached it from inside the cluster has the same weakness at smaller scale.',
    whenToUse:
      'When deciding how services authenticate each other, and whenever a design is tempted to leave an internal service unauthenticated because it is "not exposed".',
    whenNotToUse:
      'As a reason to build a device-trust platform. For most products the practical version is a managed identity provider plus authenticated service-to-service calls.',
    tradeoffs: [
      'Authorising every request costs more than trusting a network boundary.',
      'It depends heavily on an accurate inventory of users and devices.',
      'A central access proxy becomes critical infrastructure in its own right.',
    ],
    sourceNote: 'Based on: "BeyondCorp: A New Approach to Enterprise Security", ;login: 2014.',
    sourceUrl: 'https://research.google/pubs/beyondcorp-a-new-approach-to-enterprise-security/',
  },
  {
    slug: 'comparison-google-dapper-tracing',
    kind: 'comparison',
    patternType: 'observability',
    title: 'Google: distributed tracing with Dapper',
    summary:
      'Once a request touches many services, per-service logs stop explaining latency, because no single log knows the whole path. Dapper attaches a trace identifier to a request and records a span for each unit of work, so the full call tree can be reconstructed and the slow part identified. Two decisions made it usable everywhere. It samples rather than recording every request, which keeps the overhead low enough to leave on permanently in production. And the instrumentation lives in a small number of shared libraries that everything already uses, so individual teams get tracing without writing tracing code. Dapper is the ancestor of the tracing tools in common use today.',
    whenToUse:
      'As soon as a request crosses more than two or three services, or when latency complaints cannot be pinned to a component from logs alone.',
    whenNotToUse:
      'A single service with a single database, where request logs and a few timing metrics answer the same questions far more cheaply.',
    tradeoffs: [
      'Sampling keeps the cost down but means a specific slow request may not be captured.',
      'Trace context has to be propagated everywhere, including across queues.',
      'Stored traces are bulky and need a retention policy.',
    ],
    sourceNote:
      'Based on: "Dapper, a Large-Scale Distributed Systems Tracing Infrastructure", Google, 2010.',
    sourceUrl:
      'https://research.google/pubs/dapper-a-large-scale-distributed-systems-tracing-infrastructure/',
  },
  {
    slug: 'comparison-github-mysql-failover',
    kind: 'comparison',
    patternType: 'replication',
    title: 'GitHub: automating MySQL primary failover',
    summary:
      'GitHub runs MySQL with one primary taking writes and replicas across several data centres replaying changes and serving reads. The interesting part is what happens when the primary dies. Failure detection and promotion are handled by orchestrator nodes that agree through a consensus protocol, deliberately arranged so that no single data centre holds a majority and can therefore trigger a failover on its own. Once a replica is promoted, its identity is written to a key-value store, and proxies in front of the database reload their configuration from it, so applications keep using one stable address and never learn which server is primary. GitHub reports typical total outage windows of roughly ten to thirteen seconds.',
    whenToUse:
      'Any design with a single write primary where an unplanned failure must not require a human to promote a replica by hand.',
    whenNotToUse:
      'Early systems on a managed database, where the provider already handles failover and rebuilding it yourself adds risk rather than removing it.',
    tradeoffs: [
      'Automatic failover can fire on a false alarm, so detection must tolerate blips.',
      'Consensus across data centres avoids split brain but adds moving parts.',
      'Asynchronous replication means a failover can still lose the most recent writes.',
    ],
    sourceNote: 'Based on: GitHub engineering blog on MySQL high availability.',
    sourceUrl: 'https://github.blog/engineering/mysql-high-availability-at-github/',
  },
  {
    slug: 'comparison-netflix-zuul-edge-gateway',
    kind: 'comparison',
    patternType: 'cdn',
    title: 'Netflix: concentrating edge concerns in the Zuul gateway',
    summary:
      'Zuul is the single front door through which Netflix devices and websites reach backend services, built as a chain of filters that run on every request. Concentrating the edge in one place means authentication, request logging and metrics, dynamic routing to different backend clusters, load shedding when a service is struggling, canned responses served without touching upstream, and shifting traffic between regions are all implemented once rather than in every service. The motivation was operational: problems appear suddenly and without warning at that traffic volume, and a programmable edge lets behaviour change in minutes without redeploying everything behind it.',
    whenToUse:
      'Once several services face the public and each would otherwise re-implement authentication, rate limiting, routing and request logging.',
    whenNotToUse:
      'A single backend service, where a gateway is an extra hop and an extra thing to operate for no real gain.',
    tradeoffs: [
      'The gateway becomes a single point of failure and must be treated as critical.',
      'Business logic tends to creep into filters, where it is hard to find later.',
      'Every request pays an extra network hop.',
    ],
    sourceNote: 'Based on: the Netflix Zuul project wiki.',
    sourceUrl: 'https://github.com/Netflix/zuul/wiki',
  },
  {
    slug: 'comparison-segment-microservices-to-monolith',
    kind: 'comparison',
    patternType: 'cost',
    title: 'Segment: consolidating microservices back into a monolith',
    summary:
      'Segment split its event pipeline into a service per destination so that one slow partner could not block the others. Adding roughly three destinations a month, it reached more than a hundred and forty services with a repository each, and the overhead overtook the benefit: shared library versions drifted apart, a single change had to be tested and deployed across dozens of services, low-traffic services still needed individual scaling attention, and on-call load kept climbing. Consolidating back into one service restored a single test suite and deploy, and the number of shared library improvements per year went up. The costs were real and acknowledged: a bug in one destination can now affect all of them, and fault isolation was the thing being given up.',
    whenToUse:
      'Whenever service boundaries are being chosen, as the counterweight to the assumption that more services is automatically more scalable.',
    whenNotToUse:
      'As an argument against separating genuinely independent workloads with different scaling or availability needs.',
    tradeoffs: [
      'A monolith trades fault isolation for a dramatically simpler operational story.',
      'Per-service scaling is lost, so noisy workloads affect their neighbours.',
      'Consolidation is a large migration, not a configuration change.',
    ],
    sourceNote: 'Based on: Segment engineering blog, "Goodbye Microservices".',
    sourceUrl: 'https://www.twilio.com/en-us/blog/developers/best-practices/goodbye-microservices/',
  },
];
