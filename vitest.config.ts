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
      && form.get('resource') === 'https://emanet-merkez.2earl.com'
      && form.get('client_id') === 'https://emanet-merkez.2earl.com/oauth/client.json'
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
      reconfirm_days: 14, created_at: t - 86400 * 30, active_cases: 3, delivered_cases: 1 }]]),
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
          icra_office: 'İzmir 3. İcra Dairesi', icra_file_no: '2026/77' }] }],
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
  };
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
