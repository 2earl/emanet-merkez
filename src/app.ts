import { Hono } from 'hono';
import { routePath } from 'hono/route';
import {
  SESSION_ABSOLUTE_SECONDS,
  SIGNIN_TTL_SECONDS,
  SignInError,
  clientMetadata,
  createWebSession,
  currentSession,
  endWebSession,
  hasFreshSecondFactor,
  finishSignIn,
  startSignIn,
} from './auth';
import {
  DELIVERY_CHECKS,
  authz,
  type Permission,
  core,
  staff,
  type AgentRow,
  type NewField,
  type ReviewItem,
} from './core';
import { parseLira, parsePayoutRule, parsePriceList, parseSetting } from './forms';
import {
  SECURITY_HEADERS,
  SESSION_COOKIE,
  SIGNIN_COOKIE,
  isSameOrigin,
  readCookie,
  safeReturnTo,
  setCookie,
  underRateLimit,
  type AppContext,
  type AppEnv,
} from './http';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  isLocale,
  localizeHtml,
  pickLocale,
  withLocale,
} from './i18n';
import { registerOnboarding } from './onboarding';
import * as pages from './pages';
import * as more from './pages-more';
import * as ops from './pages-ops';
import * as asks from './pages-requests';
import { SETTING_KEYS, SETTING_TEXT, type SettingKey } from './settings-text';

/** Emanet Merkez: the 2earl staff console (emanet-core docs/DESIGN.md §7). */

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** What a person reads for each core error code. */
const ERROR_TEXT: Record<string, string> = {
  requests_pending:
    'Requests to this agent are not settled yet. Accept the answers or withdraw the requests first.',
  request_not_open: 'This request is already settled.',
  invalid_ask:
    'Choose what to ask for, and write the agent a few words for each (5 to 300 characters).',
  payouts_pending: 'Payouts are waiting for this agent. Send them first, or refuse the request.',
  already_erased: 'This agent’s data is already erased.',
  confirm_erase: 'Type SİL to confirm.',
  archive_destroyed: 'This record’s time ended and its content was destroyed.',
  agent_not_active: 'This account is closed; nothing can be asked of it.',
  not_found: 'It isn’t there any more. Someone may have dealt with it already.',
  missing_legal_name: 'Enter the legal name.',
  invalid_vkn: 'The tax number has 10 digits (11 for a person).',
  invalid_reconfirm_days: 'Re-confirming must be every 1 to 90 days.',
  no_agreement:
    'This company hasn’t accepted the agreement. Invite it under Onboarding; it becomes active when its onboarding is approved.',
  invalid_search: 'Enter a plate, a chassis number, an account ID or an email address.',
  case_open:
    'This case is still open. Its partner changes or withdraws it; closed cases can be erased here.',
  invalid_request: 'Fill in what the request is, who it is about and how it arrived.',
  invalid_price_list: 'The price list isn’t valid.',
  invalid_key: 'The key uses a to z, 0 to 9 and _, starting with a letter.',
  reserved_key: 'This key is one of Emanet’s own fields.',
  field_exists: 'This partner already has a field with this key.',
  missing_label: 'Enter both labels.',
  invalid_enum_values: 'Enter the allowed values, separated by commas.',
  enum_values_without_enum: 'Allowed values are only for “one of a list”.',
  invalid_setting: 'That value isn’t allowed.',
  checklist_incomplete: 'Tick every point of the checklist before confirming.',
  documents_not_verified: 'Both e-Devlet documents must be verified as clear first.',
  not_ready:
    'Not yet: the sign-offs on the Readiness page are missing. Record them there, or while you are only testing an owner can switch off “Sign-offs before admitting anyone” in Settings → Operations.',
  invalid_signer: 'Enter who confirmed it.',
  invalid_outcome: 'Choose what e-Devlet showed.',
  already_decided: 'This document was decided already.',
  month_not_over: 'That month isn’t over yet.',
  invalid_payout_rule: 'The payout rule isn’t valid.',
  case_not_pending: 'This case isn’t waiting for a review any more.',
  invalid_vin: 'The chassis number must be 17 letters and digits, without I, O or Q.',
  invalid_reason: 'Enter a reason of at most 200 characters.',
  legal_hold:
    'This is under a legal hold. Lift it under Privacy → Legal holds first, and answer the request citing the hold.',
  already_held: 'It is already held.',
  invalid_hold: 'Choose what to hold.',
  invalid_message: 'Write a message of 2 to 4000 characters.',
  duplicate_case: 'The partner already has an open case on that vehicle. Reject this one.',
  no_active_case: 'No active case on this vehicle any more.',
  no_payout_rule: 'Set the agents’ payout rule in Settings first.',
  missing_evidence: 'Evidence is missing.',
  nothing_to_invoice: 'Nothing to invoice for this partner.',
  invalid_amount: 'Enter an amount in lira.',
  invalid_value_date: 'Enter the value date.',
  missing_bank_ref: 'Enter the bank reference.',
  invoice_not_open: 'This invoice is already paid or cancelled.',
  duplicate_bank_ref: 'This bank reference is already recorded.',
  payout_not_ready: 'This payout can’t be ordered now.',
  payout_not_approved: 'This payout isn’t approved yet.',
  second_approver_required: 'A second admin, not you, must approve this payout.',
  iban_not_verified: 'The agent’s IBAN isn’t verified yet. Verify it on the agent’s page first.',
  iban_changed: 'The agent changed their IBAN since this page was opened. Check the new one.',
  conflict_retry: 'Someone changed this at the same moment. Try again.',
  missing_company: 'Enter the company’s name.',
  invalid_kind: 'Choose a kind.',
  missing_contact: 'Enter the contact’s name.',
  invalid_email: 'The contact email isn’t an email address.',
  invalid_locale: 'Choose a language.',
  already_invited: 'This address already has an open invitation.',
  not_open: 'This invitation is closed.',
  sent_recently: 'A link went out less than ten minutes ago.',
  not_signed: 'The company hasn’t accepted the agreement (or it was decided already).',
  incomplete: 'The company’s organization, details or fees are missing.',
  four_eyes: 'You invited this company, so another admin must approve it.',
  invalid_provider: 'A company detail isn’t valid.',
  agent_not_ready:
    'An agent becomes active only after sending their application, from the identity check or a suspension.',
  invalid_status: 'Choose a status.',
  no_sighting: 'The agent hasn’t reported a sighting on this claim.',
  invalid_invoice_number: 'Enter the e-invoice number: 3 to 32 letters and digits.',
  invalid_invoice_uuid:
    'The ETTN is the invoice’s UUID, like 123e4567-e89b-12d3-a456-426614174000.',
  duplicate_invoice_number: 'Another invoice already has this number.',
  invalid_filter: 'That isn’t a subject or actor from the log.',
};
/** The core's detail says which part was wrong; only where it helps the reader. */
const WITH_DETAIL = new Set(['missing_evidence', 'invalid_price_list', 'invalid_payout_rule']);
/** Which of 2earl's company details is wrong. */
const PROVIDER_FIELD: Record<string, string> = {
  name: 'Enter 2earl’s legal name.',
  address: 'Enter the registered address.',
  taxOffice: 'Enter the tax office.',
  vkn: 'A company’s tax number has 10 digits.',
  mersis: 'The MERSİS number has 16 digits.',
  kep: 'The KEP address isn’t an email address.',
  email: 'The email for notices isn’t an email address.',
};
const errorText = (error: string, detail?: string) =>
  `${ERROR_TEXT[error] ?? 'That didn’t work.'}${detail && WITH_DETAIL.has(error) ? ` (${detail})` : ''}`;

const DONE: Record<string, string> = {
  accepted: 'Accepted. Agents can look for the vehicle now.',
  rejected: 'Rejected. The partner is told why.',
  delivered: 'Delivered. The partners are told, and the agent’s payout is created.',
  dismissed: 'Not accepted. The agent reads your reason; nothing was booked.',
  numbered: 'Invoice number saved.',
  erased: 'Queued. The file is deleted within minutes; the record stays without it.',
  redacted: 'The addresses are erased.',
  request_opened: 'Request recorded. It must be answered within 30 days.',
  request_closed: 'Request closed.',
  ticket_replied: 'Sent. They are emailed that an answer is waiting.',
  ticket_noted: 'Note saved. Only staff see it.',
  ticket_assigned: 'Saved.',
  ticket_closed: 'Closed.',
  ticket_reopened: 'Reopened.',
  hold_placed: 'Held. Automatic deletion leaves it alone until you lift the hold.',
  hold_released: 'Lifted. The retention rules apply again from the next run.',
  call_recorded:
    'Video call recorded. The agent is not active yet: use “Before you activate” below.',
  call_activated: 'Video call recorded and the agent is active. The agent is emailed.',
  saved: 'Saved.',
  reset: 'Back to the default.',
  document_decided: 'Result recorded. The file is being deleted.',
  asked: 'Sent. The agent is emailed what you asked for.',
  request_settled: 'Saved.',
  erased_agent: 'Erased. The sealed record is below; the agent was told.',
  erasure_refused: 'Refused. The agent is emailed your reason.',
  signed: 'Sign-off recorded.',
  unsigned: 'Sign-off withdrawn.',
  month_closed: 'Marked as handed to the accountant.',
  agent_returned: 'Sent back. The applicant is told what to correct.',
  activated: 'Activated. Its people can use Emanet Kurumsal now.',
  suspended: 'Suspended.',
  invoiced: 'Invoice issued. Send it through the e-invoice provider and record its number.',
  received: 'Payment recorded.',
  approved: 'Payout approved. Send it from the bank, then mark it as sent.',
  waiting: 'Payout ordered. A second admin must approve it.',
  sent: 'Marked as sent.',
  invited: 'Invitation sent.',
  invited_unsent: 'Saved, but the email didn’t go out. Send a new link.',
  resent: 'A new link was sent.',
  returned: 'Sent back. The contact is told what to change.',
  onboarded: 'Approved. The partner is active and the contact is told.',
  declined: 'Rejected. The contact is told why.',
  cancelled: 'Cancelled.',
};
const done = (c: AppContext) => DONE[c.req.query('done') ?? ''] ?? null;

const SECTIONS = [
  '/reviews',
  '/onboarding',
  '/support',
  '/partners',
  '/agents',
  '/money',
  '/settings',
  '/audit',
  '/privacy',
  '/system',
  '/guide',
  '/readiness',
  '/search',
];

export function createApp(now: () => number) {
  const app = new Hono<AppEnv>();

  // One line per request for Cloudflare's logs: the route's pattern (never the address itself,
  // which carries IDs), the status and how long it took.
  app.use('*', async (c: AppContext, next) => {
    const started = Date.now();
    await next();
    console.log(
      JSON.stringify({
        level: c.res.status >= 500 ? 'error' : 'info',
        event: 'request',
        route: `${c.req.method} ${routePath(c)}`,
        status: c.res.status,
        ms: Date.now() - started,
      }),
    );
  });

  // Anything unexpected: the person gets a page that says so, and the core is told the route and
  // the error's name (for the System page in Emanet Merkez and the alert email). Never the data.
  app.onError(async (error, c) => {
    const route = `${c.req.method} ${routePath(c)}`;
    const name = error instanceof Error ? error.name : 'error';
    console.error(JSON.stringify({ level: 'error', event: 'request.failed', route, error: name }));
    try {
      await core(c.env).reportError(route, name);
    } catch {
      // The core itself may be what failed; the log line above stands.
    }
    return c.html(
      pages.problem(
        { signedIn: false },
        'Something went wrong',
        'That didn’t work, and 2earl has been told. Try again in a moment.',
      ),
      500,
    );
  });

  // Language: ?lang= (remembered), the cookie, then the browser's.
  app.use('*', async (c: AppContext, next) => {
    const chosen = c.req.query('lang');
    const locale = pickLocale({
      query: chosen,
      cookie: readCookie(c.req.header('Cookie'), LOCALE_COOKIE),
      acceptLanguage: c.req.header('Accept-Language'),
    });
    c.set('locale', locale);
    await withLocale({ locale, url: new URL(c.req.url) }, () => next());
    if (isLocale(chosen) && c.req.method === 'GET') {
      setCookie(c, LOCALE_COOKIE, chosen, LOCALE_COOKIE_MAX_AGE);
    }
    c.header('Content-Language', locale);
    c.header('Vary', 'Accept-Language, Cookie', { append: true });
    if (locale === DEFAULT_LOCALE) return;
    if (!(c.res.headers.get('Content-Type') ?? '').startsWith('text/html')) return;
    const page = await c.res.text();
    const headers = new Headers(c.res.headers);
    headers.delete('Content-Length');
    c.res = new Response(
      localizeHtml(page, locale).replace('<html lang="en">', `<html lang="${locale}">`),
      { status: c.res.status, headers },
    );
  });

  app.use('*', async (c: AppContext, next) => {
    c.set('now', now());
    c.set(
      'session',
      await currentSession(c.env, c.get('now'), readCookie(c.req.header('Cookie'), SESSION_COOKIE)),
    );
    if (c.req.method === 'POST' && !isSameOrigin(c)) {
      return c.html(
        pages.problem(
          { signedIn: false },
          'Not allowed',
          'This form must be sent from Emanet Merkez.',
        ),
        403,
      );
    }
    await next();
    c.res = new Response(c.res.body, c.res);
    // A route may tighten the policy (a document gets `sandbox` too); it never loosens it.
    const extra = c.res.headers.get('Content-Security-Policy');
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) c.res.headers.set(name, value);
    if (extra === 'sandbox') {
      c.res.headers.set(
        'Content-Security-Policy',
        `${SECURITY_HEADERS['Content-Security-Policy'] ?? ''}; sandbox`,
      );
    }
    if (!c.res.headers.has('Cache-Control')) c.res.headers.set('Cache-Control', 'no-store');
  });

  /** The settings this app has words for; the core may know more (development mode has its own panel). */
  const known = <T extends { key: string }>(list: T[]): T[] =>
    list.filter((s) => (SETTING_KEYS as readonly string[]).includes(s.key));

  /** Until when development mode is on; asked of the core at most every fifteen seconds. */
  let devSeen: { at: number; until: number | null } | null = null;
  const devUntil = async (c: AppContext, force = false): Promise<number | null> => {
    const at = c.get('now');
    if (!force && devSeen && at - devSeen.at < 15) return devSeen.until;
    const status = await core(c.env).devMode();
    const until = status.ok && status.value.active ? status.value.until : null;
    devSeen = { at, until };
    return until;
  };

  const nav = (c: AppContext): pages.Nav => {
    const role = c.get('role') as AppEnv['Variables']['role'] | undefined;
    const dev = c.get('dev') as number | null | undefined;
    return role
      ? { signedIn: true, role, dev: dev ?? null }
      : { signedIn: c.get('session') !== null };
  };

  /**
   * Every staff page: a session signed in with a second factor, and a staff role in login, read
   * live on every request, so a removed staff member loses access at once.
   */
  const staffGate = async (c: AppContext, next: () => Promise<void>) => {
    const session = c.get('session');
    const back = encodeURIComponent(c.req.method === 'GET' ? c.req.path : '/');
    if (!session) return c.redirect(`/signin?return=${back}`, c.req.method === 'GET' ? 302 : 303);
    if (session.aal2At === null) {
      return c.redirect(
        `/signin?second_factor=1&return=${back}`,
        c.req.method === 'GET' ? 302 : 303,
      );
    }
    const [role, granted] = await Promise.all([
      staff(c.env).roleOf(session.uid),
      authz(c.env).permissionsOf({ subject: { type: 'user', id: session.uid } }),
    ]);
    if (!role || !granted.permissions.includes('emanet:control.review')) {
      return c.html(
        pages.problem(
          { signedIn: true },
          'Staff only',
          'Your 2earl account isn’t staff. Emanet Merkez is only for 2earl’s own team.',
        ),
        403,
      );
    }
    c.set('role', role);
    c.set('permissions', new Set(granted.permissions));
    c.set('dev', await devUntil(c));
    await next();
    return undefined;
  };
  for (const section of SECTIONS) {
    app.use(section, staffGate);
    app.use(`${section}/*`, staffGate);
  }

  const uid = (c: AppContext) => c.get('session')?.uid ?? '';
  const role = (c: AppContext) => c.get('role');
  /** Whether the staff member may do this here (login's authorization API, read in staffGate). */
  const may = (c: AppContext, permission: Permission) => c.get('permissions').has(permission);
  const fresh = (c: AppContext) => {
    const session = c.get('session');
    return session !== null && hasFreshSecondFactor(session, c.get('now'));
  };
  const forbidden = (c: AppContext) =>
    c.html(pages.problem(nav(c), 'Not allowed', 'Your staff role doesn’t allow this.'), 403);
  const notFound = (c: AppContext) =>
    c.html(pages.problem(nav(c), 'Not found', 'This page doesn’t exist.'), 404);
  /** A form that changes money or rules: owner or admin, with a second factor from the last 15 min. */
  const sensitive = (c: AppContext, page: string) => {
    if (!may(c, 'emanet:control.change')) return forbidden(c);
    if (!fresh(c)) {
      return c.redirect(`/signin?second_factor=1&return=${encodeURIComponent(page)}`, 303);
    }
    return null;
  };
  const changer = (c: AppContext) => (may(c, 'emanet:control.change') ? null : forbidden(c));
  const unwrap = <T>(result: { ok: true; value: T } | { ok: false; error: string }): T => {
    if (!result.ok) throw new Error(`core: ${result.error}`);
    return result.value;
  };

  // ---- Public ---------------------------------------------------------------------------------

  // The start page: a sign-in page, or for staff what needs doing today.
  app.use('/', async (c: AppContext, next) => (c.get('session') ? staffGate(c, next) : next()));
  app.get('/', async (c) => {
    if (!c.get('session')) return c.html(pages.home());
    const [queue, uninvoiced, ready, approved, waiting, signed, queues] = await Promise.all([
      core(c.env).reviewQueue(500),
      core(c.env).uninvoiced(),
      core(c.env).payouts('ready'),
      core(c.env).payouts('approved'),
      core(c.env).agents('kyc_pending'),
      core(c.env).onboardings('signed'),
      core(c.env).queues(),
    ]);
    const readiness = await core(c.env).readiness();
    const answered = await core(c.env).answeredRequests();
    const reviews = { delivery: 0, missing_vin: 0, plate_conflict: 0 };
    for (const item of unwrap(queue)) reviews[item.kind]++;
    return c.html(
      pages.today(
        nav(c),
        {
          reviews,
          uninvoiced: unwrap(uninvoiced),
          payoutsReady: unwrap(ready).length,
          payoutsApproved: unwrap(approved).length,
          agentsWaiting: unwrap(waiting).length,
          onboardingsSigned: unwrap(signed).length,
        },
        c.get('now'),
        queues.ok ? queues.value : [],
        readiness.ok
          ? !readiness.value.enforced ||
              (readiness.value.partners_ready && readiness.value.agents_ready)
          : null,
        asks.answeredPanel(answered.ok ? answered.value : []),
      ),
    );
  });

  // ---- Search, readiness ----------------------------------------------------------------------

  app.get('/search', async (c) => {
    const q = (c.req.query('q') ?? '').trim().slice(0, 80);
    const needle = q.toLocaleLowerCase('tr-TR');
    if (needle.length < 2) return c.html(ops.searchPage(nav(c), q, [], []));
    const [agents, partners] = await Promise.all([
      core(c.env).agents(null),
      core(c.env).partners(),
    ]);
    const has = (...values: (string | null | undefined)[]) =>
      values.some((value) => (value ?? '').toLocaleLowerCase('tr-TR').includes(needle));
    return c.html(
      ops.searchPage(
        nav(c),
        q,
        unwrap(agents)
          .filter((a) => has(a.legal_name, a.phone, a.email, a.city))
          .slice(0, 25),
        unwrap(partners)
          .filter((p) => has(p.legal_name, p.vkn))
          .slice(0, 25),
      ),
    );
  });

  const showReadiness = async (c: AppContext, error: string | null, status: 200 | 422 = 200) =>
    c.html(
      ops.readinessPage(
        nav(c),
        unwrap(await core(c.env).readiness()),
        may(c, 'emanet:control.change'),
        fresh(c),
        done(c),
        error,
      ),
      status,
    );

  app.get('/readiness', (c) => showReadiness(c, null));

  app.post('/readiness/:key', async (c) => {
    const denied = sensitive(c, '/readiness');
    if (denied) return denied;
    const v = await formValues(c);
    const result = await core(c.env).signOff(uid(c), c.req.param('key'), {
      signer: v.signer ?? '',
      ...(v.note ? { note: v.note } : {}),
    });
    if (!result.ok) return showReadiness(c, errorText(result.error), 422);
    return c.redirect('/readiness?done=signed', 303);
  });

  app.post('/readiness/:key/withdraw', async (c) => {
    const denied = sensitive(c, '/readiness');
    if (denied) return denied;
    const result = await core(c.env).withdrawSignoff(uid(c), c.req.param('key'));
    if (!result.ok) return showReadiness(c, errorText(result.error), 422);
    return c.redirect('/readiness?done=unsigned', 303);
  });

  // ---- The accountant's month -------------------------------------------------------------------

  app.get('/money/accounting', async (c) => {
    if (!may(c, 'emanet:control.change')) return forbidden(c);
    const months = unwrap(await core(c.env).accountingMonths());
    const month = c.req.query('month') ?? months[0]?.month ?? null;
    const data = month ? await core(c.env).accountingMonth(uid(c), month) : null;
    return c.html(
      ops.accountingPage(
        nav(c),
        months,
        data?.ok ? data.value : null,
        may(c, 'emanet:control.change'),
        done(c),
      ),
    );
  });

  app.get('/money/accounting/:month/:file', async (c) => {
    if (!may(c, 'emanet:control.change')) return forbidden(c);
    const name = c.req.param('file').replace(/\.csv$/, '');
    const data = await core(c.env).accountingMonth(uid(c), c.req.param('month'));
    const csv = data.ok ? ops.accountingCsv(data.value, name) : null;
    if (csv === null) return notFound(c);
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="emanet-${c.req.param('month')}-${name}.csv"`,
        'Cache-Control': 'private, no-store',
      },
    });
  });

  app.post('/money/accounting/:month/close', async (c) => {
    const denied = sensitive(c, `/money/accounting?month=${c.req.param('month')}`);
    if (denied) return denied;
    const result = await core(c.env).closeMonth(uid(c), c.req.param('month'));
    if (!result.ok) {
      return c.html(pages.problem(nav(c), 'Accounting', errorText(result.error)), 422);
    }
    return c.redirect(`/money/accounting?month=${c.req.param('month')}&done=month_closed`, 303);
  });

  // ---- Handbook --------------------------------------------------------------------------------

  app.get('/guide', (c) => c.html(more.guideIndex(nav(c))));

  app.get('/guide/:slug', async (c) => {
    const settings = await core(c.env).settingsInfo();
    const page = more.guideChapter(
      nav(c),
      c.req.param('slug'),
      settings.ok ? known(settings.value) : [],
    );
    return page === null ? notFound(c) : c.html(page);
  });

  app.get('/oauth/client.json', (c) => {
    const response = c.json(clientMetadata(c.env));
    response.headers.set('Cache-Control', 'public, max-age=300');
    return response;
  });

  app.get('/robots.txt', (c) => c.text('User-agent: *\nDisallow: /\n'));

  // ---- Sign-in: always with a second factor ----------------------------------------------------

  app.get('/signin', async (c) => {
    if (!(await underRateLimit(c, 'signin'))) {
      return c.html(
        pages.problem(nav(c), 'Too many attempts', 'Wait a minute and try again.'),
        429,
      );
    }
    const returnTo = safeReturnTo(c.req.query('return'));
    const again = c.req.query('second_factor') === '1';
    const session = c.get('session');
    if (session && session.aal2At !== null && !again) return c.redirect(returnTo ?? '/', 302);
    const { cookieValue, location } = await startSignIn(c.env, c.get('now'), returnTo, {
      secondFactor: true,
    });
    setCookie(c, SIGNIN_COOKIE, cookieValue, SIGNIN_TTL_SECONDS);
    return c.redirect(location, 302);
  });

  app.get('/callback', async (c) => {
    setCookie(c, SIGNIN_COOKIE, '', 0);
    if (c.req.query('error')) {
      return c.html(
        pages.problem(nav(c), 'Not signed in', 'Sign-in was cancelled or not allowed.'),
        400,
      );
    }
    try {
      const {
        uid: user,
        aal2At,
        returnTo,
      } = await finishSignIn(c.env, c.get('now'), {
        cookieValue: readCookie(c.req.header('Cookie'), SIGNIN_COOKIE),
        state: c.req.query('state') ?? null,
        code: c.req.query('code') ?? null,
        iss: c.req.query('iss') ?? null,
      });
      if (aal2At === null) {
        return c.html(
          pages.problem(
            nav(c),
            'Second factor needed',
            'Emanet Merkez needs your second factor (passkey or authenticator app). Add one to your 2earl account and sign in again.',
          ),
          403,
        );
      }
      const previous = c.get('session');
      if (previous) await endWebSession(c.env, previous);
      setCookie(
        c,
        SESSION_COOKIE,
        await createWebSession(c.env, c.get('now'), user, aal2At),
        SESSION_ABSOLUTE_SECONDS,
      );
      return c.redirect(safeReturnTo(returnTo) ?? '/', 302);
    } catch (error) {
      if (!(error instanceof SignInError)) throw error;
      console.error('sign-in failed', error.message);
      return c.html(
        pages.problem(nav(c), 'Not signed in', 'Sign-in didn’t complete. Start again.'),
        400,
      );
    }
  });

  app.post('/signout', async (c) => {
    const session = c.get('session');
    if (session) await endWebSession(c.env, session);
    setCookie(c, SESSION_COOKIE, '', 0);
    return c.redirect('/', 303);
  });

  // ---- Reviews ----------------------------------------------------------------------------------

  const REVIEW_KINDS: ReviewItem['kind'][] = ['delivery', 'missing_vin', 'plate_conflict'];

  app.get('/reviews', async (c) => {
    const kind = c.req.query('kind');
    const filter = REVIEW_KINDS.includes(kind as ReviewItem['kind'])
      ? (kind as ReviewItem['kind'])
      : null;
    const queue = unwrap(await core(c.env).reviewQueue(500));
    return c.html(pages.reviewList(nav(c), queue, filter, done(c)));
  });

  const showReview = async (c: AppContext, error: string | null, status: 200 | 409 | 422 = 200) => {
    const result = await core(c.env).review(c.req.param('id') ?? '');
    if (!result.ok) return notFound(c);
    return c.html(
      pages.reviewDetail(nav(c), result.value, may(c, 'emanet:control.change'), fresh(c), error),
      status,
    );
  };

  app.get('/reviews/:id', (c) => showReview(c, null));

  app.post('/reviews/:id/accept', async (c) => {
    if (!may(c, 'emanet:control.review')) return forbidden(c);
    const form = await c.req.parseBody();
    const vin = text(form.vin).toUpperCase().replace(/\s/g, '');
    const result = await core(c.env).resolveIdentity(uid(c), c.req.param('id'), {
      action: 'accept',
      ...(vin ? { vin } : {}),
    });
    if (!result.ok)
      return showReview(c, errorText(result.error), result.error === 'duplicate_case' ? 409 : 422);
    return c.redirect('/reviews?done=accepted', 303);
  });

  app.post('/reviews/:id/reject', async (c) => {
    if (!may(c, 'emanet:control.review')) return forbidden(c);
    const form = await c.req.parseBody();
    const result = await core(c.env).resolveIdentity(uid(c), c.req.param('id'), {
      action: 'reject',
      reason: text(form.reason),
    });
    if (!result.ok) return showReview(c, errorText(result.error), 422);
    return c.redirect('/reviews?done=rejected', 303);
  });

  /**
   * Confirming a delivery bills the partners and creates the agent's payout; not accepting one ends
   * the agent's claim. Owner or admin, with a second factor from the last 15 minutes.
   */
  app.post('/reviews/:id/deliver', async (c) => {
    const denied = sensitive(c, `/reviews/${c.req.param('id')}`);
    if (denied) return denied;
    const review = await core(c.env).review(c.req.param('id'));
    if (!review.ok || review.value.item.kind !== 'delivery' || !review.value.claim)
      return notFound(c);
    const v = await formValues(c);
    const checks = DELIVERY_CHECKS.filter((check) => v[`check_${check}`] === '1');
    const result = await core(c.env).confirmDelivery(uid(c), review.value.claim.id, checks);
    if (!result.ok)
      return showReview(
        c,
        errorText(result.error, result.detail),
        result.error === 'conflict_retry' ? 409 : 422,
      );
    return c.redirect('/reviews?done=delivered', 303);
  });

  app.post('/reviews/:id/dismiss', async (c) => {
    const denied = sensitive(c, `/reviews/${c.req.param('id')}`);
    if (denied) return denied;
    const review = await core(c.env).review(c.req.param('id'));
    if (!review.ok || review.value.item.kind !== 'delivery' || !review.value.claim)
      return notFound(c);
    const form = await c.req.parseBody();
    const result = await core(c.env).rejectDelivery(uid(c), review.value.claim.id, {
      reason: text(form.reason),
      strike: text(form.strike) === '1',
    });
    if (!result.ok)
      return showReview(c, errorText(result.error), result.error === 'conflict_retry' ? 409 : 422);
    return c.redirect('/reviews?done=dismissed', 303);
  });

  /** An evidence file, only while its delivery is open for review. */
  app.get('/reviews/:id/evidence/:evidence', async (c) => {
    const review = await core(c.env).review(c.req.param('id'));
    const item = review.ok
      ? review.value.evidence?.find((e) => e.id === c.req.param('evidence'))
      : undefined;
    if (!item || item.erased === 1) return notFound(c);
    const object = await c.env.EVIDENCE.get(item.file_ref);
    if (!object) return notFound(c);
    await core(c.env).recordView(uid(c), `review:${c.req.param('id')}`, `evidence ${item.id}`);
    const type = object.httpMetadata?.contentType ?? '';
    const image = /^image\/(jpeg|png|webp|heic|avif)$/.test(type);
    return new Response(object.body, {
      headers: {
        'Content-Type': image ? type : 'application/octet-stream',
        'Content-Disposition': image ? 'inline' : `attachment; filename="${item.id}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  });

  // ---- Onboarding -------------------------------------------------------------------------------

  registerOnboarding(app, {
    nav,
    uid,
    role,
    may,
    fresh,
    changer,
    sensitive,
    notFound,
    errorText,
    done,
    formValues: async (c) => {
      const form = await c.req.parseBody();
      const values: Record<string, string> = {};
      for (const [key, value] of Object.entries(form)) values[key] = text(value);
      return values;
    },
  });

  // ---- Partners ---------------------------------------------------------------------------------

  app.get('/partners', async (c) => {
    const partners = unwrap(await core(c.env).partners());
    return c.html(pages.partnerList(nav(c), partners));
  });

  const formValues = async (c: AppContext) => {
    const form = await c.req.parseBody();
    const values: Record<string, string> = {};
    for (const [key, value] of Object.entries(form)) values[key] = text(value);
    return values;
  };
  const taxOf = (v: Record<string, string>) => ({
    vkn: v.vkn ? v.vkn : null,
    taxOffice: v.tax_office ? v.tax_office : null,
    kepAddress: v.kep_address ? v.kep_address : null,
    eInvoice: v.e_invoice === '1',
    reconfirmDays: Number(v.reconfirm_days),
  });

  // A company becomes a partner only through Onboarding: its accepted agreement and a second
  // staff member's approval. There is no other way to add one.

  const showPartner = async (
    c: AppContext,
    error: string | null,
    status: 200 | 409 | 422 = 200,
  ) => {
    const result = await core(c.env).partner(c.req.param('id') ?? '');
    if (!result.ok) return notFound(c);
    return c.html(
      pages.partnerDetail(
        nav(c),
        result.value,
        may(c, 'emanet:control.change'),
        fresh(c),
        done(c),
        error,
      ),
      status,
    );
  };

  app.get('/partners/:id', (c) => showPartner(c, null));

  app.post('/partners/:id', async (c) => {
    const denied = changer(c);
    if (denied) return denied;
    const v = await formValues(c);
    const result = await core(c.env).updatePartner(uid(c), c.req.param('id'), {
      legalName: v.legal_name ?? '',
      ...taxOf(v),
    });
    if (!result.ok) return showPartner(c, errorText(result.error, result.detail), 422);
    return c.redirect(`/partners/${c.req.param('id')}?done=saved`, 303);
  });

  app.post('/partners/:id/status', async (c) => {
    const denied = changer(c);
    if (denied) return denied;
    const v = await formValues(c);
    if (v.status !== 'active' && v.status !== 'suspended')
      return showPartner(c, errorText('x'), 422);
    const result = await core(c.env).setPartnerStatus(uid(c), c.req.param('id'), v.status);
    if (!result.ok) return showPartner(c, errorText(result.error), 422);
    return c.redirect(
      `/partners/${c.req.param('id')}?done=${v.status === 'active' ? 'activated' : 'suspended'}`,
      303,
    );
  });

  app.post('/partners/:id/notices', async (c) => {
    const denied = changer(c);
    if (denied) return denied;
    const v = await formValues(c);
    const result = await core(c.env).setPartnerNotices(uid(c), c.req.param('id'), v.on === '1');
    if (!result.ok) return showPartner(c, errorText(result.error), 422);
    return c.redirect(`/partners/${c.req.param('id')}?done=saved`, 303);
  });

  app.post('/partners/:id/prices', async (c) => {
    const denied = sensitive(c, `/partners/${c.req.param('id')}`);
    if (denied) return denied;
    const v = await formValues(c);
    const list = parsePriceList(v.default ?? '', v.rules ?? '');
    if (!list.ok) return showPartner(c, list.error, 422);
    const result = await core(c.env).setPriceList(uid(c), c.req.param('id'), list.value);
    if (!result.ok) return showPartner(c, errorText(result.error, result.detail), 422);
    return c.redirect(`/partners/${c.req.param('id')}?done=saved`, 303);
  });

  app.post('/partners/:id/fields', async (c) => {
    const denied = changer(c);
    if (denied) return denied;
    const v = await formValues(c);
    const type = v.type as NewField['type'];
    const values = (v.enum_values ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const field: NewField = {
      partnerId: c.req.param('id'),
      entity: v.entity === 'vehicle' || v.entity === 'place' ? v.entity : 'case',
      key: v.key ?? '',
      labelTr: v.label_tr ?? '',
      labelEn: v.label_en ?? '',
      type,
      required: v.required === '1',
      pii: v.pii === '1',
      visibility:
        v.visibility === 'admin' || v.visibility === 'agent_after_claim' ? v.visibility : 'partner',
      ...(values.length ? { enumValues: values } : {}),
    };
    const result = await core(c.env).defineField(uid(c), field);
    if (!result.ok) return showPartner(c, errorText(result.error, result.detail), 422);
    return c.redirect(`/partners/${c.req.param('id')}?done=saved`, 303);
  });

  app.post('/partners/:id/fields/:field/retire', async (c) => {
    const denied = changer(c);
    if (denied) return denied;
    const result = await core(c.env).deprecateField(uid(c), c.req.param('field'));
    if (!result.ok) return showPartner(c, errorText(result.error), 422);
    return c.redirect(`/partners/${c.req.param('id')}?done=saved`, 303);
  });

  // ---- Agents -----------------------------------------------------------------------------------

  app.get('/agents', async (c) => {
    const raw = c.req.query('status');
    const filter = pages.AGENT_STATUSES.includes(raw as AgentRow['status'])
      ? (raw as AgentRow['status'])
      : null;
    const agents = unwrap(await core(c.env).agents(filter));
    return c.html(pages.agentList(nav(c), agents, filter, done(c)));
  });

  const showAgent = async (c: AppContext, error: string | null, status: 200 | 409 | 422 = 200) => {
    const agent = unwrap(await core(c.env).agents(null)).find(
      (a) => a.user_id === c.req.param('id'),
    );
    if (!agent) return notFound(c);
    const [checks, documents, accepted, asked, activation, holds] = await Promise.all([
      core(c.env).kycChecks(agent.user_id),
      core(c.env).agentDocuments(agent.user_id),
      core(c.env).agentAcceptance(agent.user_id),
      core(c.env).agentRequests(agent.user_id),
      agent.status === 'kyc_pending' && !agent.erased_at
        ? core(c.env).activationChecklist(agent.user_id)
        : Promise.resolve(null),
      may(c, 'emanet:control.change') ? core(c.env).holds() : Promise.resolve(null),
    ]);
    const hold =
      holds?.ok === true
        ? (holds.value.find(
            (h) =>
              h.subject_kind === 'agent' &&
              h.subject_ref === agent.user_id &&
              h.released_at === null,
          ) ?? null)
        : null;
    return c.html(
      pages.agentDetail(
        nav(c),
        agent,
        checks.ok ? checks.value : [],
        may(c, 'emanet:control.change'),
        fresh(c),
        done(c),
        error,
        (activation?.ok
          ? ops.activationPanel(
              agent,
              activation.value,
              may(c, 'emanet:control.change') && fresh(c),
            )
          : '') +
          ops.vettingPanel(
            agent,
            documents.ok ? documents.value : [],
            accepted.ok ? accepted.value : null,
            may(c, 'emanet:control.change') && fresh(c),
          ) +
          asks.requestsPanel(
            agent,
            asked.ok ? asked.value : [],
            may(c, 'emanet:control.review'),
            c.get('now'),
          ) +
          asks.holdPanel(agent.user_id, hold, may(c, 'emanet:control.change'), fresh(c)),
      ),
      status,
    );
  };

  // Asking an agent for details or documents: anyone who reviews applications.
  app.post('/agents/:id/ask', async (c) => {
    if (!may(c, 'emanet:control.review')) return forbidden(c);
    const list = asks.asksFrom(await formValues(c));
    const result = await core(c.env).askAgent(uid(c), c.req.param('id'), list);
    if (!result.ok) {
      const code = /^invalid_(request|reason)$/.test(result.error) ? 'invalid_ask' : result.error;
      return showAgent(c, errorText(code), 422);
    }
    return c.redirect(`/agents/${c.req.param('id')}?done=asked#requests`, 303);
  });

  app.post('/agents/:id/requests/:request/settle', async (c) => {
    if (!may(c, 'emanet:control.review')) return forbidden(c);
    const v = await formValues(c);
    const result = await core(c.env).settleAgentRequest(
      uid(c),
      c.req.param('request'),
      v.status ?? '',
    );
    if (!result.ok || result.value.agent_id !== c.req.param('id')) {
      return showAgent(c, errorText(result.ok ? 'not_found' : result.error), 422);
    }
    return c.redirect(`/agents/${c.req.param('id')}?done=request_settled#requests`, 303);
  });

  app.post('/agents/:id/requests/:request/again', async (c) => {
    if (!may(c, 'emanet:control.review')) return forbidden(c);
    const v = await formValues(c);
    const result = await core(c.env).askAgentAgain(uid(c), c.req.param('request'), v.note ?? '');
    if (!result.ok) {
      const code = result.error === 'invalid_reason' ? 'invalid_ask' : result.error;
      return showAgent(c, errorText(code), 422);
    }
    return c.redirect(`/agents/${c.req.param('id')}?done=asked#requests`, 303);
  });

  // Erasing an agent's personal data: owner or admin, with a fresh second factor.
  const showErase = async (c: AppContext, error: string | null, status: 200 | 422 = 200) => {
    const agent = unwrap(await core(c.env).agents(null)).find(
      (a) => a.user_id === c.req.param('id'),
    );
    if (!agent || agent.erased_at) return notFound(c);
    const [overview, settings] = await Promise.all([
      core(c.env).erasureOverview(agent.user_id),
      core(c.env).settings(),
    ]);
    const days = settings.ok ? settings.value.erasure_archive_days : 3650;
    return c.html(
      asks.erasePage(
        nav(c),
        agent,
        unwrap(overview),
        may(c, 'emanet:control.change'),
        fresh(c),
        Math.max(1, Math.round(days / 365)),
        error,
      ),
      status,
    );
  };

  app.get('/agents/:id/erase', (c) => showErase(c, null));

  app.post('/agents/:id/erase', async (c) => {
    const denied = sensitive(c, `/agents/${c.req.param('id')}/erase`);
    if (denied) return denied;
    const v = await formValues(c);
    if (!/^s[iİıI]l$/i.test(v.confirm ?? '')) return showErase(c, errorText('confirm_erase'), 422);
    const result = await core(c.env).eraseAgent(uid(c), c.req.param('id'), {
      reason: v.reason ?? '',
    });
    if (!result.ok) return showErase(c, errorText(result.error), 422);
    return c.redirect(
      result.value.archive_id
        ? `/privacy/archive/${result.value.archive_id}?done=erased_agent`
        : '/privacy/archive?done=erased_agent',
      303,
    );
  });

  app.post('/agents/:id/erase/refuse', async (c) => {
    const denied = sensitive(c, `/agents/${c.req.param('id')}/erase`);
    if (denied) return denied;
    const v = await formValues(c);
    const overview = await core(c.env).erasureOverview(c.req.param('id'));
    const open =
      overview.ok && overview.value.request?.status === 'open' ? overview.value.request : null;
    if (!open) return showErase(c, errorText('not_found'), 422);
    const result = await core(c.env).refuseErasure(uid(c), open.id, v.reason ?? '');
    if (!result.ok) return showErase(c, errorText(result.error), 422);
    return c.redirect('/privacy?done=erasure_refused#requests', 303);
  });

  /** An applicant's e-Devlet document, to check against e-Devlet. Each opening is recorded. */
  app.get('/agents/:id/documents/:doc', async (c) => {
    const file = await core(c.env).documentFile(uid(c), c.req.param('doc'));
    if (!file.ok || file.value.agent_id !== c.req.param('id')) return notFound(c);
    const object = await c.env.EVIDENCE.get(file.value.file_ref);
    if (!object) return notFound(c);
    const type = object.httpMetadata?.contentType ?? '';
    const shown = /^(application\/pdf|image\/(jpeg|png|webp))$/.test(type);
    return new Response(object.body, {
      headers: {
        'Content-Type': shown ? type : 'application/octet-stream',
        'Content-Disposition': shown ? 'inline' : 'attachment; filename="document"',
        'Cache-Control': 'private, no-store',
        // An uploaded PDF runs nothing: the page's policy, plus `sandbox` (added by the middleware).
        'Content-Security-Policy': 'sandbox',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
      },
    });
  });

  app.post('/agents/:id/documents/:doc/decide', async (c) => {
    const denied = sensitive(c, `/agents/${c.req.param('id')}`);
    if (denied) return denied;
    const v = await formValues(c);
    const result = await core(c.env).decideDocument(uid(c), c.req.param('doc'), {
      outcome: v.outcome ?? '',
      ...(v.note ? { note: v.note } : {}),
    });
    if (!result.ok) return showAgent(c, errorText(result.error), 422);
    return c.redirect(`/agents/${c.req.param('id')}?done=document_decided`, 303);
  });

  app.get('/agents/:id', (c) => showAgent(c, null));

  /**
   * Activating an agent lets them read debtors' addresses; suspending ends their claims. Owner or
   * admin, with a second factor from the last 15 minutes.
   */
  app.post('/agents/:id/status', async (c) => {
    const denied = sensitive(c, `/agents/${c.req.param('id')}`);
    if (denied) return denied;
    const v = await formValues(c);
    if (!pages.AGENT_STATUSES.includes(v.status as AgentRow['status'])) {
      return showAgent(c, errorText('invalid_setting'), 422);
    }
    if (!v.reason) return showAgent(c, errorText('invalid_reason'), 422);
    const result = await core(c.env).setAgentStatus(
      uid(c),
      c.req.param('id'),
      v.status as AgentRow['status'],
      v.reason,
    );
    if (!result.ok)
      return showAgent(c, errorText(result.error), result.error === 'conflict_retry' ? 409 : 422);
    return c.redirect(`/agents/${c.req.param('id')}?done=saved`, 303);
  });

  /** The application goes back to the applicant with what to correct. */
  app.post('/agents/:id/return', async (c) => {
    const denied = sensitive(c, `/agents/${c.req.param('id')}`);
    if (denied) return denied;
    const v = await formValues(c);
    if (!v.reason?.trim()) return showAgent(c, errorText('invalid_reason'), 422);
    const result = await core(c.env).returnApplication(uid(c), c.req.param('id'), v.reason);
    if (!result.ok) return showAgent(c, errorText(result.error), 422);
    return c.redirect(`/agents/${c.req.param('id')}?done=agent_returned`, 303);
  });

  /** Staff saw the person and their ID card on a video call. */
  app.post('/agents/:id/video-call', async (c) => {
    const denied = sensitive(c, `/agents/${c.req.param('id')}`);
    if (denied) return denied;
    const v = await formValues(c);
    if (v.seen !== '1') return showAgent(c, 'Confirm what you saw on the call.', 422);
    const result = await core(c.env).recordVideoCall(
      uid(c),
      c.req.param('id'),
      v.result !== 'failed',
      v.activate === '1',
    );
    if (!result.ok) return showAgent(c, errorText(result.error), 422);
    if (result.value.activated) {
      return c.redirect(`/agents/${c.req.param('id')}?done=call_activated`, 303);
    }
    if (result.value.blocked) {
      // The call is saved; say plainly why the agent is still waiting.
      return showAgent(
        c,
        `Video call recorded, but the agent was not activated. ${errorText(result.value.blocked)}`,
      );
    }
    return c.redirect(`/agents/${c.req.param('id')}?done=call_recorded`, 303);
  });

  /** Money will go to this IBAN: owner or admin, with a fresh second factor. */
  app.post('/agents/:id/iban', async (c) => {
    const denied = sensitive(c, `/agents/${c.req.param('id')}`);
    if (denied) return denied;
    const v = await formValues(c);
    if (v.checked !== '1') return showAgent(c, 'Confirm you checked the IBAN.', 422);
    const result = await core(c.env).verifyIban(uid(c), c.req.param('id'), v.iban ?? '');
    if (!result.ok) return showAgent(c, errorText(result.error), 409);
    return c.redirect(`/agents/${c.req.param('id')}?done=saved`, 303);
  });

  // ---- Money ------------------------------------------------------------------------------------

  const showMoney = async (c: AppContext, error: string | null, status: 200 | 409 | 422 = 200) => {
    const partnerFilter = c.req.query('partner') || null;
    const [uninvoiced, invoices, payouts, partners, settings] = await Promise.all([
      core(c.env).uninvoiced(),
      core(c.env).invoices(partnerFilter),
      core(c.env).payouts(null),
      core(c.env).partners(),
      core(c.env).settings(),
    ]);
    return c.html(
      pages.money(
        nav(c),
        {
          uninvoiced: unwrap(uninvoiced),
          invoices: unwrap(invoices),
          payouts: unwrap(payouts),
          partners: unwrap(partners),
          partnerFilter,
          dualApprovalKurus: unwrap(settings).dual_approval_kurus,
        },
        uid(c),
        may(c, 'emanet:control.change'),
        fresh(c),
        c.get('now'),
        done(c),
        error,
      ),
      status,
    );
  };

  app.get('/money', (c) => showMoney(c, null));

  app.get('/money/ledger', async (c) =>
    c.html(pages.ledger(nav(c), unwrap(await core(c.env).trialBalance()))),
  );

  app.post('/money/invoices', async (c) => {
    const denied = sensitive(c, '/money');
    if (denied) return denied;
    const v = await formValues(c);
    const result = await core(c.env).issueInvoice(uid(c), v.partner_id ?? '');
    if (!result.ok) return showMoney(c, errorText(result.error), 422);
    return c.redirect('/money?done=invoiced', 303);
  });

  app.post('/money/invoices/:id/number', async (c) => {
    const denied = sensitive(c, '/money');
    if (denied) return denied;
    const v = await formValues(c);
    const result = await core(c.env).setInvoiceNumber(uid(c), c.req.param('id'), {
      number: v.number ?? '',
      uuid: v.uuid ? v.uuid : null,
    });
    if (!result.ok) {
      return showMoney(
        c,
        errorText(result.error),
        result.error === 'duplicate_invoice_number' ? 409 : 422,
      );
    }
    return c.redirect('/money?done=numbered#invoices', 303);
  });

  app.post('/money/receipts', async (c) => {
    const denied = sensitive(c, '/money');
    if (denied) return denied;
    const v = await formValues(c);
    const amount = parseLira(v.amount ?? '');
    if (amount === null || amount === 0) return showMoney(c, errorText('invalid_amount'), 422);
    const invoice = unwrap(await core(c.env).invoices(null)).find((i) => i.id === v.invoice_id);
    if (!invoice) return showMoney(c, errorText('invoice_not_open'), 422);
    const result = await core(c.env).recordReceipt(uid(c), {
      partnerId: invoice.partner_id,
      invoiceId: invoice.id,
      amountKurus: amount,
      valueDate: v.value_date ?? '',
      bankRef: v.bank_ref ?? '',
      source: 'manual',
    });
    if (!result.ok) {
      return showMoney(
        c,
        errorText(result.error),
        result.error === 'duplicate_bank_ref' ? 409 : 422,
      );
    }
    return c.redirect('/money?done=received', 303);
  });

  app.post('/money/payouts/:id/order', async (c) => {
    const denied = sensitive(c, '/money');
    if (denied) return denied;
    const result = await core(c.env).orderPayout(uid(c), c.req.param('id'));
    if (!result.ok) return showMoney(c, errorText(result.error), 422);
    const outcome = result.value.status === 'ready' ? 'waiting' : 'approved';
    return c.redirect(`/money?done=${outcome}#payouts`, 303);
  });

  app.post('/money/payouts/:id/sent', async (c) => {
    const denied = sensitive(c, '/money');
    if (denied) return denied;
    const v = await formValues(c);
    const result = await core(c.env).markPayoutSent(uid(c), c.req.param('id'), v.bank_ref ?? '');
    if (!result.ok) return showMoney(c, errorText(result.error), 422);
    return c.redirect('/money?done=sent#payouts', 303);
  });

  // ---- Settings ---------------------------------------------------------------------------------

  const showSettings = async (
    c: AppContext,
    error: string | null,
    status: 200 | 422 = 200,
    providerValues: Record<string, string> | null = null,
  ) => {
    const [settings, rule, provider, dev] = await Promise.all([
      core(c.env).settingsInfo(),
      core(c.env).payoutRule(),
      core(c.env).provider(),
      core(c.env).devMode(),
    ]);
    return c.html(
      more.settingsPage(
        nav(c),
        known(unwrap(settings)),
        unwrap(rule),
        may(c, 'emanet:control.change'),
        fresh(c),
        done(c),
        error,
        unwrap(provider),
        providerValues,
        role(c) === 'owner' ? { until: dev.ok ? dev.value.until : null, act: fresh(c) } : null,
      ),
      status,
    );
  };

  app.post('/settings/provider', async (c) => {
    const denied = sensitive(c, '/settings');
    if (denied) return denied;
    const v = await formValues(c);
    const result = await core(c.env).setProvider(uid(c), {
      name: v.name ?? '',
      address: v.address ?? '',
      taxOffice: v.taxOffice ?? '',
      vkn: v.vkn ?? '',
      mersis: v.mersis ?? '',
      kep: v.kep ?? '',
      email: v.email ?? '',
    });
    if (!result.ok) {
      const field =
        result.error === 'invalid_provider' ? PROVIDER_FIELD[result.detail ?? ''] : null;
      return showSettings(c, field ?? errorText(result.error), 422, v);
    }
    return c.redirect('/settings?done=saved', 303);
  });

  /** Development mode: only an owner, with a fresh second factor. */
  app.post('/settings/dev-mode', async (c) => {
    if (role(c) !== 'owner') return forbidden(c);
    const denied = sensitive(c, '/settings');
    if (denied) return denied;
    const v = await formValues(c);
    const result = await core(c.env).setDevMode(uid(c), v.on === '1');
    if (!result.ok) return showSettings(c, errorText(result.error), 422);
    await devUntil(c, true);
    return c.redirect('/settings?done=saved#g-dev', 303);
  });

  app.get('/settings', (c) => showSettings(c, null));

  app.post('/settings', async (c) => {
    const denied = sensitive(c, '/settings');
    if (denied) return denied;
    const v = await formValues(c);
    const current = unwrap(await core(c.env).settings());
    const label = (key: SettingKey) =>
      SETTING_TEXT[key][c.get('locale') === 'tr' ? 'tr' : 'en'].label;
    const changes: [SettingKey, number][] = [];
    // Each group saves only its own fields; the rest are absent from the form.
    for (const key of SETTING_KEYS) {
      const raw = v[key];
      if (raw === undefined) continue;
      const value = parseSetting(key, raw);
      if (value === null) {
        return showSettings(c, `${errorText('invalid_setting')} (${label(key)})`, 422);
      }
      if (value !== current[key]) changes.push([key, value]);
    }
    for (const [key, value] of changes) {
      const result = await core(c.env).setSetting(uid(c), key, value);
      if (!result.ok) {
        return showSettings(c, `${errorText(result.error)} (${label(key)})`, 422);
      }
    }
    return c.redirect('/settings?done=saved', 303);
  });

  app.post('/settings/reset', async (c) => {
    const denied = sensitive(c, '/settings');
    if (denied) return denied;
    const v = await formValues(c);
    const key = SETTING_KEYS.find((k) => k === v.key);
    if (!key) return showSettings(c, errorText('invalid_setting'), 422);
    const result = await core(c.env).resetSetting(uid(c), key);
    if (!result.ok) return showSettings(c, errorText(result.error), 422);
    return c.redirect(`/settings?done=reset#s-${key}`, 303);
  });

  app.post('/settings/payout-rule', async (c) => {
    const denied = sensitive(c, '/settings');
    if (denied) return denied;
    const v = await formValues(c);
    const rule = parsePayoutRule({
      share: v.share ?? '',
      fixed: v.fixed ?? '',
      min: v.min ?? '',
      max: v.max ?? '',
    });
    if (!rule.ok) return showSettings(c, rule.error, 422);
    const result = await core(c.env).setPayoutRule(uid(c), rule.value);
    if (!result.ok) return showSettings(c, errorText(result.error, result.detail), 422);
    return c.redirect('/settings?done=saved', 303);
  });

  // ---- Audit -----------------------------------------------------------------------------------

  /** Who did what, newest first. Every staff role reads it; looking someone up is recorded. */
  app.get('/audit', async (c) => {
    const subject = text(c.req.query('subject'));
    const actor = text(c.req.query('actor'));
    const before = Number(c.req.query('before'));
    const result = await core(c.env).audit(uid(c), {
      ...(subject ? { subject } : {}),
      ...(actor ? { actor } : {}),
      ...(Number.isInteger(before) && before > 0 ? { before } : {}),
      limit: 100,
    });
    if (!result.ok) {
      return c.html(
        pages.auditPage(nav(c), [], null, { subject, actor }, errorText(result.error)),
        422,
      );
    }
    return c.html(
      pages.auditPage(
        nav(c),
        result.value.events,
        result.value.next_before,
        { subject, actor },
        null,
      ),
    );
  });

  // ---- Privacy: what is held about someone, and removing it (KVKK art. 7, 11, 13) ----------------

  const showPrivacy = async (c: AppContext, error: string | null, status: 200 | 422 = 200) => {
    const term = text(c.req.query('q'));
    const [found, requests] = await Promise.all([
      term ? core(c.env).privacySearch(uid(c), term) : Promise.resolve(null),
      core(c.env).privacyRequests(),
    ]);
    const searchError = found && !found.ok ? errorText(found.error) : null;
    return c.html(
      pages.privacyPage(
        nav(c),
        {
          term,
          found: found?.ok ? found.value : null,
          requests: unwrap(requests),
        },
        may(c, 'emanet:control.change'),
        fresh(c),
        c.get('now'),
        done(c),
        error ?? searchError,
      ),
      (error ?? searchError) ? 422 : status,
    );
  };

  app.get('/privacy', (c) => showPrivacy(c, null));

  const back = (c: AppContext, outcome: string, q: string) =>
    c.redirect(`/privacy?done=${outcome}${q ? `&q=${encodeURIComponent(q)}` : ''}`, 303);

  for (const [path, run] of [
    [
      'evidence',
      (c: AppContext, reason: string) =>
        core(c.env).eraseEvidence(uid(c), c.req.param('id') ?? '', reason),
    ],
    [
      'documents',
      (c: AppContext, reason: string) =>
        core(c.env).eraseDocument(uid(c), c.req.param('id') ?? '', reason),
    ],
    [
      'cases',
      (c: AppContext, reason: string) =>
        core(c.env).redactCasePlaces(uid(c), c.req.param('id') ?? '', reason),
    ],
  ] as const) {
    app.post(`/privacy/${path}/:id/erase`, async (c) => {
      const denied = sensitive(c, '/privacy');
      if (denied) return denied;
      const v = await formValues(c);
      const result = await run(c, v.reason ?? '');
      if (!result.ok) return showPrivacy(c, errorText(result.error), 422);
      return back(c, path === 'cases' ? 'redacted' : 'erased', v.q ?? '');
    });
  }

  // ---- Support: questions from agents and companies --------------------------------------------

  app.use('/support', async (c: AppContext, next) =>
    may(c, 'emanet:control.review') ? next() : forbidden(c),
  );
  app.use('/support/*', async (c: AppContext, next) =>
    may(c, 'emanet:control.review') ? next() : forbidden(c),
  );

  app.get('/support', async (c) => {
    const status = c.req.query('status');
    const kind = c.req.query('kind');
    const mine = c.req.query('mine') === '1';
    const statusOk = status === 'open' || status === 'answered' || status === 'closed';
    const list = unwrap(
      await core(c.env).supportTickets({
        status: statusOk ? status : 'active',
        ...(kind === 'agent' || kind === 'partner' ? { kind } : {}),
        ...(mine ? { mine: uid(c) } : {}),
      }),
    );
    return c.html(
      asks.supportInbox(
        nav(c),
        list,
        { status: statusOk ? status : 'active', kind: kind ?? '', mine },
        uid(c),
        c.get('now'),
        done(c),
      ),
    );
  });

  const showTicket = async (c: AppContext, error: string | null, status: 200 | 422 = 200) => {
    const found = await core(c.env).supportTicket(c.req.param('id') ?? '');
    if (!found.ok) return notFound(c);
    return c.html(asks.supportThread(nav(c), found.value, uid(c), error, done(c)), status);
  };

  app.get('/support/:id', (c) => showTicket(c, null));

  app.post('/support/:id/reply', async (c) => {
    const v = await formValues(c);
    const id = c.req.param('id');
    const result = await core(c.env).supportReply(uid(c), id, v.body ?? '', v.note === '1');
    if (!result.ok) return showTicket(c, errorText(result.error), 422);
    return c.redirect(
      `/support/${id}?done=${v.note === '1' ? 'ticket_noted' : 'ticket_replied'}`,
      303,
    );
  });

  app.post('/support/:id/assign', async (c) => {
    const v = await formValues(c);
    const id = c.req.param('id');
    const result = await core(c.env).supportAssign(uid(c), id, v.to === 'me' ? uid(c) : null);
    if (!result.ok) return showTicket(c, errorText(result.error), 422);
    return c.redirect(`/support/${id}?done=ticket_assigned`, 303);
  });

  for (const action of ['close', 'reopen'] as const) {
    app.post(`/support/:id/${action}`, async (c) => {
      const id = c.req.param('id');
      const result = await core(c.env).supportClose(uid(c), id, action === 'close');
      if (!result.ok) return showTicket(c, errorText(result.error), 422);
      return c.redirect(
        `/support/${id}?done=${action === 'close' ? 'ticket_closed' : 'ticket_reopened'}`,
        303,
      );
    });
  }

  // ---- Legal holds: owner or admin only ----------------------------------------------------------

  app.use('/privacy/holds', async (c: AppContext, next) =>
    may(c, 'emanet:control.change') ? next() : forbidden(c),
  );
  app.use('/privacy/holds/*', async (c: AppContext, next) =>
    may(c, 'emanet:control.change') ? next() : forbidden(c),
  );
  app.use('/privacy/retention', async (c: AppContext, next) =>
    may(c, 'emanet:control.change') ? next() : forbidden(c),
  );

  /** Where a hold form sends the person back: only to an agent's own page. */
  const holdReturn = (value: string | undefined, outcome: string) =>
    value && /^\/agents\/[\w-]+$/.test(value)
      ? `${value}?done=${outcome}`
      : `/privacy/holds?done=${outcome}`;

  const showHolds = async (c: AppContext, error: string | null, status: 200 | 422 = 200) =>
    c.html(
      asks.holdsPage(nav(c), unwrap(await core(c.env).holds()), fresh(c), error, done(c)),
      status,
    );

  app.get('/privacy/holds', (c) => showHolds(c, null));

  app.get('/privacy/retention', async (c) =>
    c.html(asks.retentionPage(nav(c), unwrap(await core(c.env).retentionOverview()))),
  );

  app.post('/privacy/holds', async (c) => {
    const denied = sensitive(c, '/privacy/holds');
    if (denied) return denied;
    const v = await formValues(c);
    const result = await core(c.env).placeHold(uid(c), v.kind ?? '', v.ref ?? '', v.reason ?? '');
    if (!result.ok) return showHolds(c, errorText(result.error), 422);
    return c.redirect(holdReturn(v.back, 'hold_placed'), 303);
  });

  app.post('/privacy/holds/:id/release', async (c) => {
    const denied = sensitive(c, '/privacy/holds');
    if (denied) return denied;
    const v = await formValues(c);
    const result = await core(c.env).releaseHold(uid(c), c.req.param('id'), v.reason ?? '');
    if (!result.ok) return showHolds(c, errorText(result.error), 422);
    return c.redirect(holdReturn(v.back, 'hold_released'), 303);
  });

  // ---- The sealed archive of erased data: owner or admin only -----------------------------------

  app.use('/privacy/archive', async (c: AppContext, next) =>
    may(c, 'emanet:control.change') ? next() : forbidden(c),
  );
  app.use('/privacy/archive/*', async (c: AppContext, next) =>
    may(c, 'emanet:control.change') ? next() : forbidden(c),
  );

  app.get('/privacy/archive', async (c) => {
    const term = c.req.query('q')?.trim() ?? '';
    return c.html(
      asks.archiveList(nav(c), unwrap(await core(c.env).archives(term)), term, done(c)),
    );
  });

  const showArchive = async (c: AppContext, error: string | null, status: 200 | 422 = 200) => {
    const id = c.req.param('id') ?? '';
    const entry = unwrap(await core(c.env).archives(id)).find((a) => a.id === id);
    if (!entry) return notFound(c);
    const views = await core(c.env).archiveViews(id);
    return c.html(
      asks.archiveDetail(nav(c), entry, views.ok ? views.value : [], fresh(c), error, done(c)),
      status,
    );
  };

  app.get('/privacy/archive/:id', (c) => showArchive(c, null));

  const download = (body: BodyInit, type: string, name: string) =>
    new Response(body, {
      headers: {
        'Content-Type': type,
        'Content-Disposition': `attachment; filename="${name}"`,
        'Cache-Control': 'private, no-store',
        'Content-Security-Policy': 'sandbox',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
      },
    });

  /** The opened record as plain text. The reason is recorded by the core before anything is returned. */
  app.post('/privacy/archive/:id/download', async (c) => {
    const denied = sensitive(c, `/privacy/archive/${c.req.param('id')}`);
    if (denied) return denied;
    const v = await formValues(c);
    const opened = await core(c.env).openArchive(uid(c), c.req.param('id'), v.reason ?? '');
    if (!opened.ok) return showArchive(c, errorText(opened.error), 422);
    const body = asks.archiveText(opened.value.entry, opened.value.payload, {
      by: uid(c),
      at: c.get('now'),
      reason: (v.reason ?? '').trim(),
    });
    // A byte-order mark, so Windows editors read the Turkish letters.
    return download(
      `\uFEFF${body}`,
      'text/plain; charset=utf-8',
      `emanet-arsiv-${c.req.param('id').slice(0, 8)}.txt`,
    );
  });

  app.post('/privacy/archive/:id/file', async (c) => {
    const id = c.req.param('id');
    const denied = sensitive(c, `/privacy/archive/${id}`);
    if (denied) return denied;
    const v = await formValues(c);
    const ref = v.ref ?? '';
    // Only an object this archive lists is read from storage.
    const listed = await core(c.env).archiveHasFile(id, ref);
    if (!listed.ok || !listed.value || !ref.startsWith(`archive/${id}/`)) return notFound(c);
    const object = await c.env.EVIDENCE.get(ref);
    if (!object) return showArchive(c, errorText('not_found'), 422);
    const opened = await core(c.env).openArchiveFile(
      uid(c),
      id,
      ref,
      v.reason ?? '',
      await object.arrayBuffer(),
    );
    if (!opened.ok) return showArchive(c, errorText(opened.error), 422);
    const ext =
      opened.value.type === 'application/pdf'
        ? 'pdf'
        : (/^image\/(jpeg|png|webp|heic)$/.exec(opened.value.type)?.[1] ?? 'bin');
    return download(
      opened.value.bytes,
      'application/octet-stream',
      `emanet-arsiv-${id.slice(0, 8)}-${opened.value.name.replace(/[^a-z_]/g, '')}.${ext}`,
    );
  });

  app.post('/privacy/requests', async (c) => {
    const denied = changer(c);
    if (denied) return denied;
    const v = await formValues(c);
    const received = v.received_at ? Date.parse(`${v.received_at}T09:00:00Z`) / 1000 : NaN;
    const result = await core(c.env).openPrivacyRequest(uid(c), {
      kind: v.kind ?? '',
      subjectKind: v.subject_kind ?? '',
      subjectRef: v.subject_ref ?? '',
      channel: v.channel ?? '',
      ...(v.note ? { note: v.note } : {}),
      ...(Number.isFinite(received) ? { receivedAt: received } : {}),
    });
    if (!result.ok) return showPrivacy(c, errorText(result.error), 422);
    return back(c, 'request_opened', '');
  });

  app.post('/privacy/requests/:id/close', async (c) => {
    const denied = changer(c);
    if (denied) return denied;
    const v = await formValues(c);
    const result = await core(c.env).closePrivacyRequest(uid(c), c.req.param('id'), {
      status: v.status === 'refused' ? 'refused' : 'done',
      outcome: v.outcome ?? '',
    });
    if (!result.ok) return showPrivacy(c, errorText(result.error), 422);
    return back(c, 'request_closed', '');
  });

  // ---- System: are the jobs running, what failed ------------------------------------------------

  app.get('/system', async (c) =>
    c.html(pages.systemPage(nav(c), unwrap(await core(c.env).ops()), c.get('now'))),
  );

  // Static files (styles, icon); anything else is not found.
  app.get('*', async (c) => {
    const asset = await c.env.ASSETS.fetch(c.req.raw);
    if (asset.status !== 404) return asset;
    return notFound(c);
  });

  return app;
}
