import type { ReactNode } from 'react';
import { ArrowRight, ClipboardList, GitBranch, Network } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { paths } from '@/lib/paths';
import { cn } from '@/lib/utils';
import {
  CostMock,
  DiffMock,
  GroundingMock,
  MiniCanvas,
  RationalePanelMock,
  WindowFrame,
  type MiniEdge,
  type MiniNode,
} from './mockups';

export function LandingPage() {
  return (
    <>
      <Hero />
      <ProofStrip />
      <HowItWorks />
      <Features />
      <FinalCta />
    </>
  );
}

// ---------------------------------------------------------------------------

const heroNodes: MiniNode[] = [
  { id: 'gateway', type: 'service', label: 'API Gateway', x: 16, y: 104 },
  { id: 'catalog', type: 'service', label: 'Catalog Service', x: 226, y: 32, state: 'selected' },
  { id: 'playback', type: 'service', label: 'Playback Service', x: 226, y: 176 },
  { id: 'cache', type: 'infra', label: 'Redis Cache', x: 436, y: 32 },
  { id: 'cdn', type: 'infra', label: 'CDN', x: 436, y: 176 },
];
const heroEdges: MiniEdge[] = [
  { from: 'gateway', to: 'catalog' },
  { from: 'gateway', to: 'playback' },
  { from: 'catalog', to: 'cache' },
  { from: 'playback', to: 'cdn' },
  { from: 'catalog', to: 'cdn' },
];

function Hero() {
  return (
    <section className="relative overflow-hidden pt-20 pb-20 sm:pt-24">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-50 left-1/2 h-125 w-225 -translate-x-1/2 bg-[radial-gradient(ellipse,rgb(108_92_231/0.2)_0%,transparent_70%)]"
      />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-8">
        <p className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#332b5c] bg-brand-subtle px-3 py-1.5 font-mono text-xs text-brand-soft">
          <span className="size-1.5 rounded-full bg-success" />
          System design, explained as it's generated
        </p>
        <h1 className="max-w-3xl text-4xl leading-[1.08] font-bold tracking-tight sm:text-6xl">
          Design your system before you build it.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Describe what you're building. Trestle drafts an editable architecture, explains the
          reasoning behind every component, and evolves it with you as your requirements change, one
          reviewed change at a time.
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Button asChild size="lg" className="h-12 px-6 text-[15px] font-semibold">
            <Link to={paths.signup}>
              Start designing free
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="lg"
            className="h-12 px-4 text-[15px] text-muted-foreground"
          >
            <a href="#how-it-works">See how it works</a>
          </Button>
        </div>

        <WindowFrame className="mt-18">
          <div className="bg-canvas-grid flex flex-col md:flex-row">
            <div className="hidden flex-1 justify-center overflow-hidden py-8 md:flex">
              <MiniCanvas nodes={heroNodes} edges={heroEdges} width={600} height={264} />
            </div>
            <RationalePanelMock
              title="Catalog Service"
              body="Owns song, album and artist metadata. Split from Playback because catalog reads are heavy and cacheable, while playback is session-oriented."
              alternative="combine with Playback"
            />
          </div>
        </WindowFrame>
      </div>
    </section>
  );
}

function ProofStrip() {
  const items = [
    'Engineering blogs',
    'System design references',
    'Published production architectures',
    'Cost & scaling patterns',
  ];
  return (
    <div className="border-y border-subtle py-9">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 px-4 sm:px-8">
        <p className="font-mono text-xs text-tertiary">GROUNDED IN PATTERNS FROM</p>
        <ul className="flex flex-wrap gap-x-7 gap-y-2 text-[13px] text-tertiary">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function SectionHeading({
  tag,
  title,
  children,
}: {
  tag: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-14 max-w-2xl">
      <p className="mb-3.5 font-mono text-xs tracking-wide text-brand uppercase">{tag}</p>
      <h2 className="text-3xl leading-tight font-bold tracking-tight sm:text-[34px]">{title}</h2>
      <p className="mt-4 leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    {
      icon: ClipboardList,
      title: 'Describe',
      body: 'Tell Trestle what you are building: features, expected users, read/write mix, latency and consistency needs, budget.',
    },
    {
      icon: Network,
      title: 'Generate',
      body: 'Get an editable architecture where every component comes with its reasoning, alternatives, comparisons and a rough cost.',
    },
    {
      icon: GitBranch,
      title: 'Evolve',
      body: 'Ask for changes in plain language. Review the proposed diff, accept what you want, and keep a full version history.',
    },
  ];
  return (
    <section id="how-it-works" className="scroll-mt-20 py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-8">
        <SectionHeading tag="How it works" title="Three steps from idea to architecture">
          No blank canvas and no black box. You stay in control of every decision.
        </SectionHeading>
        <ol className="grid gap-5 md:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="rounded-2xl border bg-elevated/60 p-6">
              <div className="flex items-center justify-between">
                <span className="flex size-9 items-center justify-center rounded-lg bg-brand-subtle text-brand-soft">
                  <step.icon className="size-4.5" aria-hidden="true" />
                </span>
                <span className="font-mono text-xs text-tertiary">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </div>
              <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

interface FeatureRowProps {
  id?: string;
  title: string;
  body: string;
  points: string[];
  visual: ReactNode;
  reverse?: boolean;
}

function FeatureRow({ id, title, body, points, visual, reverse }: FeatureRowProps) {
  return (
    <div id={id} className="grid scroll-mt-24 items-center gap-10 md:grid-cols-2 md:gap-16">
      <div className={cn(reverse && 'md:order-2')}>
        <h3 className="mb-3.5 text-2xl font-semibold tracking-tight">{title}</h3>
        <p className="mb-5 leading-relaxed text-muted-foreground">{body}</p>
        <ul className="flex flex-col gap-2.5">
          {points.map((point) => (
            <li key={point} className="flex gap-2.5 text-sm text-[#d4d6e0]">
              <span aria-hidden="true" className="font-mono text-brand">
                —
              </span>
              {point}
            </li>
          ))}
        </ul>
      </div>
      <div className={cn(reverse && 'md:order-1')}>{visual}</div>
    </div>
  );
}

const rationaleNodes: MiniNode[] = [
  { id: 'auth', type: 'service', label: 'Auth Service', x: 8, y: 92 },
  { id: 'pg', type: 'data', label: 'Postgres (sharded)', x: 196, y: 24, state: 'selected' },
  { id: 'session', type: 'infra', label: 'Session Store', x: 196, y: 160 },
];
const rationaleEdges: MiniEdge[] = [
  { from: 'auth', to: 'pg' },
  { from: 'auth', to: 'session' },
];

function Features() {
  return (
    <section id="features" className="scroll-mt-20 pb-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-8">
        <SectionHeading tag="Features" title="From a description to an architecture you can defend">
          Trestle produces a structured design, not just a picture. Each component knows why it
          exists, what it replaced, and what it will cost.
        </SectionHeading>

        <div className="flex flex-col gap-28">
          <FeatureRow
            title="Every component explains itself"
            body="Click any node to see why it's there: the tradeoff it resolves, the alternatives that were considered, and when you'd want to revisit it."
            points={[
              'Structured intake: project type, scale, priorities, budget',
              'An editable node-graph canvas, not a static image',
              'Rationale, alternatives and tradeoffs on every component',
            ]}
            visual={
              <WindowFrame label="Example">
                <div className="bg-canvas-grid flex flex-col">
                  <div className="hidden justify-center overflow-hidden py-6 sm:flex">
                    <MiniCanvas
                      nodes={rationaleNodes}
                      edges={rationaleEdges}
                      width={352}
                      height={232}
                    />
                  </div>
                  <RationalePanelMock
                    stacked
                    title="Postgres (sharded)"
                    body="Sharded by user_id to spread write load evenly as accounts grow past what a single instance can handle."
                    alternative="single unsharded instance"
                  />
                </div>
              </WindowFrame>
            }
          />

          <FeatureRow
            reverse
            title="Suggest first, never auto-apply"
            body={`Ask for a change in plain language, like "add live chat between users", and Trestle proposes exactly what would change as a preview. Nothing is merged until you approve it.`}
            points={[
              'Targeted diffs, not full regenerations: your design stays intact',
              'Accept or reject each proposed change individually',
              'Every accepted change becomes a versioned snapshot',
            ]}
            visual={<DiffMock />}
          />

          <FeatureRow
            id="grounding"
            title="Grounded, not guessed"
            body="Before generating, Trestle retrieves relevant patterns from a curated library of system design references and engineering write-ups, so its reasoning points back to a source."
            points={[
              'Retrieval by pattern: caching, sharding, queuing and more',
              'Industry comparisons show how similar systems solve the same problem',
              'Stores extracted patterns and summaries, never copied source text',
            ]}
            visual={<GroundingMock />}
          />

          <FeatureRow
            reverse
            title="Know what it costs before you build it"
            body="Each component carries a rough monthly cost at your traffic level, plus a warning where it's likely to become a bottleneck as you grow."
            points={[
              'Per-component cost breakdown for your traffic tier',
              'Bottleneck warnings at higher traffic multiples',
              'Directional estimates, clearly labelled as such',
            ]}
            visual={<CostMock />}
          />
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative overflow-hidden py-28 text-center">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-1/2 h-100 w-175 -translate-x-1/2 bg-[radial-gradient(ellipse,rgb(108_92_231/0.18),transparent_70%)]"
      />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-8">
        <h2 className="mx-auto mb-5 max-w-xl text-3xl font-bold tracking-tight sm:text-[38px]">
          Stop designing systems in a vacuum.
        </h2>
        <p className="mb-9 text-muted-foreground">
          Bring your requirements. Leave with an architecture you can defend.
        </p>
        <Button asChild size="lg" className="h-12 px-6 text-[15px] font-semibold">
          <Link to={paths.signup}>
            Start designing free
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
