import type {
  AgentRow,
  AuditRow,
  Inventory,
  KycCheck,
  OpsOverview,
  PrivacyRequest,
  BalanceRow,
  EvidenceKind,
  FieldRow,
  InvoiceRow,
  PartnerRow,
  PayoutRow,
  PriceList,
  ReviewDetail,
  ReviewItem,
  StaffRole,
  UninvoicedRow,
} from './core';
import { icon, scene, type IconName } from './icons';
import { currentLocale, languageSwitcher } from './i18n';
import { DELIVERY_CHECKS, type Queue, type QueueKey } from './core';

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

/**
 * Text written in both languages where it is used (prose, explanations, the handbook), instead of
 * through the sentence catalogue. Whatever shows it marks it translate="no".
 */
export const L = (en: string, tr: string) => (currentLocale() === 'tr' ? tr : en);
/** The same, as an element the translator leaves alone. */
export const both = (en: string, tr: string) => `<span translate="no">${esc(L(en, tr))}</span>`;

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
  | 'home'
  | 'reviews'
  | 'onboarding'
  | 'support'
  | 'partners'
  | 'agents'
  | 'money'
  | 'settings'
  | 'audit'
  | 'privacy'
  | 'system'
  | 'guide'
  | 'readiness';

export interface Nav {
  signedIn: boolean;
  role?: StaffRole;
  current?: Section;
  /** Development mode is on until this time (Unix seconds). */
  dev?: number | null;
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

/** Shown on every staff page while development mode is on, so nobody forgets it is. */
function devBanner(until: number): string {
  const time = new Intl.DateTimeFormat(currentLocale() === 'tr' ? 'tr-TR' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  }).format(new Date(until * 1000));
  return `<p class="dev-banner" role="status" translate="no">${icon('alert')}<span><strong>${esc(L('Development mode is on.', 'Geliştirme modu açık.'))}</strong> ${esc(L(`Sign-off and document checks are lifted, and an inviter can approve their own company. It ends by itself at ${time} (Istanbul). Use test data only.`, `Onay ve belge kontrolleri kalktı; daveti gönderen kendi şirketini de onaylayabilir. Saat ${time} (İstanbul) olunca kendiliğinden kapanır. Yalnızca deneme verisi kullanın.`))} <a href="/settings#g-dev">${esc(L('Switch off', 'Kapat'))}</a></span></p>`;
}

export function layout(title: string, nav: Nav, body: string): string {
  const link = (key: Section, href: string, label: string, glyph: IconName) =>
    `<a href="${href}"${nav.current === key ? ' aria-current="page"' : ''}>${icon(glyph)}<span>${label}</span></a>`;
  const group = (label: string) => `<span class="group">${label}</span>`;
  const sections = nav.role
    ? `<form class="rail-search" method="get" action="/search" role="search"><label><span class="visually-hidden">Search</span>${icon('search')}<input name="q" type="search" minlength="2" placeholder="Search" autocomplete="off"></label></form>
      <nav aria-label="Sections">
        ${group('Work')}
        ${link('home', '/', 'Today', 'today')}
        ${link('reviews', '/reviews', 'Reviews', 'reviews')}
        ${link('onboarding', '/onboarding', 'Onboarding', 'onboarding')}
        ${link('support', '/support', 'Support', 'mail')}
        ${group('Records')}
        ${link('partners', '/partners', 'Partners', 'partners')}
        ${link('agents', '/agents', 'Agents', 'agents')}
        ${link('money', '/money', 'Money', 'money')}
        ${group('Control')}
        ${link('settings', '/settings', 'Settings', 'settings')}
        ${link('audit', '/audit', 'Audit', 'audit')}
        ${link('privacy', '/privacy', 'Privacy', 'privacy')}
        ${link('system', '/system', 'System', 'system')}
        ${link('readiness', '/readiness', 'Readiness', 'scale')}
        ${group('Help')}
        ${link('guide', '/guide', 'Handbook', 'guide')}
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
${nav.dev ? devBanner(nav.dev) : ''}
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

/**
 * The breadcrumb (2earl design system): parents as links, then this page. Each item is HTML
 * already made safe by the caller. On a phone only the direct parent shows, as one step back.
 */
export function crumbs(items: string[]): string {
  const last = items.length - 1;
  return `<nav class="crumbs" aria-label="Breadcrumb"><ol>${items
    .map((item, i) =>
      i === last
        ? `<li><span aria-current="page">${item}</span></li>`
        : `<li${i === last - 1 ? ' class="back-to"' : ''}>${item}</li>`,
    )
    .join('')}</ol></nav>`;
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
      ${scene('shield')}
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
  /** Support messages waiting for staff. */
  supportWaiting?: number;
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

const QUEUE_TEXT: Record<QueueKey, { en: string; tr: string; href: string; icon: IconName }> = {
  delivery: {
    en: 'Deliveries to review',
    tr: 'İncelenecek teslimler',
    href: '/reviews?kind=delivery',
    icon: 'camera',
  },
  identity: {
    en: 'Vehicle-identity questions',
    tr: 'Araç kimliği soruları',
    href: '/reviews',
    icon: 'car',
  },
  agents: {
    en: 'Agent applications',
    tr: 'Görevli başvuruları',
    href: '/agents?status=kyc_pending',
    icon: 'agents',
  },
  onboarding: {
    en: 'Companies to approve',
    tr: 'Onay bekleyen kurumlar',
    href: '/onboarding?status=signed',
    icon: 'onboarding',
  },
  privacy: {
    en: 'Data subjects’ requests',
    tr: 'İlgili kişi başvuruları',
    href: '/privacy#requests',
    icon: 'privacy',
  },
  invoicing: {
    en: 'Deliveries to invoice',
    tr: 'Faturalanacak teslimler',
    href: '/money',
    icon: 'invoice',
  },
};

/** A length of time in the reader's words: 5 hours, 3 days. */
export function lasting(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 3600) return `${String(Math.max(1, Math.round(s / 60)))} ${L('min', 'dk')}`;
  if (s < 48 * 3600) return `${String(Math.round(s / 3600))} ${L('hours', 'saat')}`;
  return `${String(Math.round(s / 86_400))} ${L('days', 'gün')}`;
}

/** The queues against their service levels: what waits, how long, and what is late. */
export function queueCards(queues: Queue[], now: number): string {
  const cards = queues
    .map((q) => {
      const text = QUEUE_TEXT[q.key];
      const state = q.overdue > 0 ? 'late' : q.due_soon > 0 ? 'soon' : q.open > 0 ? 'ok' : 'clear';
      const waited = q.oldest_at === null ? 0 : now - q.oldest_at;
      const used =
        q.oldest_at === null ? 0 : Math.min(100, Math.round((waited / q.limit_seconds) * 100));
      const line =
        q.open === 0
          ? L('Nothing waiting', 'Bekleyen yok')
          : q.overdue > 0
            ? L(`${String(q.overdue)} overdue`, `${String(q.overdue)} gecikmiş`)
            : q.due_soon > 0
              ? L(`${String(q.due_soon)} due soon`, `${String(q.due_soon)} yaklaşıyor`)
              : L('On time', 'Zamanında');
      const oldest =
        q.oldest_at === null
          ? ''
          : `<span class="queue-age">${esc(L(`Oldest waits ${lasting(waited)} of ${lasting(q.limit_seconds)}`, `En eski ${lasting(waited)} bekliyor; süre ${lasting(q.limit_seconds)}`))}</span>`;
      return `<a class="queue ${state}" href="${text.href}">
        <span class="queue-icon">${icon(text.icon)}</span>
        <strong>${String(q.open)}</strong>
        <span class="queue-name">${esc(L(text.en, text.tr))}</span>
        <span class="queue-state">${esc(line)}</span>
        <span class="meter"><span style="--used:${String(used)}%"></span><span class="visually-hidden">${esc(L(`${String(used)} percent of the time used`, `Sürenin yüzde ${String(used)} kadarı doldu`))}</span></span>
        ${oldest}
      </a>`;
    })
    .join('');
  return `<div class="queues" translate="no">${cards}</div>`;
}

export function today(
  nav: Nav,
  t: Today,
  now: number,
  queues: Queue[] = [],
  /** Whether the lawyer's and accountant's sign-offs are in; null when unknown. */
  ready: boolean | null = null,
  /** More to do, drawn elsewhere: answers from agents (src/pages-requests.ts). */
  extra = '',
): string {
  // What has work in it comes first; empty tiles stay, dimmed, so the layout is familiar.
  const tile = (href: string, count: number, label: string, glyph: IconName) => ({
    count,
    html: `<a href="${href}"${count === 0 ? ' class="zero"' : ''}>${icon(glyph)}<strong translate="no">${String(count)}</strong><span>${label}</span></a>`,
  });
  const late = t.uninvoiced.filter((u) => now - u.oldest_delivery > (INVOICE_DAYS - 2) * 86_400);
  const overdue = queues.reduce((sum, q) => sum + q.overdue, 0);
  const summary =
    queues.length === 0
      ? ''
      : overdue > 0
        ? `<p class="lede" translate="no">${esc(L(overdue === 1 ? 'One item is past its deadline. Take it first.' : `${String(overdue)} items are past their deadline. Take those first.`, `${String(overdue)} iş süresini aştı. Önce ${overdue === 1 ? 'onu' : 'onları'} alın.`))}</p>`
        : `<p class="lede" translate="no">${esc(L('Everything is within its deadline.', 'Her şey süresi içinde.'))}</p>`;
  return layout(
    'Today',
    { ...nav, current: 'home' },
    `<header class="page-head"><div><h1>Today</h1>${summary}</div>
       <a class="button secondary" href="/guide/operations">${icon('guide')}<span translate="no">${esc(L('How the day runs', 'Gün nasıl yürür'))}</span></a></header>
     ${ready === false ? `<a class="banner" href="/readiness" translate="no">${icon('scale')}<span><strong>${esc(L('Not ready for the first customer yet.', 'İlk müşteri için henüz hazır değil.'))}</strong> ${esc(L('Sign-offs or set-up are missing: companies can’t be approved and agents can’t be activated. See what is open.', 'Onaylar ya da kurulum eksik: kurum onaylanamaz, görevli etkinleştirilemez. Açık olanlara bakın.'))}</span>${icon('arrow')}</a>` : ''}
     ${queues.length > 0 ? `<h2>Queues</h2>${queueCards(queues, now)}` : ''}
     <h2>To do</h2>
     ${(() => {
       const tiles = [
         tile('/reviews?kind=delivery', t.reviews.delivery, REVIEW_LABEL.delivery, 'camera'),
         tile('/reviews?kind=missing_vin', t.reviews.missing_vin, REVIEW_LABEL.missing_vin, 'car'),
         tile(
           '/reviews?kind=plate_conflict',
           t.reviews.plate_conflict,
           REVIEW_LABEL.plate_conflict,
           'alert',
         ),
         tile('/support?status=open', t.supportWaiting ?? 0, 'Support messages to answer', 'mail'),
         tile(
           '/onboarding?status=signed',
           t.onboardingsSigned,
           'Companies to approve',
           'onboarding',
         ),
         tile('/agents?status=kyc_pending', t.agentsWaiting, 'Agents waiting for KYC', 'agents'),
         tile('/money#payouts', t.payoutsReady, 'Payouts to order', 'wallet'),
         tile('/money#payouts', t.payoutsApproved, 'Payouts to send', 'money'),
       ];
       const busy = tiles.filter((x) => x.count > 0);
       const idle = tiles.filter((x) => x.count === 0);
       return `${busy.length === 0 ? '<p class="panel">Nothing to do here. Every list is empty.</p>' : ''}<div class="counts">${[...busy, ...idle].map((x) => x.html).join('')}</div>`;
     })()}
     ${extra}
     <h2>To invoice</h2>
     ${
       t.uninvoiced.length === 0
         ? `<div class="panel empty">${scene('inbox')}<p>Every delivered case is invoiced.</p></div>`
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
  /** The time and each queue's limit, so a review shows how long it has waited and whether it is late. */
  now: number | null = null,
  queues: Queue[] = [],
): string {
  const limit = (k: ReviewItem['kind']) =>
    queues.find((q) => q.key === (k === 'delivery' ? 'delivery' : 'identity'))?.limit_seconds ??
    null;
  const waited = (i: ReviewItem) => {
    if (now === null) return moment(i.created_at);
    const seconds = now - i.created_at;
    const max = limit(i.kind);
    const state =
      max === null ? '' : seconds > max ? ' overdue' : seconds > max * 0.75 ? ' due' : '';
    const label =
      state === ' overdue'
        ? L('Late', 'Gecikti')
        : state === ' due'
          ? L('Due soon', 'Yaklaşıyor')
          : '';
    return `<span translate="no">${esc(lasting(seconds))}</span>${label ? ` <span class="status${state}" translate="no">${esc(label)}</span>` : ''}<br><span class="hint">${moment(i.created_at)}</span>`;
  };
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
      : `<table><thead><tr><th>Kind</th><th>Waiting</th><th>Details</th><th></th></tr></thead><tbody>${shown
          .map(
            (i) => `<tr>
              <td><a href="/reviews/${attr(i.id)}">${REVIEW_KIND[i.kind]}</a></td>
              <td>${waited(i)}</td>
              <td>${reviewSummary(i)}</td>
              <td><a class="button secondary" href="/reviews/${attr(i.id)}">Review</a></td>
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

/** Minutes or hours, for how soon after claiming an agent reported a sighting. */
function span(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return data(`${String(minutes)} min`);
  return data(`${(seconds / 3600).toFixed(1)} h`);
}

const metres = (m: number) => data(m < 1000 ? `${String(m)} m` : `${(m / 1000).toFixed(1)} km`);

/** A report within this of claiming, or this far from every known place, deserves a second look. */
const SOON_SECONDS = 15 * 60;
const FAR_METRES = 5000;

function signalsPanel(s: ReviewDetail['signals']): string {
  if (!s) return '';
  const flag = (on: boolean) => (on ? ' <span class="status rejected">Look twice</span>' : '');
  return `<h2>Before you decide</h2>
    <div class="panel"><dl class="facts">
      <dt>From claim to sighting</dt><dd>${s.seconds_to_sighting === null ? '—' : `${span(s.seconds_to_sighting)}${flag(s.seconds_to_sighting < SOON_SECONDS)}`}</dd>
      <dt>Sighting to the nearest known place</dt><dd>${s.nearest_place_m === null ? 'No place with coordinates' : `${metres(s.nearest_place_m)}${flag(s.nearest_place_m > FAR_METRES)}`}</dd>
      <dt>Agent’s deliveries</dt><dd translate="no">${String(s.agent_deliveries)}</dd>
      <dt>Agent’s strikes</dt><dd translate="no">${String(s.agent_strikes)}${flag(s.agent_strikes > 0)}</dd>
    </dl></div>`;
}

const CHECK_TEXT: Record<(typeof DELIVERY_CHECKS)[number], { en: string; tr: string }> = {
  plate_matches: {
    en: 'The plate in the scene photo is this case’s plate (or the chassis number is visible and matches).',
    tr: 'Olay yeri fotoğrafındaki plaka bu dosyanın plakası (ya da şasi numarası görünüyor ve eşleşiyor).',
  },
  custody_receipt: {
    en: 'The custodian’s receipt names this vehicle and the car park, and is dated after the claim.',
    tr: 'Yediemin makbuzu bu aracı ve otoparkı gösteriyor; tarihi üstlenmeden sonra.',
  },
  place_plausible: {
    en: 'The sighting’s place and time don’t contradict the photos or the known addresses.',
    tr: 'Görme bildiriminin yeri ve saati fotoğraflarla ve bilinen adreslerle çelişmiyor.',
  },
  photos_original: {
    en: 'The photos are originals: not screenshots, not taken from elsewhere.',
    tr: 'Fotoğraflar özgün: ekran görüntüsü veya başka yerden alınmış değil.',
  },
};

/** What staff tick before confirming; the core refuses a confirmation without all of them. */
function deliveryChecklist(): string {
  return `<fieldset class="checks" translate="no"><legend>${esc(L('Before you confirm', 'Onaylamadan önce'))}</legend>${DELIVERY_CHECKS.map(
    (check) =>
      `<label class="check"><input type="checkbox" name="check_${check}" value="1" required> ${esc(L(CHECK_TEXT[check].en, CHECK_TEXT[check].tr))}</label>`,
  ).join(
    '',
  )}<p class="hint"><a href="/guide/reviews">${esc(L('What each point means', 'Her madde ne anlama gelir'))}</a></p></fieldset>`;
}

/** Usual reasons, offered as suggestions; staff can always write their own. */
const REFUSAL_REASONS: [string, string][] = [
  [
    'The plate in the photos is not this case’s plate.',
    'Fotoğraflardaki plaka bu dosyanın plakası değil.',
  ],
  ['The custodian’s receipt is missing or unreadable.', 'Yediemin makbuzu eksik veya okunmuyor.'],
  ['The receipt names a different vehicle.', 'Makbuz başka bir aracı gösteriyor.'],
  ['The photos were taken before the claim.', 'Fotoğraflar üstlenmeden önce çekilmiş.'],
  ['There is no police report of the seizure.', 'Yakalamaya ilişkin kolluk tutanağı yok.'],
];
const STATUS_REASONS: [string, string][] = [
  ['Video call: ID card and IBAN matched.', 'Görüntülü görüşme: kimlik kartı ve IBAN eşleşti.'],
  [
    'The person on the call isn’t the person on the ID card.',
    'Görüşmedeki kişi kimlik kartındaki kişi değil.',
  ],
  ['Repeated false delivery reports.', 'Tekrarlayan yanlış teslim bildirimleri.'],
  [
    'Breach of the field rules (contact with the debtor or the vehicle).',
    'Saha kurallarının ihlali (borçluyla veya araçla temas).',
  ],
  ['Reinstated after review.', 'İnceleme sonrası yeniden etkinleştirildi.'],
];
const RETURN_REASONS: [string, string][] = [
  [
    'The name doesn’t match the ID card letter for letter.',
    'Ad, kimlik kartıyla harfi harfine eşleşmiyor.',
  ],
  ['The IBAN is not in your own name.', 'IBAN kendi adınıza değil.'],
  ['We couldn’t reach you at this mobile number.', 'Bu cep telefonu numarasından size ulaşamadık.'],
];

function reasonList(id: string, reasons: [string, string][]): string {
  return `<datalist id="${id}" translate="no">${reasons.map(([en, tr]) => `<option value="${attr(L(en, tr))}"></option>`).join('')}</datalist>`;
}

export function reviewDetail(
  nav: Nav,
  r: ReviewDetail,
  changeAllowed: boolean,
  fresh: boolean,
  errorText: string | null,
): string {
  const kind = r.item.kind;
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
            .map((e) =>
              e.erased === 1
                ? `<li><span>${EVIDENCE_LABEL[e.kind]}</span><span class="status expired">File deleted</span></li>`
                : `<li>
                <a href="/reviews/${attr(r.item.id)}/evidence/${attr(e.id)}"><img src="/reviews/${attr(r.item.id)}/evidence/${attr(e.id)}" alt="${attr(EVIDENCE_LABEL[e.kind])}" loading="lazy"></a>
                <span>${EVIDENCE_LABEL[e.kind]}</span>
                <span class="hint">Taken ${moment(e.exif_time)} · received ${moment(e.created_at)}</span>
                ${claim && e.exif_time !== null && e.exif_time < claim.claimed_at - 600 ? '<span class="status rejected">Taken before the claim</span>' : ''}
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
      ${signalsPanel(r.signals)}
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
        !changeAllowed
          ? '<p class="hint">An owner or admin confirms deliveries.</p>'
          : !claim
            ? ''
            : !fresh
              ? confirmFirst(`/reviews/${r.item.id}`)
              : `${
                  cases.length > 0
                    ? `<h2>Confirm</h2>
                       <form method="post" action="/reviews/${attr(r.item.id)}/deliver" class="stack">
                         ${deliveryChecklist()}
                         <div><button type="submit">Confirm the vehicle is in custody</button></div>
                       </form>
                       <p class="hint">Every case above is closed as delivered, each partner is told and invoiced, and the agent’s payout is created.</p>`
                    : ''
                }
                <h2>Don’t accept</h2>
                <form method="post" action="/reviews/${attr(r.item.id)}/dismiss" class="stack">
                  <label>Reason for the agent <input name="reason" required maxlength="200" list="refusal-reasons"></label>
                  ${reasonList('refusal-reasons', REFUSAL_REASONS)}
                  <label class="check"><input type="checkbox" name="strike" value="1"> Count a strike against the agent (a false or careless report).</label>
                  <p class="hint">The claim ends and these photos can’t be used again. The agent reads your reason and can’t take this vehicle again for a while. No partner is told and nothing is booked.</p>
                  <div><button class="secondary" type="submit">Don’t accept this delivery</button></div>
                </form>`
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

export function partnerList(nav: Nav, partners: PartnerRow[]): string {
  const table =
    partners.length === 0
      ? '<p class="panel">No partners yet. A company becomes a partner when its onboarding is approved.</p>'
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
  return layout(
    'Partners',
    { ...nav, current: 'partners' },
    `<h1>Partners</h1>
     <p class="lede">A company becomes a partner only through its onboarding: it accepts the agreement, and a second staff member approves it. <a href="/onboarding">Invite a company</a></p>
     ${table}`,
  );
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
     <h2>Email notices</h2>
     <div class="panel"><dl class="facts">
       <dt>Operations contact</dt><dd>${p.contact_email ? data(p.contact_email) : '—'}</dd>
       <dt>Invoices to</dt><dd>${p.billing_email ? data(p.billing_email) : '—'}</dd>
       <dt>Notices</dt><dd>${p.mail_notices === 0 ? 'Off' : p.contact_email ? 'On: vehicles in custody (hourly), cases about to expire (daily)' : 'No contact to send to'}</dd>
     </dl></div>
     ${
       canChange && p.contact_email
         ? `<form method="post" action="${path}/notices" class="actions">
             <input type="hidden" name="on" value="${p.mail_notices === 0 ? '1' : '0'}">
             <button class="secondary" type="submit">${p.mail_notices === 0 ? 'Turn notices on' : 'Turn notices off'}</button>
           </form>`
         : ''
     }
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

const KYC_LABEL: Record<KycCheck['kind'], string> = {
  email: 'Email address',
  id_registry: 'ID number against the population registry',
  video_call: 'Video call with the ID card',
  iban: 'IBAN in their own name',
  phone: 'Phone by SMS',
  id_nfc: 'ID card chip (NFC)',
  liveness: 'Liveness check',
  criminal_record: 'Criminal record certificate',
};
const KYC_RESULT: Record<KycCheck['result'], string> = {
  passed: 'Passed',
  failed: 'Failed',
  review: 'Check it yourself',
};

/** What is checked before an agent can be made active, and where each check stands. */
function kycList(a: AgentRow, checks: KycCheck[]): string {
  const of = (kind: KycCheck['kind']) => checks.find((c) => c.kind === kind);
  const stamp = (state: 'passed' | 'failed' | 'review' | 'none') =>
    state === 'none'
      ? '<span class="status pending">Not done</span>'
      : `<span class="status ${state === 'passed' ? 'active' : state === 'failed' ? 'rejected' : 'pending'}">${KYC_RESULT[state]}</span>`;
  const registry = of('id_registry');
  const call = of('video_call');
  const rows: [string, string, string][] = [
    [
      KYC_LABEL.email,
      stamp(a.email ? 'passed' : 'none'),
      a.email ? data(a.email) : 'The agent proves it with a code we mail.',
    ],
    [
      KYC_LABEL.id_registry,
      stamp(!a.id_given ? 'none' : (registry?.result ?? 'review')),
      !a.id_given
        ? 'The agent hasn’t given an ID number.'
        : registry?.result === 'passed'
          ? 'Number, name and birth year belong together. The number itself isn’t kept.'
          : 'The registry didn’t answer. Compare the number on the card with what the agent reads out on the call.',
    ],
    [
      KYC_LABEL.video_call,
      stamp(call?.result ?? 'none'),
      call ? moment(call.created_at) : 'Record it below after the call.',
    ],
    [
      KYC_LABEL.iban,
      stamp(a.iban_verified ? 'passed' : 'none'),
      a.iban_verified ? 'Verified.' : 'Bank name check or a test transfer, then mark it verified.',
    ],
    [
      KYC_LABEL.phone,
      stamp('none'),
      'By SMS, once the SMS provider is set up. Until then the call to this number is the check.',
    ],
  ];
  return `<h2>Identity checks</h2>
    <ol class="checklist">${rows
      .map(
        ([label, state, note]) =>
          `<li><strong>${label}</strong>${state}<span class="hint">${note}</span></li>`,
      )
      .join('')}</ol>`;
}

export function agentDetail(
  nav: Nav,
  a: AgentRow,
  checks: KycCheck[],
  canChange: boolean,
  fresh: boolean,
  noticeText: string | null,
  errorText: string | null,
  /** The agreement and documents part (src/pages-ops.ts). */
  vetting = '',
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
  const erased = Boolean(a.erased_at);
  const needsConfirm = canChange && !fresh && !erased;
  const call =
    !erased && canChange && fresh && (a.status === 'kyc_pending' || a.status === 'suspended')
      ? `<form method="post" action="${path}/video-call" class="stack">
           <label class="check"><input type="checkbox" name="seen" value="1" required> On a video call I saw this person hold their Turkish ID card: the photo is them, and the name is the name above.</label>
           ${
             a.status === 'kyc_pending'
               ? `<label class="check"><input type="checkbox" name="activate" value="1" checked> If the call passed, make the agent active now (the same checks as “Before you activate” still apply).</label>`
               : ''
           }
           <div class="actions">
             <button type="submit" name="result" value="passed">Record the call as passed</button>
             <button class="secondary" type="submit" name="result" value="failed">It didn’t match</button>
           </div>
         </form>`
      : '';
  const status =
    canChange && fresh && !erased
      ? `<h2>Change status</h2>
       <form method="post" action="${path}/status" class="stack">
         <div class="grid2">
           <label>New status <select name="status">${AGENT_STATUSES.filter((s) => s !== a.status)
             .map((s) => `<option value="${s}">${AGENT_STATUS[s]}</option>`)
             .join('')}</select></label>
           <label>Reason <input name="reason" required maxlength="200" list="status-reasons"></label>
         </div>
         ${reasonList('status-reasons', STATUS_REASONS)}
         <p class="hint">Suspending or banning ends the agent’s open claims at once. The agent is emailed the decision and your reason.</p>
         <div><button class="secondary" type="submit">Change status</button></div>
       </form>`
      : '';
  const sendBack =
    canChange && fresh && a.status === 'kyc_pending'
      ? `<div translate="no"><h2>${esc(L('Send back for correction', 'Düzeltme için geri gönder'))}</h2>
         <form method="post" action="${path}/return" class="stack">
           <label>${esc(L('What should the applicant correct?', 'Başvuran neyi düzeltmeli?'))} <input name="reason" required maxlength="300" list="return-reasons"></label>
           ${reasonList('return-reasons', RETURN_REASONS)}
           <p class="hint">${esc(L('The applicant is emailed your note, corrects their details and sends the application again. Nothing they entered is lost.', 'Başvurana notunuz e-postayla gider; bilgilerini düzeltip başvuruyu yeniden gönderir. Girdiği hiçbir şey kaybolmaz.'))}</p>
           <div><button class="secondary" type="submit">${esc(L('Send back', 'Geri gönder'))}</button></div>
         </form></div>`
      : '';
  const returned =
    a.status === 'applied' && a.review_note
      ? `<p class="notice" translate="no">${esc(L('Sent back for correction:', 'Düzeltme için geri gönderildi:'))} ${esc(a.review_note)}</p>`
      : '';
  return layout(
    'Agent',
    { ...nav, current: 'agents' },
    `${notice(noticeText)}
     ${crumbs([`<a href="/agents">Agents</a>`, a.legal_name ? data(a.legal_name) : '—'])}
     <h1>${a.legal_name ? data(a.legal_name) : 'No name yet'} <span class="status ${a.status}">${AGENT_STATUS[a.status]}</span></h1>
     ${error(errorText)}
     ${returned}
     ${erased ? `<p class="notice" translate="no">${icon('lock')} ${esc(L('This person’s data was erased on', 'Bu kişinin verileri silindi:'))} ${day(a.erased_at ?? null)}. ${esc(L('What remains here names nobody. Admins find the sealed record under Privacy → Sealed archive.', 'Burada kalanlar kimseyi göstermez. Yöneticiler mühürlü kaydı Gizlilik → Mühürlü arşiv altında bulur.'))}</p>` : ''}
     ${!erased && (a.requests_open ?? 0) + (a.requests_answered ?? 0) > 0 ? `<p class="notice" translate="no">${icon('mail')} ${esc(L(`${String(a.requests_open ?? 0)} request(s) wait for the agent, ${String(a.requests_answered ?? 0)} answer(s) wait for you.`, `${String(a.requests_open ?? 0)} talep görevliyi, ${String(a.requests_answered ?? 0)} yanıt sizi bekliyor.`))} <a href="#requests">${esc(L('See them', 'Göster'))}</a></p>` : ''}
     <div class="workspace"><div class="workspace-main">
     <div class="panel"><dl class="facts">
       <dt>Mobile</dt><dd>${a.phone ? `<a href="tel:${attr(a.phone)}" translate="no">${esc(a.phone)}</a>` : '—'}</dd>
       <dt>Email</dt><dd>${a.email ? data(a.email) : '—'}</dd>
       <dt>Birth year</dt><dd>${a.birth_year ? data(String(a.birth_year)) : '—'}</dd>
       <dt>City</dt><dd>${a.city ? data(a.city) : '—'}</dd>
       <dt translate="no">${esc(L('Home address', 'İkamet adresi'))}</dt><dd>${a.address ? data(a.address) : '—'}</dd>
       <dt>IBAN</dt><dd>${a.iban ? data(a.iban) : '—'} ${a.iban ? (a.iban_verified ? '<span class="status active">Verified</span>' : '<span class="status kyc_pending">Not verified</span>') : ''}</dd>
       <dt>Tax</dt><dd>${TAX_LABEL[a.tax_profile] ?? data(a.tax_profile)}${a.vkn ? ` · ${data(a.vkn)}` : ''}</dd>
       <dt>Applied</dt><dd>${day(a.submitted_at)}</dd>
       <dt>Rules accepted</dt><dd>${a.terms_version ? data(a.terms_version) : '—'}</dd>
       <dt>Open claims</dt><dd translate="no">${String(a.open_claims)}</dd>
       <dt>Deliveries</dt><dd translate="no">${String(a.deliveries)}</dd>
       <dt>Strikes</dt><dd translate="no">${String(a.strikes)}</dd>
     </dl></div>
     ${vetting}
     ${kycList(a, checks)}
     ${check}
     ${call}
     ${iban}
     </div>
     <aside class="workspace-side">
       <div class="panel decision"><h2 translate="no">${esc(L('Decision', 'Karar'))}</h2>
         ${needsConfirm ? confirmFirst(path) : ''}
         ${!canChange ? `<p class="hint" translate="no">${esc(L('An owner or admin decides.', 'Kararı sahip ya da yönetici verir.'))}</p>` : ''}
         ${sendBack}
         ${status}
         <p class="hint" translate="no">${esc(L('Activation needs: a verified email, an ID number, both e-Devlet documents clear, every request to the agent settled, a passed video call, a verified IBAN, and the sign-offs on the Readiness page.', 'Etkinleştirme için: doğrulanmış e-posta, kimlik numarası, iki e-Devlet belgesinin de temiz olması, görevliden istenenlerin tümünün sonuçlanması, başarılı görüntülü görüşme, doğrulanmış IBAN ve Hazırlık sayfasındaki onaylar gerekir.'))}</p>
         <p class="hint" translate="no">${esc(L('Is a detail wrong or a document missing?', 'Bir bilgi yanlış ya da bir belge eksik mi?'))} <a href="#requests">${esc(L('Ask the agent for it', 'Görevliden isteyin'))}</a></p>
       </div>
       ${canChange && !erased ? `<div class="panel" translate="no"><h2>${esc(L('Personal data', 'Kişisel veriler'))}</h2><p class="hint">${esc(L('On the person’s request, or when the law says so, erase their data. A sealed copy is archived.', 'Kişinin talebi üzerine ya da mevzuat gerektirdiğinde verilerini silin. Mühürlü bir kopya arşivlenir.'))}</p><p><a class="button secondary" href="${path}/erase">${icon('lock')}<span>${esc(L('Erase personal data', 'Kişisel verileri sil'))}</span></a></p></div>` : ''}
     </aside></div>`,
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
              <td>${
                i.number
                  ? data(i.number)
                  : act && i.status !== 'cancelled'
                    ? `<form method="post" action="/money/invoices/${attr(i.id)}/number" class="inline">
                        <label class="sr">E-invoice number <input name="number" required maxlength="32" placeholder="E-invoice number" autocomplete="off"></label>
                        <button class="secondary" type="submit">Save number</button></form>`
                    : '<span class="hint">Waiting for the e-invoice number</span>'
              }</td>
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
    `${notice(noticeText)}<header class="page-head"><h1>Money</h1><a class="button secondary" href="/money/accounting" translate="no">${icon('chart')}<span>${esc(L('Accounting: the month for the accountant', 'Muhasebe: mali müşavirin ayı'))}</span></a></header>
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

// ---- Audit ----------------------------------------------------------------------------------------

/** A short, safe rendering of an event's detail: keys and plain values only. */
function auditDetail(detail: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(detail)) {
    if (value === null || value === undefined || value === '') continue;
    const shown =
      typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
        ? String(value)
        : JSON.stringify(value);
    parts.push(`${key}: ${shown.length > 80 ? `${shown.slice(0, 80)}…` : shown}`);
    if (parts.length === 4) break;
  }
  return parts.length === 0 ? '' : data(parts.join(' · '));
}

export function auditPage(
  nav: Nav,
  events: AuditRow[],
  nextBefore: number | null,
  filter: { subject: string; actor: string },
  errorText: string | null,
): string {
  const query = (extra: Record<string, string>) => {
    const params = new URLSearchParams();
    if (filter.subject) params.set('subject', filter.subject);
    if (filter.actor) params.set('actor', filter.actor);
    for (const [key, value] of Object.entries(extra)) params.set(key, value);
    const text = params.toString();
    return text ? `/audit?${esc(text)}` : '/audit';
  };
  const by = (key: 'subject' | 'actor', value: string) =>
    `<a href="/audit?${key}=${encodeURIComponent(value)}" translate="no">${esc(value)}</a>`;
  const table =
    events.length === 0
      ? '<p class="panel">Nothing recorded here.</p>'
      : `<table><thead><tr><th>When</th><th>Who</th><th>What</th><th>On</th><th>Details</th></tr></thead><tbody>${events
          .map(
            (e) => `<tr>
              <td>${moment(e.at)}</td>
              <td>${by('actor', e.actor)}</td>
              <td>${data(e.action)}</td>
              <td>${by('subject', e.subject)}</td>
              <td>${auditDetail(e.detail)}</td>
            </tr>`,
          )
          .join('')}</tbody></table>`;
  return layout(
    'Audit',
    { ...nav, current: 'audit' },
    `<h1>Audit</h1>
     <p class="lede">Everything done in Emanet, newest first: by staff, partners’ people, agents and the system. Nothing here can be changed or removed. Looking someone up is recorded too.</p>
     ${error(errorText)}
     <form method="get" action="/audit" class="stack">
       <div class="grid2">
         <label>On (subject) <input name="subject" maxlength="120" autocomplete="off" placeholder="partner:… claim:… agent:…" value="${attr(filter.subject)}"></label>
         <label>By (actor) <input name="actor" maxlength="120" autocomplete="off" placeholder="staff:… agent:…" value="${attr(filter.actor)}"></label>
       </div>
       <div><button class="secondary" type="submit">Show</button> ${filter.subject || filter.actor ? '<a href="/audit">Show everything</a>' : ''}</div>
     </form>
     ${table}
     ${nextBefore === null ? '' : `<p><a href="${query({ before: String(nextBefore) })}">Older</a></p>`}`,
  );
}

// ---- Privacy --------------------------------------------------------------------------------------

const REQUEST_KIND: Record<PrivacyRequest['kind'], string> = {
  access: 'What do you hold about me?',
  erasure: 'Delete my data',
  correction: 'Correct my data',
  objection: 'Objection',
};
const SUBJECT_KIND: Record<PrivacyRequest['subject_kind'], string> = {
  agent: 'An agent',
  vehicle: 'A vehicle’s owner (through the partner)',
  contact: 'A company’s contact person',
  other: 'Someone else',
};
const ERASED_LABEL = { no: '', due: 'Being deleted', yes: 'Deleted' } as const;
const ABOUT_LABEL = {
  vehicle: 'Shows a vehicle and its plate',
  document: 'A document that can name people',
} as const;

export interface PrivacyView {
  term: string;
  found: Inventory | null;
  requests: PrivacyRequest[];
}

export function privacyPage(
  nav: Nav,
  v: PrivacyView,
  canChange: boolean,
  fresh: boolean,
  now: number,
  noticeText: string | null,
  errorText: string | null,
): string {
  const act = canChange && fresh;
  const eraseForm = (action: string, label: string) =>
    act
      ? `<form method="post" action="${action}" class="inline">
           <input type="hidden" name="q" value="${attr(v.term)}">
           <label class="sr">Reason <input name="reason" required maxlength="200" placeholder="Reason (request no.)" autocomplete="off"></label>
           <button class="secondary" type="submit">${label}</button></form>`
      : '';
  const erased = (state: 'no' | 'due' | 'yes') =>
    state === 'no'
      ? ''
      : `<span class="status ${state === 'due' ? 'due' : 'expired'}">${ERASED_LABEL[state]}</span>`;
  const f = v.found;
  const nothing = f && !f.vehicle && !f.agent && f.onboardings.length === 0;
  const vehicle = f?.vehicle
    ? `<h3>Vehicle ${plate(f.vehicle.plate)}</h3>
       <table><thead><tr><th>Partner</th><th>Their reference</th><th>Status</th><th class="num">Places with an address</th><th></th></tr></thead><tbody>${f.vehicle.cases
         .map(
           (
             c,
           ) => `<tr><td>${data(c.partner)}</td><td>${data(c.external_ref)}</td><td>${data(c.status)}</td>
             <td class="num" translate="no">${String(c.addresses)} / ${String(c.places)}</td>
             <td>${c.addresses > 0 && c.status !== 'active' && c.status !== 'pending_identity' ? eraseForm(`/privacy/cases/${attr(c.id)}/erase`, 'Erase the addresses') : ''}</td></tr>`,
         )
         .join('')}</tbody></table>
       <p class="hint">For a debtor’s data the partner is the controller: pass the request to the partner and act on its instruction. An open case’s addresses are changed or withdrawn by the partner.</p>`
    : '';
  const agent = f?.agent
    ? `<h3>Agent</h3>
       <div class="panel"><dl class="facts">
         <dt>Name</dt><dd>${f.agent.legal_name ? data(f.agent.legal_name) : '—'}</dd>
         <dt>Email</dt><dd>${f.agent.email ? data(f.agent.email) : '—'}</dd>
         <dt>Mobile</dt><dd>${f.agent.phone ? data(f.agent.phone) : '—'}</dd>
         <dt>Sightings (locations)</dt><dd translate="no">${String(f.agent.sightings)}</dd>
         <dt>Payouts</dt><dd translate="no">${String(f.agent.payouts)}</dd>
       </dl>
       <p><a href="/agents/${attr(f.agent.user_id)}">Open the agent</a></p>
       <p class="hint">An agent deletes their account themselves in their 2earl account: profile, ID hash, email, phone and the photos of claims that delivered nothing go at once. Payouts and the books stay for the legal retention period.</p></div>`
    : '';
  const evidence =
    f && f.evidence.length > 0
      ? `<h3>Photos</h3>
         <table><thead><tr><th>Kind</th><th>Personal data</th><th>Taken</th><th>Kept because</th><th></th></tr></thead><tbody>${f.evidence
           .map(
             (
               e,
             ) => `<tr><td>${EVIDENCE_LABEL[e.kind]}</td><td>${ABOUT_LABEL[e.about]}</td><td>${moment(e.created_at)}</td>
               <td>${e.delivered ? 'Proof of a delivery (commercial record)' : 'No delivery: deleted after 30 days'}</td>
               <td>${e.erased === 'no' ? eraseForm(`/privacy/evidence/${attr(e.id)}/erase`, 'Delete the file') : erased(e.erased)}</td></tr>`,
           )
           .join('')}</tbody></table>`
      : '';
  const onboardings = (f?.onboardings ?? [])
    .map(
      (o) => `<h3>${data(o.company)}</h3>
        <p>${data(o.contact_name)} · ${data(o.contact_email)} · <a href="/onboarding/${attr(o.id)}">Open the onboarding</a></p>
        ${
          o.documents.length === 0
            ? ''
            : `<table><thead><tr><th>Document</th><th>File</th><th></th></tr></thead><tbody>${o.documents
                .map(
                  (d) => `<tr><td>${data(d.kind)}</td><td>${data(d.file_name)}</td>
                    <td>${d.erased === 'no' ? eraseForm(`/privacy/documents/${attr(d.id)}/erase`, 'Delete the file') : erased(d.erased)}</td></tr>`,
                )
                .join('')}</tbody></table>`
        }`,
    )
    .join('');
  const requests =
    v.requests.length === 0
      ? '<p class="panel">No requests recorded.</p>'
      : `<table><thead><tr><th>Received</th><th>Request</th><th>How it arrived</th><th>About</th><th>Who they are</th><th>Answer by</th><th>Status</th><th>What was done</th><th></th></tr></thead><tbody>${v.requests
          .map((r) => {
            const overdue = r.status === 'open' && r.due_at < now;
            return `<tr${overdue ? ' class="late"' : ''}>
              <td>${day(r.received_at)}</td>
              <td>${REQUEST_KIND[r.kind]}</td>
              <td>${data(r.channel)}</td>
              <td><a href="/privacy?q=${encodeURIComponent(r.subject_ref)}" translate="no">${esc(r.subject_ref)}</a></td>
              <td>${SUBJECT_KIND[r.subject_kind]}</td>
              <td>${day(r.due_at)}</td>
              <td><span class="status ${overdue ? 'overdue' : r.status}">${overdue ? 'Overdue' : r.status === 'open' ? 'Open' : r.status === 'done' ? 'Answered' : r.status === 'withdrawn' ? 'Withdrawn' : 'Refused'}</span></td>
              <td>${r.outcome ? data(r.outcome) : ''}</td>
              <td>${
                r.status === 'open' &&
                canChange &&
                r.kind === 'erasure' &&
                r.subject_kind === 'agent' &&
                r.channel === 'saha'
                  ? `<a class="button" href="/agents/${attr(r.subject_ref)}/erase" translate="no">${esc(L('Carry out or refuse', 'Yerine getir ya da reddet'))}</a>`
                  : r.status === 'open' && canChange
                    ? `<form method="post" action="/privacy/requests/${attr(r.id)}/close" class="inline">
                      <label class="sr">What was done <input name="outcome" required maxlength="1000" placeholder="What was done" autocomplete="off"></label>
                      <button type="submit" name="status" value="done">Answered</button>
                      <button class="secondary" type="submit" name="status" value="refused">Refused</button></form>`
                    : ''
              }</td></tr>`;
          })
          .join('')}</tbody></table>`;
  const option = (map: Record<string, string>) =>
    Object.entries(map)
      .map(([value, label]) => `<option value="${value}">${label}</option>`)
      .join('');
  return layout(
    'Privacy',
    { ...nav, current: 'privacy' },
    `${notice(noticeText)}<h1>Privacy</h1>
     <p class="lede">Find everything Emanet holds about a person, and remove what a request or the law says must go. Every search and every deletion is recorded.</p>
     ${error(errorText)}
     <form method="get" action="/privacy" class="inline">
       <label class="sr">Search <input name="q" required minlength="3" maxlength="254" placeholder="Plate, chassis number, agent ID or email" value="${attr(v.term)}" autocomplete="off"></label>
       <button type="submit">Search</button>
     </form>
     ${canChange && !fresh && f ? confirmFirst(`/privacy?q=${v.term}`) : ''}
     ${nothing ? '<p class="panel">Nothing is held for this.</p>' : ''}
     ${vehicle}${agent}${evidence}${onboardings}
     ${canChange ? `<p translate="no"><a class="button secondary" href="/privacy/retention">${icon('scale')}<span>${esc(L('What is deleted when', 'Ne zaman ne silinir'))}</span></a></p>` : ''}
     ${canChange ? `<p translate="no"><a class="button secondary" href="/privacy/holds">${icon('lock')}<span>${esc(L('Legal holds', 'Yasal tutma'))}</span></a></p>` : ''}
     ${canChange ? `<p translate="no"><a class="button secondary" href="/privacy/archive">${icon('lock')}<span>${esc(L('Sealed archive of erased data', 'Silinen verilerin mühürlü arşivi'))}</span></a></p>` : ''}
     <h2 id="requests">Requests</h2>
     <p class="hint">Record every request the day it arrives (KVKK art. 13: answered within 30 days, free of charge).</p>
     <p class="hint" translate="no">${esc(L('An agent’s own request to be erased arrives here from Emanet Saha by itself.', 'Bir görevlinin kendi silme talebi buraya Emanet Saha’dan kendiliğinden düşer.'))}</p>
     ${requests}
     ${
       canChange
         ? `<h3>Record a request</h3>
            <form method="post" action="/privacy/requests" class="stack">
              <div class="grid2">
                <label>What they ask <select name="kind">${option(REQUEST_KIND)}</select></label>
                <label>Who they are <select name="subject_kind">${option(SUBJECT_KIND)}</select></label>
                <label>Search term for them <input name="subject_ref" required maxlength="254" placeholder="Plate, chassis number, agent ID or email" autocomplete="off"></label>
                <label>How it arrived <input name="channel" required maxlength="60" placeholder="Email, KEP, post, partner" autocomplete="off"></label>
                <label>Received on <input name="received_at" type="date"></label>
                <label>Note <input name="note" maxlength="1000" autocomplete="off"></label>
              </div>
              <div><button type="submit">Record the request</button></div>
            </form>`
         : ''
     }`,
  );
}

// ---- System ---------------------------------------------------------------------------------------

/** Jobs run every 5 or 10 minutes: one silent for longer than this has stopped. */
const STALE_SECONDS = 30 * 60;

export function systemPage(nav: Nav, o: OpsOverview, now: number): string {
  const jobs =
    o.heartbeats.length === 0
      ? '<p class="panel">No job has reported yet.</p>'
      : `<table><thead><tr><th>Job</th><th>Last ran</th><th>State</th><th>Last failure</th></tr></thead><tbody>${o.heartbeats
          .map((h) => {
            const failing = h.failed_at !== null && (h.ok_at === null || h.failed_at >= h.ok_at);
            const stale = h.ok_at === null || now - h.ok_at > STALE_SECONDS;
            return `<tr${failing || stale ? ' class="late"' : ''}><td>${data(h.name)}</td><td>${moment(h.ok_at)}</td>
              <td><span class="status ${failing ? 'failed' : stale ? 'due' : 'active'}">${failing ? 'Failing' : stale ? 'Not running' : 'Running'}</span></td>
              <td>${h.failed_at === null ? '—' : `${moment(h.failed_at)} ${h.error ? data(h.error) : ''}`}</td></tr>`;
          })
          .join('')}</tbody></table>`;
  const events =
    o.events.length === 0
      ? '<p class="panel">No errors or warnings in the last 30 days.</p>'
      : `<table><thead><tr><th>When</th><th>Where</th><th>Level</th><th>What</th><th>Error</th></tr></thead><tbody>${o.events
          .map(
            (e) => `<tr><td>${moment(e.at)}</td><td>${data(e.source)}</td>
              <td><span class="status ${e.level === 'error' ? 'failed' : 'pending'}">${data(e.level)}</span></td>
              <td>${data(e.event)}</td><td>${e.detail ? data(e.detail) : '—'}</td></tr>`,
          )
          .join('')}</tbody></table>`;
  const errors = o.last_day.filter((d) => d.level === 'error').reduce((sum, d) => sum + d.n, 0);
  const tile = (count: number | string, label: string, href?: string) =>
    href
      ? `<a href="${href}"><strong translate="no">${String(count)}</strong><span>${label}</span></a>`
      : `<div><strong translate="no">${String(count)}</strong><span>${label}</span></div>`;
  const waiting =
    o.queues.oldest_review_at === null
      ? '—'
      : `${String(Math.max(0, Math.round((now - o.queues.oldest_review_at) / 3600)))} h`;
  return layout(
    'System',
    { ...nav, current: 'system' },
    `<h1>System</h1>
     <p class="lede">Whether Emanet’s jobs are running and what has failed. Errors are also mailed to staff, at most once an hour. Full logs and traces are in Cloudflare (Workers → Observability), kept seven days; none of it holds personal data.</p>
     <div class="counts">
       ${tile(errors, 'Errors in the last 24 hours')}
       ${tile(waiting, 'Oldest review waiting', '/reviews')}
       ${tile(o.queues.agents_waiting, 'Agents waiting for KYC', '/agents?status=kyc_pending')}
       ${tile(o.queues.requests_open, 'Privacy requests open', '/privacy')}
       ${tile(o.queues.requests_overdue, 'Privacy requests overdue', '/privacy')}
       ${tile(o.queues.files_due, 'Files waiting to be deleted')}
     </div>
     <h2>Jobs</h2>${jobs}
     <h2>Errors and warnings</h2>${events}`,
  );
}
