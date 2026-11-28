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
    const activated = await post('/agents/agent-1/video-call', admin, {
      seen: '1',
      result: 'passed',
      activate: '1',
    });
    expect(activated.headers.get('Location')).toBe('/agents/agent-1?done=call_activated');
    await coreHooks().testActivateBlocked('documents_not_verified');
    const held = await post('/agents/agent-1/video-call', admin, {
      seen: '1',
      result: 'passed',
      activate: '1',
    });
    expect(held.status).toBe(200);
    const heldPage = await held.text();
    expect(heldPage).toContain('the agent was not activated');
    expect(heldPage).toContain('e-Devlet documents must be verified');
    await coreHooks().testActivateBlocked(null);
    const support = await signIn('support-1!aal2');
    expect((await post('/agents/agent-1/video-call', support, { seen: '1' })).status).toBe(403);
  });
});

describe('before activating an agent', () => {
  it('lists what is missing, points to Readiness and offers no button yet', async () => {
    const admin = await signIn('admin-1!aal2');
    const page = await (await request('/agents/agent-1', { headers: { Cookie: admin } })).text();
    expect(page).toContain('Before you activate');
    expect(page).toContain('Both e-Devlet documents are verified and clear.');
    expect(page).toContain('href="/readiness"');
    expect(page).toContain('Privacy arrangements reviewed, Accounting set up');
    expect(page).not.toContain('Make the agent active');
  });

  it('offers the button once everything that blocks is met', async () => {
    await coreHooks().testActivation({
      ready: true,
      items: [{ key: 'application', ok: true, blocking: true }],
    });
    const admin = await signIn('admin-1!aal2');
    const page = await (await request('/agents/agent-1', { headers: { Cookie: admin } })).text();
    expect(page).toContain('Make the agent active');
    expect(page).toContain('name="status" value="active"');
    await coreHooks().testReset();
  });

  it('turns Turkish with the page', async () => {
    const admin = await signIn('admin-1!aal2');
    const page = await (
      await request('/agents/agent-1', { headers: { Cookie: admin, 'Accept-Language': 'tr' } })
    ).text();
    expect(page).toContain('Etkinleştirmeden önce');
  });
});

describe('development mode', () => {
  it('is switched on by an owner with a fresh second factor, shows a banner, and ends when switched off', async () => {
    const admin = await signIn('admin-1!aal2');
    expect((await post('/settings/dev-mode', admin, { on: '1' })).status).toBe(403);
    const stale = await signIn('owner-1!old');
    expect(
      (await post('/settings/dev-mode', stale, { on: '1' })).headers.get('Location'),
    ).toContain('/signin?second_factor=1');

    const owner = await signIn('owner-1!aal2');
    const before = await (await request('/settings', { headers: { Cookie: owner } })).text();
    expect(before).not.toContain('Development mode is on.');
    expect(before).toContain('Switch on for twelve hours');
    // The core's extra setting isn't a row of the generic form.
    expect(before).not.toContain('name="dev_mode"');

    const on = await post('/settings/dev-mode', owner, { on: '1' });
    expect(on.headers.get('Location')).toBe('/settings?done=saved#g-dev');
    expect(await callsOf('setDevMode')).toEqual([['owner-1', true]]);
    const page = await (await request('/', { headers: { Cookie: admin } })).text();
    expect(page).toContain('Development mode is on.');
    expect(page).toContain('Use test data only.');

    await post('/settings/dev-mode', owner, { on: '0' });
    expect(await callsOf('setDevMode')).toEqual([
      ['owner-1', true],
      ['owner-1', false],
    ]);
    const after = await (await request('/', { headers: { Cookie: admin } })).text();
    expect(after).not.toContain('Development mode is on.');
  });

  it('turns Turkish with the page', async () => {
    const owner = await signIn('owner-1!aal2');
    await post('/settings/dev-mode', owner, { on: '1' });
    const page = await (
      await request('/settings', { headers: { Cookie: owner, 'Accept-Language': 'tr' } })
    ).text();
    expect(page).toContain('Geliştirme modu açık.');
    expect(page).toContain('Kapat');
    await post('/settings/dev-mode', owner, { on: '0' });
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

describe('vetting an applicant', () => {
  it('shows what was accepted and each document with how to verify it', async () => {
    const cookie = await signIn('admin-1!aal2');
    const page = await (await request('/agents/agent-1', { headers: { Cookie: cookie } })).text();
    expect(page).toContain('Accepted the agent agreement');
    expect(page).toContain('Barkodlu Belge Doğrulama');
    expect(page).toContain('turkiye.gov.tr/belge-dogrulama');
    expect(page).toContain('<code>ABC-123456</code>');
    expect(page).toContain('class="workspace"');
  });

  it('serves the document sandboxed, records the view, and deletes with the decision', async () => {
    await env.EVIDENCE.put(
      'agents/agent-1/criminal_record-1',
      new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      {
        httpMetadata: { contentType: 'application/pdf' },
      },
    );
    const cookie = await signIn('admin-1!aal2');
    const file = await request('/agents/agent-1/documents/doc-1', { headers: { Cookie: cookie } });
    expect(file.status).toBe(200);
    expect(file.headers.get('Content-Type')).toBe('application/pdf');
    expect(file.headers.get('Content-Security-Policy')).toContain('sandbox');
    await file.arrayBuffer();
    expect(await callsOf('documentFile')).toEqual([['admin-1', 'doc-1']]);
    // Another agent's address doesn't open it.
    expect(
      (await request('/agents/agent-2/documents/doc-1', { headers: { Cookie: cookie } })).status,
    ).toBe(404);
    // A record that isn't clean needs a reason.
    const bare = await post('/agents/agent-1/documents/doc-1/decide', cookie, {
      outcome: 'has_record',
    });
    expect(bare.status).toBe(422);
    const done = await post('/agents/agent-1/documents/doc-1/decide', cookie, { outcome: 'clear' });
    expect(done.headers.get('Location')).toBe('/agents/agent-1?done=document_decided');
    const after = await (await request('/agents/agent-1', { headers: { Cookie: cookie } })).text();
    expect(after).toContain('The file has been deleted; only this result is kept.');
    expect(
      (await request('/agents/agent-1/documents/doc-1', { headers: { Cookie: cookie } })).status,
    ).toBe(404);
    const support = await signIn('support-1!aal2');
    expect(
      (await post('/agents/agent-1/documents/doc-2/decide', support, { outcome: 'clear' })).status,
    ).toBe(403);
  });
});

describe('readiness', () => {
  it('shows what is open, takes sign-offs with a name, and warns on Today', async () => {
    const cookie = await signIn('admin-1!aal2');
    const today = await (await request('/', { headers: { Cookie: cookie } })).text();
    expect(today).toContain('Not ready for the first customer yet.');
    const page = await (await request('/readiness', { headers: { Cookie: cookie } })).text();
    expect(page).toContain('Companies can’t be approved yet');
    expect(page).toContain('action="/readiness/accounting_setup"');
    expect((await post('/readiness/legal_privacy', cookie, { signer: 'x' })).status).toBe(422);
    for (const key of [
      'legal_service_agreement',
      'legal_agent_agreement',
      'legal_privacy',
      'accounting_setup',
    ]) {
      const signed = await post(`/readiness/${key}`, cookie, {
        signer: 'Av. Ayşe Örnek',
        note: 'e-posta',
      });
      expect(signed.headers.get('Location')).toBe('/readiness?done=signed');
    }
    const ready = await (await request('/readiness', { headers: { Cookie: cookie } })).text();
    expect(ready).toContain('Companies can be approved');
    expect(ready).toContain('Av. Ayşe Örnek');
    expect(await (await request('/', { headers: { Cookie: cookie } })).text()).not.toContain(
      'Not ready for the first customer yet.',
    );
    const back = await post('/readiness/legal_privacy/withdraw', cookie);
    expect(back.headers.get('Location')).toBe('/readiness?done=unsigned');
    const support = await signIn('support-1!aal2');
    expect((await post('/readiness/legal_privacy', support, { signer: 'Av. X Y' })).status).toBe(
      403,
    );
  });
});

describe('the accountant’s month', () => {
  it('shows totals, what is missing, and gives four files Excel can read', async () => {
    const cookie = await signIn('admin-1!aal2');
    const page = await (await request('/money/accounting', { headers: { Cookie: cookie } })).text();
    expect(page).toContain('The journal balances');
    expect(page).toContain('Missing details for a payment document');
    expect(page).not.toContain('10000000146');
    const csv = await request('/money/accounting/2026-11/payouts.csv', {
      headers: { Cookie: cookie },
    });
    expect(csv.headers.get('Content-Disposition')).toContain('emanet-2026-11-payouts.csv');
    const bytes = new Uint8Array(await csv.arrayBuffer());
    // A byte-order mark, so Excel reads the Turkish letters.
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder().decode(bytes);
    expect(text.startsWith('Odeme Tarihi;Ad Soyad;TCKN;')).toBe(true);
    expect(text).toContain(';10000000146;');
    expect(text).toContain('5000,00;500,00;4500,00');
    // A quote is doubled, and a value that would run as a formula is kept as text.
    expect(text).toContain('"Örnek Mah. No:1 ""A"" Blok"');
    expect(text).toContain(";'=cmd;");
    for (const name of ['invoices', 'receipts', 'journal']) {
      const file = await request(`/money/accounting/2026-11/${name}.csv`, {
        headers: { Cookie: cookie },
      });
      expect(file.status, name).toBe(200);
      await file.text();
    }
    expect(
      (await request('/money/accounting/2026-11/x.csv', { headers: { Cookie: cookie } })).status,
    ).toBe(404);
    expect((await post('/money/accounting/2026-11/close', cookie)).status).toBe(422);
    expect((await post('/money/accounting/2026-10/close', cookie)).headers.get('Location')).toBe(
      '/money/accounting?month=2026-10&done=month_closed',
    );
    // ID numbers are for owners and admins.
    const support = await signIn('support-1!aal2');
    expect((await request('/money/accounting', { headers: { Cookie: support } })).status).toBe(403);
    expect(
      (await request('/money/accounting/2026-11/payouts.csv', { headers: { Cookie: support } }))
        .status,
    ).toBe(403);
  });
});

describe('search', () => {
  it('finds agents and partners by what staff know of them', async () => {
    const cookie = await signIn('support-1!aal2');
    const byName = await (await request('/search?q=ali', { headers: { Cookie: cookie } })).text();
    expect(byName).toContain('href="/agents/agent-1"');
    const byTax = await (
      await request('/search?q=1234567890', { headers: { Cookie: cookie } })
    ).text();
    expect(byTax).toContain('href="/partners/p-1"');
    const none = await (await request('/search?q=zzzz', { headers: { Cookie: cookie } })).text();
    expect(none).toContain('Nothing found among agents and partners.');
    expect((await request('/search?q=ali')).status).not.toBe(200);
  });
});

describe('asking an agent for more', () => {
  beforeEach(async () => {
    await coreHooks().testReset();
  });

  it('shows what was asked, lets any reviewer ask, and reads only filled rows', async () => {
    const support = await signIn('support-1!aal2');
    const page = await (await request('/agents/agent-1', { headers: { Cookie: support } })).text();
    expect(page).toContain('Requests to the agent');
    expect(page).toContain('Adresinizde daire numarası eksik.');
    expect(page).toContain('Düzelttim, No:4 D:2');
    expect(page).toContain('Late');
    expect(page).toContain('action="/agents/agent-1/ask"');
    expect(page).toContain('value="document:residence_record"');
    expect((await post('/agents/agent-1/ask', support, {})).status).toBe(422);
    expect(
      (await post('/agents/agent-1/ask', support, { what1: 'info:iban', note1: 'x' })).status,
    ).toBe(422);
    const sent = await post('/agents/agent-1/ask', support, {
      what1: 'info:iban',
      note1: 'IBAN kendi adınıza değil.',
      what2: '',
      note2: '',
      what3: 'document:driving_licence',
      note3: 'Sürücü belgenizin fotoğrafını yükleyin.',
    });
    expect(sent.headers.get('Location')).toBe('/agents/agent-1?done=asked#requests');
    expect((await callsOf('askAgent')).at(-1)).toEqual([
      'support-1',
      'agent-1',
      [
        { kind: 'info', subject: 'iban', note: 'IBAN kendi adınıza değil.' },
        {
          kind: 'document',
          subject: 'driving_licence',
          note: 'Sürücü belgenizin fotoğrafını yükleyin.',
        },
      ],
    ]);
    // Signed out: nothing is asked.
    await post('/agents/agent-1/ask', '', { what1: 'info:iban', note1: 'abcdef' });
    expect(await callsOf('askAgent')).toHaveLength(3);
  });

  it('accepts an answer, asks again, withdraws, and lists answers on Today', async () => {
    const support = await signIn('support-1!aal2');
    const today = await (await request('/', { headers: { Cookie: support } })).text();
    expect(today).toContain('Answers from agents');
    expect(today).toContain('/agents/agent-1#requests');
    expect(
      (await post('/agents/agent-1/requests/ar-2/settle', support, { status: 'accepted' })).status,
    ).toBe(422);
    expect(
      (
        await post('/agents/agent-1/requests/ar-1/again', support, {
          note: 'Kapı numarası da eksik.',
        })
      ).headers.get('Location'),
    ).toBe('/agents/agent-1?done=asked#requests');
    expect(
      (
        await post('/agents/agent-1/requests/ar-2/settle', support, { status: 'cancelled' })
      ).headers.get('Location'),
    ).toBe('/agents/agent-1?done=request_settled#requests');
    // A request that belongs to another agent is not settled through this page.
    expect(
      (await post('/agents/other/requests/ar-1/settle', support, { status: 'cancelled' })).status,
    ).not.toBe(303);
  });
});

describe('erasing an agent and the sealed archive', () => {
  beforeEach(async () => {
    await coreHooks().testReset();
  });

  it('erases only for an admin with a fresh second factor who typed the word', async () => {
    const support = await signIn('support-1!aal2');
    const old = await signIn('admin-1!old');
    const admin = await signIn('admin-1!aal2');
    const privacy = await (await request('/privacy', { headers: { Cookie: admin } })).text();
    expect(privacy).toContain('href="/agents/agent-1/erase"');
    expect(privacy).toContain('href="/privacy/archive"');
    expect(
      await (await request('/privacy', { headers: { Cookie: support } })).text(),
    ).not.toContain('href="/privacy/archive"');
    const page = await (
      await request('/agents/agent-1/erase', { headers: { Cookie: admin } })
    ).text();
    expect(page).toContain('What erasing does');
    expect(page).toContain('action="/agents/agent-1/erase/refuse"');
    expect(
      await (await request('/agents/agent-1/erase', { headers: { Cookie: old } })).text(),
    ).not.toContain('action="/agents/agent-1/erase"');
    expect(
      (await post('/agents/agent-1/erase', support, { reason: 'talep', confirm: 'SİL' })).status,
    ).toBe(403);
    expect(
      (await post('/agents/agent-1/erase', old, { reason: 'talep', confirm: 'SİL' })).headers.get(
        'Location',
      ),
    ).toContain('/signin?second_factor=1');
    expect(
      (await post('/agents/agent-1/erase', admin, { reason: 'talep', confirm: 'evet' })).status,
    ).toBe(422);
    expect(await callsOf('eraseAgent')).toEqual([]);
    await coreHooks().testPayoutsPending(1);
    const blocked = await (
      await request('/agents/agent-1/erase', { headers: { Cookie: admin } })
    ).text();
    expect(blocked).toContain('Payouts are waiting');
    expect(blocked).not.toContain('action="/agents/agent-1/erase" ');
    expect(
      (await post('/agents/agent-1/erase', admin, { reason: 'talep', confirm: 'SİL' })).status,
    ).toBe(422);
    await coreHooks().testPayoutsPending(0);
    const done = await post('/agents/agent-1/erase', admin, {
      reason: 'İlgili kişinin talebi',
      confirm: 'sil',
    });
    expect(done.headers.get('Location')).toBe('/privacy/archive/arch-1?done=erased_agent');
    expect((await callsOf('eraseAgent')).at(-1)).toEqual([
      'admin-1',
      'agent-1',
      { reason: 'İlgili kişinin talebi' },
    ]);
    const after = await (await request('/agents/agent-1', { headers: { Cookie: admin } })).text();
    expect(after).toContain('This person’s data was erased on');
    expect(after).not.toContain('action="/agents/agent-1/status"');
    expect(after).not.toContain('action="/agents/agent-1/ask"');
    expect((await request('/agents/agent-1/erase', { headers: { Cookie: admin } })).status).toBe(
      404,
    );
  });

  it('refuses a request with a reason the agent is told', async () => {
    const admin = await signIn('admin-1!aal2');
    expect((await post('/agents/agent-1/erase/refuse', admin, { reason: 'hayır' })).status).toBe(
      422,
    );
    const refused = await post('/agents/agent-1/erase/refuse', admin, {
      reason: 'Bekleyen ödemeniz gönderildikten sonra yeniden başvurun.',
    });
    expect(refused.headers.get('Location')).toBe('/privacy?done=erasure_refused#requests');
    expect((await callsOf('refuseErasure')).at(-1)).toEqual([
      'admin-1',
      'pr-5',
      'Bekleyen ödemeniz gönderildikten sonra yeniden başvurun.',
    ]);
  });

  it('keeps the archive to admins and never shows content on a page', async () => {
    const support = await signIn('support-1!aal2');
    const admin = await signIn('admin-1!aal2');
    for (const path of ['/privacy/archive', '/privacy/archive/arch-1']) {
      expect((await request(path, { headers: { Cookie: support } })).status, path).toBe(403);
      expect((await request(path)).status, path).toBe(302);
    }
    expect(
      (await post('/privacy/archive/arch-1/download', support, { reason: 'Mahkeme yazısı 2027/1' }))
        .status,
    ).toBe(403);
    const list = await (await request('/privacy/archive', { headers: { Cookie: admin } })).text();
    expect(list).toContain('href="/privacy/archive/arch-1"');
    expect(list).toContain('Destroyed');
    expect(list).not.toContain('Ali Veli');
    const detail = await (
      await request('/privacy/archive/arch-1', { headers: { Cookie: admin } })
    ).text();
    expect(detail).toContain('Nobody has opened this record.');
    expect(detail).not.toContain('Ali Veli');
    expect(detail).not.toContain('10000000146');
    expect(await callsOf('openArchive')).toEqual([]);
    expect((await request('/privacy/archive/nope', { headers: { Cookie: admin } })).status).toBe(
      404,
    );
  });

  it('downloads a record as plain text only with a reason and a fresh second factor', async () => {
    const old = await signIn('admin-1!old');
    const admin = await signIn('admin-1!aal2');
    const reason = 'İzmir 3. Asliye Hukuk 2027/123 sayılı yazı';
    expect(
      (await post('/privacy/archive/arch-1/download', old, { reason })).headers.get('Location'),
    ).toContain('/signin?second_factor=1');
    expect(await callsOf('openArchive')).toEqual([]);
    expect(
      (await post('/privacy/archive/arch-1/download', admin, { reason: 'bakmak' })).status,
    ).toBe(422);
    expect((await post('/privacy/archive/arch-0/download', admin, { reason })).status).toBe(422);
    const file = await post('/privacy/archive/arch-1/download', admin, { reason });
    expect(file.status).toBe(200);
    expect(file.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    expect(file.headers.get('Content-Disposition')).toBe(
      'attachment; filename="emanet-arsiv-arch-1.txt"',
    );
    expect(file.headers.get('Cache-Control')).toBe('private, no-store');
    const bytes = new Uint8Array(await file.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain('Ali Veli');
    expect(text).toContain('10000000146');
    expect(text).toContain(reason);
    expect(text).toContain('admin-1');
    // One value, one line: a line break inside an address can't forge a new field.
    expect(text).toContain('Örnek Mah. No:1 Kadıköy');
    expect(text).not.toContain('<');
    expect((await callsOf('openArchive')).at(-1)).toEqual(['admin-1', 'arch-1', reason]);
    const detail = await (
      await request('/privacy/archive/arch-1', { headers: { Cookie: admin } })
    ).text();
    expect(detail).toContain(reason);
  });

  it('opens a sealed file through the core and only if the archive lists it', async () => {
    const admin = await signIn('admin-1!aal2');
    const reason = 'Savcılık yazısı 2027/9 için';
    await env.EVIDENCE.put('archive/arch-1/f-1', new Uint8Array([0x45, 0x25, 0x50, 0x44, 0x46]));
    await env.EVIDENCE.put('claims/cl-1/secret', new Uint8Array([1, 2, 3]));
    expect(
      (await post('/privacy/archive/arch-1/file', admin, { ref: 'claims/cl-1/secret', reason }))
        .status,
    ).toBe(404);
    expect(
      (
        await post('/privacy/archive/arch-1/file', admin, {
          ref: 'archive/arch-1/f-1',
          reason: 'x',
        })
      ).status,
    ).toBe(422);
    const file = await post('/privacy/archive/arch-1/file', admin, {
      ref: 'archive/arch-1/f-1',
      reason,
    });
    expect(file.status).toBe(200);
    expect(file.headers.get('Content-Disposition')).toBe(
      'attachment; filename="emanet-arsiv-arch-1-population_record.pdf"',
    );
    expect(file.headers.get('Content-Type')).toBe('application/octet-stream');
    expect([...new Uint8Array(await file.arrayBuffer())]).toEqual([0x25, 0x50, 0x44, 0x46]);
    expect((await callsOf('openArchiveFile')).at(-1)).toEqual([
      'admin-1',
      'arch-1',
      'archive/arch-1/f-1',
      reason,
      5,
    ]);
  });

  it('seals files bound for the archive, deletes the original only after, and leaves a failed one in place', async () => {
    const { archiveDueFiles } = await import('../src/index');
    await env.EVIDENCE.put('agents/a-1/population_record-1', new Uint8Array([1, 2, 3]), {
      httpMetadata: { contentType: 'application/pdf' },
    });
    await env.EVIDENCE.put('agents/a-1/refused-2', new Uint8Array([9]));
    await coreHooks().testArchiveDue([
      { file_ref: 'agents/a-1/population_record-1', bucket: 'evidence', archive_id: 'arch-1' },
      { file_ref: 'agents/a-1/refused-2', bucket: 'evidence', archive_id: 'arch-1' },
      { file_ref: 'agents/a-1/gone-3', bucket: 'evidence', archive_id: 'arch-1' },
    ]);
    expect(await archiveDueFiles(env)).toBe(1);
    expect(await env.EVIDENCE.get('agents/a-1/population_record-1')).toBeNull();
    expect(await env.EVIDENCE.get('agents/a-1/refused-2')).not.toBeNull();
    const [stored = ''] = await coreHooks().testArchiveStored();
    expect(stored.startsWith('archive/arch-1/')).toBe(true);
    const sealed = await env.EVIDENCE.get(stored);
    expect([...new Uint8Array((await sealed?.arrayBuffer()) ?? new ArrayBuffer(0))]).toEqual([
      0x45, 1, 2, 3,
    ]);
    expect((await callsOf('archiveFileStored')).at(-1)).toEqual([
      'arch-1',
      'agents/a-1/population_record-1',
      'application/pdf',
      4,
    ]);
    expect((await callsOf('filesErased')).at(-1)).toEqual([['agents/a-1/gone-3']]);
  });
});

describe('legal holds', () => {
  it('lets an admin place and lift a hold with a fresh second factor, and no one else', async () => {
    const admin = await signIn('admin-1!aal2');
    const empty = await (await request('/privacy/holds', { headers: { Cookie: admin } })).text();
    expect(empty).toContain('Legal holds');
    expect(empty).toContain('Nothing is held.');

    const stale = await signIn('admin-1!old');
    const redirected = await post('/privacy/holds', stale, {
      kind: 'agent',
      ref: 'agent-1',
      reason: 'Savcılık',
    });
    expect(redirected.headers.get('Location')).toContain('second_factor=1');

    const placed = await post('/privacy/holds', admin, {
      kind: 'agent',
      ref: 'agent-1',
      reason: 'Savcılık 2026/9',
    });
    expect(placed.headers.get('Location')).toBe('/privacy/holds?done=hold_placed');
    const twice = await post('/privacy/holds', admin, {
      kind: 'agent',
      ref: 'agent-1',
      reason: 'again',
    });
    expect(twice.status).toBe(422);
    expect(await twice.text()).toContain('already held');

    const listed = await (await request('/privacy/holds', { headers: { Cookie: admin } })).text();
    expect(listed).toContain('Savcılık 2026/9');
    expect(listed).toContain('agent-1');

    const lifted = await post('/privacy/holds/hold-1/release', admin, { reason: 'Dava kapandı' });
    expect(lifted.headers.get('Location')).toBe('/privacy/holds?done=hold_released');
    const after = await (await request('/privacy/holds', { headers: { Cookie: admin } })).text();
    expect(after).toContain('Dava kapandı');

    const support = await signIn('support-1!aal2');
    expect((await request('/privacy/holds', { headers: { Cookie: support } })).status).toBe(403);
    expect(
      (await post('/privacy/holds', support, { kind: 'agent', ref: 'x', reason: 'abc' })).status,
    ).toBe(403);
  });
});

describe('what is deleted when', () => {
  it('shows the rules and counts to an admin only', async () => {
    const admin = await signIn('admin-1!aal2');
    const page = await (await request('/privacy/retention', { headers: { Cookie: admin } })).text();
    expect(page).toContain('What is deleted when');
    expect(page).toContain('Debtors’ street addresses on closed cases');
    expect(page).toContain('30 days');
    const support = await signIn('support-1!aal2');
    expect((await request('/privacy/retention', { headers: { Cookie: support } })).status).toBe(
      403,
    );
  });

  it('puts a hold from the agent’s page and comes back to it', async () => {
    const admin = await signIn('admin-1!aal2');
    const before = await (await request('/agents/agent-1', { headers: { Cookie: admin } })).text();
    expect(before).toContain('Place a legal hold');
    const placed = await post('/privacy/holds', admin, {
      kind: 'agent',
      ref: 'agent-1',
      reason: 'Savcılık 2026/9',
      back: '/agents/agent-1',
    });
    expect(placed.headers.get('Location')).toBe('/agents/agent-1?done=hold_placed');
    const held = await (await request('/agents/agent-1', { headers: { Cookie: admin } })).text();
    expect(held).toContain('Lift the hold');
    expect(held).toContain('Savcılık 2026/9');
    const lifted = await post('/privacy/holds/hold-1/release', admin, {
      reason: 'Kapandı',
      back: 'https://evil.example/',
    });
    expect(lifted.headers.get('Location')).toBe('/privacy/holds?done=hold_released');
  });
});

describe('support inbox', () => {
  it('lists tickets, answers, notes, assigns and closes', async () => {
    const staff = await signIn('support-1!aal2');
    const inbox = await (await request('/support', { headers: { Cookie: staff } })).text();
    expect(inbox).toContain('waiting for us here');
    expect(inbox).toContain('Ödemem gelmedi');
    expect(inbox).toContain('Fatura sorusu');
    const agentsOnly = await (
      await request('/support?kind=agent', { headers: { Cookie: staff } })
    ).text();
    expect(agentsOnly).toContain('Ödemem gelmedi');
    expect(agentsOnly).not.toContain('Fatura sorusu');

    const thread = await (await request('/support/tk-1', { headers: { Cookie: staff } })).text();
    expect(thread).toContain('IBAN’ıma ödeme yok.');
    expect(thread).toContain('Send to them');

    const empty = await post('/support/tk-1/reply', staff, { body: ' ' });
    expect(empty.status).toBe(422);
    const sent = await post('/support/tk-1/reply', staff, { body: 'IBAN’ınızı doğruluyoruz.' });
    expect(sent.headers.get('Location')).toBe('/support/tk-1?done=ticket_replied');
    const noted = await post('/support/tk-1/reply', staff, { body: 'İç not', note: '1' });
    expect(noted.headers.get('Location')).toBe('/support/tk-1?done=ticket_noted');
    expect((await post('/support/tk-1/assign', staff, { to: 'me' })).headers.get('Location')).toBe(
      '/support/tk-1?done=ticket_assigned',
    );
    expect((await post('/support/tk-1/close', staff, {})).headers.get('Location')).toBe(
      '/support/tk-1?done=ticket_closed',
    );
    const closed = await (await request('/support/tk-1', { headers: { Cookie: staff } })).text();
    expect(closed).toContain('Reopen');
    expect(closed).not.toContain('Send to them');
    expect((await request('/support/nope', { headers: { Cookie: staff } })).status).toBe(404);
  });
});
