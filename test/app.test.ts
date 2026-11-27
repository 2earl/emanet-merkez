import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { ORIGIN, callback, callsOf, coreHooks, post, request, signIn } from './helpers';

beforeEach(async () => {
  await coreHooks().testReset();
});

describe('public pages', () => {
  it('serves the start page, robots.txt and the client metadata', async () => {
    const home = await request('/');
    expect(home.status).toBe(200);
    expect(await home.text()).toContain('Sign in with 2earl');
    expect(home.headers.get('Content-Security-Policy')).toContain("default-src 'none'");
    expect(home.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(await (await request('/robots.txt')).text()).toContain('Disallow: /');
    const client = await (await request('/oauth/client.json')).json<Record<string, unknown>>();
    expect(client.client_id).toBe(`${ORIGIN}/oauth/client.json`);
    expect(client.scope).toBe('emanet:control');
  });

  it('always asks login for a second factor', async () => {
    const start = await request('/signin');
    const location = new URL(start.headers.get('Location') ?? '');
    expect(location.origin).toBe('https://login.2earl.com');
    expect(location.searchParams.get('acr_values')).toBe('urn:2earl:aal2');
    expect(location.searchParams.get('resource')).toBe(ORIGIN);
  });
});

describe('who gets in', () => {
  it('sends people who are not signed in to sign in', async () => {
    const response = await request('/money');
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/signin?return=%2Fmoney');
  });

  it('refuses a sign-in without a second factor', async () => {
    const response = await callback('admin-1');
    expect(response.status).toBe(403);
    expect(await response.text()).toContain('needs your second factor');
  });

  it('refuses people who are not staff', async () => {
    const cookie = await signIn('outsider!aal2');
    for (const path of ['/', '/reviews', '/money']) {
      const response = await request(path, { headers: { Cookie: cookie } });
      expect(response.status).toBe(403);
      expect(await response.text()).toContain('Staff only');
    }
  });

  it('refuses forms from other sites', async () => {
    const cookie = await signIn('admin-1!aal2');
    const response = await post(
      '/partners',
      cookie,
      { org_id: 'x' },
      { Origin: 'https://evil.example' },
    );
    expect(response.status).toBe(403);
    expect(await callsOf('createPartner')).toEqual([]);
  });

  it('serves every staff page', async () => {
    const cookie = await signIn('support-1!aal2');
    for (const path of [
      '/',
      '/reviews',
      '/reviews?kind=delivery',
      '/reviews/r-vin',
      '/reviews/r-plate',
      '/reviews/r-del',
      '/partners',
      '/partners/p-1',
      '/agents',
      '/agents?status=kyc_pending',
      '/agents/agent-1',
      '/money',
      '/money?partner=p-1',
      '/money/ledger',
      '/settings',
    ]) {
      const response = await request(path, { headers: { Cookie: cookie } });
      expect(response.status, path).toBe(200);
      const html = await response.text();
      expect(html, path).toContain('Emanet Merkez');
      expect(html, path).toContain('Support');
    }
    const missing = await request('/reviews/nope', { headers: { Cookie: cookie } });
    expect(missing.status).toBe(404);
  });
});

describe('reviews', () => {
  it('lets support accept an identity review with a VIN', async () => {
    const cookie = await signIn('support-1!aal2');
    const response = await post('/reviews/r-vin/accept', cookie, { vin: 'vf1r ja00061234567' });
    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toBe('/reviews?done=accepted');
    expect(await callsOf('resolveIdentity')).toEqual([
      ['support-1', 'r-vin', { action: 'accept', vin: 'VF1RJA00061234567' }],
    ]);
  });

  it('shows the core’s error when the VIN is wrong', async () => {
    const cookie = await signIn('support-1!aal2');
    const response = await post('/reviews/r-vin/accept', cookie, { vin: 'nope' });
    expect(response.status).toBe(422);
    expect(await response.text()).toContain('17 letters and digits');
  });

  it('rejects with a reason', async () => {
    const cookie = await signIn('support-1!aal2');
    const response = await post('/reviews/r-plate/reject', cookie, { reason: 'Wrong vehicle' });
    expect(response.headers.get('Location')).toBe('/reviews?done=rejected');
  });

  it('lets only owners and admins confirm deliveries', async () => {
    const support = await signIn('support-1!aal2');
    expect((await post('/reviews/r-del/deliver', support)).status).toBe(403);
    const page = await (await request('/reviews/r-del', { headers: { Cookie: support } })).text();
    expect(page).not.toContain('Confirm the vehicle is in custody');
    // It creates money owed: a second factor from the last 15 minutes.
    const old = await signIn('admin-1!old');
    expect((await post('/reviews/r-del/deliver', old)).headers.get('Location')).toBe(
      '/signin?second_factor=1&return=%2Freviews%2Fr-del',
    );
    const oldPage = await (await request('/reviews/r-del', { headers: { Cookie: old } })).text();
    expect(oldPage).not.toContain('Confirm the vehicle is in custody');
    expect(oldPage).toContain('Confirm it’s you');
    expect(await callsOf('confirmDelivery')).toEqual([]);
    const admin = await signIn('admin-1!aal2');
    const response = await post('/reviews/r-del/deliver', admin);
    expect(response.headers.get('Location')).toBe('/reviews?done=delivered');
    expect(await callsOf('confirmDelivery')).toEqual([['admin-1', 'cl-1']]);
  });

  it('shows what to look at twice, and doesn’t accept a delivery with a reason', async () => {
    const support = await signIn('support-1!aal2');
    expect((await post('/reviews/r-del/dismiss', support, { reason: 'x' })).status).toBe(403);
    const admin = await signIn('admin-1!aal2');
    const page = await (await request('/reviews/r-del', { headers: { Cookie: admin } })).text();
    expect(page).toContain('Before you decide');
    expect(page).toContain('7.4 km');
    expect(page).toContain('Look twice');
    expect(page).toContain('Don’t accept this delivery');
    expect((await post('/reviews/r-del/dismiss', admin, { reason: '' })).status).toBe(422);
    expect((await post('/reviews/r-vin/dismiss', admin, { reason: 'x' })).status).toBe(404);
    const response = await post('/reviews/r-del/dismiss', admin, {
      reason: 'The receipt shows another plate',
      strike: '1',
    });
    expect(response.headers.get('Location')).toBe('/reviews?done=dismissed');
    expect((await callsOf('rejectDelivery')).at(-1)).toEqual([
      'admin-1',
      'cl-1',
      // The rule mistakes this key for String.prototype.strike.
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      { reason: 'The receipt shows another plate', strike: true },
    ]);
  });

  it('serves evidence only for an open delivery review', async () => {
    const cookie = await signIn('support-1!aal2');
    await env.EVIDENCE.put('claims/cl-1/e-1', new Uint8Array([0xff, 0xd8, 0xff]), {
      httpMetadata: { contentType: 'image/jpeg' },
    });
    const image = await request('/reviews/r-del/evidence/e-1', { headers: { Cookie: cookie } });
    expect(image.status).toBe(200);
    expect(image.headers.get('Content-Type')).toBe('image/jpeg');
    expect(image.headers.get('Cache-Control')).toBe('private, no-store');
    expect(new Uint8Array(await image.arrayBuffer())).toEqual(new Uint8Array([0xff, 0xd8, 0xff]));
    expect(
      (await request('/reviews/r-vin/evidence/e-1', { headers: { Cookie: cookie } })).status,
    ).toBe(404);
    expect(
      (await request('/reviews/r-del/evidence/e-2', { headers: { Cookie: cookie } })).status,
    ).toBe(404);
    // Without staff access, nothing.
    expect((await request('/reviews/r-del/evidence/e-1')).status).toBe(302);
  });
});

describe('partners', () => {
  it('adds a partner, and refuses one already there', async () => {
    const cookie = await signIn('admin-1!old');
    const form = {
      org_id: 'org-9',
      kind: 'vys',
      legal_name: 'Yeni Varlık A.Ş.',
      vkn: '9876543210',
      tax_office: 'Şişli',
      kep_address: '',
      reconfirm_days: '21',
      e_invoice: '1',
    };
    const created = await post('/partners', cookie, form);
    expect(created.status).toBe(303);
    expect(created.headers.get('Location')).toBe('/partners/p-2?done=saved');
    expect((await callsOf('createPartner'))[0]).toEqual([
      'admin-1',
      {
        orgId: 'org-9',
        kind: 'vys',
        legalName: 'Yeni Varlık A.Ş.',
        vkn: '9876543210',
        taxOffice: 'Şişli',
        eInvoice: true,
        reconfirmDays: 21,
      },
    ]);
    const again = await post('/partners', cookie, form);
    expect(again.status).toBe(409);
    expect(await again.text()).toContain('already a partner');
  });

  it('keeps support from changing partners', async () => {
    const cookie = await signIn('support-1!aal2');
    expect((await post('/partners', cookie, { org_id: 'org-9' })).status).toBe(403);
    expect((await post('/partners/p-1/status', cookie, { status: 'suspended' })).status).toBe(403);
  });

  it('saves a price list from the form, only with a fresh second factor', async () => {
    const old = await signIn('admin-1!old');
    const page = await (await request('/partners/p-1', { headers: { Cookie: old } })).text();
    expect(page).toContain('Confirm it’s you');
    const stale = await post('/partners/p-1/prices', old, { default: '10000', rules: '' });
    expect(stale.status).toBe(303);
    expect(stale.headers.get('Location')).toBe('/signin?second_factor=1&return=%2Fpartners%2Fp-1');

    const fresh = await signIn('admin-1!aal2');
    const saved = await post('/partners/p-1/prices', fresh, {
      default: '10.000,00',
      rules: 'Renault;*;;;12.500\nToyota;Corolla;2020;2024;15000,50\n',
    });
    expect(saved.headers.get('Location')).toBe('/partners/p-1?done=saved');
    expect(await callsOf('setPriceList')).toEqual([
      [
        'admin-1',
        'p-1',
        {
          default_kurus: 1_000_000,
          rules: [
            { fee_kurus: 1_250_000, make: 'Renault' },
            {
              fee_kurus: 1_500_050,
              make: 'Toyota',
              model: 'Corolla',
              year_from: 2020,
              year_to: 2024,
            },
          ],
        },
      ],
    ]);
    const bad = await post('/partners/p-1/prices', fresh, {
      default: '10000',
      rules: 'Renault;12500',
    });
    expect(bad.status).toBe(422);
    expect(await bad.text()).toContain('Line 1 isn’t Make;Model;From;To;Fee.');
  });

  it('activates, edits, and defines and retires fields', async () => {
    const cookie = await signIn('owner-1!old');
    expect(
      (await post('/partners/p-1/status', cookie, { status: 'suspended' })).headers.get('Location'),
    ).toBe('/partners/p-1?done=suspended');
    const edited = await post('/partners/p-1', cookie, {
      legal_name: 'Test Bankası A.Ş.',
      vkn: '12',
      reconfirm_days: '14',
    });
    expect(edited.status).toBe(422);
    expect(await edited.text()).toContain('10 digits');
    const field = await post('/partners/p-1/fields', cookie, {
      entity: 'vehicle',
      key: 'branch',
      label_tr: 'Şube',
      label_en: 'Branch',
      type: 'enum',
      visibility: 'admin',
      enum_values: 'Kadıköy, Şişli',
      required: '1',
    });
    expect(field.headers.get('Location')).toBe('/partners/p-1?done=saved');
    expect((await callsOf('defineField'))[0]?.[1]).toEqual({
      partnerId: 'p-1',
      entity: 'vehicle',
      key: 'branch',
      labelTr: 'Şube',
      labelEn: 'Branch',
      type: 'enum',
      required: true,
      pii: false,
      visibility: 'admin',
      enumValues: ['Kadıköy', 'Şişli'],
    });
    expect((await post('/partners/p-1/fields/f-1/retire', cookie)).headers.get('Location')).toBe(
      '/partners/p-1?done=saved',
    );
  });
});

describe('agents', () => {
  it('shows an agent’s details and changes their status with a reason', async () => {
    // Activating lets the agent read addresses: a second factor from the last 15 minutes.
    const old = await signIn('admin-1!old');
    expect(
      (await post('/agents/agent-1/status', old, { status: 'active', reason: 'x' })).headers.get(
        'Location',
      ),
    ).toBe('/signin?second_factor=1&return=%2Fagents%2Fagent-1');
    const cookie = await signIn('admin-1!aal2');
    const page = await (await request('/agents/agent-1', { headers: { Cookie: cookie } })).text();
    expect(page).toContain('tel:+905321234567');
    expect(page).toContain('TR330006100519786457841326');
    expect(page).toContain('Identity check');
    expect(
      (await post('/agents/agent-1/status', cookie, { status: 'active', reason: '' })).status,
    ).toBe(422);
    const response = await post('/agents/agent-1/status', cookie, {
      status: 'active',
      reason: 'KYC passed',
    });
    expect(response.headers.get('Location')).toBe('/agents/agent-1?done=saved');
    expect(await callsOf('setAgentStatus')).toEqual([
      ['admin-1', 'agent-1', 'active', 'KYC passed'],
    ]);
    expect((await request('/agents/nobody', { headers: { Cookie: cookie } })).status).toBe(404);
  });

  it('verifies the IBAN that was checked, with a fresh second factor', async () => {
    const old = await signIn('admin-1!old');
    expect(await (await request('/agents/agent-1', { headers: { Cookie: old } })).text()).toContain(
      'Confirm it’s you',
    );
    const stale = await post('/agents/agent-1/iban', old, {
      iban: 'TR330006100519786457841326',
      checked: '1',
    });
    expect(stale.headers.get('Location')).toBe(
      '/signin?second_factor=1&return=%2Fagents%2Fagent-1',
    );
    const support = await signIn('support-1!aal2');
    expect((await post('/agents/agent-1/iban', support, { iban: 'x', checked: '1' })).status).toBe(
      403,
    );
    const fresh = await signIn('admin-1!aal2');
    expect(
      (await post('/agents/agent-1/iban', fresh, { iban: 'TR330006100519786457841326' })).status,
    ).toBe(422);
    const changed = await post('/agents/agent-1/iban', fresh, {
      iban: 'TR320010009999901234567890',
      checked: '1',
    });
    expect(changed.status).toBe(409);
    expect(await changed.text()).toContain('changed their IBAN');
    const ok = await post('/agents/agent-1/iban', fresh, {
      iban: 'TR330006100519786457841326',
      checked: '1',
    });
    expect(ok.headers.get('Location')).toBe('/agents/agent-1?done=saved');
    expect(await callsOf('verifyIban')).toEqual([
      ['admin-1', 'agent-1', 'TR320010009999901234567890'],
      ['admin-1', 'agent-1', 'TR330006100519786457841326'],
    ]);
  });
});

describe('money', () => {
  it('asks for a fresh second factor before any money form', async () => {
    const old = await signIn('admin-1!old');
    const page = await (await request('/money', { headers: { Cookie: old } })).text();
    expect(page).toContain('Confirm it’s you');
    expect(page).not.toContain('Record payment');
    const response = await post('/money/payouts/po-small/order', old);
    expect(response.headers.get('Location')).toBe('/signin?second_factor=1&return=%2Fmoney');
    expect(await callsOf('orderPayout')).toEqual([]);
    const support = await signIn('support-1!aal2');
    expect((await post('/money/invoices', support, { partner_id: 'p-1' })).status).toBe(403);
  });

  it('orders a small payout in one step, and a large one with two admins', async () => {
    const first = await signIn('admin-1!aal2');
    expect((await post('/money/payouts/po-small/order', first)).headers.get('Location')).toBe(
      '/money?done=approved#payouts',
    );
    expect((await post('/money/payouts/po-big/order', first)).headers.get('Location')).toBe(
      '/money?done=waiting#payouts',
    );
    const page = await (await request('/money', { headers: { Cookie: first } })).text();
    expect(page).toContain('Waiting for a second admin');
    const twice = await post('/money/payouts/po-big/order', first);
    expect(twice.status).toBe(422);
    expect(await twice.text()).toContain('A second admin, not you');
    const second = await signIn('admin-2!aal2');
    expect((await post('/money/payouts/po-big/order', second)).headers.get('Location')).toBe(
      '/money?done=approved#payouts',
    );
    expect((await post('/money/payouts/po-big/sent', second, { bank_ref: '' })).status).toBe(422);
    expect(
      (await post('/money/payouts/po-big/sent', second, { bank_ref: 'EFT-123' })).headers.get(
        'Location',
      ),
    ).toBe('/money?done=sent#payouts');
  });

  it('records a partner’s payment once', async () => {
    const cookie = await signIn('owner-1!aal2');
    const form = {
      invoice_id: 'i-1',
      amount: '12.000,00',
      value_date: '2026-11-20',
      bank_ref: 'HVL-1',
    };
    expect((await post('/money/receipts', cookie, form)).headers.get('Location')).toBe(
      '/money?done=received',
    );
    expect(await callsOf('recordReceipt')).toEqual([
      [
        'owner-1',
        {
          partnerId: 'p-1',
          invoiceId: 'i-1',
          amountKurus: 1_200_000,
          valueDate: '2026-11-20',
          bankRef: 'HVL-1',
          source: 'manual',
        },
      ],
    ]);
    const again = await post('/money/receipts', cookie, form);
    expect(again.status).toBe(409);
    expect(await again.text()).toContain('already recorded');
    expect((await post('/money/receipts', cookie, { ...form, amount: 'abc' })).status).toBe(422);
  });

  it('issues an invoice', async () => {
    const cookie = await signIn('owner-1!aal2');
    expect(
      (await post('/money/invoices', cookie, { partner_id: 'p-1' })).headers.get('Location'),
    ).toBe('/money?done=invoiced');
    const nothing = await post('/money/invoices', cookie, { partner_id: 'p-1' });
    expect(nothing.status).toBe(422);
    expect(await nothing.text()).toContain('Nothing to invoice');
  });

  it('records the e-invoice number on an invoice', async () => {
    const admin = await signIn('admin-1!aal2');
    const page = await (await request('/money', { headers: { Cookie: admin } })).text();
    expect(page).toContain('/money/invoices/i-1/number');
    expect((await post('/money/invoices/i-1/number', admin, { number: 'a b' })).status).toBe(422);
    expect(
      (await post('/money/invoices/i-9/number', admin, { number: 'EMA2026000000001' })).status,
    ).toBe(422);
    const saved = await post('/money/invoices/i-1/number', admin, { number: 'ema2026000000001' });
    expect(saved.headers.get('Location')).toBe('/money?done=numbered#invoices');
    const after = await (await request('/money', { headers: { Cookie: admin } })).text();
    expect(after).toContain('EMA2026000000001');
    const support = await signIn('support-1!aal2');
    expect((await post('/money/invoices/i-1/number', support, { number: 'X123' })).status).toBe(
      403,
    );
  });

  it('shows a balanced trial balance', async () => {
    const cookie = await signIn('support-1!aal2');
    const page = await (await request('/money/ledger', { headers: { Cookie: cookie } })).text();
    expect(page).toContain('Balanced');
  });
});

describe('settings', () => {
  it('saves only the settings that changed, in their stored units', async () => {
    const cookie = await signIn('admin-1!aal2');
    const response = await post('/settings', cookie, {
      claim_hours: '48',
      reporting_hours: '12',
      cooldown_hours: '72',
      max_active_claims: '3',
      kdv_bp: '20',
      dual_approval_kurus: '25.000,00',
      withholding_individual_bp: '1,5',
      withholding_sole_trader_bp: '0',
      withholding_company_bp: '0',
    });
    expect(response.headers.get('Location')).toBe('/settings?done=saved');
    expect(await callsOf('setSetting')).toEqual([
      ['admin-1', 'claim_hours', 48],
      ['admin-1', 'withholding_individual_bp', 150],
    ]);
    const bad = await post('/settings', cookie, { claim_hours: '0' });
    expect(bad.status).toBe(422);
  });

  it('saves a payout rule with a share or a fixed amount, not both', async () => {
    const cookie = await signIn('admin-1!aal2');
    const both = await post('/settings/payout-rule', cookie, {
      share: '50',
      fixed: '5000',
      min: '',
      max: '',
    });
    expect(both.status).toBe(422);
    const response = await post('/settings/payout-rule', cookie, {
      share: '45',
      fixed: '',
      min: '2.000',
      max: '20000',
    });
    expect(response.headers.get('Location')).toBe('/settings?done=saved');
    expect(await callsOf('setPayoutRule')).toEqual([
      ['admin-1', { share_bp: 4500, min_kurus: 200_000, max_kurus: 2_000_000 }],
    ]);
  });
});

describe('audit', () => {
  it('shows the log to staff only, filtered and paged', async () => {
    expect((await request('/audit')).headers.get('Location')).toBe('/signin?return=%2Faudit');
    const outsider = await signIn('outsider!aal2');
    expect((await request('/audit', { headers: { Cookie: outsider } })).status).toBe(403);
    const support = await signIn('support-1!aal2');
    const page = await (await request('/audit', { headers: { Cookie: support } })).text();
    expect(page).toContain('delivery.rejected');
    expect(page).toContain('/audit?actor=staff%3Aadmin-1');
    expect(page).toContain('Older');
    const filtered = await request('/audit?subject=case:c-1', { headers: { Cookie: support } });
    const text = await filtered.text();
    expect(text).toContain('case.created');
    expect(text).not.toContain('delivery.rejected');
    expect((await callsOf('audit')).at(-1)).toEqual([
      'support-1',
      { subject: 'case:c-1', limit: 100 },
    ]);
    expect(
      (await request('/audit?subject=%3Cscript%3E', { headers: { Cookie: support } })).status,
    ).toBe(422);
  });
});
