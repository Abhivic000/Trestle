import { z } from 'zod';

/*
 * What the user tells us about the project they want to build: the input to
 * design generation. Used by the intake form in the browser AND by the API to
 * validate what arrives, so both sides enforce the same rules.
 */

export const projectTypes = [
  'web_app',
  'mobile_backend',
  'saas',
  'marketplace',
  'social',
  'streaming',
  'ecommerce',
  'analytics',
  'other',
] as const;
export type ProjectType = (typeof projectTypes)[number];

export const projectTypeLabels: Record<ProjectType, string> = {
  web_app: 'Web application',
  mobile_backend: 'Mobile app backend',
  saas: 'SaaS product',
  marketplace: 'Marketplace',
  social: 'Social / community',
  streaming: 'Media streaming',
  ecommerce: 'E-commerce',
  analytics: 'Analytics / data platform',
  other: 'Other',
};

export const trafficShapes = ['read_heavy', 'balanced', 'write_heavy'] as const;
export type TrafficShape = (typeof trafficShapes)[number];
export const trafficShapeLabels: Record<TrafficShape, string> = {
  read_heavy: 'Mostly reads (e.g. 90:10)',
  balanced: 'Roughly balanced',
  write_heavy: 'Mostly writes',
};

export const priorityLevels = ['low', 'medium', 'high'] as const;
export type PriorityLevel = (typeof priorityLevels)[number];

export const consistencyNeeds = ['eventual', 'strong'] as const;
export type ConsistencyNeed = (typeof consistencyNeeds)[number];

export const availabilityTargets = ['99', '99.9', '99.99'] as const;
export type AvailabilityTarget = (typeof availabilityTargets)[number];
export const availabilityTargetLabels: Record<AvailabilityTarget, string> = {
  '99': '99% (a few hours down per month is fine)',
  '99.9': '99.9% (about 45 minutes per month)',
  '99.99': '99.99% (about 4 minutes per month)',
};

export const budgetTiers = ['hobby', 'startup', 'funded', 'enterprise'] as const;
export type BudgetTier = (typeof budgetTiers)[number];
export const budgetTierLabels: Record<BudgetTier, string> = {
  hobby: 'Hobby (free tiers, under $50/mo)',
  startup: 'Early startup (a few hundred $/mo)',
  funded: 'Funded (thousands $/mo)',
  enterprise: 'Enterprise (cost is not the constraint)',
};

export const complianceNeeds = ['gdpr', 'hipaa', 'pci', 'soc2'] as const;
export type ComplianceNeed = (typeof complianceNeeds)[number];
export const complianceNeedLabels: Record<ComplianceNeed, string> = {
  gdpr: 'GDPR (EU personal data)',
  hipaa: 'HIPAA (US health data)',
  pci: 'PCI DSS (card payments)',
  soc2: 'SOC 2 (security controls audit)',
};

const requirementsFields = z.object({
  projectType: z.enum(projectTypes),
  /** Required when projectType is "other". */
  projectTypeOther: z.string().max(80).optional(),
  /** What the product does, one feature per entry. */
  features: z
    .array(z.string().min(2, 'Too short.').max(120))
    .min(1, 'Add at least one feature.')
    .max(20, 'Twenty features is plenty for one design.'),
  dailyActiveUsers: z
    .number({ error: 'Enter a number of daily active users.' })
    .int()
    .min(1, 'Must be at least 1.')
    .max(1_000_000_000),
  trafficShape: z.enum(trafficShapes),
  latencySensitivity: z.enum(priorityLevels),
  consistency: z.enum(consistencyNeeds),
  availability: z.enum(availabilityTargets),
  budget: z.enum(budgetTiers),
  compliance: z.array(z.enum(complianceNeeds)).max(4).default([]),
  /** Existing constraints, e.g. "must run on AWS", "team knows Python". */
  constraints: z.string().max(600).default(''),
  /** Anything the form didn't ask for. */
  notes: z.string().max(2000).default(''),
});

export const requirementsSchema = requirementsFields.superRefine((requirements, ctx) => {
  if (requirements.projectType === 'other' && !requirements.projectTypeOther?.trim()) {
    ctx.addIssue({
      code: 'custom',
      path: ['projectTypeOther'],
      message: 'Describe the project type.',
    });
  }
});

/** Validated requirements, with every default filled in. */
export type Requirements = z.infer<typeof requirementsSchema>;

/**
 * The shape accepted *before* validation: fields with defaults may be missing.
 * Forms hold this type while being edited.
 */
export type RequirementsInput = z.input<typeof requirementsSchema>;

/** Human-readable project name derived from the requirements. */
export function projectNameFromRequirements(requirements: Requirements): string {
  const type =
    requirements.projectType === 'other'
      ? (requirements.projectTypeOther?.trim() ?? '')
      : projectTypeLabels[requirements.projectType];
  return (type || 'Untitled project').slice(0, 80);
}
