import { env, exports } from 'cloudflare:workers';
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
      '/partners/p-1/status',
      cookie,
      { status: 'suspended' },
      { Origin: 'https://evil.example' },
    );
    expect(response.status).toBe(403);
    expect(await callsOf('setPartnerStatus')).toEqual([]);
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
    // Not without the checklist: every point ticked.
    const partly = await post('/reviews/r-del/deliver', admin, { check_plate_matches: '1' });
    expect(partly.status).toBe(422);
    expect(await partly.text()).toContain('Tick every point of the checklist');
    const checks = {
      check_plate_matches: '1',
      check_custody_receipt: '1',
      check_place_plausible: '1',
      check_photos_original: '1',
    };
    const response = await post('/reviews/r-del/deliver', admin, checks);
    expect(response.headers.get('Location')).toBe('/reviews?done=delivered');
    expect((await callsOf('confirmDelivery')).at(-1)).toEqual([
      'admin-1',
      'cl-1',
      ['plate_matches', 'custody_receipt', 'place_plausible', 'photos_original'],
    ]);
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
  it('has no way to add a partner outside onboarding', async () => {
    const cookie = await signIn('admin-1!aal2');
    const page = await (await request('/partners', { headers: { Cookie: cookie } })).text();
    expect(page).not.toContain('name="org_id"');
    expect(page).toContain('href="/onboarding"');
    const posted = await post('/partners', cookie, {
      org_id: 'org-9',
      legal_name: 'Kestirme A.Ş.',
    });
    expect(posted.status).toBe(404);
  });

  it('keeps support from changing partners', async () => {
    const cookie = await signIn('support-1!aal2');
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

  it('shows every setting with its explanation, default and range, grouped', async () => {
    const cookie = await signIn('admin-1!aal2');
    const page = await (await request('/settings', { headers: { Cookie: cookie } })).text();
    for (const group of [
      'search',
      'review',
      'agents',
      'partners',
      'money',
      'privacy',
      'operations',
    ])
      expect(page).toContain(`id="g-${group}"`);
    expect(page).toContain('id="s-strike_limit"');
    expect(page).toContain('Default: 24 hours · Allowed: 1 – 336 hours');
    expect(page).toContain('name="review_checklist"');
    // The legal ceiling is in the range the page shows.
    expect(page).toContain('Default: 30 days · Allowed: 1 – 30 days');
  });

  it('saves one group without touching the others, switches included, and resets to the default', async () => {
    const cookie = await signIn('admin-1!aal2');
    const saved = await post('/settings', cookie, { strike_limit: '5', agent_mail: '0' });
    expect(saved.headers.get('Location')).toBe('/settings?done=saved');
    expect(await callsOf('setSetting')).toEqual([
      ['admin-1', 'strike_limit', 5],
      ['admin-1', 'agent_mail', 0],
    ]);
    const page = await (await request('/settings', { headers: { Cookie: cookie } })).text();
    expect(page).toContain('form="reset-strike_limit"');
    const reset = await post('/settings/reset', cookie, { key: 'strike_limit' });
    expect(reset.headers.get('Location')).toBe('/settings?done=reset#s-strike_limit');
    expect(await callsOf('resetSetting')).toEqual([['admin-1', 'strike_limit']]);
    expect((await post('/settings/reset', cookie, { key: 'nope' })).status).toBe(422);
    // Out of range is refused with the setting's name.
    const high = await post('/settings', cookie, { privacy_request_days: '45' });
    expect(high.status).toBe(422);
    expect(await high.text()).toContain('Answer a data subject’s request within');
    // Support can read, not change.
    const support = await signIn('support-1!aal2');
    expect((await post('/settings/reset', support, { key: 'strike_limit' })).status).toBe(403);
  });
});

describe('the handbook', () => {
  it('lists its chapters and serves each in both languages with live values', async () => {
    const cookie = await signIn('support-1!aal2');
    const index = await (await request('/guide', { headers: { Cookie: cookie } })).text();
    const slugs = [...index.matchAll(/href="\/guide\/([a-z]+)"/g)].map((m) => m[1]);
    expect(new Set(slugs).size).toBeGreaterThanOrEqual(10);
    for (const slug of new Set(slugs)) {
      const en = await request(`/guide/${String(slug)}`, { headers: { Cookie: cookie } });
      expect(en.status, slug).toBe(200);
      const text = await en.text();
      // No placeholder left unfilled.
      expect(text, slug).not.toMatch(/\{\{[a-z_]+\}\}/);
      const tr = await request(`/guide/${String(slug)}`, {
        headers: { Cookie: cookie, 'Accept-Language': 'tr' },
      });
      expect(await tr.text(), slug).not.toMatch(/\{\{[a-z_]+\}\}/);
    }
    const agents = await (await request('/guide/agents', { headers: { Cookie: cookie } })).text();
    expect(agents).toContain('<strong class="live">24 hours</strong>');
    const reference = await (
      await request('/guide/settings', { headers: { Cookie: cookie } })
    ).text();
    expect(reference).toContain('<code>webhook_disable_after</code>');
    expect((await request('/guide/nope', { headers: { Cookie: cookie } })).status).toBe(404);
    // Staff only.
    expect((await request('/guide')).status).not.toBe(200);
  });
});

describe('work queues and applications', () => {
  it('shows each queue against its deadline on Today', async () => {
    const cookie = await signIn('support-1!aal2');
    const page = await (await request('/', { headers: { Cookie: cookie } })).text();
    expect(page).toContain('class="queue late"');
    expect(page).toContain('1 overdue');
    expect(page).toContain('class="queue soon"');
    expect(page).toContain('Nothing waiting');
  });

  it('sends an application back with what to correct', async () => {
    const cookie = await signIn('admin-1!aal2');
    expect((await post('/agents/agent-1/return', cookie, { reason: ' ' })).status).toBe(422);
    const response = await post('/agents/agent-1/return', cookie, {
      reason: 'The IBAN is not in your own name.',
    });
    expect(response.headers.get('Location')).toBe('/agents/agent-1?done=agent_returned');
    expect(await callsOf('returnApplication')).toEqual([
      ['admin-1', 'agent-1', 'The IBAN is not in your own name.'],
    ]);
    const page = await (await request('/agents/agent-1', { headers: { Cookie: cookie } })).text();
    expect(page).toContain('Sent back for correction:');
    const support = await signIn('support-1!aal2');
    expect((await post('/agents/agent-1/return', support, { reason: 'x' })).status).toBe(403);
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

describe('agents’ identity', () => {
  it('shows where each check stands and records the video call', async () => {
    const admin = await signIn('admin-1!aal2');
    const page = await (await request('/agents/agent-1', { headers: { Cookie: admin } })).text();
    expect(page).toContain('Identity checks');
    expect(page).toContain('ali@example.com');
    expect(page).toContain('The registry didn’t answer');
    expect((await post('/agents/agent-1/video-call', admin, { result: 'passed' })).status).toBe(
      422,
    );
    const recorded = await post('/agents/agent-1/video-call', admin, {
      seen: '1',
      result: 'passed',
    });
    expect(recorded.headers.get('Location')).toBe('/agents/agent-1?done=call_recorded');
    expect(await callsOf('recordVideoCall')).toEqual([['admin-1', 'agent-1', true]]);
    const support = await signIn('support-1!aal2');
    expect((await post('/agents/agent-1/video-call', support, { seen: '1' })).status).toBe(403);
  });
});

describe('privacy', () => {
  it('finds what is held and deletes it with a reason and a fresh second factor', async () => {
    const admin = await signIn('admin-1!aal2');
    const found = await (
      await request('/privacy?q=34ABC123', { headers: { Cookie: admin } })
    ).text();
    expect(found).toContain('Shows a vehicle and its plate');
    expect(found).toContain('/privacy/evidence/e-1/erase');
    // An open case's addresses aren't ours to erase; a closed one's are.
    expect(found).toContain('/privacy/cases/c-1/erase');
    expect(found).not.toContain('/privacy/cases/c-5/erase');
    expect(
      (await post('/privacy/evidence/e-1/erase', admin, { reason: '', q: '34ABC123' })).status,
    ).toBe(422);
    const erased = await post('/privacy/evidence/e-1/erase', admin, {
      reason: 'KVKK 2026/3',
      q: '34ABC123',
    });
    expect(erased.headers.get('Location')).toBe('/privacy?done=erased&q=34ABC123');
    expect(await callsOf('eraseEvidence')).toContainEqual(['admin-1', 'e-1', 'KVKK 2026/3']);
    const old = await signIn('admin-1!old');
    expect(
      (await post('/privacy/documents/d-1/erase', old, { reason: 'x' })).headers.get('Location'),
    ).toBe('/signin?second_factor=1&return=%2Fprivacy');
    const support = await signIn('support-1!aal2');
    expect((await post('/privacy/cases/c-1/erase', support, { reason: 'x' })).status).toBe(403);
    expect((await request('/privacy?q=ab', { headers: { Cookie: support } })).status).toBe(422);
  });

  it('keeps the register of requests', async () => {
    const admin = await signIn('admin-1!aal2');
    const page = await (await request('/privacy', { headers: { Cookie: admin } })).text();
    expect(page).toContain('Overdue');
    const opened = await post('/privacy/requests', admin, {
      kind: 'erasure',
      subject_kind: 'vehicle',
      subject_ref: '34 ABC 123',
      channel: 'KEP',
      received_at: '2026-11-20',
    });
    expect(opened.headers.get('Location')).toBe('/privacy?done=request_opened');
    expect((await callsOf('openPrivacyRequest'))[0]?.[1]).toMatchObject({
      kind: 'erasure',
      subjectRef: '34 ABC 123',
      receivedAt: Date.parse('2026-11-20T09:00:00Z') / 1000,
    });
    expect(
      (await post('/privacy/requests/pr-1/close', admin, { status: 'done', outcome: '' })).status,
    ).toBe(422);
    const closed = await post('/privacy/requests/pr-1/close', admin, {
      status: 'done',
      outcome: 'Adresler silindi',
    });
    expect(closed.headers.get('Location')).toBe('/privacy?done=request_closed');
  });

  it('deletes queued files from both buckets and reports back', async () => {
    const { eraseDueFiles } = await import('../src/index');
    await env.EVIDENCE.put('claims/cl-1/e-9', new Uint8Array([1]));
    await env.DOCUMENTS.put('onboarding/ob-1/d-9', new Uint8Array([1]));
    expect(await eraseDueFiles(env)).toBe(2);
    expect(await env.EVIDENCE.get('claims/cl-1/e-9')).toBeNull();
    expect(await env.DOCUMENTS.get('onboarding/ob-1/d-9')).toBeNull();
    expect((await callsOf('filesErased')).at(-1)).toEqual([
      ['claims/cl-1/e-9', 'onboarding/ob-1/d-9'],
    ]);
    expect(await eraseDueFiles(env)).toBe(0);
  });
});

describe('system', () => {
  it('shows jobs, errors and queues to staff', async () => {
    const support = await signIn('support-1!aal2');
    const page = await (await request('/system', { headers: { Cookie: support } })).text();
    expect(page).toContain('core.notices');
    expect(page).toContain('Failing');
    expect(page).toContain('Not running');
    expect(page).toContain('webhook.disabled');
    expect((await request('/system')).headers.get('Location')).toBe('/signin?return=%2Fsystem');
  });

  it('reads Turkish unless English was chosen', async () => {
    const plain = await exports.default.fetch(new Request('https://merkez.emanet.dev/'));
    expect(plain.headers.get('Content-Language')).toBe('tr');
    const english = await exports.default.fetch(
      new Request('https://merkez.emanet.dev/', { headers: { 'Accept-Language': 'en-US' } }),
    );
    expect(english.headers.get('Content-Language')).toBe('tr');
    const chosen = await exports.default.fetch(new Request('https://merkez.emanet.dev/?lang=en'));
    expect(chosen.headers.get('Content-Language')).toBe('en');
  });
});
