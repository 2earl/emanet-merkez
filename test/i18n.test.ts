import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { collectMissing } from '../src/i18n';
import { callback, coreHooks, post, request, signIn } from './helpers';

/** Every page in Turkish, and nothing left in English (src/locales/tr.ts). */

const tr = { 'Accept-Language': 'tr-TR,tr;q=0.9' };

describe('Turkish', () => {
  let support = '';
  let admin = '';
  let old = '';
  let second = '';

  beforeAll(async () => {
    await coreHooks().testReset();
    await env.EVIDENCE.put('claims/cl-1/e-1', new Uint8Array([1]), {
      httpMetadata: { contentType: 'image/jpeg' },
    });
    support = await signIn('support-1!aal2');
    admin = await signIn('admin-1!aal2');
    old = await signIn('owner-1!old');
    second = await signIn('admin-2!aal2');
  });

  it('serves every page without an untranslated sentence', async () => {
    const missing = collectMissing();
    const get = async (path: string, cookie = '') => {
      const response = await request(path, {
        headers: { ...tr, ...(cookie ? { Cookie: cookie } : {}) },
      });
      expect(response.headers.get('Content-Language'), path).toBe('tr');
      return response.text();
    };
    const send = async (path: string, cookie: string, form: Record<string, string> = {}) =>
      (await post(path, cookie, form, tr)).text();

    await get('/');
    await get('/nope');
    await get('/', await signIn('outsider!aal2'));
    await (await callback('admin-1')).text();
    for (const cookie of [support, admin, old]) {
      for (const path of [
        '/',
        '/reviews',
        '/reviews?kind=delivery',
        '/reviews?kind=missing_vin',
        '/reviews?kind=plate_conflict',
        '/reviews/r-vin',
        '/reviews/r-plate',
        '/reviews/r-del',
        '/partners',
        '/partners/p-1',
        '/agents',
        '/agents?status=banned',
        '/money',
        '/money?partner=p-1',
        '/money/ledger',
        '/settings',
      ]) {
        await get(path, cookie);
      }
    }
    for (const done of ['saved', 'activated', 'suspended'])
      await get(`/partners/p-1?done=${done}`, admin);
    for (const done of ['accepted', 'rejected', 'delivered'])
      await get(`/reviews?done=${done}`, admin);
    for (const done of ['invoiced', 'received', 'approved', 'waiting', 'sent'])
      await get(`/money?done=${done}`, admin);
    await get('/settings?done=saved', admin);
    await get('/agents?done=saved', admin);

    // Errors shown on pages.
    await send('/reviews/r-vin/accept', support, { vin: 'x' });
    await send('/reviews/r-vin/reject', support, { reason: '' });
    await send('/reviews/r-del/deliver', support);
    await send('/partners', support, {});
    await send('/partners', admin, { org_id: '' });
    await send('/partners', admin, { org_id: 'org-1', legal_name: 'X', reconfirm_days: '14' });
    await send('/partners/p-1', admin, { legal_name: 'X', vkn: '1', reconfirm_days: '14' });
    await send('/partners/p-1', admin, { legal_name: 'X', vkn: '', reconfirm_days: '500' });
    await send('/partners/p-1/prices', admin, { default: '', rules: '' });
    await send('/partners/p-1/prices', admin, { default: '100', rules: 'a;b' });
    await send('/partners/p-1/fields', admin, { key: 'Bad Key', label_tr: 'a', label_en: 'b' });
    await send('/partners/p-1/fields', admin, { key: 'portfolio', label_tr: 'a', label_en: 'b' });
    await send('/partners/p-1/fields/f-9/retire', admin);
    await send('/agents/agent-1/status', admin, { status: 'active', reason: '' });
    await send('/agents/agent-1/status', admin, { status: 'nope', reason: 'x' });
    await send('/money/receipts', admin, { invoice_id: 'i-1', amount: 'x' });
    await send('/money/receipts', admin, { invoice_id: 'i-9', amount: '10' });
    await send('/money/receipts', admin, {
      invoice_id: 'i-1',
      amount: '10',
      value_date: '2026-11-01',
      bank_ref: 'A',
    });
    await send('/money/receipts', admin, {
      invoice_id: 'i-1',
      amount: '10',
      value_date: '2026-11-01',
      bank_ref: 'A',
    });
    await send('/money/receipts', admin, {
      invoice_id: 'i-1',
      amount: '10',
      value_date: 'x',
      bank_ref: 'B',
    });
    await send('/money/payouts/po-big/order', admin);
    await get('/money', admin);
    await send('/money/payouts/po-big/order', admin);
    await send('/money/payouts/po-small/sent', admin, { bank_ref: '' });
    await send('/money/payouts/po-nope/order', admin);
    await send('/money/payouts/po-big/sent', second, { bank_ref: 'x' });
    await send('/money/invoices', admin, { partner_id: 'p-1' });
    await send('/money/invoices', admin, { partner_id: 'p-1' });
    await get('/', admin);
    await send('/settings', admin, { claim_hours: 'x' });
    await send('/settings/payout-rule', admin, { share: '', fixed: '', min: '', max: '' });
    await send('/settings/payout-rule', admin, { share: 'x', fixed: '', min: '', max: '' });
    await send('/settings/payout-rule', admin, { share: '', fixed: 'x', min: '', max: '' });
    await send('/settings/payout-rule', admin, { share: '5', fixed: '', min: 'x', max: '' });
    await send('/settings/payout-rule', admin, { share: '5', fixed: '', min: '9', max: '1' });
    await send('/reviews/r-del/deliver', admin);
    await get('/reviews/r-del', admin);
    await post('/partners', admin, { org_id: 'x' }, { ...tr, Origin: 'https://evil.example' }).then(
      (r) => r.text(),
    );

    console.log('MISSING' + JSON.stringify([...missing].sort()));
    expect([...missing].sort()).toEqual([]);
  });
});
