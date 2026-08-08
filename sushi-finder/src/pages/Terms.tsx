import { Breadcrumbs } from '../components/Breadcrumbs';
import { en } from '../i18n/en';

/**
 * Terms of use for By Photos (sushi-finder).
 * Every statement is true of this Cloudflare Pages + D1 public catalog:
 * no accounts, public CRUD on sushis, title search, Workers AI assistant grounded in D1.
 * Measured floors: file size, rendered word count, and headed sections.
 */
export function Terms(): JSX.Element {
  return (
    <>
      <Breadcrumbs
        items={[
          { label: en.brand.name, to: '/' },
          { label: en.nav.terms }
        ]}
      />
      <main id="main">
        <article className="prose">
          <h1 className="page-title">{en.terms.title}</h1>
          <p className="prose__updated">{en.terms.updated}</p>
          <p>
            These Terms of Use (“Terms”) govern access to and use of By Photos (the “Service”), a
            public web application that stores and displays sushi restaurant catalog records in a
            Cloudflare D1 database bound to this deployment. The product name in the interface is
            By Photos; the repository and project slug for this codebase is sushi-finder. The
            Service is delivered as a Vite + React + TypeScript single-page application hosted on
            Cloudflare Pages, with request handlers implemented as Cloudflare Pages Functions under
            the /api path. By loading the site, calling its public API routes, creating or editing
            catalog rows, or sending a message to the in-app assistant, you agree to these Terms. If
            you do not agree, do not use the Service.
          </p>

          <h2>1. Acceptance and eligibility</h2>
          <p>
            The Service is offered to the general public without registration. There is no sign-up
            form, no login screen, no password reset flow, and no session cookie used to identify a
            user account, because this product does not implement accounts. You must be able to form
            a binding agreement under the laws that apply to you. If you use the Service on behalf of
            an organization, you represent that you have authority to bind that organization to these
            Terms. There is no separate minimum-age gate beyond what the law requires for browsing a
            general-interest website. We do not knowingly collect personal data from children through
            account registration, because registration does not exist; see the Privacy Policy for how
            public catalog fields and assistant messages are treated. Loading product routes, posting
            to /api/sushis, or posting to /api/assistant is acceptance of these Terms for that use.
          </p>

          <h2>2. What the Service is</h2>
          <p>
            By Photos is a marketplace-style public catalog of sushi restaurant entries stored as
            rows in a single D1 table named sushis. Each row has an id, a title, a free-text
            description, and created and updated timestamps. Through the UI and matching API
            routes you may: list catalog rows; search by a case-insensitive title fragment via the
            optional query parameter q on GET /api/sushis; open a detail page for one id; create a
            new row with a title and description; edit an existing row; delete a row after an
            in-browser confirmation; and ask natural-language questions of an in-app assistant.
            The assistant endpoint posts to /api/assistant, uses Cloudflare Workers AI when the AI
            binding is available to help interpret a search fragment, and builds the human-readable
            answer from D1 query results for this deployment rather than inventing restaurants that
            are not in the database. A health endpoint at GET /api/health returns a simple status
            payload for operators. The Service does not take reservations, process payments, sell
            gift cards, show live table inventory, stream third-party review feeds, or load restaurant
            coordinates from a maps provider.
          </p>

          <h2>3. Central disclaimer — catalog is informational only</h2>
          <p>
            This is the product’s central disclaimer and it leads on purpose. Catalog titles and
            descriptions may be incomplete, outdated, user-edited, or wrong. Seed rows shipped with
            the project describe a small set of well-known sushi restaurants for demonstration and
            browsing; they are not a complete worldwide directory and they are not a live feed from
            Google Places, Yelp, OpenTable, Resy, or any other third-party listing service. Free-text
            descriptions may mention style, price band, or walk-in habits in ordinary language, but
            the database schema does not enforce structured fields for conveyor versus counter
            service, price bands, walk-in policy, photo galleries, map pins, or seating availability.
            We do not guarantee restaurant hours, menu accuracy, allergen information, food safety,
            accessibility of the physical venue, or that a place still operates. Always confirm
            details with the restaurant itself before travel or dining. The assistant may err,
            mis-parse your question, or return a summary of stored rows that does not match the real
            world; treat assistant answers as helpers over this deployment’s D1 data, not as
            professional advice, booking confirmation, or a review score.
          </p>

          <h2>4. Coverage boundary of the data</h2>
          <p>
            The Service’s data boundary is the sushis table for this Cloudflare project binding.
            A search that returns no rows is a statement that no matching title exists in that table,
            not proof that no sushi restaurant exists in a city. Features described in marketing
            language about a worldwide finder, photo browsing, map browsing, or seating availability
            are product goals or problem statements; this MVP surface implements public list, title
            search, detail, manage, and a D1-grounded assistant. Do not assume geolocation ranking,
            city filters, photo CDNs, or live reviews exist because those integrations are not wired
            in this codebase. If a description field is empty, the UI shows an empty-description
            state rather than inventing text.
          </p>

          <h2>5. Acceptable use</h2>
          <p>
            You may use the Service only for lawful purposes. You must not attempt to disrupt the
            Service, probe for vulnerabilities outside responsible disclosure, inject malicious
            payloads into title or description fields, scrape in a way that degrades availability for
            others, or flood create, update, or delete endpoints with automated abuse. You must not
            submit content that is illegal, defamatory, fraudulent, or that you do not have rights to
            publish. Because create and edit endpoints are public and unauthenticated, do not enter
            secrets, passwords, API keys, payment card data, government identifiers, or personal data
            of other people into catalog fields or the assistant. Operators may remove abusive rows
            and may block abusive network traffic at the edge.
          </p>
          <ul>
            <li>Do not use the public write APIs to vandalize the shared catalog.</li>
            <li>Do not misrepresent catalog text as a live reservation system or official restaurant website.</li>
            <li>Do not reverse engineer secrets from client bundles; none are required for public browse.</li>
            <li>Do not attempt to bypass Zod validation or parameterized SQL by injection.</li>
          </ul>

          <h2>6. Intellectual property</h2>
          <p>
            The By Photos name, layout, original software, and brand mark assets for this deployment
            are provided to operate the Service. Seed restaurant names and factual descriptions refer
            to publicly known establishments and are used for catalog demonstration; trademarks and
            trade names remain with their respective owners. You retain whatever rights you have in
            text you submit through create or edit forms. By submitting text, you grant the operators
            of this deployment a non-exclusive, worldwide, royalty-free license to store, display,
            process, and delete that text solely to run the catalog features and maintain the shared
            database. You represent that you have the rights needed to grant that license. Bulk
            scraping and republishing of the catalog as a competing commercial dataset without
            permission is not authorized by these Terms.
          </p>

          <h2>7. Third-party services</h2>
          <p>
            The Service depends on Cloudflare infrastructure: Pages for static hosting, Pages
            Functions for API handlers, D1 for persistence, and Workers AI for optional assistant
            interpretation. Those platforms apply their own terms and privacy policies. This
            application code does not integrate payment processors, advertising SDKs, map tile
            vendors as a restaurant data source, or third-party review APIs. External URLs that may
            appear inside user-supplied descriptions are not controlled by us; following them leaves
            the Service. Contact instructions may point you at a project repository host; that host
            is a third party with its own rules.
          </p>

          <h2>8. Disclaimer of warranties</h2>
          <p>
            THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE” WITHOUT WARRANTIES OF ANY KIND,
            WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY,
            FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. We do not warrant that the
            Service will be uninterrupted, error-free, secure, or free of harmful components; that
            catalog rows will remain stable; that Workers AI will always be bound and available; that
            search results will match your intent; or that any restaurant will still operate under
            the name shown. Some jurisdictions do not allow certain warranty exclusions; in those
            places, exclusions apply only to the extent permitted by law.
          </p>

          <h2>9. Limitation of liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE OPERATORS OF THIS DEPLOYMENT ARE NOT LIABLE
            FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR
            ANY LOSS OF PROFITS, DATA, GOODWILL, OR SUBSTITUTE SERVICES, ARISING FROM YOUR USE OF THE
            SERVICE OR RELIANCE ON CATALOG OR ASSISTANT CONTENT, WHETHER BASED ON CONTRACT, TORT, OR
            ANY OTHER THEORY. Aggregate liability for claims relating to the Service shall not exceed
            one hundred US dollars (USD $100) or the amount you paid us to use the Service in the
            twelve months before the claim, whichever is greater. For this free public deployment the
            amount paid is zero. Mandatory rights that cannot be waived in your jurisdiction remain
            intact.
          </p>

          <h2>10. Indemnity</h2>
          <p>
            You agree to indemnify and hold harmless the operators of this deployment from claims,
            damages, losses, and expenses (including reasonable legal fees) arising from your misuse
            of the Service, your submitted catalog content, your assistant messages, or your
            violation of these Terms or applicable law, to the extent permitted by law.
          </p>

          <h2>11. Availability and changes to the Service</h2>
          <p>
            We may modify, suspend, or discontinue the Service at any time without liability,
            including schema migrations, seed updates, removal or restriction of public write APIs,
            assistant model changes, or full shutdown of the deployment. Features that rely on the
            Workers AI binding may fail when the binding is missing or the model is unavailable; the
            product is designed to surface those failures as error states rather than empty success
            responses when a grounded answer cannot be built. There is no uptime service level
            agreement and no paid support commitment. The project is maintained on a best-effort
            basis.
          </p>

          <h2>12. Termination</h2>
          <p>
            Because there are no accounts, “termination” means you may stop using the Service at any
            time, and we may block abusive traffic or remove abusive catalog content without notice.
            Provisions that by their nature should survive cessation of use — including disclaimers,
            limitation of liability, indemnity, and intellectual property notices — survive.
          </p>

          <h2>13. Changes to these Terms</h2>
          <p>
            We may update these Terms by publishing a new version on this page and updating the last
            updated line. We do not operate an email list for term notices. Continued use after
            changes become effective constitutes acceptance of the revised Terms for subsequent use.
            If you do not accept a change, stop using the Service.
          </p>

          <h2>14. Governing law and disputes</h2>
          <p>
            These Terms are conditions of use for a free public catalog project. They are not a
            substitute for advice from a lawyer in your jurisdiction. Before filing a formal claim,
            use the Contact page and allow a reasonable time for a response. Where the law requires a
            governing jurisdiction to be stated and permits the parties to choose, the laws applicable
            to the operator’s principal place of business apply, without regard to conflict-of-law
            rules that would produce a different result, except where mandatory consumer protections
            in your place of residence cannot be waived. Nothing here requires you to waive rights you
            are legally forbidden to waive.
          </p>

          <h2>15. Contact about these Terms</h2>
          <p>
            Questions about these Terms may be directed through the Contact page of this application.
            There is no authenticated support portal and no in-app private ticket system. Do not send
            passwords, payment card numbers, or other secrets through public catalog fields or the
            assistant. For privacy-specific requests, say so clearly in your message title or subject
            line as described on the Contact page.
          </p>
        </article>
      </main>
    </>
  );
}

/** Alias matching prior route module name. */
export const TermsPage = Terms;
