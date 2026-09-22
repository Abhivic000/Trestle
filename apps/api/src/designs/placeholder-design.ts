import { DESIGN_SCHEMA_VERSION, type Design, type Requirements } from '@trestle/shared';

/**
 * Stand-in design stored as version 1 until real AI generation lands (step 6.4).
 * It is deliberately generic and labelled as a placeholder in the UI: it is NOT
 * tailored to the user's requirements and must never be presented as advice.
 */
export function buildPlaceholderDesign(requirements: Requirements): Design {
  const scale = requirements.dailyActiveUsers.toLocaleString('en-US');

  return {
    schemaVersion: DESIGN_SCHEMA_VERSION,
    origin: 'placeholder',
    summary:
      `Placeholder architecture for roughly ${scale} daily active users. ` +
      'It shows the shape of a typical web backend so you can explore the canvas. ' +
      'Generating a design from your actual requirements comes next.',
    components: [
      {
        id: 'client-app',
        kind: 'client',
        label: 'Client app',
        responsibility: 'Browser or mobile app that people use.',
        rationale: 'Every design starts with the client that sends the traffic.',
        alternatives: [],
        tradeoffs: [],
        sources: [],
        position: { x: 0, y: 160 },
      },
      {
        id: 'api-gateway',
        kind: 'gateway',
        label: 'API gateway',
        responsibility: 'Single entry point: checks the login token and routes requests.',
        rationale: 'Keeps authentication and routing in one place instead of in every service.',
        alternatives: [
          {
            option: 'Clients call each service directly',
            whyNot: 'Auth logic ends up duplicated everywhere.',
          },
        ],
        tradeoffs: ['One more hop, and a component that must stay highly available.'],
        sources: [],
        position: { x: 260, y: 160 },
      },
      {
        id: 'app-service',
        kind: 'service',
        label: 'Application service',
        responsibility: 'Runs the core product logic.',
        rationale:
          'A single service is the simplest thing that works until load or team size forces a split.',
        alternatives: [
          {
            option: 'Several microservices',
            whyNot: 'More moving parts than an early product needs.',
          },
        ],
        tradeoffs: ['Everything scales together, even if only one part is busy.'],
        sources: [],
        position: { x: 540, y: 160 },
      },
      {
        id: 'primary-db',
        kind: 'database',
        label: 'Primary database',
        technology: 'PostgreSQL',
        responsibility: 'Stores the product data and is the source of truth.',
        rationale:
          'A relational database handles related data and transactions well at this scale.',
        alternatives: [
          {
            option: 'Document database',
            whyNot: 'Relationships and transactions are harder to get right.',
          },
        ],
        tradeoffs: ['A single primary eventually becomes a write bottleneck.'],
        sources: [],
        position: { x: 820, y: 60 },
      },
      {
        id: 'cache',
        kind: 'cache',
        label: 'Cache',
        technology: 'Redis',
        responsibility: 'Keeps frequently read data in memory.',
        rationale: 'Read-heavy traffic is usually concentrated on a small share of the data.',
        alternatives: [
          { option: 'No cache', whyNot: 'Repeated reads hit the database for no reason.' },
        ],
        tradeoffs: ['Cached data can be briefly out of date.'],
        sources: [],
        position: { x: 820, y: 260 },
      },
    ],
    connections: [
      {
        id: 'client-app__api-gateway',
        from: 'client-app',
        to: 'api-gateway',
        kind: 'sync',
        label: 'HTTPS',
      },
      {
        id: 'api-gateway__app-service',
        from: 'api-gateway',
        to: 'app-service',
        kind: 'sync',
        label: 'REST',
      },
      {
        id: 'app-service__primary-db',
        from: 'app-service',
        to: 'primary-db',
        kind: 'data',
        label: 'reads/writes',
      },
      { id: 'app-service__cache', from: 'app-service', to: 'cache', kind: 'data', label: 'reads' },
    ],
    dataModel: [
      {
        name: 'User',
        storedIn: 'primary-db',
        keyFields: ['id', 'email', 'created_at'],
        notes: 'Every product has an account of some kind.',
      },
    ],
  };
}
