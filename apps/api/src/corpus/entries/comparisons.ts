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
];
