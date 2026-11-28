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
const SPECS = {
  claim_hours: ['search', 'hours', 24, 1, 336], reporting_hours: ['search', 'hours', 12, 1, 168],
  cooldown_hours: ['search', 'hours', 72, 0, 2160], max_active_claims: ['search', 'count', 3, 1, 50],
  max_evidence_per_claim: ['search', 'count', 40, 5, 200],
  review_sla_hours: ['review', 'hours', 24, 1, 336], identity_sla_hours: ['review', 'hours', 48, 1, 336],
  review_checklist: ['review', 'switch', 1, 0, 1],
  agent_sla_hours: ['agents', 'hours', 72, 1, 720], strike_limit: ['agents', 'count', 3, 0, 20],
  email_code_minutes: ['agents', 'minutes', 15, 5, 120], agent_mail: ['agents', 'switch', 1, 0, 1],
  require_documents: ['agents', 'switch', 1, 0, 1], agent_request_days: ['agents', 'days', 14, 1, 90],
  invitation_days: ['partners', 'days', 14, 1, 90], onboarding_sla_hours: ['partners', 'hours', 48, 1, 720],
  expiry_warning_days: ['partners', 'days', 3, 1, 30], webhook_disable_after: ['partners', 'count', 20, 3, 200],
  max_webhooks: ['partners', 'count', 5, 1, 20],
  kdv_bp: ['money', 'bp', 2000, 0, 5000], invoice_days: ['money', 'days', 7, 1, 7],
  dual_approval_kurus: ['money', 'kurus', 2500000, 0, 100000000000],
  withholding_individual_bp: ['money', 'bp', 0, 0, 5000], withholding_sole_trader_bp: ['money', 'bp', 0, 0, 5000],
  withholding_company_bp: ['money', 'bp', 0, 0, 5000],
  evidence_retention_days: ['privacy', 'days', 3650, 365, 7300], failed_claim_evidence_days: ['privacy', 'days', 30, 7, 365],
  place_retention_days: ['privacy', 'days', 30, 1, 365], erasure_archive_days: ['privacy', 'days', 3650, 180, 3650], abandoned_onboarding_days: ['privacy', 'days', 90, 7, 365], support_retention_days: ['privacy', 'days', 730, 90, 3650],
  privacy_request_days: ['privacy', 'days', 30, 1, 30],
  alert_interval_minutes: ['operations', 'minutes', 60, 15, 1440], ops_keep_days: ['operations', 'days', 30, 7, 365],
  require_signoffs: ['operations', 'switch', 1, 0, 1],
};
let s;
function asksOf() {
  return (s.asks ??= [
    { id: 'ar-1', agent_id: 'agent-1', kind: 'info', subject: 'address', note: 'Adresinizde daire numarası eksik.', status: 'answered', answer: 'Düzelttim, No:4 D:2', document_id: null, created_at: now() - 86400, due_at: now() + 13 * 86400, answered_at: now() - 3600, closed_at: null },
    { id: 'ar-2', agent_id: 'agent-1', kind: 'document', subject: 'bank_proof', note: 'IBAN dekontu yükleyin.', status: 'open', answer: null, document_id: null, created_at: now() - 20 * 86400, due_at: now() - 6 * 86400, answered_at: null, closed_at: null },
    { id: 'ar-3', agent_id: 'agent-1', kind: 'info', subject: 'phone', note: 'Telefon numaranızı güncelleyin.', status: 'accepted', answer: null, document_id: null, created_at: now() - 30 * 86400, due_at: now() - 16 * 86400, answered_at: now() - 29 * 86400, closed_at: now() - 28 * 86400 },
  ]);
}
function archivesOf() {
  return (s.archives ??= [
    { id: 'arch-1', subject_kind: 'agent', subject_ref: 'agent-0000-erased', request_id: 'pr-5', reason: 'İlgili kişinin talebi', archived_by: 'staff:admin-1', archived_at: now() - 86400, purge_at: now() + 3649 * 86400, purged_at: null,
      files: [{ ref: 'archive/arch-1/f-1', name: 'population_record', type: 'application/pdf', size: 20480 }], files_pending: 1, views: 0, last_viewed_at: null },
    { id: 'arch-0', subject_kind: 'agent', subject_ref: 'agent-0000-old', request_id: null, reason: 'account deleted', archived_by: 'system', archived_at: now() - 3700 * 86400, purge_at: now() - 50 * 86400, purged_at: now() - 50 * 86400,
      files: [], files_pending: 0, views: 2, last_viewed_at: now() - 3000 * 86400 },
  ]);
}
function seed() {
  const t = now();
  s = {
    calls: [],
    signoffsOpen: [],
    tickets: [
      { id: 'tk-1', requester_kind: 'agent', requester_ref: 'agent-1', subject: 'Ödemem gelmedi', category: 'payment', status: 'open', created_at: t - 90000, updated_at: t - 90000, first_response_at: null, closed_at: null, assigned_to: null, who: 'Ali Veli', messages: 1 },
      { id: 'tk-2', requester_kind: 'partner', requester_ref: 'partner-1', subject: 'Fatura sorusu', category: 'invoice', status: 'answered', created_at: t - 5000, updated_at: t - 3000, first_response_at: t - 3000, closed_at: null, assigned_to: null, who: 'Deneme Bankası', messages: 2 },
    ],
    ticketMessages: { 'tk-1': [{ id: 'm1', author_kind: 'requester', body: 'IBAN’ıma ödeme yok.', created_at: t - 90000 }] },
    holds: [],
    activateBlocked: null,
    activation: { ready: false, items: [
      { key: 'application', ok: true, blocking: true },
      { key: 'documents', ok: false, blocking: true },
      { key: 'requests', ok: false, blocking: true, detail: 2 },
      { key: 'signoffs', ok: false, blocking: true, detail: ['legal_privacy', 'accounting_setup'] },
      { key: 'video_call', ok: false, blocking: false },
      { key: 'iban', ok: false, blocking: false },
    ] },
    partners: new Map([['p-1', { id: 'p-1', org_id: 'org-1', kind: 'bank', legal_name: 'Test Bankası A.Ş.',
      vkn: '1234567890', tax_office: 'Kadıköy', kep_address: null, e_invoice: 1, status: 'active',
      reconfirm_days: 14, created_at: t - 86400 * 30, active_cases: 3, delivered_cases: 1,
      contact_email: 'ops@testbank.example', billing_email: 'fatura@testbank.example', mail_notices: 1 }]]),
    prices: new Map([['p-1', { list: { default_kurus: 1000000, rules: [{ make: 'Renault', fee_kurus: 1200000 }] }, from: t - 86400 }]]),
    fields: [{ id: 'f-1', partner_id: 'p-1', entity: 'case', key: 'portfolio', label_tr: 'Portföy',
      label_en: 'Portfolio', type: 'enum', enum_values: '["A","B"]', required: 0, visibility: 'partner', deprecated_at: null }],
    settings: Object.fromEntries(Object.entries(SPECS).map(([key, spec]) => [key, spec[2]])),
    settingsChanged: {},
    signoffs: {},
    documents: [
      { id: 'doc-1', agent_id: 'agent-1', kind: 'criminal_record', barcode: 'ABC-123456', uploaded_at: t, status: 'uploaded', outcome: null, decided_at: null, note: null, file_ref: 'agents/agent-1/criminal_record-1' },
      { id: 'doc-2', agent_id: 'agent-1', kind: 'population_record', barcode: 'NVI-987654', uploaded_at: t, status: 'uploaded', outcome: null, decided_at: null, note: null, file_ref: 'agents/agent-1/population_record-1' },
    ],
    rule: { rule: { share_bp: 5000 }, valid_from: t - 86400 },
    agents: [{ user_id: 'agent-1', status: 'kyc_pending', legal_name: 'Ali Veli', city: 'İstanbul',
      phone: '+905321234567', iban: 'TR330006100519786457841326', tax_profile: 'individual', vkn: null,
      strikes: 0, created_at: t - 3600, submitted_at: t - 1800, terms_version: '2026-11-27',
      iban_verified: 0, open_claims: 0, deliveries: 0, email: 'ali@example.com', id_given: 1, birth_year: 1990 }],
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
  async settingsInfo() {
    return ok([...Object.entries(SPECS).map(([key, [group, unit, def, min, max]]) => ({
      key, group, unit, default: def, min, max, value: s.settings[key],
      updated_by: s.settingsChanged[key] ?? null, updated_at: s.settingsChanged[key] ? now() : null,
    })), { key: 'dev_mode', group: 'operations', unit: 'switch', default: 0, min: 0, max: 1, value: 0, updated_by: null, updated_at: null }]);
  }
  async setSetting(staffId, key, value) {
    log('setSetting', [staffId, key, value]);
    const spec = SPECS[key];
    if (!spec || !Number.isSafeInteger(value) || value < spec[3] || value > spec[4]) return fail('invalid_setting');
    s.settings[key] = value;
    s.settingsChanged[key] = staffId;
    return ok(null);
  }
  async resetSetting(staffId, key) {
    log('resetSetting', [staffId, key]);
    if (!SPECS[key]) return fail('invalid_setting');
    s.settings[key] = SPECS[key][2];
    delete s.settingsChanged[key];
    return ok(null);
  }
  async queues() {
    const t = now();
    return ok([
      { key: 'delivery', open: 2, oldest_at: t - 30 * 3600, overdue: 1, due_soon: 0, limit_seconds: 86400 },
      { key: 'identity', open: 1, oldest_at: t - 40 * 3600, overdue: 0, due_soon: 1, limit_seconds: 172800 },
      { key: 'agents', open: 1, oldest_at: t - 3600, overdue: 0, due_soon: 0, limit_seconds: 259200 },
      { key: 'onboarding', open: 0, oldest_at: null, overdue: 0, due_soon: 0, limit_seconds: 172800 },
      { key: 'privacy', open: 1, oldest_at: t - 5 * 86400, overdue: 0, due_soon: 0, limit_seconds: 2592000 },
      { key: 'invoicing', open: 3, oldest_at: t - 6 * 86400, overdue: 0, due_soon: 3, limit_seconds: 604800 },
    ]);
  }
  async agentDocuments(id) { return ok(s.documents.filter((d) => d.agent_id === id)); }
  async agentAcceptance(id) {
    return ok(id === 'agent-1' ? { version: '2026-11-28-taslak', sha256: 'ab'.repeat(32), locale: 'tr', accepted_at: now() - 3600, current: true } : null);
  }
  async documentFile(staffId, docId) {
    log('documentFile', [staffId, docId]);
    const d = s.documents.find((x) => x.id === docId && x.status === 'uploaded');
    return d ? ok({ file_ref: d.file_ref, agent_id: d.agent_id, kind: d.kind }) : fail('not_found');
  }
  async decideDocument(staffId, docId, input) {
    log('decideDocument', [staffId, docId, input]);
    const d = s.documents.find((x) => x.id === docId);
    if (!d) return fail('not_found');
    if (!['clear', 'has_record', 'mismatch', 'invalid'].includes(input.outcome)) return fail('invalid_outcome');
    if (input.outcome !== 'clear' && !input.note) return fail('invalid_reason');
    if (d.status !== 'uploaded') return fail('already_decided');
    Object.assign(d, { status: input.outcome === 'clear' ? 'verified' : 'rejected', outcome: input.outcome, decided_at: now(), note: input.note ?? null, file_ref: null });
    return ok({ agent_id: d.agent_id });
  }
  async readiness() {
    const need = { legal_service_agreement: 'lawyer', legal_agent_agreement: 'lawyer', legal_privacy: 'lawyer', accounting_setup: 'accountant' };
    const signs = Object.entries(need).map(([key, by]) => {
      const row = s.signoffs[key];
      return { key, kind: 'signoff', by, version: 'v1', ok: Boolean(row), signer: row?.signer ?? null, signed_at: row ? now() : null, signed_version: row ? 'v1' : null, note: row?.note ?? null };
    });
    const all = signs.every((c) => c.ok);
    return ok({ checks: [
      { key: 'company_details', kind: 'auto', ok: true }, { key: 'payout_rule', kind: 'auto', ok: true },
      { key: 'encryption_key', kind: 'auto', ok: true }, { key: 'service_agreement_final', kind: 'auto', ok: false },
      { key: 'agent_agreement_final', kind: 'auto', ok: false }, ...signs,
    ], partners_ready: all, agents_ready: all, enforced: true });
  }
  async signOff(staffId, key, input) {
    log('signOff', [staffId, key, input]);
    if (!input.signer || input.signer.length < 3) return fail('invalid_signer');
    s.signoffs[key] = input;
    return ok(null);
  }
  async withdrawSignoff(staffId, key) { log('withdrawSignoff', [staffId, key]); delete s.signoffs[key]; return ok(null); }
  async accountingMonths() { return ok([{ month: '2026-11', entries: 4, closed: false }, { month: '2026-10', entries: 2, closed: true }]); }
  async accountingMonth(staffId, month) {
    log('accountingMonth', [staffId, month]);
    if (!/^\\d{4}-\\d{2}$/.test(month)) return fail('invalid_month');
    const t = now();
    return ok({ month, closed: month === '2026-10' ? { by: 'admin-1', at: t } : null,
      invoices: [{ id: 'i-1', number: 'EMA2026000000001', issued_at: t, partner: 'Test Bankası A.Ş.', vkn: '1234567890', tax_office: 'Kadıköy', net_kurus: 1000000, kdv_kurus: 200000, total_kurus: 1200000, status: 'issued', cases: 1 }],
      receipts: [{ id: 'r-1', value_date: '2026-11-20', partner: 'Test Bankası A.Ş.', amount_kurus: 1200000, bank_ref: 'REF;1', invoice_number: 'EMA2026000000001' }],
      payouts: [{ id: 'po-1', paid_at: t, agent_id: 'agent-1', name: 'Ali Veli', tckn: '10000000146', address: 'Örnek Mah. No:1 "A" Blok', tax_profile: 'individual', vkn: null, iban: 'TR330006100519786457841326', gross_kurus: 500000, withholding_kurus: 50000, net_kurus: 450000, bank_ref: '=cmd' }],
      journal: [{ entry_id: 'e-1', occurred_at: t, kind: 'invoice', memo: 'Fatura', ref_id: 'i-1', account_code: '120', account_name: 'Alıcılar', debit_kurus: 1200000, credit_kurus: 0 },
        { entry_id: 'e-1', occurred_at: t, kind: 'invoice', memo: 'Fatura', ref_id: 'i-1', account_code: '600', account_name: 'Yurt İçi Satışlar', debit_kurus: 0, credit_kurus: 1200000 }],
      totals: { invoiced_net: 1000000, invoiced_kdv: 200000, received: 1200000, paid_gross: 500000, withheld: 50000, paid_net: 450000, debit: 1200000, credit: 1200000 },
      withholding: [{ tax_profile: 'individual', payouts: 1, gross_kurus: 500000, withheld_kurus: 50000 }],
      incomplete: [{ agent_id: 'agent-2', name: null, missing: ['name', 'address'] }] });
  }
  async closeMonth(staffId, month) { log('closeMonth', [staffId, month]); return month >= '2026-11' ? fail('month_not_over') : ok(null); }
  async returnApplication(staffId, id, reason) {
    log('returnApplication', [staffId, id, reason]);
    const a = s.agents.find((x) => x.user_id === id);
    if (!a || a.status !== 'kyc_pending') return fail('agent_not_ready');
    a.status = 'applied';
    a.review_note = reason;
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
  async confirmDelivery(staffId, claimId, checks = []) {
    log('confirmDelivery', [staffId, claimId, checks]);
    if (s.settings.review_checklist === 1 && checks.length !== 4) return fail('checklist_incomplete');
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
  async reportError(event, detail) { log('reportError', [event, detail]); }
  async heartbeat(name, error) { log('heartbeat', [name, error]); }
  async kycChecks(agentId) {
    return ok(s.videoCalls?.[agentId] ? [{ kind: 'video_call', provider: 'staff', result: s.videoCalls[agentId], reviewed_by: 'admin-1', created_at: now() }]
      : [{ kind: 'id_registry', provider: 'nvi-kps', result: 'review', reviewed_by: null, created_at: now() - 60 }]);
  }
  async devMode() {
    return ok({ active: s.dev != null, until: s.dev ?? null });
  }
  async setDevMode(staffId, on) {
    log('setDevMode', [staffId, on]);
    s.dev = on ? now() + 43200 : null;
    return ok({ active: on, until: s.dev });
  }
  async activationChecklist(agentId) {
    log('activationChecklist', [agentId]);
    return ok(s.activation ?? { items: [], ready: false });
  }
  async recordVideoCall(staffId, agentId, passed, activate) {
    log('recordVideoCall', [staffId, agentId, passed]);
    s.videoCalls = { ...(s.videoCalls ?? {}), [agentId]: passed ? 'passed' : 'failed' };
    if (passed && activate) {
      if (s.activateBlocked) return ok({ activated: false, blocked: s.activateBlocked });
      return ok({ activated: true, blocked: null });
    }
    return ok({ activated: false, blocked: null });
  }
  async privacySearch(staffId, term) {
    log('privacySearch', [staffId, term]);
    if (term.length < 3) return fail('invalid_search');
    const none = { vehicle: null, agent: null, evidence: [], onboardings: [] };
    if (term === 'nobody@example.com') return ok(none);
    if (term.includes('@')) return ok({ ...none,
      agent: { user_id: 'agent-1', status: 'active', legal_name: 'Ali Veli', email: term, phone: '+905321234567', sightings: 2, payouts: 1 },
      onboardings: [{ id: 'ob-signed', company: 'Örnek Bank', contact_name: 'Ayşe Yılmaz', contact_email: term, status: 'signed',
        documents: [{ id: 'd-1', kind: 'signature_circular', file_name: 'imza.pdf', erased: s.erased?.has('d-1') ? 'due' : 'no' }] }] });
    return ok({ ...none,
      vehicle: { id: 'v-1', plate: '34ABC123', vin: 'VF1RJA00061234567', cases: [
        { id: 'c-1', partner: 'Test Bankası A.Ş.', external_ref: 'K-1', status: 'withdrawn', places: 2, addresses: 1 },
        { id: 'c-5', partner: 'Test Bankası A.Ş.', external_ref: 'K-5', status: 'active', places: 1, addresses: 1 }] },
      evidence: [
        { id: 'e-1', claim_id: 'cl-1', kind: 'scene', about: 'vehicle', created_at: now() - 900, delivered: true, erased: s.erased?.has('e-1') ? 'due' : 'no' },
        { id: 'e-2', claim_id: 'cl-2', kind: 'police_report', about: 'document', created_at: now() - 800, delivered: false, erased: 'yes' }] });
  }
  async eraseEvidence(staffId, id, reason) { log('eraseEvidence', [staffId, id, reason]); if (!reason) return fail('invalid_reason'); (s.erased ??= new Set()).add(id); return ok(null); }
  async eraseDocument(staffId, id, reason) { log('eraseDocument', [staffId, id, reason]); if (!reason) return fail('invalid_reason'); (s.erased ??= new Set()).add(id); return ok(null); }
  async redactCasePlaces(staffId, id, reason) { log('redactCasePlaces', [staffId, id, reason]); if (!reason) return fail('invalid_reason'); if (id === 'c-5') return fail('case_open'); return ok({ places: 1 }); }
  async privacyRequests() {
    return ok(s.requests ?? (s.requests = [
      { id: 'pr-1', kind: 'erasure', subject_kind: 'vehicle', subject_ref: '34ABC123', channel: 'KEP', note: null, received_at: now() - 40 * 86400, due_at: now() - 10 * 86400, status: 'open', outcome: null, closed_at: null },
      { id: 'pr-5', kind: 'erasure', subject_kind: 'agent', subject_ref: 'agent-1', channel: 'saha', note: null, received_at: now() - 86400, due_at: now() + 29 * 86400, status: 'open', outcome: null, closed_at: null },
      { id: 'pr-6', kind: 'erasure', subject_kind: 'agent', subject_ref: 'agent-9', channel: 'saha', note: null, received_at: now() - 86400, due_at: now() + 29 * 86400, status: 'withdrawn', outcome: null, closed_at: now() },
      { id: 'pr-2', kind: 'access', subject_kind: 'agent', subject_ref: 'ali@example.com', channel: 'Email', note: null, received_at: now() - 86400, due_at: now() + 29 * 86400, status: 'open', outcome: null, closed_at: null },
      { id: 'pr-3', kind: 'objection', subject_kind: 'contact', subject_ref: 'x@example.com', channel: 'Post', note: null, received_at: now() - 90 * 86400, due_at: now() - 60 * 86400, status: 'refused', outcome: 'Not a data subject', closed_at: now() - 70 * 86400 },
      { id: 'pr-4', kind: 'correction', subject_kind: 'other', subject_ref: 'y@example.com', channel: 'Email', note: null, received_at: now() - 90 * 86400, due_at: now() - 60 * 86400, status: 'done', outcome: 'Corrected', closed_at: now() - 80 * 86400 }]));
  }
  async openPrivacyRequest(staffId, input) { log('openPrivacyRequest', [staffId, input]); if (!input.subjectRef || !input.channel) return fail('invalid_request'); return ok({ id: 'pr-9', due_at: now() + 30 * 86400 }); }
  async closePrivacyRequest(staffId, id, input) { log('closePrivacyRequest', [staffId, id, input]); if (!input.outcome) return fail('invalid_request'); return ok(null); }
  // ---- Requests to agents, erasure, the sealed archive ----
  async agentRequests(id) { return ok(asksOf().filter((r) => r.agent_id === id)); }
  async askAgent(staffId, id, asks) {
    log('askAgent', [staffId, id, asks]);
    if (asks.length === 0 || asks.some((a) => !a.kind || !a.subject)) return fail('invalid_request');
    if (asks.some((a) => a.note.length < 5)) return fail('invalid_reason');
    const agent = s.agents.find((a) => a.user_id === id);
    if (!agent) return fail('not_found');
    for (const a of asks) asksOf().push({ id: 'ar-' + (asksOf().length + 1), agent_id: id, kind: a.kind, subject: a.subject, note: a.note,
      status: 'open', answer: null, document_id: null, created_at: now(), due_at: now() + 14 * 86400, answered_at: null, closed_at: null });
    const returned = agent.status === 'kyc_pending';
    if (returned) agent.status = 'applied';
    return ok({ ids: ['ar-new'], returned });
  }
  async settleAgentRequest(staffId, requestId, status) {
    log('settleAgentRequest', [staffId, requestId, status]);
    const r = asksOf().find((x) => x.id === requestId);
    if (!r) return fail('not_found');
    if (status === 'accepted' && r.status !== 'answered') return fail('request_not_open');
    r.status = status;
    return ok({ agent_id: r.agent_id });
  }
  async askAgentAgain(staffId, requestId, note) {
    log('askAgentAgain', [staffId, requestId, note]);
    const r = asksOf().find((x) => x.id === requestId);
    if (!r || r.status !== 'answered') return fail('request_not_open');
    if (note.length < 5) return fail('invalid_reason');
    r.status = 'open'; r.note = note;
    return ok({ agent_id: r.agent_id, note });
  }
  async answeredRequests() {
    return ok(asksOf().filter((r) => r.status === 'answered').map((r) => ({ id: r.id, agent_id: r.agent_id, legal_name: 'Ali Veli',
      agent_status: 'applied', kind: r.kind, subject: r.subject, answered_at: r.answered_at })));
  }
  async erasureOverview(id) {
    return ok({ request: id === 'agent-1' && !s.erasureClosed ? { id: 'pr-5', status: 'open', received_at: now() - 86400, due_at: now() + 29 * 86400, outcome: null, closed_at: null } : null,
      blockers: { open_claims: 1, payouts_pending: s.payoutsPending ?? 0, payouts_sent: 2 } });
  }
  async supportTickets(filter) {
    log('supportTickets', [filter]);
    const all = s.tickets ?? [];
    return ok(all.filter((t) => (filter.status === 'active' ? t.status !== 'closed' : !filter.status || t.status === filter.status)).filter((t) => !filter.kind || t.requester_kind === filter.kind).filter((t) => !filter.mine || t.assigned_to === filter.mine));
  }
  async supportTicket(id) {
    const t = (s.tickets ?? []).find((x) => x.id === id);
    if (!t) return fail('not_found');
    return ok({ ticket: t, messages: s.ticketMessages?.[id] ?? [] });
  }
  async supportReply(staffId, id, body, note) {
    log('supportReply', [staffId, id, body, Boolean(note)]);
    const t = (s.tickets ?? []).find((x) => x.id === id);
    if (!t) return fail('not_found');
    if (body.trim().length < 2) return fail('invalid_message');
    s.ticketMessages = { ...(s.ticketMessages ?? {}), [id]: [...(s.ticketMessages?.[id] ?? []), { id: 'm' + String(Math.random()), author_kind: note ? 'note' : 'staff', body, created_at: now() }] };
    if (!note) t.status = 'answered';
    return ok(null);
  }
  async supportAssign(staffId, id, to) {
    log('supportAssign', [staffId, id, to]);
    const t = (s.tickets ?? []).find((x) => x.id === id);
    if (!t) return fail('not_found');
    t.assigned_to = to;
    return ok(null);
  }
  async supportClose(staffId, id, closed) {
    log('supportClose', [staffId, id, closed]);
    const t = (s.tickets ?? []).find((x) => x.id === id);
    if (!t) return fail('not_found');
    t.status = closed ? 'closed' : 'open';
    return ok(null);
  }
  async retentionOverview() {
    return ok({
      rows: [
        { key: 'failed_evidence', days: 30, due: 2, held: 0 },
        { key: 'delivered_evidence', days: 3650, due: 0, held: 0 },
        { key: 'abandoned_documents', days: 90, due: 1, held: 0 },
        { key: 'partner_documents', days: 3650, due: 0, held: 0 },
        { key: 'agent_documents', days: 90, due: 0, held: 0 },
        { key: 'case_places', days: 30, due: 5, held: 1 },
        { key: 'archive', days: 3650, due: 0, held: 0 },
        { key: 'support', days: 730, due: 0, held: 0 },
      ],
      files_waiting: 3,
      open_holds: 1,
    });
  }
  async holds() {
    return ok(s.holds ?? []);
  }
  async placeHold(staffId, kind, ref, reason) {
    log('placeHold', [staffId, kind, ref, reason]);
    if ((s.holds ?? []).some((h) => h.subject_ref === ref && h.released_at === null)) {
      return fail('already_held');
    }
    const hold = { id: 'hold-' + String((s.holds ?? []).length + 1), subject_kind: kind, subject_ref: ref, reason, set_by: 'staff:' + staffId, set_at: now(), released_by: null, released_at: null, release_reason: null };
    s.holds = [...(s.holds ?? []), hold];
    return ok({ id: hold.id });
  }
  async releaseHold(staffId, id, reason) {
    log('releaseHold', [staffId, id, reason]);
    s.holds = (s.holds ?? []).map((h) => (h.id === id ? { ...h, released_by: 'staff:' + staffId, released_at: now(), release_reason: reason } : h));
    return ok(null);
  }
  async eraseAgent(staffId, id, input) {
    log('eraseAgent', [staffId, id, input]);
    if ((s.payoutsPending ?? 0) > 0) return fail('payouts_pending');
    if (!input.reason || input.reason.length < 3) return fail('invalid_reason');
    const agent = s.agents.find((a) => a.user_id === id);
    if (!agent) return fail('not_found');
    Object.assign(agent, { status: 'banned', legal_name: null, phone: null, iban: null, email: null, city: null, erased_at: now() });
    s.erasureClosed = true;
    return ok({ archive_id: 'arch-1' });
  }
  async refuseErasure(staffId, requestId, reason) {
    log('refuseErasure', [staffId, requestId, reason]);
    if (reason.length < 10) return fail('invalid_reason');
    s.erasureClosed = true;
    return ok({ agent_id: 'agent-1', reason });
  }
  async archives(term = '') {
    const list = archivesOf();
    return ok(term ? list.filter((a) => a.id === term || a.subject_ref === term || term === 'ali@example.com') : list);
  }
  async archiveViews(id) { return ok((s.archiveViews ?? []).filter((v) => v.archive_id === id)); }
  async openArchive(staffId, id, reason) {
    log('openArchive', [staffId, id, reason]);
    const entry = archivesOf().find((a) => a.id === id);
    if (!entry) return fail('not_found');
    if (entry.purged_at) return fail('archive_destroyed');
    if (reason.trim().length < 10) return fail('invalid_reason');
    (s.archiveViews ??= []).push({ archive_id: id, staff_id: staffId, what: 'record', reason: reason.trim(), viewed_at: now() });
    return ok({ entry, payload: { subject: 'agent', account_id: entry.subject_ref, archived_at: entry.archived_at, reason: entry.reason,
      profile: { legal_name: 'Ali Veli', id_number: '10000000146', phone: '+905321234567', email: 'ali@example.com', address: 'Örnek Mah. No:1\\nKadıköy', created_at: now() - 86400 * 90, strikes: 0, vkn: null },
      identity_checks: [{ kind: 'id_registry', provider: 'nvi-kps', result: 'passed', created_at: now() - 86400 * 80 }],
      documents: [{ kind: 'population_record', barcode: 'NVI-1', status: 'uploaded', uploaded_at: now() - 86400 * 80 }, { kind: 'criminal_record', barcode: 'ADL-1', status: 'verified', outcome: 'clear' }],
      acceptances: [{ version: '2026-11-28', sha256: 'a'.repeat(64), locale: 'tr', accepted_at: now() - 86400 * 85 }],
      requests: [], privacy_requests: [{ id: 'pr-5', kind: 'erasure', status: 'done' }] } });
  }
  async archiveHasFile(id, ref) { return ok(archivesOf().some((a) => a.id === id && a.files.some((f) => f.ref === ref))); }
  async openArchiveFile(staffId, id, ref, reason, bytes) {
    log('openArchiveFile', [staffId, id, ref, reason, bytes.byteLength]);
    if (reason.trim().length < 10) return fail('invalid_reason');
    // The stand-in "seal" is a one-byte prefix.
    return ok({ name: 'population_record', type: 'application/pdf', bytes: new Uint8Array(bytes).slice(1) });
  }
  async archiveFilesDue() { return ok(s.archiveDue ?? []); }
  async sealArchiveFile(archiveId, fileRef, bytes) {
    log('sealArchiveFile', [archiveId, fileRef, bytes.byteLength]);
    if (fileRef.includes('refused')) return fail('not_found');
    const out = new Uint8Array(bytes.byteLength + 1); out[0] = 0x45; out.set(new Uint8Array(bytes), 1);
    return ok(out);
  }
  async archiveFileStored(archiveId, fileRef, stored) {
    log('archiveFileStored', [archiveId, fileRef, stored.type, stored.size]);
    s.archiveDue = (s.archiveDue ?? []).filter((f) => f.file_ref !== fileRef);
    (s.archiveStored ??= []).push(stored.ref);
    return ok(null);
  }
  async testArchiveDue(files) { s.archiveDue = files; }
  async testArchiveStored() { return s.archiveStored ?? []; }
  async testPayoutsPending(n) { s.payoutsPending = n; }
  async filesDue() { return ok(s.due ?? [{ file_ref: 'claims/cl-1/e-9', bucket: 'evidence' }, { file_ref: 'onboarding/ob-1/d-9', bucket: 'documents' }]); }
  async filesErased(refs) { log('filesErased', [refs]); s.due = []; return ok({ erased: refs.length }); }
  async ops() {
    const t = now();
    return ok({
      events: [{ id: 'o-1', at: t - 300, source: 'saha', level: 'error', event: 'GET /claims/:id', detail: 'TypeError' },
        { id: 'o-2', at: t - 900, source: 'kurumsal', level: 'warn', event: 'webhook.disabled', detail: 'bank.example' }],
      heartbeats: [{ name: 'core.expireClaims', ok_at: t - 120, failed_at: null, error: null },
        { name: 'core.notices', ok_at: t - 7200, failed_at: t - 60, error: 'D1_ERROR' },
        { name: 'merkez.erase_files', ok_at: t - 7200, failed_at: null, error: null }],
      last_day: [{ source: 'saha', level: 'error', n: 3 }],
      queues: { oldest_review_at: t - 7200, files_due: 2, requests_open: 2, requests_overdue: 1, agents_waiting: 1 } });
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
  async approvalChecklist(staffId, id) {
    const o = s.onboardings.get(id);
    if (!o) return fail('not_found');
    const open = s.signoffsOpen ?? [];
    const items = [
      { key: 'agreement', ok: o.status === 'signed', blocking: true },
      { key: 'details', ok: true, blocking: true },
      { key: 'signoffs', ok: open.length === 0, blocking: true, detail: open },
      { key: 'four_eyes', ok: o.invited_by !== staffId, blocking: true },
    ];
    return ok({ items, ready: items.every((i) => i.ok) });
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
  async testActivation(value) { s.activation = value; }
  async testSignoffsOpen(list) { s.signoffsOpen = list; }
  async testActivateBlocked(code) { s.activateBlocked = code; }
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
