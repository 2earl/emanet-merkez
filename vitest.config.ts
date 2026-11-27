import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

/**
 * Tests run the Worker with stand-ins for its two neighbours:
 * - login: a token endpoint that checks PKCE, validateToken, and a StaffDirectory with fixed
 *   roles. A code is "<uid>.<code_challenge>"; a uid ending "!aal2" signed in with a second
 *   factor a minute ago, "!old" an hour ago, and no suffix without one.
 * - emanet-core's ControlApi: an in-memory version of the contract in src/core.ts, with one
 *   partner, two reviews, a payout and an invoice. testReset() puts it back.
 */

const LOGIN = `
import { WorkerEntrypoint } from 'cloudflare:workers';
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
  .replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
const ROLES = { 'owner-1': 'owner', 'admin-1': 'admin', 'admin-2': 'admin', 'support-1': 'support' };
const base = (uid) => uid.split('!')[0];
export class StaffDirectory extends WorkerEntrypoint {
  async roleOf(uid) { return ROLES[uid] ?? null; }
}
export default class extends WorkerEntrypoint {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== '/oauth/token') return new Response('no', { status: 404 });
    const form = await request.formData();
    const code = String(form.get('code'));
    const dot = code.lastIndexOf('.');
    const uid = code.slice(0, dot);
    const challenge = code.slice(dot + 1);
    const digest = await crypto.subtle.digest('SHA-256',
      new TextEncoder().encode(String(form.get('code_verifier'))));
    const ok = form.get('grant_type') === 'authorization_code'
      && form.get('resource') === 'https://merkez.emanet.dev'
      && form.get('client_id') === 'https://merkez.emanet.dev/oauth/client.json'
      && b64(digest) === challenge;
    if (!ok) return Response.json({ error: 'invalid_grant' }, { status: 400 });
    return Response.json({ access_token: 'token-' + uid, token_type: 'Bearer' });
  }
  async validateToken(resource, token) {
    if (!token.startsWith('token-')) return null;
    const uid = token.slice(6);
    const t = Math.floor(Date.now() / 1000);
    const aal2At = uid.endsWith('!aal2') ? t - 60 : uid.endsWith('!old') ? t - 3600 : null;
    return { audience: resource, scope: ['emanet:control'], props: { uid: base(uid), aal2At } };
  }
}
`;

const CORE = `
import { WorkerEntrypoint } from 'cloudflare:workers';
const ok = (value) => ({ ok: true, value });
const fail = (error, detail) => (detail === undefined ? { ok: false, error } : { ok: false, error, detail });
const now = () => Math.floor(Date.now() / 1000);
let s;
function seed() {
  const t = now();
  s = {
    calls: [],
    partners: new Map([['p-1', { id: 'p-1', org_id: 'org-1', kind: 'bank', legal_name: 'Test Bankası A.Ş.',
      vkn: '1234567890', tax_office: 'Kadıköy', kep_address: null, e_invoice: 1, status: 'active',
      reconfirm_days: 14, created_at: t - 86400 * 30, active_cases: 3, delivered_cases: 1,
      contact_email: 'ops@testbank.example', billing_email: 'fatura@testbank.example', mail_notices: 1 }]]),
    prices: new Map([['p-1', { list: { default_kurus: 1000000, rules: [{ make: 'Renault', fee_kurus: 1200000 }] }, from: t - 86400 }]]),
    fields: [{ id: 'f-1', partner_id: 'p-1', entity: 'case', key: 'portfolio', label_tr: 'Portföy',
      label_en: 'Portfolio', type: 'enum', enum_values: '["A","B"]', required: 0, visibility: 'partner', deprecated_at: null }],
    settings: { claim_hours: 24, reporting_hours: 12, cooldown_hours: 72, max_active_claims: 3, kdv_bp: 2000,
      dual_approval_kurus: 2500000, withholding_individual_bp: 0, withholding_sole_trader_bp: 0, withholding_company_bp: 0 },
    rule: { rule: { share_bp: 5000 }, valid_from: t - 86400 },
    agents: [{ user_id: 'agent-1', status: 'kyc_pending', legal_name: 'Ali Veli', city: 'İstanbul',
      phone: '+905321234567', iban: 'TR330006100519786457841326', tax_profile: 'individual', vkn: null,
      strikes: 0, created_at: t - 3600, submitted_at: t - 1800, terms_version: '2026-11-27',
      iban_verified: 0, open_claims: 0, deliveries: 0 }],
    reviews: new Map([
      ['r-vin', { item: { id: 'r-vin', kind: 'missing_vin', subject_id: 'c-1', detail: { plate: '34ABC123' }, created_at: t - 7200 },
        case: { id: 'c-1', legal_name: 'Test Bankası A.Ş.', external_ref: 'K-1', status: 'pending_identity',
          vehicle_snapshot: { vin: null, plate: '34ABC123', make: 'Renault', model: 'Clio' } },
        vehicle: { id: 'v-1', vin: null, make: 'Renault', model: 'Clio', plate: '34ABC123' } }],
      ['r-plate', { item: { id: 'r-plate', kind: 'plate_conflict', subject_id: 'c-2',
          detail: { plate: '06XY456', vin: 'VF1RJA00061234567', reason: 'plate_change', recorded: '06XY455' }, created_at: t - 3600 },
        case: { id: 'c-2', legal_name: 'Test Bankası A.Ş.', external_ref: 'K-2', status: 'pending_identity',
          vehicle_snapshot: { vin: 'VF1RJA00061234567', plate: '06XY456', make: 'Fiat', model: 'Egea' } },
        vehicle: { id: 'v-2', vin: 'VF1RJA00061234567', make: 'Fiat', model: 'Egea', plate: '06XY455' } }],
      ['r-del', { item: { id: 'r-del', kind: 'delivery', subject_id: 'cl-1', detail: {}, created_at: t - 600 },
        claim: { id: 'cl-1', agent_id: 'agent-2', agent_name: 'Ayşe Yılmaz', plate: '35KL789', make: 'Toyota',
          model: 'Corolla', vin: 'NMTBB0JE10R123456', claimed_at: t - 7200 },
        sightings: [{ lat: 38.42, lng: 27.14, accuracy_m: 8, taken_at: t - 5000, received_at: t - 4990 }],
        evidence: [{ id: 'e-1', kind: 'yediemin_receipt', file_ref: 'claims/cl-1/e-1', sha256: 'x', exif_time: t - 900,
          exif_lat: null, exif_lng: null, status: 'submitted', created_at: t - 800 }],
        cases: [{ id: 'c-3', legal_name: 'Test Bankası A.Ş.', external_ref: 'K-3', fee_kurus: 1200000,
          icra_office: 'İzmir 3. İcra Dairesi', icra_file_no: '2026/77' }],
        signals: { seconds_to_sighting: 300, nearest_place_m: 7400, agent_deliveries: 2, agent_strikes: 1 } }],
    ]),
    uninvoiced: [{ partner_id: 'p-1', legal_name: 'Test Bankası A.Ş.', cases: 1, net_kurus: 1000000, oldest_delivery: t - 86400 * 6 }],
    invoices: [{ id: 'i-1', partner_id: 'p-1', legal_name: 'Test Bankası A.Ş.', number: null, issued_at: t - 86400,
      net_kurus: 1000000, kdv_kurus: 200000, total_kurus: 1200000, paid_kurus: 0, status: 'issued', cases: 1 }],
    payouts: [
      { id: 'po-small', agent_id: 'agent-2', legal_name: 'Ayşe Yılmaz', case_id: 'c-9', gross_kurus: 500000,
        withholding_kurus: 0, net_kurus: 500000, status: 'ready', ordered_by: null, approved_by: null, bank_ref: null, created_at: t - 3600 },
      { id: 'po-big', agent_id: 'agent-2', legal_name: 'Ayşe Yılmaz', case_id: 'c-8', gross_kurus: 3000000,
        withholding_kurus: 0, net_kurus: 3000000, status: 'ready', ordered_by: null, approved_by: null, bank_ref: null, created_at: t - 7200 },
    ],
    receipts: new Set(),
    provider: null,
    onboardings: new Map([
      ['ob-signed', onboarding('ob-signed', 'signed', 'admin-1', t)],
      ['ob-progress', onboarding('ob-progress', 'in_progress', 'admin-1', t)],
      ['ob-invited', onboarding('ob-invited', 'invited', 'admin-1', t)],
    ]),
  };
}
function onboarding(id, status, invitedBy, t) {
  const signed = status === 'signed';
  return { id, kind: 'bank', company: 'Örnek Bank', contact_name: 'Ayşe Yılmaz', contact_email: 'ops@ornek.example',
    locale: 'tr', status, invited_by: invitedBy, invited_at: t - 86400 * 2, sent_at: t - 86400 * 2,
    expires_at: t + 86400 * 12, signed_at: signed ? t - 3600 : null, decided_at: null, partner_id: null,
    updated_at: t - 3600, price_list: { default_kurus: 1500000, rules: [{ make: 'Ford', fee_kurus: 2000000 }] },
    reconfirm_days: 14, note: 'Met at the conference', claimed_by: status === 'invited' ? null : 'joiner-1',
    org_id: status === 'invited' ? null : 'org_ornek',
    details: status === 'invited' ? null : { legalName: 'Örnek Bank A.Ş.', address: 'Büyükdere Cad. 1, İstanbul',
      taxOffice: 'Büyük Mükellefler', vkn: '1234567890', mersis: null, kep: 'ornek@hs01.kep.tr',
      signatoryName: 'Mehmet Demir', signatoryTitle: 'Genel Müdür Yardımcısı', billingEmail: 'fatura@ornek.example',
      operationsName: 'Ayşe Yılmaz', operationsEmail: 'ops@ornek.example', operationsPhone: '+90 212 555 00 00', eInvoice: true },
    contract_version: signed ? '2026-11-27-draft' : null, contract_sha256: signed ? 'ab'.repeat(32) : null,
    contract_text: signed ? 'EMANET HİZMET SÖZLEŞMESİ' : null, signer_name: signed ? 'Ayşe Yılmaz' : null,
    signer_title: signed ? 'Operasyon Müdürü' : null, decision_reason: null,
    documents: signed ? [{ id: 'd-1', kind: 'signature_circular', file_ref: 'onboarding/' + id + '/d-1', sha256: 'cd'.repeat(32),
      file_name: 'imza.pdf', content_type: 'application/pdf', size: 1200, uploaded_by: 'joiner-1', uploaded_at: t - 7200 }] : [],
    acceptances: signed ? [
      { contract_version: '2026-11-27-draft', contract_sha256: 'ef'.repeat(32), signer_name: 'Ayşe Yılmaz', signer_title: 'Müdür', signer_ip: '192.0.2.9', signed_at: t - 86400 },
      { contract_version: '2026-11-27-draft', contract_sha256: 'ab'.repeat(32), signer_name: 'Ayşe Yılmaz', signer_title: 'Operasyon Müdürü', signer_ip: '192.0.2.9', signed_at: t - 3600 },
    ] : [] };
}
seed();
const log = (method, args) => s.calls.push([method, ...args]);
export class ControlApi extends WorkerEntrypoint {
  async partners() { return ok([...s.partners.values()]); }
  async partner(id) {
    const partner = s.partners.get(id);
    if (!partner) return fail('not_found');
    const price = s.prices.get(id);
    return ok({ partner, priceList: price?.list ?? null, priceListFrom: price?.from ?? null,
      fields: s.fields.filter((f) => f.partner_id === id || f.partner_id === null) });
  }
  async createPartner(staffId, input) {
    log('createPartner', [staffId, input]);
    if (!input.legalName.trim()) return fail('missing_legal_name');
    if ([...s.partners.values()].some((p) => p.org_id === input.orgId)) return fail('partner_exists');
    const id = 'p-' + (s.partners.size + 1);
    s.partners.set(id, { id, org_id: input.orgId, kind: input.kind, legal_name: input.legalName, vkn: input.vkn ?? null,
      tax_office: input.taxOffice ?? null, kep_address: input.kepAddress ?? null, e_invoice: input.eInvoice ? 1 : 0,
      status: 'invited', reconfirm_days: input.reconfirmDays ?? 14, created_at: now(), active_cases: 0, delivered_cases: 0 });
    return ok({ id });
  }
  async updatePartner(staffId, id, input) {
    log('updatePartner', [staffId, id, input]);
    const p = s.partners.get(id);
    if (!p) return fail('not_found');
    if (input.vkn !== null && !/^\\d{10,11}$/.test(input.vkn)) return fail('invalid_vkn');
    if (!(input.reconfirmDays >= 1 && input.reconfirmDays <= 90)) return fail('invalid_reconfirm_days');
    Object.assign(p, { legal_name: input.legalName, vkn: input.vkn, tax_office: input.taxOffice,
      kep_address: input.kepAddress, e_invoice: input.eInvoice ? 1 : 0, reconfirm_days: input.reconfirmDays });
    return ok(null);
  }
  async setPartnerStatus(staffId, id, status) {
    log('setPartnerStatus', [staffId, id, status]);
    const p = s.partners.get(id);
    if (!p) return fail('not_found');
    p.status = status;
    return ok(null);
  }
  async setPriceList(staffId, id, list) {
    log('setPriceList', [staffId, id, list]);
    s.prices.set(id, { list, from: now() });
    return ok(list);
  }
  async defineField(staffId, field) {
    log('defineField', [staffId, field]);
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(field.key)) return fail('invalid_key', 'Use a-z, 0-9 and _, starting with a letter.');
    if (s.fields.some((f) => f.partner_id === field.partnerId && f.key === field.key)) return fail('field_exists');
    s.fields.push({ id: 'f-' + (s.fields.length + 1), partner_id: field.partnerId, entity: field.entity, key: field.key,
      label_tr: field.labelTr, label_en: field.labelEn, type: field.type, enum_values: field.enumValues ? JSON.stringify(field.enumValues) : null,
      required: field.required ? 1 : 0, visibility: field.visibility ?? 'partner', deprecated_at: null });
    return ok(null);
  }
  async deprecateField(staffId, id) {
    log('deprecateField', [staffId, id]);
    const f = s.fields.find((x) => x.id === id && x.deprecated_at === null);
    if (!f) return fail('not_found');
    f.deprecated_at = now();
    return ok(null);
  }
  async settings() { return ok({ ...s.settings }); }
  async setSetting(staffId, key, value) {
    log('setSetting', [staffId, key, value]);
    if (!(key in s.settings)) return fail('invalid_setting');
    s.settings[key] = value;
    return ok(null);
  }
  async payoutRule() { return ok(s.rule); }
  async setPayoutRule(staffId, rule) {
    log('setPayoutRule', [staffId, rule]);
    s.rule = { rule, valid_from: now() };
    return ok(null);
  }
  async agents(status) { return ok(s.agents.filter((a) => status === null || a.status === status)); }
  async setAgentStatus(staffId, id, status, reason) {
    log('setAgentStatus', [staffId, id, status, reason]);
    const a = s.agents.find((x) => x.user_id === id);
    if (!a) return fail('not_found');
    a.status = status;
    return ok(null);
  }
  async verifyIban(staffId, id, iban) {
    log('verifyIban', [staffId, id, iban]);
    const a = s.agents.find((x) => x.user_id === id);
    if (!a || a.iban !== iban) return fail('iban_changed');
    a.iban_verified = 1;
    return ok(null);
  }
  async reviewQueue() { return ok([...s.reviews.values()].map((r) => ({ ...r.item, detail: JSON.stringify(r.item.detail) }))); }
  async review(id) { const r = s.reviews.get(id); return r ? ok(r) : fail('not_found'); }
  async resolveIdentity(staffId, id, decision) {
    log('resolveIdentity', [staffId, id, decision]);
    const r = s.reviews.get(id);
    if (!r || r.item.kind === 'delivery') return fail('not_found');
    if (decision.action === 'reject') {
      if (!decision.reason) return fail('invalid_reason');
      s.reviews.delete(id);
      return ok({ case_status: 'withdrawn' });
    }
    const vin = decision.vin ?? r.case.vehicle_snapshot.vin;
    if (!vin || !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return fail('invalid_vin');
    s.reviews.delete(id);
    return ok({ case_status: 'active' });
  }
  async confirmDelivery(staffId, claimId) {
    log('confirmDelivery', [staffId, claimId]);
    for (const [id, r] of s.reviews) if (r.item.kind === 'delivery' && r.claim.id === claimId) {
      s.reviews.delete(id);
      return ok({ cases: r.cases.map((c) => c.id), payout: { id: 'po-new', gross_kurus: 600000, net_kurus: 600000 } });
    }
    return fail('not_found');
  }
  async rejectDelivery(staffId, claimId, input) {
    log('rejectDelivery', [staffId, claimId, input]);
    if (!input.reason) return fail('invalid_reason');
    for (const [id, r] of s.reviews) if (r.item.kind === 'delivery' && r.claim.id === claimId) {
      s.reviews.delete(id);
      return ok({ strikes: input.strike ? 1 : 0 });
    }
    return fail('not_found');
  }
  async setInvoiceNumber(staffId, invoiceId, input) {
    log('setInvoiceNumber', [staffId, invoiceId, input]);
    const i = s.invoices.find((x) => x.id === invoiceId);
    if (!i) return fail('not_found');
    if (!/^[A-Za-z0-9][A-Za-z0-9/-]{2,31}$/.test(input.number)) return fail('invalid_invoice_number');
    if (s.invoices.some((x) => x !== i && x.number === input.number.toUpperCase())) return fail('duplicate_invoice_number');
    i.number = input.number.toUpperCase();
    return ok(null);
  }
  async audit(staffId, query) {
    log('audit', [staffId, query]);
    if (query.subject && /[^A-Za-z0-9_.:/@-]/.test(query.subject)) return fail('invalid_filter');
    const t = now();
    const events = [
      { id: 'a-2', at: t - 60, actor: 'staff:admin-1', action: 'delivery.rejected', subject: 'claim:cl-9', detail: { reason: 'Wrong plate', strike: true } },
      { id: 'a-1', at: t - 3600, actor: 'partner:p-1/user-1', action: 'case.created', subject: 'case:c-1', detail: {} },
    ].filter((e) => (!query.subject || e.subject === query.subject) && (!query.actor || e.actor === query.actor));
    return ok({ events, next_before: query.before ? null : t - 3600 });
  }
  async uninvoiced() { return ok(s.uninvoiced); }
  async invoices(partnerId) { return ok(s.invoices.filter((i) => partnerId === null || i.partner_id === partnerId)); }
  async issueInvoice(staffId, partnerId) {
    log('issueInvoice', [staffId, partnerId]);
    const u = s.uninvoiced.find((x) => x.partner_id === partnerId);
    if (!u) return fail('nothing_to_invoice');
    s.uninvoiced = s.uninvoiced.filter((x) => x !== u);
    return ok({ id: 'i-2', total_kurus: Math.round(u.net_kurus * 1.2) });
  }
  async recordReceipt(staffId, receipt) {
    log('recordReceipt', [staffId, receipt]);
    if (s.receipts.has(receipt.bankRef)) return fail('duplicate_bank_ref');
    if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(receipt.valueDate)) return fail('invalid_value_date');
    s.receipts.add(receipt.bankRef);
    const i = s.invoices.find((x) => x.id === receipt.invoiceId);
    i.paid_kurus += receipt.amountKurus;
    if (i.paid_kurus >= i.total_kurus) i.status = 'paid';
    return ok({ id: 'rc-1', invoice_paid: i.status === 'paid' });
  }
  async payouts(status) { return ok(s.payouts.filter((p) => status === null || p.status === status)); }
  async orderPayout(staffId, id) {
    log('orderPayout', [staffId, id]);
    const p = s.payouts.find((x) => x.id === id);
    if (!p) return fail('not_found');
    if (p.status !== 'ready') return fail('payout_not_ready', p.status);
    const needsSecond = p.gross_kurus >= s.settings.dual_approval_kurus;
    if (p.ordered_by === null) {
      p.ordered_by = staffId;
      if (!needsSecond) { p.approved_by = staffId; p.status = 'approved'; }
      return ok({ status: p.status });
    }
    if (p.ordered_by === staffId) return fail('second_approver_required');
    p.approved_by = staffId; p.status = 'approved';
    return ok({ status: 'approved' });
  }
  async markPayoutSent(staffId, id, bankRef) {
    log('markPayoutSent', [staffId, id, bankRef]);
    const p = s.payouts.find((x) => x.id === id);
    if (!p) return fail('not_found');
    if (p.status !== 'approved') return fail('payout_not_approved', p.status);
    if (!bankRef.trim()) return fail('missing_bank_ref');
    p.status = 'sent'; p.bank_ref = bankRef;
    return ok(null);
  }
  async trialBalance() {
    return ok([
      { code: '102', name: 'Bankalar', debit_kurus: 1200000, credit_kurus: 500000 },
      { code: '120', name: 'Alıcılar', debit_kurus: 1200000, credit_kurus: 1200000 },
      { code: '320', name: 'Satıcılar', debit_kurus: 500000, credit_kurus: 500000 },
      { code: '391', name: 'Hesaplanan KDV', debit_kurus: 0, credit_kurus: 200000 },
      { code: '600', name: 'Yurt İçi Satışlar', debit_kurus: 0, credit_kurus: 1000000 },
      { code: '740', name: 'Hizmet Üretim Maliyeti', debit_kurus: 500000, credit_kurus: 0 },
    ]);
  }
  async recordView(staffId, subject, what) { log('recordView', [staffId, subject, what]); return ok(null); }
  async provider() { return ok(s.provider); }
  async setPartnerNotices(staffId, partnerId, on) {
    log('setPartnerNotices', [staffId, partnerId, on]);
    const p = s.partners.get(partnerId);
    if (!p) return fail('not_found');
    p.mail_notices = on ? 1 : 0; return ok(null);
  }
  async setProvider(staffId, input) {
    log('setProvider', [staffId, input]);
    if (!/^[0-9]{10}$/.test(input.vkn)) return fail('invalid_provider', 'vkn');
    s.provider = { details: input, updated_by: staffId, updated_at: now() };
    return ok(input);
  }
  async inviteCompany(staffId, input) {
    log('inviteCompany', [staffId, input]);
    if (!input.company) return fail('missing_company');
    for (const o of s.onboardings.values()) if (o.contact_email === input.contactEmail && ['invited', 'in_progress', 'signed'].includes(o.status)) return fail('already_invited');
    const id = 'ob-' + crypto.randomUUID().slice(0, 8);
    const o = onboarding(id, 'invited', staffId, now());
    Object.assign(o, { company: input.company, contact_name: input.contactName, contact_email: input.contactEmail, price_list: input.priceList });
    s.onboardings.set(id, o);
    return ok({ id, emailed: true });
  }
  async onboardings(status) {
    return ok([...s.onboardings.values()].filter((o) => !status || o.status === status)
      .map((o) => ({ ...o, legal_name: o.details ? o.details.legalName : null })));
  }
  async onboarding(id) { const o = s.onboardings.get(id); return o ? ok(o) : fail('not_found'); }
  async resendInvitation(staffId, id) {
    log('resendInvitation', [staffId, id]);
    const o = s.onboardings.get(id);
    if (!o) return fail('not_found');
    if (!['invited', 'in_progress', 'expired'].includes(o.status)) return fail('not_open');
    return ok({ emailed: true });
  }
  async cancelOnboarding(staffId, id, reason) {
    log('cancelOnboarding', [staffId, id, reason]);
    const o = s.onboardings.get(id);
    if (!reason) return fail('invalid_reason');
    if (!o || !['invited', 'in_progress', 'signed', 'expired'].includes(o.status)) return fail('not_open');
    o.status = 'cancelled'; o.decision_reason = reason; return ok(null);
  }
  async returnOnboarding(staffId, id, reason) {
    log('returnOnboarding', [staffId, id, reason]);
    const o = s.onboardings.get(id);
    if (!reason) return fail('invalid_reason');
    if (!o || o.status !== 'signed') return fail('not_signed');
    o.status = 'in_progress'; o.signed_at = null; o.decision_reason = reason; return ok({ emailed: true });
  }
  async rejectOnboarding(staffId, id, reason) {
    log('rejectOnboarding', [staffId, id, reason]);
    const o = s.onboardings.get(id);
    if (!reason) return fail('invalid_reason');
    if (!o || !['in_progress', 'signed'].includes(o.status)) return fail('not_open');
    o.status = 'rejected'; o.decision_reason = reason; return ok({ emailed: true });
  }
  async approveOnboarding(staffId, id) {
    log('approveOnboarding', [staffId, id]);
    const o = s.onboardings.get(id);
    if (!o || o.status !== 'signed') return fail('not_signed');
    if (o.invited_by === staffId) return fail('four_eyes');
    o.status = 'approved'; o.partner_id = 'p-new'; return ok({ partnerId: 'p-new', emailed: true });
  }
  async testCalls() { return s.calls; }
  async testReset() { seed(); }
}
export default { fetch() { return new Response(null, { status: 404 }); } };
`;

export default defineConfig(async () => {
  const migrations = await readD1Migrations('./migrations');
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            SESSION_PEPPER: 'test-session-pepper',
          },
          workers: [
            { name: 'login', modules: true, compatibilityDate: '2026-11-01', script: LOGIN },
            { name: 'emanet-core', modules: true, compatibilityDate: '2026-11-01', script: CORE },
          ],
        },
      }),
    ],
    test: { setupFiles: ['./test/apply-migrations.ts'] },
  };
});
