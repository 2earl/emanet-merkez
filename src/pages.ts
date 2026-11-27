import type {
  AgentRow,
  BalanceRow,
  EvidenceKind,
  FieldRow,
  InvoiceRow,
  PartnerRow,
  PayoutRow,
  PayoutRule,
  PriceList,
  Provider,
  ProviderRecord,
  ReviewDetail,
  ReviewItem,
  Settings,
  StaffRole,
  UninvoicedRow,
} from './core';
import { PARTNER_KINDS } from './core';
import { currentLocale, languageSwitcher } from './i18n';

/**
 * Server-rendered pages. Every dynamic value goes through `esc`, and data (names, plates, amounts)
 * is marked translate="no" so the language engine leaves it alone. No scripts (CSP).
 */

export function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const data = (value: string) => `<span translate="no">${esc(value)}</span>`;
export const attr = (value: string) => esc(value);

const MARK =
  '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">' +
  '<path fill="#F15A24" d="M0 0 50 50V100L0 50Z"/>' +
  '<path fill="#F7931E" d="M100 0 50 50V100L100 50Z"/>' +
  '<path fill="#ED1C24" d="M0 50 50 100H15A15 15 0 0 1 0 85Z"/>' +
  '<path fill="#FBB03B" d="M100 50V85A15 15 0 0 1 85 100H50Z"/>' +
  // Emanet: the 2earl hands holding something entrusted to them.
  '<path fill="#ED1C24" d="M50 7 66 23 50 39 34 23Z"/>' +
  '</svg>';

export type Section =
  'home' | 'reviews' | 'onboarding' | 'partners' | 'agents' | 'money' | 'settings';

export interface Nav {
  signedIn: boolean;
  role?: StaffRole;
  current?: Section;
}

export function plate(value: string | null, size: '' | 'large' = ''): string {
  if (!value) return '—';
  const m = /^(\d{2})([A-Z]{1,3})(\d{2,4})$/.exec(value);
  const text = m ? `${m[1] ?? ''} ${m[2] ?? ''} ${m[3] ?? ''}` : value;
  return `<span class="plate${size ? ` ${size}` : ''}" translate="no"><span>${esc(text)}</span></span>`;
}

/** Turkish lira in the page's language: ₺10,000.00 in English, ₺10.000,00 in Turkish. */
export const lira = (kurus: number) =>
  `<span translate="no">₺${(kurus / 100).toLocaleString(currentLocale() === 'tr' ? 'tr-TR' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>`;

/** Lira as a form shows it for editing: 12500.00 */
export const liraInput = (kurus: number) => (kurus / 100).toFixed(2);

/** Turkey's time (UTC+3 all year): what a date means to the people Emanet works with. */
const turkey = (unix: number) => new Date((unix + 3 * 3600) * 1000).toISOString();

export const day = (unix: number | null) =>
  unix === null ? '—' : `<time translate="no">${turkey(unix).slice(0, 10)}</time>`;

export const moment = (unix: number | null) =>
  unix === null
    ? '—'
    : `<time translate="no">${turkey(unix).slice(0, 16).replace('T', ' ')}</time>`;

const ROLE_LABEL: Record<StaffRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  support: 'Support',
};

export function layout(title: string, nav: Nav, body: string): string {
  const link = (key: Section, href: string, label: string) =>
    `<a href="${href}"${nav.current === key ? ' aria-current="page"' : ''}>${label}</a>`;
  const sections = nav.role
    ? `<nav aria-label="Sections">
        ${link('home', '/', 'Today')}
        ${link('reviews', '/reviews', 'Reviews')}
        ${link('onboarding', '/onboarding', 'Onboarding')}
        ${link('partners', '/partners', 'Partners')}
        ${link('agents', '/agents', 'Agents')}
        ${link('money', '/money', 'Money')}
        ${link('settings', '/settings', 'Settings')}
      </nav>`
    : '';
  const who = nav.signedIn
    ? `<div class="who">${nav.role ? `<span class="role">${ROLE_LABEL[nav.role]}</span>` : ''}
        <form method="post" action="/signout"><button class="link" type="submit">Sign out</button></form></div>`
    : `<div class="who"><a class="button" href="/signin">Sign in</a></div>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)} · Emanet Merkez</title>
<link rel="stylesheet" href="/app.css">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="bar">
  <a class="brand" href="/">${MARK}<span translate="no">Emanet Merkez</span></a>
  ${sections}
  ${who}
</header>
<main id="main">
${body}
</main>
<footer>
  <span>2earl staff only. Every change is recorded with your name. Times are Turkey time.</span>
  <span><a href="https://emanet.dev/gizlilik">Privacy notice</a> · <a href="https://emanet.dev/kullanim-sartlari">Terms of use</a></span>
  ${languageSwitcher()}
</footer>
</body>
</html>`;
}

export const notice = (text: string | null) => (text ? `<p class="notice">${esc(text)}</p>` : '');
export const error = (text: string | null) =>
  text ? `<p class="error" role="alert">${esc(text)}</p>` : '';

/** Shown in place of forms that need a second factor from the last 15 minutes. */
export function confirmFirst(returnTo: string): string {
  return `<p class="panel">To change money or rules, confirm it’s you first. <a class="button secondary" href="/signin?second_factor=1&amp;return=${encodeURIComponent(returnTo)}">Confirm it’s you</a></p>`;
}

export function problem(nav: Nav, title: string, text: string): string {
  return layout(
    title,
    nav,
    `<h1>${esc(title)}</h1><p class="lede">${esc(text)}</p><p><a href="/">Back to the start</a></p>`,
  );
}

export function home(): string {
  return layout(
    'Staff console',
    { signedIn: false },
    `<section class="hero">
      <h1>Emanet Merkez</h1>
      <p class="lede">The 2earl staff console for Emanet: partners, agents, reviews, invoices and payouts. Sign in with your 2earl account and its second factor.</p>
      <p><a class="button" href="/signin">Sign in with 2earl</a></p>
    </section>`,
  );
}

// ---- Today ----------------------------------------------------------------------------------------

export interface Today {
  reviews: Record<ReviewItem['kind'], number>;
  uninvoiced: UninvoicedRow[];
  payoutsReady: number;
  payoutsApproved: number;
  agentsWaiting: number;
  onboardingsSigned: number;
}

const REVIEW_LABEL: Record<ReviewItem['kind'], string> = {
  delivery: 'Deliveries to confirm',
  missing_vin: 'Vehicles without a chassis number',
  plate_conflict: 'Plates on another vehicle',
};

const REVIEW_KIND: Record<ReviewItem['kind'], string> = {
  delivery: 'Delivery',
  missing_vin: 'No chassis number',
  plate_conflict: 'Plate conflict',
};

/** Turkish law wants an invoice within seven days of the service (VUK 231/5). */
const INVOICE_DAYS = 7;

export function today(nav: Nav, t: Today, now: number): string {
  const tile = (href: string, count: number, label: string) =>
    `<a href="${href}"><strong translate="no">${String(count)}</strong><span>${label}</span></a>`;
  const late = t.uninvoiced.filter((u) => now - u.oldest_delivery > (INVOICE_DAYS - 2) * 86_400);
  return layout(
    'Today',
    { ...nav, current: 'home' },
    `<h1>Today</h1>
     <div class="counts">
       ${tile('/reviews?kind=delivery', t.reviews.delivery, REVIEW_LABEL.delivery)}
       ${tile('/reviews?kind=missing_vin', t.reviews.missing_vin, REVIEW_LABEL.missing_vin)}
       ${tile('/reviews?kind=plate_conflict', t.reviews.plate_conflict, REVIEW_LABEL.plate_conflict)}
       ${tile('/onboarding?status=signed', t.onboardingsSigned, 'Companies to approve')}
       ${tile('/agents?status=kyc_pending', t.agentsWaiting, 'Agents waiting for KYC')}
       ${tile('/money#payouts', t.payoutsReady, 'Payouts to order')}
       ${tile('/money#payouts', t.payoutsApproved, 'Payouts to send')}
     </div>
     <h2>To invoice</h2>
     ${
       t.uninvoiced.length === 0
         ? '<p class="panel">Every delivered case is invoiced.</p>'
         : `${late.length > 0 ? '<p class="error">Some deliveries are close to the seven-day invoicing limit.</p>' : ''}${uninvoicedTable(t.uninvoiced, now, false)}`
     }`,
  );
}

function uninvoicedTable(rows: UninvoicedRow[], now: number, withActions: boolean): string {
  return `<table>
    <thead><tr><th>Partner</th><th class="num">Cases</th><th class="num">Net</th><th>Oldest delivery</th>${withActions ? '<th></th>' : ''}</tr></thead>
    <tbody>${rows
      .map((u) => {
        const daysLeft = INVOICE_DAYS - Math.floor((now - u.oldest_delivery) / 86_400);
        return `<tr${daysLeft <= 2 ? ' class="late"' : ''}>
          <td><a href="/partners/${attr(u.partner_id)}">${data(u.legal_name)}</a></td>
          <td class="num" translate="no">${String(u.cases)}</td>
          <td class="num">${lira(u.net_kurus)}</td>
          <td>${day(u.oldest_delivery)}</td>
          ${
            withActions
              ? `<td><form method="post" action="/money/invoices" class="inline">
                  <input type="hidden" name="partner_id" value="${attr(u.partner_id)}">
                  <button type="submit">Issue invoice</button></form></td>`
              : ''
          }
        </tr>`;
      })
      .join('')}</tbody></table>`;
}

// ---- Reviews --------------------------------------------------------------------------------------

export function reviewList(
  nav: Nav,
  items: ReviewItem[],
  kind: ReviewItem['kind'] | null,
  noticeText: string | null,
): string {
  const filters = [
    `<a href="/reviews"${kind === null ? ' aria-current="page"' : ''}>All</a>`,
    ...(['delivery', 'missing_vin', 'plate_conflict'] as const).map(
      (k) =>
        `<a href="/reviews?kind=${k}"${kind === k ? ' aria-current="page"' : ''}>${REVIEW_KIND[k]}</a>`,
    ),
  ].join(' · ');
  const shown = kind ? items.filter((i) => i.kind === kind) : items;
  const table =
    shown.length === 0
      ? '<p class="panel">Nothing to review.</p>'
      : `<table><thead><tr><th>Kind</th><th>Waiting since</th><th>Details</th></tr></thead><tbody>${shown
          .map(
            (i) => `<tr>
              <td><a href="/reviews/${attr(i.id)}">${REVIEW_KIND[i.kind]}</a></td>
              <td>${moment(i.created_at)}</td>
              <td>${reviewSummary(i)}</td>
            </tr>`,
          )
          .join('')}</tbody></table>`;
  return layout(
    'Reviews',
    { ...nav, current: 'reviews' },
    `${notice(noticeText)}<h1>Reviews</h1>
     <p class="lede">Cases wait here until their vehicle is certain, and deliveries until the evidence shows the vehicle in a custodian car park. Oldest first.</p>
     <p>${filters}</p>${table}`,
  );
}

function detailOf(item: ReviewItem): Record<string, unknown> {
  if (typeof item.detail !== 'string') return item.detail;
  try {
    return JSON.parse(item.detail) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function reviewSummary(item: ReviewItem): string {
  const d = detailOf(item);
  const value = (key: string) => (typeof d[key] === 'string' ? d[key] : '');
  if (value('plate')) return plate(value('plate'));
  if (value('vin')) return data(value('vin'));
  return '—';
}

const EVIDENCE_LABEL: Record<EvidenceKind, string> = {
  scene: 'Photo at the scene',
  police_report: 'Police report',
  tow_report: 'Tow report',
  yediemin_receipt: 'Custodian’s receipt',
  yediemin_vehicle: 'Vehicle in the car park',
};

export function reviewDetail(
  nav: Nav,
  r: ReviewDetail,
  role: StaffRole,
  errorText: string | null,
): string {
  const kind = r.item.kind;
  const changeAllowed = role === 'owner' || role === 'admin';
  let body: string;
  if (kind === 'delivery') {
    const claim = r.claim;
    const evidence = r.evidence ?? [];
    const sightings = r.sightings ?? [];
    const cases = r.cases ?? [];
    const gallery =
      evidence.length === 0
        ? '<p class="panel">No evidence uploaded yet.</p>'
        : `<ul class="evidence">${evidence
            .map(
              (e) => `<li>
                <a href="/reviews/${attr(r.item.id)}/evidence/${attr(e.id)}"><img src="/reviews/${attr(r.item.id)}/evidence/${attr(e.id)}" alt="${attr(EVIDENCE_LABEL[e.kind])}" loading="lazy"></a>
                <span>${EVIDENCE_LABEL[e.kind]}</span>
                <span class="hint">Taken ${moment(e.exif_time)} · received ${moment(e.created_at)}</span>
              </li>`,
            )
            .join('')}</ul>`;
    body = `<p>${plate(claim?.plate ?? null, 'large')}</p>
      <h1>Delivery: ${data(`${claim?.make ?? ''} ${claim?.model ?? ''}`)}</h1>
      <div class="panel"><dl class="facts">
        <dt>Chassis number (VIN)</dt><dd>${claim?.vin ? data(claim.vin) : '—'}</dd>
        <dt>Agent</dt><dd>${claim?.agent_name ? data(claim.agent_name) : '—'}</dd>
        <dt>Claimed</dt><dd>${moment(claim?.claimed_at ?? null)}</dd>
      </dl></div>
      <h2>Evidence</h2>
      <p class="hint">Check that the plate and chassis number on the custodian’s receipt match this vehicle, and that the photos were taken after the claim.</p>
      ${gallery}
      <h2>Sightings</h2>
      ${
        sightings.length === 0
          ? '<p class="panel">No sightings.</p>'
          : `<table><thead><tr><th>Taken</th><th>Received</th><th>Location</th><th class="num">Accuracy</th></tr></thead><tbody>${sightings
              .map(
                (s) => `<tr><td>${moment(s.taken_at)}</td><td>${moment(s.received_at)}</td>
                  <td>${data(`${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}`)}</td>
                  <td class="num">${s.accuracy_m === null ? '—' : data(`${String(Math.round(s.accuracy_m))} m`)}</td></tr>`,
              )
              .join('')}</tbody></table>`
      }
      <h2>Cases delivered by this</h2>
      ${
        cases.length === 0
          ? '<p class="panel">No active case on this vehicle any more. It can’t be delivered.</p>'
          : `<table><thead><tr><th>Partner</th><th>Their reference</th><th>Enforcement file</th><th class="num">Fee</th></tr></thead><tbody>${cases
              .map(
                (c) => `<tr><td>${data(c.legal_name)}</td><td>${data(c.external_ref)}</td>
                  <td>${data(`${c.icra_office} ${c.icra_file_no}`)}</td><td class="num">${lira(c.fee_kurus)}</td></tr>`,
              )
              .join('')}</tbody></table>`
      }
      ${error(errorText)}
      ${
        changeAllowed && claim && cases.length > 0
          ? `<form method="post" action="/reviews/${attr(r.item.id)}/deliver" class="actions">
              <button type="submit">Confirm the vehicle is in custody</button>
            </form>
            <p class="hint">Every case above is closed as delivered, each partner is told and invoiced, and the agent’s payout is created.</p>`
          : changeAllowed
            ? ''
            : '<p class="hint">An owner or admin confirms deliveries.</p>'
      }`;
  } else {
    const c = r.case;
    const v = r.vehicle;
    const d = r.item.detail;
    const why =
      d.reason === 'plate_change'
        ? 'The partner reports a new plate for this vehicle.'
        : d.reason === 'plate_on_other_vehicle'
          ? 'Another vehicle has this plate now.'
          : 'No chassis number.';
    body = `<p>${plate(c?.vehicle_snapshot.plate ?? null, 'large')}</p>
      <h1>${REVIEW_KIND[kind]}</h1>
      <p class="lede">${
        kind === 'missing_vin'
          ? 'The partner sent this vehicle without a chassis number. Agents don’t see it until staff confirm which vehicle it is.'
          : 'The partner’s plate is recorded on another vehicle. Decide which vehicle it belongs to now.'
      }</p>
      <div class="grid2">
        <div class="panel"><h2>The partner says</h2><dl class="facts">
          <dt>Partner</dt><dd>${c ? data(c.legal_name) : '—'}</dd>
          <dt>Their reference</dt><dd>${c ? data(c.external_ref) : '—'}</dd>
          <dt>Plate</dt><dd>${plate(c?.vehicle_snapshot.plate ?? null)}</dd>
          <dt>Chassis number (VIN)</dt><dd>${c?.vehicle_snapshot.vin ? data(c.vehicle_snapshot.vin) : '—'}</dd>
          <dt>Vehicle</dt><dd>${c ? data(`${c.vehicle_snapshot.make} ${c.vehicle_snapshot.model}`) : '—'}</dd>
        </dl></div>
        <div class="panel"><h2>Emanet has</h2><dl class="facts">
          <dt>Plate</dt><dd>${plate(typeof d.recorded === 'string' ? d.recorded : (v?.plate ?? null))}</dd>
          <dt>Chassis number (VIN)</dt><dd>${v?.vin ? data(v.vin) : '—'}</dd>
          <dt>Vehicle</dt><dd>${v ? data(`${v.make} ${v.model}`) : '—'}</dd>
          <dt>Why</dt><dd>${why}</dd>
        </dl></div>
      </div>
      ${error(errorText)}
      <h2>Accept</h2>
      <form method="post" action="/reviews/${attr(r.item.id)}/accept" class="stack">
        <label>Chassis number (VIN) <input name="vin" maxlength="17" autocomplete="off" value="${attr(c?.vehicle_snapshot.vin ?? '')}"></label>
        <p class="hint">From the registration (ruhsat) or the enforcement file. If another vehicle has this chassis number, the case joins it, and the plate moves to it.</p>
        <div><button type="submit">Accept and let agents look</button></div>
      </form>
      <h2>Reject</h2>
      <form method="post" action="/reviews/${attr(r.item.id)}/reject" class="stack">
        <label>Reason for the partner <input name="reason" required maxlength="200"></label>
        <div><button class="secondary" type="submit">Reject the case</button></div>
      </form>`;
  }
  return layout(REVIEW_KIND[kind], { ...nav, current: 'reviews' }, body);
}

// ---- Partners -------------------------------------------------------------------------------------

export const KIND_LABEL: Record<PartnerRow['kind'], string> = {
  bank: 'Bank',
  vys: 'Asset management company',
  law_firm: 'Law firm',
  leasing: 'Leasing company',
  other: 'Other',
};

const PARTNER_STATUS: Record<PartnerRow['status'], string> = {
  invited: 'Invited',
  active: 'Active',
  suspended: 'Suspended',
};

const partnerStatus = (s: PartnerRow['status']) =>
  `<span class="status ${s}">${PARTNER_STATUS[s]}</span>`;

export function partnerList(
  nav: Nav,
  partners: PartnerRow[],
  canChange: boolean,
  errorText: string | null,
  values: Record<string, string>,
): string {
  const table =
    partners.length === 0
      ? '<p class="panel">No partners yet.</p>'
      : `<table><thead><tr><th>Partner</th><th>Kind</th><th>Status</th><th class="num">Open cases</th><th class="num">Delivered</th></tr></thead><tbody>${partners
          .map(
            (p) => `<tr>
              <td><a href="/partners/${attr(p.id)}">${data(p.legal_name)}</a></td>
              <td>${KIND_LABEL[p.kind]}</td>
              <td>${partnerStatus(p.status)}</td>
              <td class="num" translate="no">${String(p.active_cases)}</td>
              <td class="num" translate="no">${String(p.delivered_cases)}</td>
            </tr>`,
          )
          .join('')}</tbody></table>`;
  const form = canChange
    ? `<h2>Add a partner</h2>
       <p class="hint">First create the organization in 2earl login and invite its people. Then add it here with the organization’s ID. It starts as invited: set its price list, then activate it.</p>
       ${error(errorText)}
       <form method="post" action="/partners" class="stack">
         <div class="grid2">
           <label>Login organization ID <input name="org_id" required maxlength="64" autocomplete="off" value="${attr(values.org_id ?? '')}"></label>
           <label>Kind <select name="kind">${PARTNER_KINDS.map(
             (k) =>
               `<option value="${k}"${values.kind === k ? ' selected' : ''}>${KIND_LABEL[k]}</option>`,
           ).join('')}</select></label>
         </div>
         <label>Legal name <input name="legal_name" required maxlength="200" value="${attr(values.legal_name ?? '')}"></label>
         ${taxFields(values)}
         <div><button type="submit">Add partner</button></div>
       </form>`
    : '';
  return layout('Partners', { ...nav, current: 'partners' }, `<h1>Partners</h1>${table}${form}`);
}

function taxFields(values: Record<string, string>): string {
  return `<div class="grid2">
      <label>Tax number (VKN) <input name="vkn" inputmode="numeric" pattern="[0-9]{10,11}" maxlength="11" value="${attr(values.vkn ?? '')}"></label>
      <label>Tax office <input name="tax_office" maxlength="100" value="${attr(values.tax_office ?? '')}"></label>
      <label>KEP address <input name="kep_address" type="email" maxlength="200" value="${attr(values.kep_address ?? '')}"></label>
      <label>Re-confirm cases every (days) <input name="reconfirm_days" type="number" min="1" max="90" required value="${attr(values.reconfirm_days ?? '14')}"></label>
    </div>
    <label class="check"><input type="checkbox" name="e_invoice" value="1"${values.e_invoice === '1' ? ' checked' : ''}> Registered for e-invoices (e-Fatura)</label>`;
}

const ENTITY_LABEL: Record<FieldRow['entity'], string> = {
  vehicle: 'Vehicle',
  case: 'Case',
  place: 'Place',
};

const TYPE_LABEL: Record<string, string> = {
  text: 'Text',
  number: 'Number',
  date: 'Date',
  enum: 'One of a list',
  bool: 'Yes or no',
  phone: 'Phone number',
  money: 'Amount in lira',
};

const VISIBILITY_LABEL: Record<string, string> = {
  partner: 'Partner and staff',
  admin: 'Staff only',
  agent_after_claim: 'Also the agent, after a claim',
};

export function partnerDetail(
  nav: Nav,
  d: {
    partner: PartnerRow;
    priceList: PriceList | null;
    priceListFrom: number | null;
    fields: FieldRow[];
  },
  canChange: boolean,
  fresh: boolean,
  noticeText: string | null,
  errorText: string | null,
): string {
  const p = d.partner;
  const path = `/partners/${p.id}`;
  const statusActions = canChange
    ? `<form method="post" action="${path}/status" class="actions">
        ${p.status !== 'active' ? '<button type="submit" name="status" value="active">Activate</button>' : ''}
        ${p.status === 'active' ? '<button class="secondary" type="submit" name="status" value="suspended">Suspend</button>' : ''}
      </form>
      ${p.status === 'active' ? '<p class="hint">Suspending stops its people from signing in to Emanet Kurumsal and its API keys from working. Its cases stay as they are.</p>' : ''}`
    : '';
  const rules = d.priceList?.rules ?? [];
  const priceRows = rules
    .map(
      (r) =>
        `${r.make ?? '*'};${r.model ?? '*'};${r.year_from === undefined ? '' : String(r.year_from)};${r.year_to === undefined ? '' : String(r.year_to)};${liraInput(r.fee_kurus)}`,
    )
    .join('\n');
  const price = `<h2>Price list</h2>
    ${
      d.priceList
        ? `<div class="panel"><dl class="facts">
            <dt>Default fee</dt><dd>${lira(d.priceList.default_kurus)}</dd>
            <dt>Valid from</dt><dd>${day(d.priceListFrom)}</dd>
          </dl>
          ${
            rules.length
              ? `<table><thead><tr><th>Make</th><th>Model</th><th>Years</th><th class="num">Fee</th></tr></thead><tbody>${rules
                  .map(
                    (r) => `<tr><td>${data(r.make ?? '*')}</td><td>${data(r.model ?? '*')}</td>
                      <td>${data(r.year_from === undefined && r.year_to === undefined ? '*' : `${r.year_from === undefined ? '' : String(r.year_from)}–${r.year_to === undefined ? '' : String(r.year_to)}`)}</td>
                      <td class="num">${lira(r.fee_kurus)}</td></tr>`,
                  )
                  .join('')}</tbody></table>`
              : ''
          }</div>`
        : '<p class="panel">No price list. The partner can’t add cases until it has one.</p>'
    }
    ${
      canChange
        ? fresh
          ? `<form method="post" action="${path}/prices" class="stack">
              <label>Default fee (₺) <input name="default" required inputmode="decimal" value="${attr(d.priceList ? liraInput(d.priceList.default_kurus) : '')}"></label>
              <label>Rules, one per line <textarea name="rules" rows="6" spellcheck="false" translate="no">${esc(priceRows)}</textarea></label>
              <p class="hint">Make;Model;From year;To year;Fee. Use * for any make or model and leave years empty for any year. The most specific rule wins. A new list applies to cases added from now on; open cases keep their fee.</p>
              <div><button type="submit">Save price list</button></div>
            </form>`
          : confirmFirst(path)
        : ''
    }`;
  const fields = d.fields;
  const fieldTable =
    fields.length === 0
      ? '<p class="panel">No custom fields.</p>'
      : `<table><thead><tr><th>Applies to</th><th>Key</th><th>Label</th><th>Type</th><th>Who sees it</th><th></th></tr></thead><tbody>${fields
          .map(
            (f) => `<tr${f.deprecated_at ? ' class="retired"' : ''}>
              <td>${ENTITY_LABEL[f.entity]}${f.partner_id ? '' : ' <span class="hint">(all partners)</span>'}</td>
              <td>${data(f.key)}${f.required ? ' <span class="hint">required</span>' : ''}</td>
              <td>${data(currentLocale() === 'tr' ? f.label_tr : f.label_en)}</td>
              <td>${TYPE_LABEL[f.type] ?? data(f.type)}</td>
              <td>${VISIBILITY_LABEL[f.visibility] ?? data(f.visibility)}</td>
              <td>${
                f.deprecated_at
                  ? 'Retired'
                  : canChange && f.partner_id
                    ? `<form method="post" action="${path}/fields/${attr(f.id)}/retire" class="inline"><button class="link" type="submit">Retire</button></form>`
                    : ''
              }</td>
            </tr>`,
          )
          .join('')}</tbody></table>`;
  const fieldForm = canChange
    ? `<details><summary>Add a field</summary>
        <form method="post" action="${path}/fields" class="stack">
          <div class="grid2">
            <label>Applies to <select name="entity">
              <option value="case">Case</option><option value="vehicle">Vehicle</option><option value="place">Place</option>
            </select></label>
            <label>Key <input name="key" required pattern="[a-z][a-z0-9_]{0,39}" maxlength="40" autocomplete="off"></label>
            <label>Label in Turkish <input name="label_tr" required maxlength="80"></label>
            <label>Label in English <input name="label_en" required maxlength="80"></label>
            <label>Type <select name="type">
              <option value="text">Text</option><option value="number">Number</option><option value="date">Date</option>
              <option value="enum">One of a list</option><option value="bool">Yes or no</option>
              <option value="phone">Phone number</option><option value="money">Amount in lira</option>
            </select></label>
            <label>Who sees it <select name="visibility">
              <option value="partner">Partner and staff</option><option value="admin">Staff only</option>
              <option value="agent_after_claim">Also the agent, after a claim</option>
            </select></label>
          </div>
          <label>Allowed values, for “one of a list” <input name="enum_values" maxlength="500"></label>
          <p class="hint">Separate the values with commas. A field is never deleted, only retired, so old values keep their meaning.</p>
          <label class="check"><input type="checkbox" name="required" value="1"> Required</label>
          <label class="check"><input type="checkbox" name="pii" value="1"> Personal data (never shown to agents before a claim)</label>
          <div><button type="submit">Add field</button></div>
        </form></details>`
    : '';
  const edit = canChange
    ? `<details><summary>Edit details</summary>
        <form method="post" action="${path}" class="stack">
          <label>Legal name <input name="legal_name" required maxlength="200" value="${attr(p.legal_name)}"></label>
          ${taxFields({
            vkn: p.vkn ?? '',
            tax_office: p.tax_office ?? '',
            kep_address: p.kep_address ?? '',
            reconfirm_days: String(p.reconfirm_days),
            e_invoice: p.e_invoice ? '1' : '',
          })}
          <div><button type="submit">Save details</button></div>
        </form></details>`
    : '';
  return layout(
    'Partner',
    { ...nav, current: 'partners' },
    `${notice(noticeText)}
     <h1>${data(p.legal_name)} ${partnerStatus(p.status)}</h1>
     ${error(errorText)}
     <div class="panel"><dl class="facts">
       <dt>Kind</dt><dd>${KIND_LABEL[p.kind]}</dd>
       <dt>Login organization</dt><dd>${data(p.org_id)}</dd>
       <dt>Tax number (VKN)</dt><dd>${p.vkn ? data(p.vkn) : '—'}</dd>
       <dt>Tax office</dt><dd>${p.tax_office ? data(p.tax_office) : '—'}</dd>
       <dt>KEP address</dt><dd>${p.kep_address ? data(p.kep_address) : '—'}</dd>
       <dt>E-invoices</dt><dd>${p.e_invoice ? 'Yes' : 'No'}</dd>
       <dt>Re-confirm cases every</dt><dd>${data(String(p.reconfirm_days))} days</dd>
       <dt>Open cases</dt><dd translate="no">${String(p.active_cases)}</dd>
       <dt>Delivered</dt><dd translate="no">${String(p.delivered_cases)}</dd>
     </dl></div>
     ${statusActions}
     ${edit}
     ${price}
     <h2>Custom fields</h2>
     ${fieldTable}
     ${fieldForm}
     <p><a href="/money?partner=${attr(p.id)}">Invoices for this partner</a></p>`,
  );
}

// ---- Agents ---------------------------------------------------------------------------------------

export const AGENT_STATUSES = ['applied', 'kyc_pending', 'active', 'suspended', 'banned'] as const;

const AGENT_STATUS: Record<AgentRow['status'], string> = {
  applied: 'Applied',
  kyc_pending: 'Checking identity',
  active: 'Active',
  suspended: 'Suspended',
  banned: 'Banned',
};

const TAX_LABEL: Record<string, string> = {
  individual: 'Individual',
  sole_trader: 'Sole trader',
  company: 'Company',
};

export function agentList(
  nav: Nav,
  agents: AgentRow[],
  filter: AgentRow['status'] | null,
  noticeText: string | null,
): string {
  const filters = [
    `<a href="/agents"${filter === null ? ' aria-current="page"' : ''}>All</a>`,
    ...AGENT_STATUSES.map(
      (s) =>
        `<a href="/agents?status=${s}"${filter === s ? ' aria-current="page"' : ''}>${AGENT_STATUS[s]}</a>`,
    ),
  ].join(' · ');
  const table =
    agents.length === 0
      ? '<p class="panel">No agents here.</p>'
      : `<table><thead><tr><th>Agent</th><th>City</th><th>Status</th><th>IBAN</th><th class="num">Open claims</th><th class="num">Deliveries</th><th class="num">Strikes</th><th>Since</th></tr></thead><tbody>${agents
          .map(
            (a) => `<tr>
              <td><a href="/agents/${attr(a.user_id)}">${a.legal_name ? data(a.legal_name) : 'No name yet'}</a></td>
              <td>${a.city ? data(a.city) : '—'}</td>
              <td><span class="status ${a.status}">${AGENT_STATUS[a.status]}</span></td>
              <td>${a.iban_verified ? 'Verified' : 'Not verified'}</td>
              <td class="num" translate="no">${String(a.open_claims)}</td>
              <td class="num" translate="no">${String(a.deliveries)}</td>
              <td class="num" translate="no">${String(a.strikes)}</td>
              <td>${day(a.created_at)}</td>
            </tr>`,
          )
          .join('')}</tbody></table>`;
  return layout(
    'Agents',
    { ...nav, current: 'agents' },
    `${notice(noticeText)}<h1>Agents</h1>
     <p class="lede">An agent can claim vehicles only when active: identity checked in a video call with their ID card, and an IBAN in their own name.</p>
     <p>${filters}</p>${table}`,
  );
}

export function agentDetail(
  nav: Nav,
  a: AgentRow,
  canChange: boolean,
  fresh: boolean,
  noticeText: string | null,
  errorText: string | null,
): string {
  const path = `/agents/${a.user_id}`;
  const check =
    a.status === 'kyc_pending'
      ? `<h2>Identity check</h2>
         <ol class="steps">
           <li>Call the agent on a video call at the number above.</li>
           <li>They hold their Turkish ID card next to their face: the photo is the person you see, and the name is the name above, letter for letter.</li>
           <li>Don’t write down or keep the ID number or a picture of the card.</li>
           <li>Check the IBAN is in that name: the bank’s name check, or a small test transfer whose reference they read back to you. Then mark it verified below.</li>
           <li>If everything matches, make the agent active with a short reason, like “video call, ID matched”.</li>
         </ol>`
      : '';
  const iban =
    a.iban && !a.iban_verified && canChange
      ? fresh
        ? `<form method="post" action="${path}/iban" class="stack">
            <input type="hidden" name="iban" value="${attr(a.iban)}">
            <label class="check"><input type="checkbox" name="checked" value="1" required> I checked that this IBAN is in the name above.</label>
            <div><button type="submit">Mark the IBAN verified</button></div>
          </form>`
        : confirmFirst(path)
      : '';
  const status = canChange
    ? `<h2>Change status</h2>
       <form method="post" action="${path}/status" class="stack">
         <div class="grid2">
           <label>New status <select name="status">${AGENT_STATUSES.filter((s) => s !== a.status)
             .map((s) => `<option value="${s}">${AGENT_STATUS[s]}</option>`)
             .join('')}</select></label>
           <label>Reason <input name="reason" required maxlength="200"></label>
         </div>
         <p class="hint">Suspending or banning ends the agent’s open claims at once.</p>
         <div><button class="secondary" type="submit">Change status</button></div>
       </form>`
    : '';
  return layout(
    'Agent',
    { ...nav, current: 'agents' },
    `${notice(noticeText)}
     <h1>${a.legal_name ? data(a.legal_name) : 'No name yet'} <span class="status ${a.status}">${AGENT_STATUS[a.status]}</span></h1>
     ${error(errorText)}
     <div class="panel"><dl class="facts">
       <dt>Mobile</dt><dd>${a.phone ? `<a href="tel:${attr(a.phone)}" translate="no">${esc(a.phone)}</a>` : '—'}</dd>
       <dt>City</dt><dd>${a.city ? data(a.city) : '—'}</dd>
       <dt>IBAN</dt><dd>${a.iban ? data(a.iban) : '—'} ${a.iban ? (a.iban_verified ? '<span class="status active">Verified</span>' : '<span class="status kyc_pending">Not verified</span>') : ''}</dd>
       <dt>Tax</dt><dd>${TAX_LABEL[a.tax_profile] ?? data(a.tax_profile)}${a.vkn ? ` · ${data(a.vkn)}` : ''}</dd>
       <dt>Applied</dt><dd>${day(a.submitted_at)}</dd>
       <dt>Rules accepted</dt><dd>${a.terms_version ? data(a.terms_version) : '—'}</dd>
       <dt>Open claims</dt><dd translate="no">${String(a.open_claims)}</dd>
       <dt>Deliveries</dt><dd translate="no">${String(a.deliveries)}</dd>
       <dt>Strikes</dt><dd translate="no">${String(a.strikes)}</dd>
     </dl></div>
     ${check}
     ${iban}
     ${status}`,
  );
}

// ---- Money ----------------------------------------------------------------------------------------

const INVOICE_STATUS: Record<InvoiceRow['status'], string> = {
  issued: 'Open',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

const PAYOUT_STATUS: Record<PayoutRow['status'], string> = {
  awaiting_receipt: 'Waiting for the partner’s payment',
  ready: 'Ready to order',
  approved: 'Approved, to send',
  sent: 'Sent',
  cancelled: 'Cancelled',
};

export interface Money {
  uninvoiced: UninvoicedRow[];
  invoices: InvoiceRow[];
  payouts: PayoutRow[];
  partners: PartnerRow[];
  partnerFilter: string | null;
  dualApprovalKurus: number;
}

export function money(
  nav: Nav,
  m: Money,
  staffId: string,
  canChange: boolean,
  fresh: boolean,
  now: number,
  noticeText: string | null,
  errorText: string | null,
): string {
  const act = canChange && fresh;
  const filter = m.partnerFilter ? m.partners.find((p) => p.id === m.partnerFilter) : undefined;
  const invoices =
    m.invoices.length === 0
      ? '<p class="panel">No invoices yet.</p>'
      : `<table><thead><tr><th>Issued</th><th>Partner</th><th>Number</th><th class="num">Cases</th><th class="num">Total</th><th class="num">Paid</th><th>Status</th></tr></thead><tbody>${m.invoices
          .map(
            (i) => `<tr>
              <td>${day(i.issued_at)}</td>
              <td><a href="/partners/${attr(i.partner_id)}">${data(i.legal_name)}</a></td>
              <td>${i.number ? data(i.number) : '<span class="hint">Waiting for the e-invoice number</span>'}</td>
              <td class="num" translate="no">${String(i.cases)}</td>
              <td class="num">${lira(i.total_kurus)}</td>
              <td class="num">${lira(i.paid_kurus)}</td>
              <td><span class="status ${i.status}">${INVOICE_STATUS[i.status]}</span></td>
            </tr>`,
          )
          .join('')}</tbody></table>`;
  const open = m.invoices.filter((i) => i.status === 'issued');
  const receipt = act
    ? `<h3>Record a payment from a partner</h3>
       <p class="hint">Copy it from the bank statement. The bank reference is recorded once, so the same payment can’t be counted twice.</p>
       <form method="post" action="/money/receipts" class="stack">
         <div class="grid2">
           <label>Invoice <select name="invoice_id" required>${open
             .map(
               (i) =>
                 `<option value="${attr(i.id)}" translate="no">${esc(`${i.legal_name} · ${i.number ?? i.id.slice(0, 8)} · ${liraInput(i.total_kurus - i.paid_kurus)}`)}</option>`,
             )
             .join('')}</select></label>
           <label>Amount (₺) <input name="amount" required inputmode="decimal"></label>
           <label>Value date <input name="value_date" type="date" required></label>
           <label>Bank reference <input name="bank_ref" required maxlength="100" autocomplete="off"></label>
         </div>
         <div><button type="submit"${open.length === 0 ? ' disabled' : ''}>Record payment</button></div>
       </form>`
    : '';
  const payoutAction = (p: PayoutRow) => {
    if (!act) return '';
    if (p.status === 'ready') {
      const second = p.ordered_by !== null;
      if (second && p.ordered_by === staffId)
        return '<span class="hint">Waiting for a second admin</span>';
      return `<form method="post" action="/money/payouts/${attr(p.id)}/order" class="inline">
          <button type="submit">${second ? 'Approve' : 'Order'}</button></form>`;
    }
    if (p.status === 'approved') {
      return `<form method="post" action="/money/payouts/${attr(p.id)}/sent" class="inline">
          <label class="sr">Bank reference <input name="bank_ref" required maxlength="100" placeholder="Bank reference" autocomplete="off"></label>
          <button type="submit">Mark as sent</button></form>`;
    }
    return '';
  };
  const payouts =
    m.payouts.length === 0
      ? '<p class="panel">No payouts yet.</p>'
      : `<table><thead><tr><th>Created</th><th>Agent</th><th class="num">Gross</th><th class="num">Withholding</th><th class="num">Net</th><th>Status</th><th>Bank reference</th>${act ? '<th></th>' : ''}</tr></thead><tbody>${m.payouts
          .map(
            (p) => `<tr>
              <td>${day(p.created_at)}</td>
              <td>${p.legal_name ? data(p.legal_name) : '—'}</td>
              <td class="num">${lira(p.gross_kurus)}</td>
              <td class="num">${lira(p.withholding_kurus)}</td>
              <td class="num">${lira(p.net_kurus)}</td>
              <td><span class="status ${p.status}">${PAYOUT_STATUS[p.status]}</span></td>
              <td>${p.bank_ref ? data(p.bank_ref) : '—'}</td>
              ${act ? `<td>${payoutAction(p)}</td>` : ''}
            </tr>`,
          )
          .join('')}</tbody></table>`;
  const partnerFilter = `<form method="get" action="/money" class="inline">
      <label>Partner <select name="partner"><option value="">All partners</option>${m.partners
        .map(
          (p) =>
            `<option value="${attr(p.id)}"${p.id === m.partnerFilter ? ' selected' : ''} translate="no">${esc(p.legal_name)}</option>`,
        )
        .join('')}</select></label>
      <button class="secondary" type="submit">Show</button></form>`;
  return layout(
    'Money',
    { ...nav, current: 'money' },
    `${notice(noticeText)}<h1>Money</h1>
     <p class="lede">Partners are invoiced for delivered vehicles. An agent is paid after the partner’s payment is in the bank: order the payout here, send it from the bank, then record its reference.</p>
     ${error(errorText)}
     ${canChange && !fresh ? confirmFirst('/money') : ''}
     <p><a href="/money/ledger">Trial balance</a></p>
     <h2>To invoice</h2>
     ${m.uninvoiced.length === 0 ? '<p class="panel">Every delivered case is invoiced.</p>' : uninvoicedTable(m.uninvoiced, now, act)}
     <h2 id="invoices">Invoices${filter ? ` · ${data(filter.legal_name)}` : ''}</h2>
     ${partnerFilter}
     ${invoices}
     ${receipt}
     <h2 id="payouts">Payouts</h2>
     <p class="hint">Payouts of ${lira(m.dualApprovalKurus)} or more need a second admin to approve them.</p>
     ${payouts}`,
  );
}

export function ledger(nav: Nav, rows: BalanceRow[]): string {
  const debit = rows.reduce((sum, r) => sum + r.debit_kurus, 0);
  const credit = rows.reduce((sum, r) => sum + r.credit_kurus, 0);
  return layout(
    'Trial balance',
    { ...nav, current: 'money' },
    `<h1>Trial balance</h1>
     <p class="lede">Every journal entry, by account of the Uniform Chart of Accounts (Tek Düzen Hesap Planı). Entries are never changed; a mistake is corrected by a new entry.</p>
     <table><thead><tr><th>Account</th><th>Name</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Balance</th></tr></thead>
     <tbody>${rows
       .map(
         (r) => `<tr><td translate="no">${esc(r.code)}</td><td>${data(r.name)}</td>
           <td class="num">${lira(r.debit_kurus)}</td><td class="num">${lira(r.credit_kurus)}</td>
           <td class="num">${lira(r.debit_kurus - r.credit_kurus)}</td></tr>`,
       )
       .join('')}</tbody>
     <tfoot><tr><th colspan="2">Total</th><th class="num">${lira(debit)}</th><th class="num">${lira(credit)}</th><th class="num">${debit === credit ? 'Balanced' : '<span class="error">Not balanced</span>'}</th></tr></tfoot>
     </table>`,
  );
}

// ---- Settings -------------------------------------------------------------------------------------

/** How each setting is shown and entered: hours, a count, a percentage or lira. */
export const SETTING_FORMS: Record<
  keyof Settings,
  { label: string; unit: 'hours' | 'count' | 'percent' | 'lira'; hint: string }
> = {
  claim_hours: {
    label: 'Claim lasts',
    unit: 'hours',
    hint: 'How long an agent holds a vehicle before it is free for others.',
  },
  reporting_hours: {
    label: 'Report a sighting within',
    unit: 'hours',
    hint: 'After a claim, the agent must send a located sighting within this time.',
  },
  cooldown_hours: {
    label: 'Cooldown after a released claim',
    unit: 'hours',
    hint: 'The same agent can’t claim the same vehicle again for this long.',
  },
  max_active_claims: {
    label: 'Claims an agent may hold at once',
    unit: 'count',
    hint: 'More would let one agent keep vehicles from others.',
  },
  kdv_bp: { label: 'VAT (KDV) on invoices', unit: 'percent', hint: 'The current general rate.' },
  dual_approval_kurus: {
    label: 'Second approval for payouts from',
    unit: 'lira',
    hint: 'Payouts of this amount or more need two different admins.',
  },
  withholding_individual_bp: {
    label: 'Withholding for individuals',
    unit: 'percent',
    hint: 'Income tax withheld from payouts to agents paid as individuals, as the accountant advises.',
  },
  withholding_sole_trader_bp: {
    label: 'Withholding for sole traders',
    unit: 'percent',
    hint: 'For agents who issue a self-employment receipt.',
  },
  withholding_company_bp: {
    label: 'Withholding for companies',
    unit: 'percent',
    hint: 'Usually none: the company invoices Emanet.',
  },
};

export function settingValue(key: keyof Settings, stored: number): string {
  const unit = SETTING_FORMS[key].unit;
  if (unit === 'percent') return String(stored / 100);
  if (unit === 'lira') return liraInput(stored);
  return String(stored);
}

export function settingsPage(
  nav: Nav,
  settings: Settings,
  rule: { rule: PayoutRule; valid_from: number } | null,
  canChange: boolean,
  fresh: boolean,
  noticeText: string | null,
  errorText: string | null,
  provider: ProviderRecord | null,
  providerValues: Partial<Record<keyof Provider, string>> | null,
): string {
  const act = canChange && fresh;
  const pv = (key: keyof Provider) =>
    attr(
      providerValues?.[key] ??
        provider?.details[key] ??
        (key === 'email' ? 'iletisim@emanet.dev' : ''),
    );
  const providerSection = `<h2>2earl’s company details</h2>
     <p class="hint">The agreement companies accept names 2earl with these details. Until they are set, companies can read the agreement but not accept it. A change applies to agreements accepted from now on; accepted ones keep their text.</p>
     ${provider ? '' : '<p class="error">Not set yet: no company can accept the agreement.</p>'}
     ${
       act
         ? `<form method="post" action="/settings/provider" class="stack">
             <label>Legal name <input name="name" required maxlength="200" value="${pv('name')}"></label>
             <label>Registered address <input name="address" required maxlength="400" value="${pv('address')}"></label>
             <div class="grid2">
               <label>Tax office <input name="taxOffice" required maxlength="100" value="${pv('taxOffice')}"></label>
               <label>Tax number (VKN) <input name="vkn" required inputmode="numeric" pattern="[0-9]{10}" maxlength="10" value="${pv('vkn')}"></label>
               <label>MERSİS number <input name="mersis" required inputmode="numeric" pattern="[0-9]{16}" maxlength="16" value="${pv('mersis')}"></label>
               <label>KEP address <input name="kep" type="email" required maxlength="254" value="${pv('kep')}"></label>
               <label>Email for notices <input name="email" type="email" required maxlength="254" value="${pv('email')}"></label>
             </div>
             <div><button type="submit">Save company details</button></div>
           </form>`
         : provider
           ? `<div class="panel"><dl class="facts">
               <dt>Legal name</dt><dd>${data(provider.details.name)}</dd>
               <dt>Registered address</dt><dd>${data(provider.details.address)}</dd>
               <dt>Tax office and number</dt><dd>${data(`${provider.details.taxOffice} · ${provider.details.vkn}`)}</dd>
               <dt>MERSİS</dt><dd>${data(provider.details.mersis)}</dd>
               <dt>KEP</dt><dd>${data(provider.details.kep)}</dd>
               <dt>Email for notices</dt><dd>${data(provider.details.email)}</dd>
               <dt>Last changed</dt><dd>${day(provider.updated_at)}</dd>
             </dl></div>`
           : ''
     }`;
  const unit = { hours: 'hours', count: '', percent: '%', lira: '₺' } as const;
  const rows = (Object.keys(SETTING_FORMS) as (keyof Settings)[])
    .map((key) => {
      const f = SETTING_FORMS[key];
      return act
        ? `<label>${f.label} ${unit[f.unit] ? `(${unit[f.unit]})` : ''}
            <input name="${key}" required inputmode="decimal" value="${attr(settingValue(key, settings[key]))}">
            <span class="hint">${f.hint}</span></label>`
        : `<dt>${f.label}</dt><dd>${
            f.unit === 'lira'
              ? lira(settings[key])
              : f.unit === 'hours'
                ? `${data(settingValue(key, settings[key]))} hours`
                : data(`${settingValue(key, settings[key])}${f.unit === 'percent' ? ' %' : ''}`)
          }</dd>`;
    })
    .join('');
  const r = rule?.rule;
  const ruleText = r
    ? r.share_bp !== undefined
      ? `${data(`${String(r.share_bp / 100)} %`)} of the partner’s fee`
      : `${lira(r.fixed_kurus ?? 0)} per delivery`
    : 'None. Deliveries can’t be confirmed without a payout rule.';
  return layout(
    'Settings',
    { ...nav, current: 'settings' },
    `${notice(noticeText)}<h1>Settings</h1>
     ${error(errorText)}
     ${canChange && !fresh ? confirmFirst('/settings') : ''}
     ${providerSection}
     <h2>Rules</h2>
     ${act ? `<form method="post" action="/settings" class="stack">${rows}<div><button type="submit">Save settings</button></div></form>` : `<div class="panel"><dl class="facts">${rows}</dl></div>`}
     <h2>Agents’ pay</h2>
     <div class="panel"><dl class="facts">
       <dt>Paid per delivery</dt><dd>${ruleText}</dd>
       ${r?.min_kurus !== undefined ? `<dt>At least</dt><dd>${lira(r.min_kurus)}</dd>` : ''}
       ${r?.max_kurus !== undefined ? `<dt>At most</dt><dd>${lira(r.max_kurus)}</dd>` : ''}
       <dt>Valid from</dt><dd>${day(rule?.valid_from ?? null)}</dd>
     </dl></div>
     ${
       act
         ? `<form method="post" action="/settings/payout-rule" class="stack">
             <div class="grid2">
               <label>Share of the fee (%) <input name="share" inputmode="decimal" value="${attr(r?.share_bp !== undefined ? String(r.share_bp / 100) : '')}"></label>
               <label>Or a fixed amount (₺) <input name="fixed" inputmode="decimal" value="${attr(r?.fixed_kurus !== undefined ? liraInput(r.fixed_kurus) : '')}"></label>
               <label>At least (₺) <input name="min" inputmode="decimal" value="${attr(r?.min_kurus !== undefined ? liraInput(r.min_kurus) : '')}"></label>
               <label>At most (₺) <input name="max" inputmode="decimal" value="${attr(r?.max_kurus !== undefined ? liraInput(r.max_kurus) : '')}"></label>
             </div>
             <p class="hint">Fill in a share or a fixed amount, not both. A payout is never more than the partner’s fee. The new rule applies to deliveries confirmed from now on.</p>
             <div><button type="submit">Save payout rule</button></div>
           </form>`
         : ''
     }`,
  );
}
