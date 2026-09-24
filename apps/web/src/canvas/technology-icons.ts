import {
  siAkamai,
  siAlgolia,
  siApachekafka,
  siAuth0,
  siClickhouse,
  siCloudflare,
  siCloudinary,
  siDatadog,
  siDocker,
  siElasticsearch,
  siFastly,
  siFirebase,
  siGo,
  siGooglecloud,
  siGrafana,
  siKubernetes,
  siMeilisearch,
  siMongodb,
  siMysql,
  siNeon,
  siNginx,
  siNodedotjs,
  siPlanetscale,
  siPostgresql,
  siPrometheus,
  siPython,
  siRabbitmq,
  siReact,
  siRedis,
  siSentry,
  siSnowflake,
  siSqlite,
  siStripe,
  siSupabase,
  siTypescript,
  siVercel,
} from 'simple-icons';

export interface TechnologyIcon {
  title: string;
  /** Brand colour, without the leading #. */
  hex: string;
  /** SVG path data for a 24x24 viewBox. */
  path: string;
}

/*
 * Maps the free-text technology the AI names ("PostgreSQL", "Managed Redis") to
 * a brand icon. First match wins, so put specific names before general ones.
 * Amazon/AWS icons are deliberately absent from the icon set, so those
 * components fall back to their role icon.
 */
const RULES: [RegExp, TechnologyIcon][] = [
  [/postgres|pgvector|rds/i, siPostgresql],
  [/redis|valkey|elasticache/i, siRedis],
  [/cloudflare|r2\b|workers/i, siCloudflare],
  [/kafka/i, siApachekafka],
  [/rabbit/i, siRabbitmq],
  [/elasticsearch|opensearch/i, siElasticsearch],
  [/meilisearch/i, siMeilisearch],
  [/algolia/i, siAlgolia],
  [/mongo|documentdb/i, siMongodb],
  [/mysql|mariadb|aurora/i, siMysql],
  [/sqlite/i, siSqlite],
  [/clickhouse/i, siClickhouse],
  [/snowflake/i, siSnowflake],
  [/planetscale/i, siPlanetscale],
  [/\bneon\b/i, siNeon],
  [/supabase/i, siSupabase],
  [/firebase|firestore/i, siFirebase],
  [/auth0|okta/i, siAuth0],
  [/nginx|envoy/i, siNginx],
  [/kubernetes|k8s|eks|gke/i, siKubernetes],
  [/docker|container/i, siDocker],
  [/node\.?\s?js|express|nest/i, siNodedotjs],
  [/typescript/i, siTypescript],
  [/python|django|fastapi|flask/i, siPython],
  [/\bgolang\b|\bgo\b/i, siGo],
  [/react|next\.?js/i, siReact],
  [/stripe/i, siStripe],
  [/vercel/i, siVercel],
  [/cloudinary|imgix/i, siCloudinary],
  [/fastly/i, siFastly],
  [/akamai/i, siAkamai],
  [/grafana|loki/i, siGrafana],
  [/prometheus/i, siPrometheus],
  [/sentry/i, siSentry],
  [/datadog/i, siDatadog],
  [/google cloud|gcp|bigquery|pub\/?sub/i, siGooglecloud],
];

/** The brand icon for a technology name, or null when we have none. */
export function findTechnologyIcon(technology: string | undefined): TechnologyIcon | null {
  if (!technology) return null;
  for (const [pattern, icon] of RULES) {
    if (pattern.test(technology)) return icon;
  }
  return null;
}
