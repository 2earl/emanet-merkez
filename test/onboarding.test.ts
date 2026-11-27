import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { callsOf, coreHooks, post, request, signIn } from './helpers';

beforeEach(async () => {
  await coreHooks().testReset();
});

const invite = {
  company: 'Yeni Varlık',
  kind: 'vys',
  contact_name: 'Can Kaya',
  contact_email: 'can@yenivarlik.example',
  locale: 'tr',
  reconfirm_days: '14',
  default: '12500',
  rules: 'Ford;*;;;15000',
};

describe('onboarding', () => {
  it('lists companies, signed ones on today’s page', async () => {
    const cookie = await signIn('support-1!aal2');
    const list = await (await request('/onboarding', { headers: { Cookie: cookie } })).text();
    expect(list).toContain('Örnek Bank A.Ş.');
    // Support can read but not invite.
    expect(list).not.toContain('Send the invitation');
    const signed = await (
      await request('/onboarding?status=signed', { headers: { Cookie: cookie } })
    ).text();
    expect(signed.match(/href="\/onboarding\/ob-/g)).toHaveLength(1);
    const today = await (await request('/', { headers: { Cookie: cookie } })).text();
    expect(today).toContain('Companies to approve');
    expect((await post('/onboarding', cookie, invite)).status).toBe(403);
  });

  it('invites a company with its fees', async () => {
    const cookie = await signIn('admin-1!aal2');
    const response = await post('/onboarding', cookie, invite);
    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toMatch(
      /^\/onboarding\/ob-[0-9a-f]{8}\?done=invited$/,
    );
    const [call] = await callsOf('inviteCompany');
    expect(call?.[0]).toBe('admin-1');
    expect(call?.[1]).toMatchObject({
      company: 'Yeni Varlık',
      kind: 'vys',
      contactEmail: 'can@yenivarlik.example',
      locale: 'tr',
      priceList: { default_kurus: 1_250_000, rules: [{ make: 'Ford', fee_kurus: 1_500_000 }] },
    });
    const again = await post('/onboarding', cookie, invite);
    expect(again.status).toBe(409);
    expect(await again.text()).toContain('already has an open invitation');
    const badFees = await post('/onboarding', cookie, {
      ...invite,
      default: 'x',
      contact_email: 'b@x.example',
    });
    expect(badFees.status).toBe(422);
  });

  it('shows what the company gave, with a warning when someone else accepted', async () => {
    const cookie = await signIn('owner-1!aal2');
    const page = await (
      await request('/onboarding/ob-signed', { headers: { Cookie: cookie } })
    ).text();
    expect(page).toContain('Büyükdere Cad. 1, İstanbul');
    expect(page).toContain('Tax certificate');
    expect(page).toContain('isn’t the signatory named in the details');
    expect(page).toContain('Approve and activate');
    // The acceptance cleared by an earlier send-back is still listed.
    expect(page).toContain('Earlier acceptances');
    expect(page).toContain('efefefefefefefef');
  });

  it('lets someone other than the inviter approve, with a fresh second factor', async () => {
    const inviter = await signIn('admin-1!aal2');
    const own = await (
      await request('/onboarding/ob-signed', { headers: { Cookie: inviter } })
    ).text();
    expect(own).toContain('another admin approves it');
    expect(own).not.toContain('Approve and activate');
    expect((await post('/onboarding/ob-signed/approve', inviter, {})).status).toBe(409);

    const stale = await signIn('owner-1!old');
    const redirected = await post('/onboarding/ob-signed/approve', stale, {});
    expect(redirected.headers.get('Location')).toContain('second_factor=1');

    const owner = await signIn('owner-1!aal2');
    const approved = await post('/onboarding/ob-signed/approve', owner, {});
    expect(approved.headers.get('Location')).toBe('/onboarding/ob-signed?done=onboarded');
    expect(await callsOf('approveOnboarding')).toEqual([
      ['admin-1', 'ob-signed'],
      ['owner-1', 'ob-signed'],
    ]);
  });

  it('sends back, rejects, cancels and resends, each with what it needs', async () => {
    const cookie = await signIn('admin-2!aal2');
    expect((await post('/onboarding/ob-signed/return', cookie, { reason: '' })).status).toBe(422);
    expect(
      (await post('/onboarding/ob-signed/return', cookie, { reason: 'Adres eksik' })).headers.get(
        'Location',
      ),
    ).toBe('/onboarding/ob-signed?done=returned');
    expect(
      (await post('/onboarding/ob-progress/reject', cookie, { reason: 'Yetki yok' })).headers.get(
        'Location',
      ),
    ).toBe('/onboarding/ob-progress?done=declined');
    expect((await post('/onboarding/ob-invited/resend', cookie, {})).headers.get('Location')).toBe(
      '/onboarding/ob-invited?done=resent',
    );
    expect(
      (await post('/onboarding/ob-invited/cancel', cookie, { reason: 'Yanlış adres' })).headers.get(
        'Location',
      ),
    ).toBe('/onboarding/ob-invited?done=cancelled');
    expect((await post('/onboarding/ob-invited/resend', cookie, {})).status).toBe(409);
  });

  it('streams a document only through its own onboarding, sandboxed', async () => {
    await env.DOCUMENTS.put('onboarding/ob-signed/d-1', new Uint8Array([0x25, 0x50, 0x44, 0x46]), {
      httpMetadata: { contentType: 'application/pdf' },
    });
    const cookie = await signIn('support-1!aal2');
    const doc = await request('/onboarding/ob-signed/documents/d-1', {
      headers: { Cookie: cookie },
    });
    expect(doc.status).toBe(200);
    expect(doc.headers.get('Content-Type')).toBe('application/pdf');
    expect(doc.headers.get('Content-Security-Policy')).toContain('sandbox');
    await doc.arrayBuffer();
    expect(await callsOf('recordView')).toEqual([
      ['support-1', 'onboarding:ob-signed', 'document d-1'],
    ]);
    expect(
      (await request('/onboarding/ob-progress/documents/d-1', { headers: { Cookie: cookie } }))
        .status,
    ).toBe(404);
    expect((await request('/onboarding/ob-signed/documents/d-1')).status).toBe(302);
  });
});

describe('2earl’s company details', () => {
  beforeEach(async () => {
    await coreHooks().testReset();
  });

  const details = {
    name: '2earl Teknoloji A.Ş.',
    address: 'Maslak Mah. Büyükdere Cad. No: 255, Sarıyer, İstanbul',
    taxOffice: 'Maslak',
    vkn: '0123456789',
    mersis: '0012345678900015',
    kep: '2earl@hs01.kep.tr',
    email: 'legal@2earl.com',
  };

  it('warns until they are set, and sets them with a fresh second factor', async () => {
    const owner = await signIn('owner-1!aal2');
    expect(await (await request('/onboarding', { headers: { Cookie: owner } })).text()).toContain(
      'Companies can’t accept the agreement until',
    );
    const settings = await (await request('/settings', { headers: { Cookie: owner } })).text();
    expect(settings).toContain('Not set yet');
    expect(settings).toContain('Save company details');

    const stale = await signIn('owner-1!old');
    const redirected = await post('/settings/provider', stale, details);
    expect(redirected.headers.get('Location')).toContain('second_factor=1');
    const support = await signIn('support-1!aal2');
    expect((await post('/settings/provider', support, details)).status).toBe(403);

    const bad = await post('/settings/provider', owner, { ...details, vkn: '12' });
    expect(bad.status).toBe(422);
    const page = await bad.text();
    expect(page).toContain('A company’s tax number has 10 digits.');
    // What was typed stays in the form.
    expect(page).toContain('Maslak Mah.');

    const saved = await post('/settings/provider', owner, details);
    expect(saved.headers.get('Location')).toBe('/settings?done=saved');
    expect((await callsOf('setProvider')).at(-1)).toEqual(['owner-1', details]);
    expect(
      await (await request('/onboarding', { headers: { Cookie: owner } })).text(),
    ).not.toContain('Companies can’t accept the agreement until');
    const readOnly = await (await request('/settings', { headers: { Cookie: support } })).text();
    expect(readOnly).toContain('2earl Teknoloji A.Ş.');
  });
});

describe('partner email notices', () => {
  beforeEach(async () => {
    await coreHooks().testReset();
  });

  it('shows the contact and turns notices off and on', async () => {
    const admin = await signIn('admin-1!aal2');
    const page = await (await request('/partners/p-1', { headers: { Cookie: admin } })).text();
    expect(page).toContain('ops@testbank.example');
    expect(page).toContain('Turn notices off');
    const off = await post('/partners/p-1/notices', admin, { on: '0' });
    expect(off.headers.get('Location')).toBe('/partners/p-1?done=saved');
    expect(await callsOf('setPartnerNotices')).toEqual([['admin-1', 'p-1', false]]);
    const after = await (await request('/partners/p-1', { headers: { Cookie: admin } })).text();
    expect(after).toContain('Turn notices on');
    const support = await signIn('support-1!aal2');
    expect((await post('/partners/p-1/notices', support, { on: '1' })).status).toBe(403);
  });
});
