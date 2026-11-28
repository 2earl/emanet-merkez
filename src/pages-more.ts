/**
 * The Settings page and the handbook. Both are mostly explanation, so their words are written in
 * both languages where they are used (src/settings-text.ts, src/guide.ts) and the blocks are
 * marked translate="no"; the short labels shared with other pages still come from the catalogue.
 */
import type { PayoutRule, Provider, ProviderRecord, SettingInfo } from './core';
import { CHAPTERS, withValues, type Chapter } from './guide';
import { icon, scene, type IconName } from './icons';
import { currentLocale } from './i18n';
import {
  L,
  attr,
  confirmFirst,
  data,
  day,
  error,
  esc,
  layout,
  lira,
  liraInput,
  notice,
  type Nav,
} from './pages';
import {
  GROUP_TEXT,
  SETTING_GROUPS,
  SETTING_TEXT,
  editSetting,
  showRange,
  showSetting,
  unitWord,
  type SettingGroup,
} from './settings-text';

const GROUP_ICON: Record<SettingGroup, IconName> = {
  search: 'search',
  review: 'reviews',
  agents: 'agents',
  partners: 'partners',
  money: 'money',
  privacy: 'privacy',
  operations: 'system',
};

const locale = () => (currentLocale() === 'tr' ? 'tr' : 'en');

/** "Default 24 hours · allowed 1 to 336 hours · changed 2026-11-28". */
function settingMeta(s: SettingInfo): string {
  const l = locale();
  const parts = [
    `${L('Default', 'Varsayılan')}: ${showSetting(s.unit, s.default, l)}`,
    ...(s.unit === 'switch'
      ? []
      : [`${L('Allowed', 'İzin verilen')}: ${showRange(s.unit, s.min, s.max, l)}`]),
  ];
  const changed =
    s.updated_at === null ? '' : ` · ${esc(L('Changed', 'Değiştirildi'))} ${day(s.updated_at)}`;
  return `<p class="setting-meta">${esc(parts.join(' · '))}${changed}</p>`;
}

function settingRow(s: SettingInfo, act: boolean): string {
  const l = locale();
  const words = SETTING_TEXT[s.key][l];
  const changed = s.value !== s.default;
  const unit = unitWord(s.unit, l);
  const field =
    s.unit === 'switch'
      ? `<label class="visually-hidden" for="f-${s.key}">${esc(words.label)}</label><select id="f-${s.key}" name="${s.key}"><option value="1"${s.value === 1 ? ' selected' : ''}>${L('On', 'Açık')}</option><option value="0"${s.value === 0 ? ' selected' : ''}>${L('Off', 'Kapalı')}</option></select>`
      : `<label class="visually-hidden" for="f-${s.key}">${esc(words.label)}</label><span class="with-unit"><input id="f-${s.key}" name="${s.key}" required inputmode="decimal" value="${attr(editSetting(s.unit, s.value))}">${unit ? `<span>${esc(unit)}</span>` : ''}</span>`;
  const value = act
    ? field
    : `<strong class="setting-now">${esc(showSetting(s.unit, s.value, l))}</strong>`;
  return `<div class="setting${changed ? ' changed' : ''}" id="s-${s.key}">
    <div class="setting-text">
      <h3>${esc(words.label)}${changed ? ` <span class="status pending">${esc(L('Changed', 'Değiştirildi'))}</span>` : ''}</h3>
      <p>${esc(words.help)}</p>
      ${settingMeta(s)}
    </div>
    <div class="setting-value">${value}${
      act && changed
        ? `<button class="link" type="submit" form="reset-${s.key}">${esc(L('Back to default', 'Varsayılana dön'))}</button>`
        : ''
    }</div>
  </div>`;
}

export function settingsPage(
  nav: Nav,
  settings: SettingInfo[],
  rule: { rule: PayoutRule; valid_from: number } | null,
  canChange: boolean,
  fresh: boolean,
  noticeText: string | null,
  errorText: string | null,
  provider: ProviderRecord | null,
  providerValues: Partial<Record<keyof Provider, string>> | null,
  dev: { until: number | null; act: boolean } | null = null,
): string {
  const act = canChange && fresh;
  const l = locale();
  const pv = (key: keyof Provider) =>
    attr(
      providerValues?.[key] ??
        provider?.details[key] ??
        (key === 'email' ? 'iletisim@emanet.dev' : ''),
    );
  const providerSection = `<section id="g-company" class="setting-group"><h2>${icon('onboarding')}<span>2earl’s company details</span></h2>
     <p class="hint">The agreement companies accept names 2earl with these details. Until they are set, companies can read the agreement but not accept it. A change applies to agreements accepted from now on; accepted ones keep their text.</p>
     ${provider ? '' : '<p class="error">Not set yet: no company can accept the agreement.</p>'}
     ${
       act
         ? `<form method="post" action="/settings/provider" class="stack">
             <label>Legal name <input name="name" required maxlength="200" value="${pv('name')}"></label>
             <label>Registered address <input name="address" required maxlength="400" value="${pv('address')}"></label>
             <div class="grid2">
               <label>Tax office <input name="taxOffice" required maxlength="100" value="${pv('taxOffice')}"></label>
               <label>Tax number (VKN) <input name="vkn" required inputmode="numeric" pattern="[0-9]{10}" maxlength="10" value="${pv('vkn')}"></label>
               <label>MERSİS number <input name="mersis" required inputmode="numeric" pattern="[0-9]{16}" maxlength="16" value="${pv('mersis')}"></label>
               <label>KEP address <input name="kep" type="email" required maxlength="254" value="${pv('kep')}"></label>
               <label>Email for notices <input name="email" type="email" required maxlength="254" value="${pv('email')}"></label>
             </div>
             <div><button type="submit">Save company details</button></div>
           </form>`
         : provider
           ? `<div class="panel"><dl class="facts">
               <dt>Legal name</dt><dd>${data(provider.details.name)}</dd>
               <dt>Registered address</dt><dd>${data(provider.details.address)}</dd>
               <dt>Tax office and number</dt><dd>${data(`${provider.details.taxOffice} · ${provider.details.vkn}`)}</dd>
               <dt>MERSİS</dt><dd>${data(provider.details.mersis)}</dd>
               <dt>KEP</dt><dd>${data(provider.details.kep)}</dd>
               <dt>Email for notices</dt><dd>${data(provider.details.email)}</dd>
               <dt>Last changed</dt><dd>${day(provider.updated_at)}</dd>
             </dl></div>`
           : ''
     }</section>`;

  const groups = SETTING_GROUPS.map((group) => {
    const words = GROUP_TEXT[group][l];
    const rows = settings.filter((s) => s.group === group);
    const body = rows.map((s) => settingRow(s, act)).join('');
    return `<section id="g-${group}" class="setting-group" translate="no">
      <h2>${icon(GROUP_ICON[group])}<span>${esc(words.label)}</span></h2>
      <p class="hint">${esc(words.help)}</p>
      ${
        act
          ? `<form method="post" action="/settings" class="settings-form">${body}<div class="setting-save"><button type="submit">${esc(L('Save', 'Kaydet'))}: ${esc(words.label)}</button></div></form>`
          : `<div class="settings-form">${body}</div>`
      }
    </section>`;
  }).join('');
  // The reset buttons sit inside each group's form but submit these: a form can't hold a form.
  const resets = act
    ? settings
        .filter((s) => s.value !== s.default)
        .map(
          (s) =>
            `<form method="post" action="/settings/reset" id="reset-${s.key}" hidden><input type="hidden" name="key" value="${s.key}"></form>`,
        )
        .join('')
    : '';

  const r = rule?.rule;
  const ruleText = r
    ? r.share_bp !== undefined
      ? `${data(`${String(r.share_bp / 100)} %`)} of the partner’s fee`
      : `${lira(r.fixed_kurus ?? 0)} per delivery`
    : 'None. Deliveries can’t be confirmed without a payout rule.';
  const paySection = `<section id="g-pay" class="setting-group"><h2>${icon('wallet')}<span>Agents’ pay</span></h2>
     <div class="panel"><dl class="facts">
       <dt>Paid per delivery</dt><dd>${ruleText}</dd>
       ${r?.min_kurus !== undefined ? `<dt>At least</dt><dd>${lira(r.min_kurus)}</dd>` : ''}
       ${r?.max_kurus !== undefined ? `<dt>At most</dt><dd>${lira(r.max_kurus)}</dd>` : ''}
       <dt>Valid from</dt><dd>${day(rule?.valid_from ?? null)}</dd>
     </dl></div>
     ${
       act
         ? `<form method="post" action="/settings/payout-rule" class="stack">
             <div class="grid2">
               <label>Share of the fee (%) <input name="share" inputmode="decimal" value="${attr(r?.share_bp !== undefined ? String(r.share_bp / 100) : '')}"></label>
               <label>Or a fixed amount (₺) <input name="fixed" inputmode="decimal" value="${attr(r?.fixed_kurus !== undefined ? liraInput(r.fixed_kurus) : '')}"></label>
               <label>At least (₺) <input name="min" inputmode="decimal" value="${attr(r?.min_kurus !== undefined ? liraInput(r.min_kurus) : '')}"></label>
               <label>At most (₺) <input name="max" inputmode="decimal" value="${attr(r?.max_kurus !== undefined ? liraInput(r.max_kurus) : '')}"></label>
             </div>
             <p class="hint">Fill in a share or a fixed amount, not both. A payout is never more than the partner’s fee. The new rule applies to deliveries confirmed from now on.</p>
             <div><button type="submit">Save payout rule</button></div>
           </form>`
         : ''
     }</section>`;

  const devSection = dev
    ? `<section id="g-dev" class="setting-group" translate="no"><h2>${icon('alert')}<span>${esc(L('Development mode', 'Geliştirme modu'))}</span></h2>
       <p class="hint">${esc(L('For testing before there is a test environment. While it is on: the sign-off and e-Devlet document checks are lifted, and whoever invited a company may approve it. IBAN checks and the second approver on large payouts stay. It switches itself off after twelve hours, and every switch is in the audit log. What you create meanwhile is real data: use test data only.', 'Test ortamı olana kadar deneme için. Açıkken: onay ve e-Devlet belge kontrolleri kalkar, bir şirketi davet eden kişi onu onaylayabilir. IBAN kontrolü ve büyük ödemelerde ikinci onaylayan kalır. On iki saat sonra kendiliğinden kapanır, her değişiklik denetim kaydındadır. Bu sürede oluşturduklarınız gerçek veridir: yalnızca deneme verisi kullanın.'))}</p>
       <p>${dev.until ? `<strong>${esc(L('On.', 'Açık.'))}</strong> ${esc(L('Ends at', 'Bitiş:'))} ${esc(new Intl.DateTimeFormat(l === 'tr' ? 'tr-TR' : 'en-GB', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Istanbul' }).format(new Date(dev.until * 1000)))}` : `<strong>${esc(L('Off.', 'Kapalı.'))}</strong>`}</p>
       ${
         dev.act
           ? `<form method="post" action="/settings/dev-mode"><input type="hidden" name="on" value="${dev.until ? '0' : '1'}"><button class="${dev.until ? '' : 'secondary'}" type="submit">${esc(dev.until ? L('Switch off', 'Kapat') : L('Switch on for twelve hours', 'On iki saatliğine aç'))}</button></form>`
           : confirmFirst('/settings')
       }</section>`
    : '';
  const changedCount = settings.filter((s) => s.value !== s.default).length;
  const toc = `<nav class="toc" aria-labelledby="toc-title" translate="no">
      <strong id="toc-title">${esc(L('On this page', 'Bu sayfada'))}</strong>
      <a href="#g-company">${esc(L('Company details', 'Şirket bilgileri'))}</a>
      ${SETTING_GROUPS.map((g) => `<a href="#g-${g}">${esc(GROUP_TEXT[g][l].label)}</a>`).join('')}
      <a href="#g-pay">${esc(L('Agents’ pay', 'Görevli ödemesi'))}</a>
      ${dev ? `<a href="#g-dev">${esc(L('Development mode', 'Geliştirme modu'))}</a>` : ''}
      <a class="toc-more" href="/guide/settings">${icon('guide')}<span>${esc(L('Configuration reference', 'Yapılandırma başvurusu'))}</span></a>
    </nav>`;

  return layout(
    'Settings',
    { ...nav, current: 'settings' },
    `${notice(noticeText)}
     <header class="page-head"><div><h1>Settings</h1>
       <p class="lede" translate="no">${esc(L(`${String(settings.length)} settings in ${String(SETTING_GROUPS.length)} groups; ${String(changedCount)} differ from their default. Every change is recorded in the audit log with the old and new value.`, `${String(SETTING_GROUPS.length)} grupta ${String(settings.length)} ayar; ${String(changedCount)} tanesi varsayılandan farklı. Her değişiklik eski ve yeni değeriyle denetim kaydına işlenir.`))}</p></div></header>
     ${error(errorText)}
     ${canChange && !fresh ? confirmFirst('/settings') : ''}
     <div class="with-toc">${toc}<div class="toc-body">
       ${providerSection}
       ${groups}
       ${devSection}
       ${paySection}
     </div></div>
     ${resets}`,
  );
}

// ---- Handbook ------------------------------------------------------------------------------------

/** The settings as the handbook's configuration chapter: every one, with what it does and its value. */
function settingsReference(settings: SettingInfo[]): string {
  const l = locale();
  return SETTING_GROUPS.map((group) => {
    const rows = settings
      .filter((s) => s.group === group)
      .map(
        (s) =>
          `<tr><td><strong>${esc(SETTING_TEXT[s.key][l].label)}</strong><br><code>${s.key}</code></td><td>${esc(SETTING_TEXT[s.key][l].help)}</td><td>${esc(showSetting(s.unit, s.value, l))}</td><td>${esc(showSetting(s.unit, s.default, l))}</td><td>${s.unit === 'switch' ? '—' : esc(showRange(s.unit, s.min, s.max, l))}</td></tr>`,
      )
      .join('');
    return `<h2>${esc(GROUP_TEXT[group][l].label)}</h2><p>${esc(GROUP_TEXT[group][l].help)}</p>
      <table class="reference"><thead><tr><th>${L('Setting', 'Ayar')}</th><th>${L('What it does', 'Ne yapar')}</th><th>${L('Now', 'Şu an')}</th><th>${L('Default', 'Varsayılan')}</th><th>${L('Allowed', 'İzin verilen')}</th></tr></thead><tbody>${rows}</tbody></table>`;
  }).join('');
}

const SETTINGS_CHAPTER = {
  slug: 'settings',
  icon: 'settings' as IconName,
  title: { en: 'Configuration reference', tr: 'Yapılandırma başvurusu' },
  summary: {
    en: 'Every setting: what it does, its value now, its default and the range it may take.',
    tr: 'Her ayar: ne yaptığı, şu anki değeri, varsayılanı ve alabileceği aralık.',
  },
};

const allChapters = () => {
  const list: Pick<Chapter, 'slug' | 'icon' | 'title' | 'summary'>[] = [...CHAPTERS];
  // Before the glossary, which closes the book.
  list.splice(list.length - 1, 0, SETTINGS_CHAPTER);
  return list;
};

export const guideSlugs = () => allChapters().map((c) => c.slug);

export function guideIndex(nav: Nav): string {
  const l = locale();
  const cards = allChapters()
    .map(
      (c, index) =>
        `<a class="chapter" href="/guide/${c.slug}"><span class="chapter-icon">${icon(c.icon)}</span><span class="chapter-no">${String(index + 1).padStart(2, '0')}</span><strong>${esc(c.title[l])}</strong><span>${esc(c.summary[l])}</span></a>`,
    )
    .join('');
  return layout(
    'Handbook',
    { ...nav, current: 'guide' },
    `<div translate="no" lang="${l}">
       <header class="page-head guide-head"><div><h1>${esc(L('Handbook', 'El kitabı'))}</h1>
         <p class="lede">${esc(L('How Emanet works: the flows, who decides what, the deadlines, and what the words mean. Read it once from the top; come back to a chapter when you need it.', 'Emanet nasıl çalışır: akışlar, kimin neye karar verdiği, süreler ve terimlerin anlamı. Bir kez baştan okuyun; gerektiğinde ilgili bölüme dönün.'))}</p></div>
         ${scene('documents')}</header>
       <div class="chapters">${cards}</div>
     </div>`,
  );
}

export function guideChapter(nav: Nav, slug: string, settings: SettingInfo[]): string | null {
  const l = locale();
  const list = allChapters();
  const index = list.findIndex((c) => c.slug === slug);
  const head = list[index];
  if (!head) return null;
  const full = CHAPTERS.find((c) => c.slug === slug);
  const byKey = new Map(settings.map((s) => [s.key as string, s]));
  const body = full
    ? withValues(full.body(l), (key) => {
        const s = byKey.get(key);
        return s ? esc(showSetting(s.unit, s.value, l)) : null;
      })
    : settingsReference(settings);
  const prev = list[index - 1];
  const next = list[index + 1];
  const side = list
    .map(
      (c) =>
        `<a href="/guide/${c.slug}"${c.slug === slug ? ' aria-current="page"' : ''}>${esc(c.title[l])}</a>`,
    )
    .join('');
  return layout(
    'Handbook',
    { ...nav, current: 'guide' },
    `<div translate="no" lang="${l}">
       <p class="crumbs"><a href="/guide">${esc(L('Handbook', 'El kitabı'))}</a> <span aria-hidden="true">/</span> ${esc(head.title[l])}</p>
       <div class="with-toc">
         <nav class="toc" aria-labelledby="toc-title"><strong id="toc-title">${esc(L('Chapters', 'Bölümler'))}</strong>${side}</nav>
         <article class="prose toc-body">
           <h1>${icon(head.icon)}<span>${esc(head.title[l])}</span></h1>
           <p class="lede">${esc(head.summary[l])}</p>
           ${body}
           <nav class="pager">
             ${prev ? `<a href="/guide/${prev.slug}"><span>${esc(L('Previous', 'Önceki'))}</span><strong>${esc(prev.title[l])}</strong></a>` : '<span></span>'}
             ${next ? `<a class="next" href="/guide/${next.slug}"><span>${esc(L('Next', 'Sonraki'))}</span><strong>${esc(next.title[l])}</strong></a>` : ''}
           </nav>
         </article>
       </div>
     </div>`,
  );
}
