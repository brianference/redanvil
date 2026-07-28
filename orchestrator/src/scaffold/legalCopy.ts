import type { Job } from '../schemas/job';

/**
 * Real starter Terms, Privacy, About and Contact documents.
 *
 * R32: a generator must emit something REAL or something impossible to miss —
 * never a plausible sentence. The earlier template emitted
 * `'<Name> page for <slug>.'` and four one-sentence legal pages shipped and
 * passed every check, because a stub was the finished output of the template.
 *
 * A marker would satisfy the letter of R32 and still leave a broken page on
 * screen. These are the better answer: complete documents that are **true of any
 * app this scaffold produces**, because the scaffold determines the stack —
 * Cloudflare Pages, Pages Functions and D1, no analytics, no advertising, no
 * third-party trackers, and auth only when the job asks for it.
 *
 * They ship correct and are meant to be edited. Every claim below is one the
 * scaffold itself guarantees; anything app-specific is phrased so a builder can
 * see exactly what to extend.
 */

/** One headed section of a document. */
export interface LegalSection {
  readonly heading: string;
  readonly body: string;
  readonly items?: readonly string[];
}

/** A complete document: intro, sections, last-updated date. */
export interface LegalDoc {
  readonly title: string;
  readonly intro: string;
  readonly sections: readonly LegalSection[];
  readonly updated: string;
}

/**
 * Build the four documents for a job.
 *
 * @param job - Validated build job; supplies the product name and whether the
 *   app has accounts, which changes what the privacy document must say.
 * @param builtAt - ISO timestamp, injected so the caller owns the clock.
 * @returns The four documents.
 */
export function legalDocs(
  job: Job,
  builtAt: string
): { about: LegalDoc; contact: LegalDoc; terms: LegalDoc; privacy: LegalDoc } {
  const name = job.slug;
  const updated = builtAt.slice(0, 10);
  const hasAuth = job.answers?.hasAuth === 'true';

  const accountLine = hasAuth
    ? 'This app has accounts. When you create one we store your email address and a one-way hash of your password, never the password itself.'
    : 'This app has no accounts and no sign-in, so there is nothing to register and no password to store.';

  return {
    about: {
      title: 'About',
      updated,
      intro: `${name} is a web application built on Cloudflare Pages. This page explains what it does, how it works, and what it does not do.`,
      sections: [
        {
          heading: 'What this app is',
          body: `${name} addresses: ${job.prompt}`
        },
        {
          heading: 'How it works',
          body: 'The interface runs in your browser. Requests go to Cloudflare Pages Functions, which read and write a Cloudflare D1 database. Everything is validated at the boundary before it reaches storage, and an invalid request is rejected rather than partly applied.'
        },
        {
          heading: 'Where the data comes from',
          body: 'Replace this section with the real provenance for this app: the source of its data, when it was obtained, and how often it refreshes. A reader should be able to tell how current what they are looking at is.'
        },
        {
          heading: 'What this app is not',
          body: 'It is not a substitute for professional advice, and it makes no guarantee that the information shown is complete or current. Confirm anything that matters before relying on it.'
        },
        {
          heading: 'Honest limitations',
          body: 'Automated systems get things wrong. If something here looks incorrect, it may be. Use the contact page to tell us.'
        }
      ]
    },

    contact: {
      title: 'Contact',
      updated,
      intro: 'How to reach us, and what to expect when you do.',
      sections: [
        {
          heading: 'General questions',
          body: 'Use the contact route published with this deployment. Tell us what you were doing, what you expected, and what happened instead.'
        },
        {
          heading: 'What to include',
          body: 'A message with these details gets a useful answer faster:',
          items: [
            'The page or address you were on',
            'What you expected to happen',
            'What actually happened',
            'The browser and device you were using'
          ]
        },
        {
          heading: 'Privacy requests',
          body: 'To ask for a copy of your data, to correct it, or to have it deleted, say so explicitly in your message and mark it as a privacy request. You do not need to give a reason.'
        },
        {
          heading: 'Reporting a security problem',
          body: 'If you believe you have found a security issue, report it privately rather than publicly, and give us a reasonable chance to fix it before disclosing it.'
        },
        {
          heading: 'Response times',
          body: 'This is a small project. We read everything and reply as soon as we reasonably can, but there is no guaranteed response time.'
        }
      ]
    },

    terms: {
      title: 'Terms and conditions',
      updated,
      intro: `These terms govern your use of ${name}. By using the app you accept them. If you do not accept them, please do not use it.`,
      sections: [
        {
          heading: 'Who can use this',
          body: `You need to be at least 13 years old. If you are under 18, you should have a parent or guardian's permission. ${accountLine}`
        },
        {
          heading: 'What the service is',
          body: `${name} is provided free and as-is. It exists to help with the task described on the About page, and nothing more is promised.`
        },
        {
          heading: 'Accuracy and reliance',
          body: 'Information shown may be incomplete, out of date, or wrong. Do not rely on it for decisions that carry money, safety, legal or medical consequences without confirming it independently. Replace this section with the specific accuracy limitation that matters most for this app.'
        },
        {
          heading: 'Acceptable use',
          body: 'You may use the app for its intended purpose. You may not:',
          items: [
            'Break the law, or use the app to help anyone else do so',
            'Scrape, bulk-download, or resell the content',
            'Attempt to overload, disrupt, or circumvent the limits of the service',
            'Attempt to access data that is not yours',
            'Submit anything abusive, hateful, or designed to harass'
          ]
        },
        {
          heading: 'Intellectual property',
          body: 'The application and its design belong to their authors. Third-party names and marks that appear are the property of their owners and are used descriptively; their appearance does not imply any affiliation or endorsement.'
        },
        {
          heading: 'Third-party services',
          body: 'The app runs on Cloudflare, which processes requests and stores data on our behalf. Any other service this app calls is named on the Privacy page. Each operates under its own terms.'
        },
        {
          heading: 'Disclaimer of warranties',
          body: 'The service is provided "as is" and "as available", without warranties of any kind, express or implied, including fitness for a particular purpose and non-infringement.'
        },
        {
          heading: 'Limitation of liability',
          body: 'To the extent the law allows, we are not liable for any loss, cost, or damage arising from your use of the service, including decisions made in reliance on what it displays. Nothing here limits liability where the law does not permit it to be limited.'
        },
        {
          heading: 'Indemnity',
          body: 'You agree to cover any claim brought against us that arises from your misuse of the service or your breach of these terms.'
        },
        {
          heading: 'Availability and changes',
          body: 'This is a free service. We may add, change, remove, limit, or stop it at any time, with or without notice, and we do not promise any level of availability.'
        },
        {
          heading: 'Changes to these terms',
          body: 'These terms may be updated as the service changes. The date at the top shows the current version. Continuing to use the app after a change means you accept the updated terms.'
        },
        {
          heading: 'Governing law and disputes',
          body: 'Replace this section with the governing jurisdiction for this deployment, and how disputes are to be resolved. Leaving it unspecified is a gap, not a neutral choice.'
        },
        {
          heading: 'Contact',
          body: 'Questions about these terms go through the contact page.'
        }
      ]
    },

    privacy: {
      title: 'Privacy policy',
      updated,
      intro: `This policy explains what ${name} collects, what it does not, and what you can ask us to do about it. It is written to be read, not to be survived.`,
      sections: [
        {
          heading: 'What we collect',
          body: `The data you enter in order to use the app, stored in Cloudflare D1. ${accountLine} Replace this section with the specific fields this app stores.`
        },
        {
          heading: 'What we do not collect',
          body: 'No advertising identifiers. No analytics. No tracking pixels or third-party tracking scripts. We do not read your device location. We do not sell or share personal data.'
        },
        {
          heading: 'Why we collect it',
          body: 'Only to make the app work: to store what you create so you can come back to it, and to keep the service running and free from abuse. We do not use it for profiling.'
        },
        {
          heading: 'Who else sees anything',
          body: 'Cloudflare hosts the application, runs its server-side functions, and stores its database, so data passes through and rests on Cloudflare infrastructure under their terms. Any other service this app sends data to is named here — replace this line with that list, or state plainly that there are none.'
        },
        {
          heading: 'Cookies and local storage',
          body: hasAuth
            ? 'One cookie once you sign in, which keeps you signed in and does nothing else. It cannot be read by page JavaScript and is never used to follow you across other sites. Your theme choice is kept in your browser and never leaves your device.'
            : 'No cookies are set. Your theme choice is kept in your browser’s own storage and never leaves your device. There is nothing here to consent to.'
        },
        {
          heading: 'Where data lives',
          body: 'On Cloudflare infrastructure, which is distributed internationally. Using the app means data may be processed outside your own country.'
        },
        {
          heading: 'How long we keep it',
          body: 'Data you create stays until you delete it or ask us to. Replace this section with the actual retention period for each kind of record this app stores.'
        },
        {
          heading: 'Your rights',
          body: 'Depending on where you live, including under the GDPR and the CCPA/CPRA, you may ask us to:',
          items: [
            'Give you a copy of the data we hold about you',
            'Correct anything that is wrong',
            'Delete your data, which means delete rather than hide',
            'Provide it in a portable form',
            'Stop or restrict a particular use of it'
          ]
        },
        {
          heading: 'How to exercise them',
          body: 'Ask through the contact page and mark the message as a privacy request. You do not have to give a reason, and exercising a right never costs you access to the service.'
        },
        {
          heading: 'Children',
          body: 'This app is not intended for children under 13, and we do not knowingly collect their data. If you believe a child has provided data, contact us and we will remove it.'
        },
        {
          heading: 'Security',
          body: hasAuth
            ? 'Traffic is served over HTTPS. Passwords are stored only as a one-way hash and are never recoverable, by us or by anyone who obtained a copy of the database alone. No system is perfectly secure, and we do not claim otherwise.'
            : 'Traffic is served over HTTPS. There are no accounts and no passwords to protect. No system is perfectly secure, and we do not claim otherwise.'
        },
        {
          heading: 'Changes to this policy',
          body: 'If what we collect changes, this page and the date at the top change with it. If a change is significant we will make that obvious in the app rather than quietly editing this page.'
        },
        {
          heading: 'Contact',
          body: 'Privacy questions go through the contact page.'
        }
      ]
    }
  };
}
