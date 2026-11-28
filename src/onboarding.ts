import type { Hono } from 'hono';
import {
  ONBOARDING_STATUSES,
  PARTNER_KINDS,
  type Permission,
  core,
  type OnboardingStatus,
  type PartnerKind,
  type StaffRole,
} from './core';
import { parsePriceList } from './forms';
import type { AppContext, AppEnv } from './http';
import * as pages from './onboarding-pages';
import type { Nav } from './pages';

/**
 * Inviting companies and deciding on them (emanet-core docs/DESIGN.md §5, Onboarding). Any staff
 * member can read; owners and admins invite, send back, reject and cancel; approving creates an
 * active partner with fees, so it needs a fresh second factor, and someone other than the inviter.
 */

interface Deps {
  nav: (c: AppContext) => Nav;
  uid: (c: AppContext) => string;
  role: (c: AppContext) => StaffRole;
  may: (c: AppContext, permission: Permission) => boolean;
  fresh: (c: AppContext) => boolean;
  changer: (c: AppContext) => Response | null;
  sensitive: (c: AppContext, page: string) => Response | null;
  notFound: (c: AppContext) => Response;
  errorText: (error: string, detail?: string) => string;
  done: (c: AppContext) => string | null;
  formValues: (c: AppContext) => Promise<Record<string, string>>;
}

export function registerOnboarding(app: Hono<AppEnv>, d: Deps): void {
  const statusOf = (value: string | undefined): OnboardingStatus | null =>
    ONBOARDING_STATUSES.includes(value as OnboardingStatus) ? (value as OnboardingStatus) : null;

  const showList = async (
    c: AppContext,
    message: string | null,
    values: Record<string, string>,
    status: 200 | 409 | 422 = 200,
  ) => {
    const filter = statusOf(c.req.query('status'));
    const [rows, provider] = await Promise.all([
      core(c.env).onboardings(filter),
      core(c.env).provider(),
    ]);
    if (!rows.ok) throw new Error(`core: ${rows.error}`);
    return c.html(
      pages.onboardingList(
        d.nav(c),
        rows.value,
        filter,
        d.may(c, 'emanet:control.change'),
        message,
        values,
        provider.ok && provider.value === null,
      ),
      status,
    );
  };

  app.get('/onboarding', (c) => showList(c, null, {}));

  app.post('/onboarding', async (c) => {
    const denied = d.changer(c);
    if (denied) return denied;
    const v = await d.formValues(c);
    const prices = parsePriceList(v.default ?? '', v.rules ?? '');
    if (!prices.ok) return showList(c, prices.error, v, 422);
    const result = await core(c.env).inviteCompany(d.uid(c), {
      company: v.company ?? '',
      kind: PARTNER_KINDS.includes(v.kind as PartnerKind) ? (v.kind as PartnerKind) : 'other',
      contactName: v.contact_name ?? '',
      contactEmail: v.contact_email ?? '',
      locale: v.locale === 'en' ? 'en' : 'tr',
      priceList: prices.value,
      reconfirmDays: Number(v.reconfirm_days) || 14,
      ...(v.note ? { note: v.note } : {}),
    });
    if (!result.ok) {
      return showList(
        c,
        d.errorText(result.error, result.detail),
        v,
        result.error === 'already_invited' ? 409 : 422,
      );
    }
    return c.redirect(
      `/onboarding/${result.value.id}?done=${result.value.emailed ? 'invited' : 'invited_unsent'}`,
      303,
    );
  });

  const show = async (c: AppContext, message: string | null, status: 200 | 409 | 422 = 200) => {
    const id = c.req.param('id') ?? '';
    const [found, checklist] = await Promise.all([
      core(c.env).onboarding(id),
      core(c.env).approvalChecklist(d.uid(c), id),
    ]);
    if (!found.ok) return d.notFound(c);
    return c.html(
      pages.onboardingDetail(
        d.nav(c),
        found.value,
        d.uid(c),
        d.may(c, 'emanet:control.change'),
        d.fresh(c),
        d.done(c),
        message,
        found.value.status === 'signed' && checklist.ok ? checklist.value : null,
      ),
      status,
    );
  };

  app.get('/onboarding/:id', (c) => show(c, null));

  const after = (c: AppContext, done: string) =>
    c.redirect(`/onboarding/${c.req.param('id') ?? ''}?done=${done}`, 303);

  app.post('/onboarding/:id/resend', async (c) => {
    const denied = d.changer(c);
    if (denied) return denied;
    const result = await core(c.env).resendInvitation(d.uid(c), c.req.param('id'));
    if (!result.ok) return show(c, d.errorText(result.error), 409);
    return after(c, result.value.emailed ? 'resent' : 'invited_unsent');
  });

  for (const [action, done] of [
    ['cancel', 'cancelled'],
    ['return', 'returned'],
    ['reject', 'declined'],
  ] as const) {
    app.post(`/onboarding/:id/${action}`, async (c) => {
      const denied = d.changer(c);
      if (denied) return denied;
      const { reason = '' } = await d.formValues(c);
      const id = c.req.param('id');
      const api = core(c.env);
      const result =
        action === 'cancel'
          ? await api.cancelOnboarding(d.uid(c), id, reason)
          : action === 'return'
            ? await api.returnOnboarding(d.uid(c), id, reason)
            : await api.rejectOnboarding(d.uid(c), id, reason);
      if (!result.ok) return show(c, d.errorText(result.error), 422);
      return after(c, done);
    });
  }

  app.post('/onboarding/:id/approve', async (c) => {
    const denied = d.sensitive(c, `/onboarding/${c.req.param('id')}`);
    if (denied) return denied;
    const result = await core(c.env).approveOnboarding(d.uid(c), c.req.param('id'));
    if (!result.ok) return show(c, d.errorText(result.error), 409);
    return after(c, 'onboarded');
  });

  // A company's document, from R2, only through its onboarding.
  app.get('/onboarding/:id/documents/:document', async (c) => {
    const found = await core(c.env).onboarding(c.req.param('id'));
    const item = found.ok
      ? found.value.documents.find((x) => x.id === c.req.param('document'))
      : undefined;
    if (!item) return d.notFound(c);
    const object = await c.env.DOCUMENTS.get(item.file_ref);
    if (!object) return d.notFound(c);
    await core(c.env).recordView(
      d.uid(c),
      `onboarding:${found.ok ? found.value.id : ''}`,
      `document ${item.id}`,
    );
    const type = object.httpMetadata?.contentType ?? '';
    const known = /^(application\/pdf|image\/jpeg|image\/png)$/.test(type);
    return new Response(object.body, {
      headers: {
        'Content-Type': known ? type : 'application/octet-stream',
        'Content-Disposition': known ? 'inline' : `attachment; filename="${item.id}"`,
        // A PDF viewer gets no scripts, no forms and no access to this site.
        'Content-Security-Policy': 'sandbox',
        'Cache-Control': 'private, no-store',
      },
    });
  });
}
