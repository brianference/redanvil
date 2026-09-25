/**
 * English copy for the template gallery, composer and variants.
 * Composed into the central locale bundle in ./en.ts.
 */
export const templates = {
  title: 'Start from a template',
  subtitle: 'Pick an app archetype, or describe your own below.',
  gridLabel: 'App type templates',
  sectionLabel: 'App types',
  sectionCount: (n: number): string => (n === 1 ? '1 template' : `${n} templates`),
  variantsLabel: 'Starter variants',
  variantsHint: 'Pick a concrete starter under this type, or keep the default prompt.',
  orDescribe: 'or describe your own',
  composerLabel: 'Your app idea',
  composerPlaceholder:
    'e.g. A booking system for independent bike shops with inventory and SMS reminders',
  continue: 'Continue to questions',
  backToChat: 'Back to chat',
  selected: 'Selected',
  emptyHint: 'Pick a template or write your own description to continue.',
  emptyTitle: 'No template selected',
  examplesLabel: 'Example prompts',
  items: [
    {
      id: 'saas',
      title: 'SaaS',
      description: 'Subscriptions, teams, billing, dashboards',
      appType: 'SaaS dashboard',
      prompt: 'A multi-tenant SaaS dashboard with team invites, billing, and usage analytics',
      variants: [
        {
          id: 'saas-analytics',
          label: 'Analytics dashboard',
          appType: 'SaaS dashboard',
          prompt:
            'A multi-tenant SaaS analytics dashboard with team invites, usage charts, and CSV export'
        },
        {
          id: 'saas-billing',
          label: 'Team billing & seats',
          appType: 'SaaS dashboard',
          prompt:
            'A SaaS app with seat-based billing, plan upgrades, team invites, and invoice history'
        },
        {
          id: 'saas-admin',
          label: 'Admin console',
          appType: 'SaaS dashboard',
          prompt:
            'A SaaS admin console with role-based access, audit logs, and customer account search'
        },
        {
          id: 'saas-onboarding',
          label: 'Product onboarding',
          appType: 'SaaS dashboard',
          prompt:
            'A SaaS product with guided onboarding, checklist progress, and team workspace setup'
        }
      ]
    },
    {
      id: 'marketplace',
      title: 'Marketplace',
      description: 'Listings, search, checkout, sellers',
      appType: 'Marketplace',
      prompt: 'A marketplace for local makers with listings, search, tips, and pickup slots',
      variants: [
        {
          id: 'market-local',
          label: 'Local services',
          appType: 'Marketplace',
          prompt:
            'A local services marketplace with provider profiles, booking slots, and reviews'
        },
        {
          id: 'market-digital',
          label: 'Digital goods',
          appType: 'Marketplace',
          prompt:
            'A digital goods marketplace with listings, secure download delivery, and seller payouts'
        },
        {
          id: 'market-rentals',
          label: 'Rentals',
          appType: 'Marketplace',
          prompt:
            'A peer-to-peer rentals marketplace with availability calendars, deposits, and return checks'
        },
        {
          id: 'market-makers',
          label: 'Local makers',
          appType: 'Marketplace',
          prompt: 'A marketplace for local makers with listings, search, tips, and pickup slots'
        }
      ]
    },
    {
      id: 'internal',
      title: 'Internal tool',
      description: 'Ops tables, roles, audit trails',
      appType: 'Internal tool',
      prompt: 'An internal ops tool with role-based access, audit trails, and bulk export',
      variants: [
        {
          id: 'internal-ops',
          label: 'Ops queue',
          appType: 'Internal tool',
          prompt:
            'An internal ops queue with role-based access, status transitions, and bulk export'
        },
        {
          id: 'internal-inventory',
          label: 'Inventory tracker',
          appType: 'Internal tool',
          prompt:
            'An internal inventory tracker with stock levels, low-stock alerts, and audit trails'
        },
        {
          id: 'internal-approvals',
          label: 'Approval workflow',
          appType: 'Internal tool',
          prompt:
            'An internal approval workflow with request forms, multi-step review, and audit logs'
        },
        {
          id: 'internal-crm',
          label: 'Lightweight CRM',
          appType: 'Internal tool',
          prompt:
            'A lightweight internal CRM with contacts, notes, pipeline stages, and CSV export'
        }
      ]
    },
    {
      id: 'mobile',
      title: 'Mobile app',
      description: 'iOS/Android flows, push, offline',
      appType: 'Mobile app',
      prompt:
        'A mobile-first app with offline support, push notifications, and simple onboarding',
      variants: [
        {
          id: 'mobile-reminders',
          label: 'Reminders & checklists',
          appType: 'Mobile app',
          prompt:
            'A mobile-first reminders app with checklists, due dates, and push-style notifications'
        },
        {
          id: 'mobile-field',
          label: 'Field capture',
          appType: 'Mobile app',
          prompt:
            'A mobile field capture app with offline notes, photo attachments, and later sync'
        },
        {
          id: 'mobile-habits',
          label: 'Habits & streaks',
          appType: 'Mobile app',
          prompt: 'A mobile habit tracker with daily check-ins, streaks, and simple onboarding'
        },
        {
          id: 'mobile-coach',
          label: 'Daily coach',
          appType: 'Mobile app',
          prompt: 'A mobile coach app with daily prompts, progress history, and offline reading'
        }
      ]
    },
    {
      id: 'api',
      title: 'API / backend',
      description: 'Auth, webhooks, rate limits, OpenAPI docs',
      appType: 'API backend',
      prompt: 'A backend API with auth, webhooks, rate limits, and OpenAPI documentation',
      variants: [
        {
          id: 'api-crud',
          label: 'CRUD + auth',
          appType: 'API backend',
          prompt: 'A backend API with session auth, resource CRUD, rate limits, and OpenAPI docs'
        },
        {
          id: 'api-webhooks',
          label: 'Webhooks hub',
          appType: 'API backend',
          prompt:
            'A webhooks hub API with signed delivery, retry queues, and event subscription CRUD'
        },
        {
          id: 'api-ingest',
          label: 'Data ingest',
          appType: 'API backend',
          prompt:
            'A data ingest API with API keys, schema validation, batch upload, and rate limits'
        },
        {
          id: 'api-bff',
          label: 'BFF for SPA',
          appType: 'API backend',
          prompt:
            'A backend-for-frontend API with cookie sessions, aggregate endpoints, and health checks'
        }
      ]
    }
  ]
} as const;
