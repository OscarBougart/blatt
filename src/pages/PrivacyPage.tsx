import { useNavigate } from 'react-router-dom';
import Page from '@/components/Page';

/** Required by the Play Store listing, and the honest answer is short: the
 *  app has no backend, so there is almost nothing to disclose. Kept as a
 *  route rather than a hosted document so it ships and versions with the
 *  code it describes. */
export default function PrivacyPage() {
  const navigate = useNavigate();

  return (
    <Page title="Privacy" back={() => navigate('/settings')}>
      <div className="type-en space-y-4 text-ink dark:text-lamp-ink">
        <p>
          Blatt has no accounts, no backend and no analytics. Nothing you read,
          save or review is sent anywhere. It stays in your browser&rsquo;s
          storage on this device.
        </p>

        <h2 className="pt-4 text-lg">What is stored, and where</h2>
        <p>
          Your documents, saved words, review schedule and reading sessions are
          held in IndexedDB on this device. Your settings &mdash; theme, text
          size, pace &mdash; are held in local storage. None of it leaves the
          device unless you export a backup yourself, and where that file goes
          is then your choice.
        </p>
        <p>
          Clearing the app&rsquo;s site data, or uninstalling it, deletes all of
          it. There is no copy anywhere else, so keep a backup if the words
          matter to you.
        </p>

        <h2 className="pt-4 text-lg">The one network call</h2>
        <p>
          When a word&rsquo;s definition is looked up, the word alone is sent to
          the public{' '}
          <a href="https://en.wiktionary.org" className="underline">
            English Wiktionary
          </a>{' '}
          API. No identifier accompanies it, and the result is cached on the
          device so the same word is never requested twice. Wikimedia, who run
          that API, will see the request and your IP address the way any website
          would; their handling of that is covered by the{' '}
          <a
            href="https://foundation.wikimedia.org/wiki/Policy:Privacy_policy"
            className="underline"
          >
            Wikimedia privacy policy
          </a>
          .
        </p>
        <p>
          Everything else &mdash; the app itself, the bundled library of stories
          &mdash; is served from Blatt&rsquo;s own origin and cached for offline
          use. Blatt keeps no server logs of its own.
        </p>

        <h2 className="pt-4 text-lg">What is not collected</h2>
        <p>
          No personal information, no account, no email address, no advertising
          identifier, no location, no contacts, no crash or usage telemetry. No
          data is sold or shared with third parties, because none is gathered.
          Blatt is not directed at children, and collects nothing from anyone of
          any age.
        </p>

        <h2 className="pt-4 text-lg">Your data, your device</h2>
        <p>
          Because there is no server, there is no request to make of anyone: you
          can export everything from Settings, and delete everything by clearing
          the app&rsquo;s data.
        </p>

        <h2 className="pt-4 text-lg">Changes and contact</h2>
        <p>
          If this ever changes, this page changes with the app. Questions:{' '}
          <a href="mailto:oscar.bougart.dev@gmail.com" className="underline">
            oscar.bougart.dev@gmail.com
          </a>
          .
        </p>

        <p className="pt-4 text-graphite dark:text-lamp-gph">
          Last updated 20 September 2026.
        </p>
      </div>
    </Page>
  );
}
