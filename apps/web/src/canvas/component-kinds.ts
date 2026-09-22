import type { ComponentKind } from '@trestle/shared';
import {
  Boxes,
  Cloud,
  Cog,
  Database,
  Globe,
  HardDrive,
  ListOrdered,
  Monitor,
  Search,
  Server,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/** Icon + accent colour per component kind, so kinds are recognisable at a glance. */
export const componentKindStyles: Record<
  ComponentKind,
  { icon: LucideIcon; label: string; accent: string }
> = {
  client: { icon: Monitor, label: 'Client', accent: 'text-[#9aa0b4]' },
  gateway: { icon: Globe, label: 'Gateway', accent: 'text-brand-soft' },
  service: { icon: Server, label: 'Service', accent: 'text-brand-soft' },
  worker: { icon: Cog, label: 'Worker', accent: 'text-brand-soft' },
  database: { icon: Database, label: 'Database', accent: 'text-success' },
  cache: { icon: Zap, label: 'Cache', accent: 'text-warning' },
  queue: { icon: ListOrdered, label: 'Queue', accent: 'text-warning' },
  storage: { icon: HardDrive, label: 'Storage', accent: 'text-success' },
  search: { icon: Search, label: 'Search', accent: 'text-success' },
  cdn: { icon: Cloud, label: 'CDN', accent: 'text-[#5ac8fa]' },
  external: { icon: Boxes, label: 'External', accent: 'text-tertiary' },
};
