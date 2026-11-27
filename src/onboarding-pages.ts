import {
  ONBOARDING_STATUSES,
  PARTNER_KINDS,
  REQUIRED_DOCUMENTS,
  type DocumentKind,
  type OnboardingDetail,
  type OnboardingRow,
  type OnboardingStatus,
} from './core';
import {
  KIND_LABEL,
  attr,
  confirmFirst,
  data,
  day,
  error,
  esc,
  layout,
  lira,
  moment,
  notice,
  type Nav,
} from './pages';

/** Companies joining Emanet (emanet-core docs/DESIGN.md §5, Onboarding), for 2earl staff. */

export const STATUS_LABEL: Record<OnboardingStatus, string> = {
  invited: 'Invited',
  in_progress: 'Filling in',
  signed: 'To approve',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

export const DOCUMENT_LABEL: Record<DocumentKind, string> = {
  signature_circular: 'Signature circular',
  tax_certificate: 'Tax certificate',
  trade_registry: 'Trade Registry Gazette',
  signed_contract: 'Wet-signed agreement',
  other: 'Other document',
};

const status = (s: OnboardingStatus) => `<span class="status ${s}">${STATUS_LABEL[s]}</span>`;

export function onboardingList(
  nav: Nav,
  rows: OnboardingRow[],
  filter: OnboardingStatus | null,
  canChange: boolean,
  message: string | null,
  values: Record<string, string>,
): string {
  const filters = [
    `<a href="/onboarding"${filter === null ? ' aria-current="page"' : ''}>All</a>`,
    ...ONBOARDING_STATUSES.map(
      (s) =>
        `<a href="/onboarding?status=${s}"${filter === s ? ' aria-current="page"' : ''}>${STATUS_LABEL[s]}</a>`,
    ),
  ].join(' · ');
  const table =
    rows.length === 0
      ? '<p class="panel">No companies here.</p>'
      : `<table><thead><tr><th>Company</th><th>Kind</th><th>Contact</th><th>Status</th><th>Invited</th><th>Link valid until</th></tr></thead><tbody>${rows
          .map(
            (o) => `<tr>
              <td><a href="/onboarding/${attr(o.id)}">${data(o.legal_name ?? o.company)}</a></td>
              <td>${KIND_LABEL[o.kind]}</td>
              <td>${data(o.contact_name)}</td>
              <td>${status(o.status)}</td>
              <td>${day(o.invited_at)}</td>
              <td>${o.status === 'invited' || o.status === 'in_progress' ? day(o.expires_at) : '—'}</td>
            </tr>`,
          )
          .join('')}</tbody></table>`;
  const v = (key: string, fallback = '') => attr(values[key] ?? fallback);
  const form = canChange
    ? `<h2>Invite a company</h2>
       <p class="hint">Emanet emails the contact a link, valid for 14 days, with reminders after 3 and 7 days. They sign in with that address, create the company’s organization, give its details and documents, and accept the agreement with these fees. Another admin then approves it here.</p>
       ${error(message)}
       <form method="post" action="/onboarding" class="stack">
         <div class="grid2">
           <label>Company <input name="company" required maxlength="200" value="${v('company')}"></label>
           <label>Kind <select name="kind">${PARTNER_KINDS.map(
             (k) =>
               `<option value="${k}"${values.kind === k ? ' selected' : ''}>${KIND_LABEL[k]}</option>`,
           ).join('')}</select></label>
           <label>Contact name <input name="contact_name" required maxlength="120" value="${v('contact_name')}"></label>
           <label>Contact email <input name="contact_email" type="email" required maxlength="254" autocomplete="off" value="${v('contact_email')}"></label>
           <label>Language of the emails <select name="locale"><option value="tr" translate="no"${values.locale === 'en' ? '' : ' selected'}>Türkçe</option><option value="en" translate="no"${values.locale === 'en' ? ' selected' : ''}>English</option></select></label>
           <label>Re-confirm cases every (days) <input name="reconfirm_days" type="number" min="1" max="90" required value="${v('reconfirm_days', '14')}"></label>
         </div>
         <fieldset><legend>Fees offered (Annex 2 of the agreement)</legend>
           <label>Default fee (₺) <input name="default" required inputmode="decimal" value="${v('default')}"></label>
           <label>Rules, one per line <textarea name="rules" rows="4" spellcheck="false" translate="no">${esc(values.rules ?? '')}</textarea></label>
           <p class="hint">Make;Model;From year;To year;Fee. Use * for any make or model and leave years empty for any year.</p>
         </fieldset>
         <label>Note for staff <input name="note" maxlength="500" value="${v('note')}"></label>
         <div><button type="submit">Send the invitation</button></div>
       </form>`
    : '';
  return layout(
    'Onboarding',
    { ...nav, current: 'onboarding' },
    `<h1>Onboarding</h1><p>${filters}</p>${table}${form}`,
  );
}

export function onboardingDetail(
  nav: Nav,
  o: OnboardingDetail,
  staffId: string,
  canChange: boolean,
  fresh: boolean,
  done: string | null,
  message: string | null,
): string {
  const path = `/onboarding/${o.id}`;
  const d = o.details;
  const have = new Set(o.documents.map((x) => x.kind));
  const missing = REQUIRED_DOCUMENTS.filter((k) => !have.has(k));
  const open = o.status === 'invited' || o.status === 'in_progress' || o.status === 'signed';
  const facts = `<div class="panel"><dl class="facts">
      <dt>Status</dt><dd>${status(o.status)}</dd>
      <dt>Kind</dt><dd>${KIND_LABEL[o.kind]}</dd>
      <dt>Contact</dt><dd>${data(`${o.contact_name} <${o.contact_email}>`)}</dd>
      <dt>Invited</dt><dd>${moment(o.invited_at)}</dd>
      <dt>Last link sent</dt><dd>${moment(o.sent_at)}</dd>
      <dt>Link valid until</dt><dd>${day(o.expires_at)}</dd>
      <dt>Organization</dt><dd>${o.org_id ? data(o.org_id) : '—'}</dd>
      <dt>Re-confirm cases every</dt><dd><span translate="no">${String(o.reconfirm_days)}</span> days</dd>
      ${o.note ? `<dt>Note</dt><dd>${data(o.note)}</dd>` : ''}
      ${o.decision_reason ? `<dt>Reason given</dt><dd>${data(o.decision_reason)}</dd>` : ''}
      ${o.partner_id ? `<dt>Partner</dt><dd><a href="/partners/${attr(o.partner_id)}">Open the partner</a></dd>` : ''}
    </dl></div>`;
  const prices = o.price_list
    ? `<h2>Fees offered</h2><table><thead><tr><th>Vehicle</th><th class="num">Fee</th></tr></thead><tbody>
        <tr><td>Any vehicle</td><td class="num">${lira(o.price_list.default_kurus)}</td></tr>
        ${o.price_list.rules
          .map(
            (r) =>
              `<tr><td>${data([r.make ?? '*', r.model ?? '*', r.year_from === undefined && r.year_to === undefined ? '' : `${r.year_from === undefined ? '' : String(r.year_from)}–${r.year_to === undefined ? '' : String(r.year_to)}`].filter(Boolean).join(' '))}</td><td class="num">${lira(r.fee_kurus)}</td></tr>`,
          )
          .join('')}</tbody></table>`
    : '';
  const company = d
    ? `<h2>Company details</h2><div class="panel"><dl class="facts">
        <dt>Legal name</dt><dd>${data(d.legalName)}</dd>
        <dt>Address</dt><dd>${data(d.address)}</dd>
        <dt>Tax office and number</dt><dd>${data(`${d.taxOffice} · ${d.vkn}`)}</dd>
        <dt>MERSİS</dt><dd>${d.mersis ? data(d.mersis) : '—'}</dd>
        <dt>KEP</dt><dd>${d.kep ? data(d.kep) : '—'}</dd>
        <dt>e-Fatura</dt><dd>${d.eInvoice ? 'Yes' : 'No'}</dd>
        <dt>Signatory</dt><dd>${data(`${d.signatoryName}, ${d.signatoryTitle}`)}</dd>
        <dt>Invoices to</dt><dd>${data(d.billingEmail)}</dd>
        <dt>Operations</dt><dd>${data(`${d.operationsName} · ${d.operationsEmail} · ${d.operationsPhone}`)}</dd>
      </dl></div>`
    : '<h2>Company details</h2><p class="panel">Not given yet.</p>';
  const showMissing = o.status !== 'approved' ? missing : [];
  const documents = `<h2>Documents</h2>
    ${
      o.documents.length || showMissing.length
        ? `<table><thead><tr><th>Document</th><th>File</th><th>Added</th><th>SHA-256</th></tr></thead><tbody>${o.documents
            .map(
              (x) =>
                `<tr><td>${DOCUMENT_LABEL[x.kind]}</td><td><a href="${path}/documents/${attr(x.id)}">${data(x.file_name)}</a></td><td>${moment(x.uploaded_at)}</td><td><code translate="no">${esc(x.sha256.slice(0, 16))}…</code></td></tr>`,
            )
            .join('')}${showMissing
            .map(
              (k) =>
                `<tr class="late"><td>${DOCUMENT_LABEL[k]}</td><td colspan="3"><strong>Missing</strong></td></tr>`,
            )
            .join('')}</tbody></table>`
        : '<p class="panel">No documents yet.</p>'
    }`;
  const agreement =
    o.signed_at !== null
      ? `<h2>Agreement</h2>
         <p>Accepted by ${data(o.signer_name ?? '')} (${data(o.signer_title ?? '')}) on ${moment(o.signed_at)}. Version ${data(o.contract_version ?? '')}.</p>
         <p class="hint">SHA-256 <code translate="no">${esc(o.contract_sha256 ?? '')}</code></p>
         ${d && o.signer_name && o.signer_name.trim().toLocaleLowerCase('tr-TR') !== d.signatoryName.trim().toLocaleLowerCase('tr-TR') ? '<p class="error">The person who accepted isn’t the signatory named in the details. Check the signature circular.</p>' : ''}
         <details><summary>Read the accepted text</summary><article class="contract" lang="tr" translate="no">${esc(o.contract_text ?? '')}</article></details>`
      : '';
  const reason = (action: string, label: string, button: string, secondary = true) =>
    `<form method="post" action="${path}/${action}" class="stack">
       <label>${label} <input name="reason" required maxlength="300"></label>
       <div><button${secondary ? ' class="secondary"' : ''} type="submit">${button}</button></div>
     </form>`;
  let actions = '';
  if (canChange && o.status === 'signed') {
    actions =
      o.invited_by === staffId
        ? '<p class="panel">You invited this company, so another admin approves it.</p>'
        : fresh
          ? `<form method="post" action="${path}/approve" class="actions">
               <button type="submit">Approve and activate</button>
             </form>
             <p class="hint">Creates the partner, active, with these details and fees. The contact is emailed.</p>`
          : confirmFirst(path);
    actions += `<h3>Ask for a change</h3><p class="hint">The acceptance is cleared; they correct it and accept again.</p>${reason('return', 'What needs changing', 'Send back')}`;
  }
  if (canChange && (o.status === 'in_progress' || o.status === 'signed')) {
    actions += `<h3>Reject</h3>${reason('reject', 'Reason, sent to the contact', 'Reject')}`;
  }
  if (
    canChange &&
    (o.status === 'invited' || o.status === 'in_progress' || o.status === 'expired')
  ) {
    actions += `<h3>Send a new link</h3>
      <p class="hint">The old link stops working. The new one is valid for 14 days.</p>
      <form method="post" action="${path}/resend" class="actions"><button class="secondary" type="submit">Send a new link</button></form>`;
  }
  if (canChange && (open || o.status === 'expired')) {
    actions += `<h3>Cancel</h3>${reason('cancel', 'Reason, for staff', 'Cancel the invitation')}`;
  }
  return layout(
    'Onboarding',
    { ...nav, current: 'onboarding' },
    `${notice(done)}${error(message)}
     <p><a href="/onboarding">All companies</a></p>
     <h1>${data(d?.legalName ?? o.company)}</h1>
     ${facts}
     ${company}
     ${documents}
     ${agreement}
     ${prices}
     ${actions ? `<h2>Decide</h2>${actions}` : ''}`,
  );
}
