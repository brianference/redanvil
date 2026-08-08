import { Breadcrumbs } from '../components/Breadcrumbs';
import { en } from '../i18n/en';

/**
 * Privacy policy for By Photos (sushi-finder).
 * Describes only data practices this app implements: public D1 catalog, no auth,
 * theme in localStorage, assistant POST body, Cloudflare edge request metadata.
 */
export function Privacy(): JSX.Element {
  return (
    <>
      <Breadcrumbs
        items={[
          { label: en.brand.name, to: '/' },
          { label: en.nav.privacy }
        ]}
      />
      <main id="main">
        <article className="prose">
          <h1 className="page-title">{en.privacy.title}</h1>
          <p className="prose__updated">{en.privacy.updated}</p>
          <p>
            This Privacy Policy explains how By Photos (“we”, “the Service”) handles information when
            you use this Cloudflare Pages deployment of the sushi-finder project. The Service is a
            public sushi restaurant catalog backed by Cloudflare D1, with optional natural-language
            questions answered through Cloudflare Workers AI grounded in that same database. The
            product is designed without user accounts. This notice is written against the behaviors
            implemented in the application source: public JSON APIs for sushis and health, public
            create/update/delete of catalog rows, localStorage for theme preference, and an assistant
            endpoint that processes a free-text message. We do not describe advertising pixels,
            marketing profiles, or payment processing, because this app does not implement them.
          </p>

          <h2>1. Who we are and how to reach us</h2>
          <p>
            By Photos is operated as a single-tenant web application on Cloudflare’s edge platform
            for this project. There is no separate customer portal, postal address page, or in-app
            messaging system inside the product UI. For privacy questions, access requests about data
            we can identify, or reports of personal information someone posted into a public catalog
            field, use the Contact page in this application and mark the subject as a privacy request.
            Source code for the Pages Functions, client theme key, and this notice text lives in the
            project repository that ships this site when that repository is public.
          </p>

          <h2>2. Accounts</h2>
          <p>
            The Service does not offer registration, login, passwords, session cookies for identity,
            OAuth, social sign-in, or user-owned private data scopes. All product pages and the
            sushi API routes described in the product interface contract are public. There are no
            account credentials to store, reset, or share. Cloudflare D1 for this project stores
            sushi catalog rows (id, title, description, timestamps), not visitor identity profiles.
            Because create, edit, and delete are public, anyone who can reach the deployment URL can
            change shared catalog content unless operators later restrict those routes at the edge
            or in code.
          </p>

          <h2>3. What is collected</h2>
          <p>
            When you use the Service, the following categories of data may be processed. This list is
            limited to what the application and its host actually handle:
          </p>
          <ul>
            <li>
              <strong>Catalog content you submit.</strong> Title and description fields for sushi
              rows you create or edit are stored in Cloudflare D1 for this deployment. Those fields
              are visible to other visitors because list, search, and detail APIs are public. There is
              no private draft state for a row in this MVP.
            </li>
            <li>
              <strong>Assistant messages.</strong> Text you send to POST /api/assistant is processed
              to produce a response. The handler may call Cloudflare Workers AI with your message to
              extract a short title-search fragment, then queries D1 and builds an answer from matching
              rows. This application does not implement a permanent chat history table for visitors.
            </li>
            <li>
              <strong>Technical request data.</strong> Like most sites on Cloudflare, request
              metadata such as IP address, user agent, timestamps, and URL path may be processed by
              the platform for delivery, security, and reliability. This app’s own code does not write
              a separate analytics product database of page views.
            </li>
            <li>
              <strong>Theme preference.</strong> If you change light or dark mode, the preference is
              stored in your browser’s localStorage under the key <code>theme</code> with values
              light, dark, or system. That key is the only intentional client persistence this UI
              implements for preference.
            </li>
            <li>
              <strong>Optional URL and search state.</strong> Search text you type into the catalog
              search control is sent as a query parameter to the list API and may appear in browser
              history while you navigate. It is not stored as a server-side user profile.
            </li>
          </ul>

          <h2>4. What is NOT collected</h2>
          <p>
            We do not collect payment card numbers, government IDs, precise continuous location
            tracks, contact address books, biometric identifiers, or a required email address to
            browse or use catalog APIs. We do not run third-party advertising pixels, retargeting
            tags, or product-analytics SDKs in the product UI described by this deployment’s source.
            We do not sell personal information. There is no newsletter signup form and no checkout.
            Browser permissions for geolocation, camera, and microphone are restricted in API
            response Permissions-Policy headers; the app does not implement a near-me ranking feature
            that would need continuous location.
          </p>
          <ul>
            <li>No identity or billing fields collected by this app for accounts</li>
            <li>No first-party advertising cookies set by application code</li>
            <li>No social login identity from this app</li>
            <li>No private per-visitor catalog in D1 separate from the shared sushis table</li>
          </ul>

          <h2>5. Why data is processed</h2>
          <p>
            Catalog text is processed to provide the core product: list, title search, detail, and
            manage flows. Assistant messages are processed to return answers grounded in D1 rows for
            this deployment. Technical request handling supports security and uptime on the host.
            Theme preference is processed only to remember your display choice on that browser. We do
            not process catalog text to build third-party advertising audiences. Purposes of
            collection are limited to operating the features the site actually provides.
          </p>
          <ul>
            <li>Render and search sushi rows stored in D1</li>
            <li>Allow public create, update, and delete of those rows</li>
            <li>Answer assistant questions from catalog data</li>
            <li>Remember light, dark, or system theme on the same device</li>
            <li>Serve health checks so operators can confirm the runtime is up</li>
          </ul>

          <h2>6. Third-party processors</h2>
          <p>
            Infrastructure is provided by Cloudflare (Pages hosting, Pages Functions compute, D1
            database, and Workers AI). Cloudflare acts as a processor for transport and storage of
            the data categories above under Cloudflare’s terms and privacy policy. We do not send
            catalog data to Google Places, Yelp, OpenTable, Resy, or similar restaurant integrations —
            those products are out of scope for this app’s wired data sources. If you open a contact
            path that uses a public repository host, that host processes the communication under its
            own policies.
          </p>

          <h2>7. Cookies and local storage</h2>
          <p>
            Application code for By Photos uses localStorage for theme preference under the key
            theme. It does not set authentication cookies because there is no login. It does not
            implement a first-party advertising cookie. Your browser may keep ordinary HTTP cache
            entries for static assets and API responses. Cloudflare’s edge may set or use cookies as
            part of platform services for security or load balancing; refer to Cloudflare’s
            documentation for platform-level cookie behavior. Clear site data in the browser to remove
            the theme key and cached assets for this origin.
          </p>

          <h2>8. Where data lives and transfers</h2>
          <p>
            Static assets, Pages Functions, and D1 for this app run on Cloudflare’s global network
            according to the region and configuration of this project. Cross-border transfers may
            occur as part of edge routing. Catalog rows in D1 are application data for the shared
            public catalog. If you submit catalog text, understand that public rows are readable by
            anyone who can reach the deployment URL and call the public list or detail APIs. Assistant
            message text is processed on the edge when you submit it; this app does not maintain a
            separate long-term visitor message archive table.
          </p>

          <h2>9. Retention and deletion</h2>
          <p>
            Sushi rows remain until deleted through the manage UI delete control (with confirmation)
            or by an operator with access to the D1 database for this project. Assistant messages are
            not designed as a permanent chat archive in this application; they are processed per
            request to produce a response. Theme preference remains until you clear site data or
            remove the theme key. Platform logs follow Cloudflare retention practices, which this
            repository does not control. Seed data may be re-applied when operators run migrations.
          </p>

          <h2>10. What a visitor can request</h2>
          <p>
            Because there are no accounts, we cannot “export an account profile” that was never
            created. Depending on where you live, privacy laws may grant rights to access, correct,
            delete, port, or object to certain processing of personal data. For this app those rights
            mainly concern the minimal categories above and any personal data someone typed into a
            public field.
          </p>
          <ul>
            <li>
              <strong>Access:</strong> Public catalog pages and GET /api/sushis responses are already
              world-readable application data for this deployment. Theme data lives only in your
              browser.
            </li>
            <li>
              <strong>Correction:</strong> Edit a sushi row through the public edit form, or contact
              us if content you cannot safely edit contains personal data of yours.
            </li>
            <li>
              <strong>Deletion:</strong> Use the delete control with confirmation for a row you can
              identify, clear localStorage for theme, or contact us for operator-assisted removal.
            </li>
            <li>
              <strong>Portability:</strong> Copy public pages or call the public JSON list API
              yourself.
            </li>
            <li>
              <strong>Objection:</strong> Stop using the site; there is no marketing list to opt out
              of.
            </li>
          </ul>

          <h2>11. Children</h2>
          <p>
            The Service is not directed at children under 13 (or the equivalent age in your
            jurisdiction). We do not knowingly collect personal information from children through
            registration, because registration does not exist. If you believe a child submitted
            personal data into a public catalog field or an assistant message, contact us via the
            Contact page so we can remove identifiable content from D1 when feasible.
          </p>

          <h2>12. Security practices</h2>
          <p>
            What this app actually implements: API inputs are validated with Zod at the Pages
            Function boundary; database access uses parameterized D1 queries rather than string
            concatenation of user values into SQL; JSON responses include security headers such as
            content-type nosniff, a restrictive referrer policy, frame denial, HTTPS strict transport
            security, a permissions policy that disables geolocation, camera, microphone, payment, and
            USB features for the document, and a content security policy oriented to self-hosted
            assets. What this notice does not claim: we do not assert a formal SOC 2 report,
            application-layer encryption of public catalog text as if it were confidential, or that
            any internet service is perfectly secure. Report suspected vulnerabilities responsibly
            rather than exploiting them, and do not paste secrets into public issues when you can
            avoid it.
          </p>

          <h2>13. Changes to this policy</h2>
          <p>
            We may update this Privacy Policy by publishing a revised page and updating the last
            updated line. Material changes are reflected on this page. We do not operate an email list
            for policy notices. Continued use after the date changes means you acknowledge the revised
            policy for subsequent use. Check this page when you care about the current rules.
          </p>

          <h2>14. Privacy contact</h2>
          <p>
            Privacy questions and requests: use the Contact page in this application and include
            “privacy request” in the subject or opening line, the deployment URL, and enough detail
            to locate the data (for example a sushi id, approximate time, or the text concerned). Do
            not submit passwords or other secrets into sushi title or description fields. General
            product contact details are summarized on the Contact page.
          </p>

          <h2>15. Public catalog transparency</h2>
          <p>
            A final point that is easy to miss: this product is a shared public catalog with public
            write APIs in the MVP. Anything you put in a title or description should be treated as
            published information. Operators may re-seed, edit, or delete rows. The assistant is
            designed to answer from those rows only for this app’s database, not from private user
            profiles. If that model is not acceptable for a piece of text, do not submit the text.
          </p>
        </article>
      </main>
    </>
  );
}

/** Alias matching prior route module name. */
export const PrivacyPage = Privacy;
