/**
 * Vetting an applicant, readiness for the first customer, the accountant's month, and search.
 * Explanation-heavy pages: their words are written in both languages here (L) and the blocks are
 * marked translate="no".
 */
import type {
  ActivationChecklist,
  Acceptance,
  AccountingMonth,
  AgentDocument,
  AgentRow,
  PartnerRow,
  Readiness,
  ReadinessCheck,
} from './core';
import { icon, scene, type IconName } from './icons';
import { DOCUMENT_NAME } from './pages-requests';
import {
  L,
  attr,
  confirmFirst,
  day,
  error,
  esc,
  layout,
  lira,
  moment,
  notice,
  type Nav,
} from './pages';

// ---- An applicant's documents and acceptance --------------------------------------------------------

const DOC_NAME: Record<string, [string, string]> = DOCUMENT_NAME;
const E_DEVLET: readonly string[] = ['criminal_record', 'population_record', 'residence_record'];

const OUTCOME: Record<string, [string, string, string]> = {
  clear: ['Clear', 'Temiz', 'active'],
  has_record: ['Has a record', 'Kaydı var', 'rejected'],
  mismatch: ['Doesn’t match', 'Eşleşmiyor', 'rejected'],
  invalid: ['Not valid', 'Geçersiz', 'rejected'],
};

/** The vetting part of an agent's page: what they accepted, and each document with how to check it. */
export function vettingPanel(
  agent: AgentRow,
  documents: AgentDocument[],
  accepted: Acceptance | null,
  act: boolean,
): string {
  const path = `/agents/${agent.user_id}`;
  const acceptance = accepted
    ? `<p class="${accepted.current ? 'fact-line' : 'error'}">${icon(accepted.current ? 'check' : 'alert')}<span>${esc(
        accepted.current
          ? L(
              `Accepted the agent agreement, the privacy notice and the explicit consent, version ${accepted.version}, on`,
              `Saha görevlisi sözleşmesini, aydınlatma metnini ve açık rızayı onayladı; sürüm ${accepted.version}, tarih`,
            )
          : L(
              `Accepted an older version (${accepted.version}); must accept the current text. Accepted on`,
              `Eski bir sürümü (${accepted.version}) onayladı; güncel metni onaylamalı. Onay tarihi`,
            ),
      )} ${moment(accepted.accepted_at)}</span></p>
       <p class="hint">${esc(L('Digest of the accepted text:', 'Onaylanan metnin özeti:'))} <code>${esc(accepted.sha256.slice(0, 16))}…</code></p>`
    : `<p class="hint">${esc(L('Nothing accepted yet: the application hasn’t been sent with the current agreement.', 'Henüz onay yok: başvuru güncel sözleşmeyle gönderilmedi.'))}</p>`;
  const one = (kind: AgentDocument['kind'], given?: AgentDocument) => {
    const doc = given ?? documents.find((d) => d.kind === kind);
    const name = L(...(DOC_NAME[kind] ?? [kind, kind]));
    const barcoded = E_DEVLET.includes(kind);
    if (!doc) {
      return `<li><div class="doc-head"><strong>${icon('file')}${esc(name)}</strong><span class="status pending">${esc(L('Not uploaded', 'Yüklenmedi'))}</span></div></li>`;
    }
    const outcome = doc.outcome ? OUTCOME[doc.outcome] : null;
    const state = outcome
      ? `<span class="status ${outcome[2]}">${esc(L(outcome[0], outcome[1]))}</span>`
      : `<span class="status kyc_pending">${esc(L('To verify', 'Doğrulanacak'))}</span>`;
    const decided =
      doc.status === 'uploaded'
        ? ''
        : `<p class="hint">${esc(L('Decided', 'Karar'))} ${day(doc.decided_at ?? null)}${doc.note ? ` · ${esc(doc.note)}` : ''} · ${esc(L('The file has been deleted; only this result is kept.', 'Dosya silindi; yalnızca bu sonuç saklanıyor.'))}</p>`;
    const work =
      doc.status === 'uploaded' && doc.file_ref
        ? `<div class="doc-work">
             <p><a class="button secondary" href="${path}/documents/${attr(doc.id)}" target="_blank" rel="noopener">${icon('file')}<span>${esc(L('Open the document', 'Belgeyi aç'))}</span></a>
               ${doc.barcode ? `<span class="barcode">${esc(L('Barcode', 'Barkod'))}: <code>${esc(doc.barcode)}</code></span>` : ''}</p>
             ${
               barcoded
                 ? `<ol class="steps">
               <li>${L('Phone: open the <strong>e-Devlet</strong> app → <strong>Barkodlu Belge Doğrulama</strong> → scan the QR code on the opened document.', 'Telefon: <strong>e-Devlet</strong> uygulaması → <strong>Barkodlu Belge Doğrulama</strong> → açtığınız belgedeki karekodu okutun.')}</li>
               <li>${L('Or computer: <a href="https://www.turkiye.gov.tr/belge-dogrulama" target="_blank" rel="noopener noreferrer">turkiye.gov.tr/belge-dogrulama</a> → enter the barcode number above (and the ID number, if asked: get it from the applicant on the call).', 'Ya da bilgisayar: <a href="https://www.turkiye.gov.tr/belge-dogrulama" target="_blank" rel="noopener noreferrer">turkiye.gov.tr/belge-dogrulama</a> → yukarıdaki barkod numarasını girin (istenirse kimlik numarasını görüşmede başvurandan alın).')}</li>
               <li>${esc(L(`Compare what e-Devlet shows with the upload: the name is “${agent.legal_name ?? '—'}”, the document is a ${name}, issued in the last 30 days, and the content is identical.`, `e-Devlet’in gösterdiğini yüklenenle karşılaştırın: ad “${agent.legal_name ?? '—'}”, belge türü ${name}, son 30 gün içinde verilmiş ve içerik birebir aynı.`))}</li>
             </ol>`
                 : `<ol class="steps">
               <li>${esc(L(`Open the document and read it against this page: the name is “${agent.legal_name ?? '—'}”, and it shows what you asked for.`, `Belgeyi açın ve bu sayfayla karşılaştırın: ad “${agent.legal_name ?? '—'}” ve istediğiniz şeyi gösteriyor.`))}</li>
               <li>${esc(kind === 'bank_proof' ? L(`The IBAN on it is the one on this page, letter for letter, and the account holder is this person. Then mark the IBAN verified below.`, `Üzerindeki IBAN bu sayfadakiyle harfi harfine aynı ve hesap sahibi bu kişi. Ardından aşağıda IBAN’ı doğrulanmış olarak işaretleyin.`) : kind === 'tax_certificate' ? L('The tax number on it is the one on this page; you can check a vergi levhası by its code at ivd.gib.gov.tr.', 'Üzerindeki vergi numarası bu sayfadakiyle aynı; vergi levhasını ivd.gib.gov.tr’de kodu ile doğrulayabilirsiniz.') : L('It is readable, complete and not visibly altered. If in doubt, ask to see the original on the video call.', 'Okunaklı, eksiksiz ve gözle görülür bir değişiklik yok. Şüphe varsa aslını görüntülü görüşmede isteyin.'))}</li>
             </ol>`
             }
             ${
               act
                 ? `<form method="post" action="${path}/documents/${attr(doc.id)}/decide" class="stack">
                      <div class="grid2">
                        <label>${esc(barcoded ? L('What e-Devlet showed', 'e-Devlet ne gösterdi') : L('What you found', 'Ne buldunuz'))} <select name="outcome" required>
                          <option value="">${esc(L('Choose', 'Seçin'))}</option>
                          <option value="clear">${esc(L('Clear: valid, this person, nothing against them', 'Temiz: geçerli, bu kişiye ait, engel yok'))}</option>
                          ${kind === 'criminal_record' ? `<option value="has_record">${esc(L('Has a record', 'Kaydı var'))}</option>` : ''}
                          <option value="mismatch">${esc(L('Doesn’t match: another person, or altered', 'Eşleşmiyor: başka kişi ya da değiştirilmiş'))}</option>
                          <option value="invalid">${esc(L('Not valid: barcode not found, old or unreadable', 'Geçersiz: barkod bulunamadı, eski ya da okunamıyor'))}</option>
                        </select></label>
                        <label>${esc(L('Reason (needed unless clear)', 'Gerekçe (temiz değilse zorunlu)'))} <input name="note" maxlength="200"></label>
                      </div>
                      <p class="hint">${esc(kind === 'criminal_record' ? L('Never write what a criminal record says. With your decision the file is deleted; only the outcome stays.', 'Adli sicil kaydında ne yazdığını asla not etmeyin. Kararınızla birlikte dosya silinir; yalnızca sonuç kalır.') : L('With your decision the file is deleted; only the outcome stays.', 'Kararınızla birlikte dosya silinir; yalnızca sonuç kalır.'))}</p>
                      <div><button type="submit">${esc(L('Record the result', 'Sonucu kaydet'))}</button></div>
                    </form>`
                 : ''
             }
           </div>`
        : '';
    return `<li><div class="doc-head"><strong>${icon('file')}${esc(name)}</strong>${state}</div>${decided}${work}</li>`;
  };
  return `<section class="vetting" translate="no">
      <h2>${esc(L('Agreement and documents', 'Sözleşme ve belgeler'))}</h2>
      ${acceptance}
      <ul class="docs-list">${one('criminal_record')}${one('population_record')}${documents
        .filter((d) => d.kind !== 'criminal_record' && d.kind !== 'population_record')
        .map((d) => one(d.kind, d))
        .join('')}</ul>
      <p class="hint"><a href="/guide/documents">${esc(L('How to verify an e-Devlet document, step by step', 'e-Devlet belgesi adım adım nasıl doğrulanır'))}</a></p>
    </section>`;
}

// ---- Readiness -------------------------------------------------------------------------------------

const CHECK_TEXT: Record<string, { en: [string, string]; tr: [string, string]; href?: string }> = {
  company_details: {
    en: [
      '2earl’s company details are set',
      'The agreement names the company with them. Settings → Company details.',
    ],
    tr: [
      '2earl şirket bilgileri girildi',
      'Sözleşme şirketi bu bilgilerle tanımlar. Ayarlar → Şirket bilgileri.',
    ],
    href: '/settings#g-company',
  },
  payout_rule: {
    en: [
      'A payout rule is set',
      'Without one no delivery can be confirmed. Settings → Agents’ pay.',
    ],
    tr: ['Ödeme kuralı tanımlı', 'Tanımlı değilse teslim onaylanamaz. Ayarlar → Görevli ödemesi.'],
    href: '/settings#g-pay',
  },
  encryption_key: {
    en: [
      'The encryption key is in place',
      'Personal fields and ID numbers are sealed with it. The deploy creates it.',
    ],
    tr: [
      'Şifreleme anahtarı yerinde',
      'Kişisel alanlar ve kimlik numaraları bununla şifrelenir. Dağıtım sırasında oluşturulur.',
    ],
  },
  service_agreement_final: {
    en: [
      'The service agreement is no longer a draft',
      'Its version still says draft. When the lawyer has finished, the developer sets the final version.',
    ],
    tr: [
      'Hizmet sözleşmesi artık taslak değil',
      'Sürümü hâlâ taslak. Avukat işini bitirince geliştirici nihai sürümü tanımlar.',
    ],
  },
  agent_agreement_final: {
    en: [
      'The agent agreement is no longer a draft',
      'Its version still says draft. When the lawyer has finished, the developer sets the final version.',
    ],
    tr: [
      'Saha görevlisi sözleşmesi artık taslak değil',
      'Sürümü hâlâ taslak. Avukat işini bitirince geliştirici nihai sürümü tanımlar.',
    ],
  },
  legal_service_agreement: {
    en: [
      'Service agreement reviewed',
      'The text companies accept: scope, fees, liability, confidentiality, the outsourcing clauses banks need.',
    ],
    tr: [
      'Hizmet sözleşmesi incelendi',
      'Kurumların onayladığı metin: kapsam, ücret, sorumluluk, gizlilik, bankaların aradığı destek hizmeti hükümleri.',
    ],
  },
  legal_agent_agreement: {
    en: [
      'Agent agreement reviewed',
      'The agreement, the privacy notice and the explicit consent an agent accepts (saha.emanet.dev/agreement).',
    ],
    tr: [
      'Saha görevlisi sözleşmesi incelendi',
      'Görevlinin onayladığı sözleşme, aydınlatma metni ve açık rıza (saha.emanet.dev/agreement).',
    ],
  },
  legal_privacy: {
    en: [
      'Privacy arrangements reviewed',
      'The notices on emanet.dev, the VERBİS assessment, the standard contract for storage in the EU and its notification, the retention periods in Settings.',
    ],
    tr: [
      'Gizlilik düzeni incelendi',
      'emanet.dev’deki aydınlatma metinleri, VERBİS değerlendirmesi, AB’de saklama için standart sözleşme ve bildirimi, Ayarlar’daki saklama süreleri.',
    ],
  },
  accounting_setup: {
    en: [
      'Accounting set up',
      'The VAT rate, the three withholding rates, which document is issued for which payment, and the chart-of-accounts mapping.',
    ],
    tr: [
      'Muhasebe düzeni kuruldu',
      'KDV oranı, üç stopaj oranı, hangi ödemeye hangi belgenin düzenleneceği ve hesap planı eşlemesi.',
    ],
  },
};

function checkRow(check: ReadinessCheck, act: boolean): string {
  const l = L('en', 'tr') as 'en' | 'tr';
  const text = CHECK_TEXT[check.key]?.[l] ?? [check.key, ''];
  const href = CHECK_TEXT[check.key]?.href;
  const who =
    check.kind === 'signoff'
      ? `<span class="who-signs">${esc(check.by === 'accountant' ? L('Accountant', 'Mali müşavir') : L('Lawyer', 'Avukat'))}</span>`
      : '';
  const record =
    check.kind !== 'signoff'
      ? ''
      : check.ok
        ? `<p class="hint">${esc(L('Signed by', 'Onaylayan'))} <strong>${esc(check.signer ?? '')}</strong> · ${day(check.signed_at ?? null)} · ${esc(L('version', 'sürüm'))} <code>${esc(check.version ?? '')}</code>${check.note ? ` · ${esc(check.note)}` : ''}</p>`
        : check.signer
          ? `<p class="error">${esc(L(`Signed for an older version (${check.signed_version ?? ''}) by ${check.signer}. The text has changed: it needs signing again for`, `${check.signer} tarafından eski bir sürüm (${check.signed_version ?? ''}) için onaylanmış. Metin değişti: şu sürüm için yeniden onay gerekir:`))} <code>${esc(check.version ?? '')}</code></p>`
          : `<p class="hint">${esc(L('To be signed for version', 'Onaylanacak sürüm'))} <code>${esc(check.version ?? '')}</code></p>`;
  const form =
    check.kind === 'signoff' && act
      ? check.ok
        ? `<form method="post" action="/readiness/${check.key}/withdraw"><button class="link" type="submit">${esc(L('Withdraw this sign-off', 'Bu onayı geri al'))}</button></form>`
        : `<form method="post" action="/readiness/${check.key}" class="signoff-form">
             <label>${esc(L('Who confirmed it (name and title)', 'Kim onayladı (ad ve unvan)'))} <input name="signer" required minlength="3" maxlength="120"></label>
             <label>${esc(L('Note (how, when; optional)', 'Not (nasıl, ne zaman; isteğe bağlı)'))} <input name="note" maxlength="300"></label>
             <button type="submit">${esc(L('Record the sign-off', 'Onayı kaydet'))}</button>
           </form>`
      : '';
  return `<li class="check-row ${check.ok ? 'ok' : 'open'}">
      <span class="check-mark">${icon(check.ok ? 'check' : check.kind === 'signoff' ? 'scale' : 'alert')}</span>
      <div><h3>${esc(text[0])}${who}</h3><p>${esc(text[1])}${href && !check.ok ? ` <a href="${href}">${esc(L('Open', 'Aç'))}</a>` : ''}</p>${record}${form}</div>
    </li>`;
}

export function readinessPage(
  nav: Nav,
  r: Readiness,
  canChange: boolean,
  fresh: boolean,
  noticeText: string | null,
  errorText: string | null,
): string {
  const act = canChange && fresh;
  const auto = r.checks.filter((c) => c.kind === 'auto');
  const signs = r.checks.filter((c) => c.kind === 'signoff');
  const open = r.checks.filter((c) => !c.ok).length;
  const verdict = (ready: boolean, yes: string, no: string) =>
    `<div class="verdict ${ready ? 'ok' : 'open'}">${icon(ready ? 'check' : 'lock')}<strong>${esc(ready ? yes : no)}</strong></div>`;
  return layout(
    'Readiness',
    { ...nav, current: 'readiness' },
    `${notice(noticeText)}<div translate="no">
       <header class="page-head"><div><h1>${esc(L('Ready for the first customer', 'İlk müşteriye hazırlık'))}</h1>
         <p class="lede">${esc(open === 0 ? L('Every check has passed.', 'Bütün kontroller tamam.') : L(`${String(open)} of ${String(r.checks.length)} checks are still open.`, `${String(r.checks.length)} kontrolden ${String(open)} tanesi açık.`))} ${esc(r.enforced ? L('While they are open, companies can’t be approved and agents can’t be activated.', 'Açık kaldıkları sürece kurum onaylanamaz, görevli etkinleştirilemez.') : L('The gate is switched off in Settings: nothing is blocked.', 'Kapı Ayarlar’da kapatılmış: hiçbir şey engellenmiyor.'))}</p></div>
         <a class="button secondary" href="/guide/readiness">${icon('guide')}<span>${esc(L('The map of the law', 'Mevzuat haritası'))}</span></a></header>
       ${error(errorText)}
       <div class="verdicts">
         ${verdict(r.partners_ready, L('Companies can be approved', 'Kurumlar onaylanabilir'), L('Companies can’t be approved yet', 'Kurumlar henüz onaylanamaz'))}
         ${verdict(r.agents_ready, L('Agents can be activated', 'Görevliler etkinleştirilebilir'), L('Agents can’t be activated yet', 'Görevliler henüz etkinleştirilemez'))}
       </div>
       ${canChange && !fresh ? confirmFirst('/readiness') : ''}
       <h2>${esc(L('What the system checks itself', 'Sistemin kendi kontrol ettikleri'))}</h2>
       <ul class="checks-list">${auto.map((c) => checkRow(c, false)).join('')}</ul>
       <h2>${esc(L('Sign-offs', 'Onaylar'))}</h2>
       <p class="hint">${esc(L('Record a sign-off when the lawyer or the accountant has read and confirmed the text in writing. It holds for the version shown; a changed text needs a new one. Each is written to the audit log with your name.', 'Avukat ya da mali müşavir metni okuyup yazılı olarak onayladığında onayı kaydedin. Gösterilen sürüm için geçerlidir; metin değişirse yenisi gerekir. Her biri adınızla denetim kaydına işlenir.'))}</p>
       <ul class="checks-list">${signs.map((c) => checkRow(c, act)).join('')}</ul>
     </div>`,
  );
}

// ---- The accountant's month ------------------------------------------------------------------------

const PROFILE: Record<string, [string, string]> = {
  individual: ['Individual', 'Gerçek kişi'],
  sole_trader: ['Sole trader', 'Serbest meslek'],
  company: ['Company', 'Şirket'],
};

const MISSING: Record<string, [string, string]> = {
  name: ['name', 'ad soyad'],
  tckn: ['national ID number', 'T.C. kimlik no'],
  vkn: ['tax number', 'vergi no'],
  address: ['address', 'adres'],
};

export function accountingPage(
  nav: Nav,
  months: { month: string; entries: number; closed: boolean }[],
  m: AccountingMonth | null,
  canChange: boolean,
  noticeText: string | null,
): string {
  const picker =
    months.length === 0
      ? ''
      : `<nav class="tabs">${months
          .map(
            (x) =>
              `<a href="/money/accounting?month=${x.month}"${m?.month === x.month ? ' aria-current="page"' : ''}>${esc(x.month)}${x.closed ? ` ${icon('check')}` : ''}</a>`,
          )
          .join('')}</nav>`;
  if (!m) {
    return layout(
      'Accounting',
      { ...nav, current: 'money' },
      `<div translate="no"><h1>${esc(L('Accounting', 'Muhasebe'))}</h1>
        <div class="panel empty">${scene('documents')}<p>${esc(L('Nothing has been booked yet. The first month appears here with its first invoice.', 'Henüz kayıt yok. İlk ay, ilk faturayla birlikte burada görünür.'))}</p></div>
        <p><a href="/guide/accounting">${esc(L('What the accountant gets each month', 'Mali müşavir her ay ne alır'))}</a></p></div>`,
    );
  }
  const balanced = m.totals.debit === m.totals.credit;
  const tile = (glyph: IconName, value: string, label: string) =>
    `<div>${icon(glyph)}<strong>${value}</strong><span>${esc(label)}</span></div>`;
  const file = (name: string, en: string, tr: string, rows: number) =>
    `<a class="file-link" href="/money/accounting/${m.month}/${name}.csv">${icon('download')}<span><strong>${esc(L(en, tr))}</strong><small>${String(rows)} ${esc(L('rows', 'satır'))} · CSV</small></span></a>`;
  const incomplete =
    m.incomplete.length === 0
      ? ''
      : `<div class="error"><strong>${esc(L('Missing details for a payment document', 'Ödeme belgesi için eksik bilgiler'))}</strong><ul>${m.incomplete
          .map(
            (x) =>
              `<li><a href="/agents/${attr(x.agent_id)}">${esc(x.name ?? x.agent_id)}</a>: ${esc(x.missing.map((k) => L(...(MISSING[k] ?? [k, k]))).join(', '))}</li>`,
          )
          .join('')}</ul></div>`;
  const withholding =
    m.withholding.length === 0
      ? ''
      : `<h2>${esc(L('Withholding by tax profile', 'Vergi durumuna göre stopaj'))}</h2>
         <table><thead><tr><th>${esc(L('Tax profile', 'Vergi durumu'))}</th><th class="num">${esc(L('Payments', 'Ödeme'))}</th><th class="num">${esc(L('Gross', 'Brüt'))}</th><th class="num">${esc(L('Withheld', 'Stopaj'))}</th></tr></thead><tbody>${m.withholding
           .map(
             (w) =>
               `<tr><td>${esc(L(...(PROFILE[w.tax_profile] ?? [w.tax_profile, w.tax_profile])))}</td><td class="num">${String(w.payouts)}</td><td class="num">${lira(w.gross_kurus)}</td><td class="num">${lira(w.withheld_kurus)}</td></tr>`,
           )
           .join('')}</tbody></table>`;
  return layout(
    'Accounting',
    { ...nav, current: 'money' },
    `${notice(noticeText)}<div translate="no">
       <p class="crumbs"><a href="/money">${esc(L('Money', 'Para'))}</a> <span aria-hidden="true">/</span> ${esc(L('Accounting', 'Muhasebe'))}</p>
       <header class="page-head"><div><h1>${esc(L('Accounting', 'Muhasebe'))} · ${esc(m.month)}</h1>
         <p class="lede">${esc(L('Everything booked in this month, Turkey time, as the accountant enters it. Opening this page is recorded, because it reads ID numbers.', 'Bu ayda (Türkiye saati) kayda geçen her şey, mali müşavirin gireceği biçimde. Bu sayfanın açılması, kimlik numaralarını okuduğu için kaydedilir.'))}</p></div>
         <a class="button secondary" href="/guide/accounting">${icon('guide')}<span>${esc(L('How to use this', 'Nasıl kullanılır'))}</span></a></header>
       ${picker}
       ${m.closed ? `<p class="notice">${esc(L('Handed to the accountant on', 'Mali müşavire teslim edildi:'))} ${day(m.closed.at)}</p>` : ''}
       ${incomplete}
       <div class="counts">
         ${tile('invoice', lira(m.totals.invoiced_net), L('Invoiced, net', 'Faturalanan, matrah'))}
         ${tile('scale', lira(m.totals.invoiced_kdv), L('VAT charged', 'Hesaplanan KDV'))}
         ${tile('money', lira(m.totals.received), L('Received', 'Tahsil edilen'))}
         ${tile('wallet', lira(m.totals.paid_gross), L('Paid to agents, gross', 'Görevlilere ödenen, brüt'))}
         ${tile('chart', lira(m.totals.withheld), L('Withheld', 'Kesilen stopaj'))}
       </div>
       <p class="${balanced ? 'fact-line' : 'error'}">${icon(balanced ? 'check' : 'alert')}<span>${esc(balanced ? L('The journal balances: debits equal credits.', 'Yevmiye dengede: borç ve alacak toplamları eşit.') : L('The journal doesn’t balance. Tell the developer before sending anything.', 'Yevmiye dengede değil. Bir şey göndermeden önce geliştiriciye haber verin.'))} ${lira(m.totals.debit)}</span></p>
       <h2>${esc(L('Files for the accountant', 'Mali müşavir için dosyalar'))}</h2>
       <div class="files">
         ${file('invoices', 'Sales invoices', 'Satış faturaları', m.invoices.length)}
         ${file('receipts', 'Receipts', 'Tahsilatlar', m.receipts.length)}
         ${file('payouts', 'Payments to agents', 'Görevli ödemeleri', m.payouts.length)}
         ${file('journal', 'Journal', 'Yevmiye', m.journal.length)}
       </div>
       ${withholding}
       <h2>${esc(L('Payments to agents', 'Görevli ödemeleri'))}</h2>
       ${
         m.payouts.length === 0
           ? `<p class="panel">${esc(L('No payment was sent this month.', 'Bu ay gönderilen ödeme yok.'))}</p>`
           : `<table><thead><tr><th>${esc(L('Paid', 'Ödeme'))}</th><th>${esc(L('Name', 'Ad soyad'))}</th><th>${esc(L('Tax profile', 'Vergi durumu'))}</th><th class="num">${esc(L('Gross', 'Brüt'))}</th><th class="num">${esc(L('Withheld', 'Stopaj'))}</th><th class="num">${esc(L('Net', 'Net'))}</th></tr></thead><tbody>${m.payouts
               .map(
                 (p) =>
                   `<tr><td>${day(p.paid_at)}</td><td><a href="/agents/${attr(p.agent_id)}">${esc(p.name ?? '—')}</a></td><td>${esc(L(...(PROFILE[p.tax_profile] ?? [p.tax_profile, p.tax_profile])))}</td><td class="num">${lira(p.gross_kurus)}</td><td class="num">${lira(p.withholding_kurus)}</td><td class="num">${lira(p.net_kurus)}</td></tr>`,
               )
               .join('')}</tbody></table>
              <p class="hint">${esc(L('ID numbers and addresses are in the file, not on this page.', 'Kimlik numaraları ve adresler bu sayfada değil, dosyadadır.'))}</p>`
       }
       ${
         canChange && !m.closed
           ? `<form method="post" action="/money/accounting/${m.month}/close" class="stack"><p class="hint">${esc(L('When the files have gone to the accountant, mark the month. It can be done once the month is over.', 'Dosyalar mali müşavire gidince ayı işaretleyin. Ay bittikten sonra yapılabilir.'))}</p><div><button class="secondary" type="submit">${esc(L('Mark as handed to the accountant', 'Mali müşavire teslim edildi olarak işaretle'))}</button></div></form>`
           : ''
       }
     </div>`,
  );
}

// ---- CSV for the accountant ------------------------------------------------------------------------

const cell = (value: string | number | null) => {
  const text = value === null ? '' : String(value);
  // A leading =, +, - or @ would be run as a formula by a spreadsheet: keep it text.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
const tl = (kurus: number) => (kurus / 100).toFixed(2).replace('.', ',');
const date = (unix: number | null) =>
  unix === null ? '' : new Date((unix + 3 * 3600) * 1000).toISOString().slice(0, 10);

/** One of the four files, semicolon-separated with a byte-order mark so Excel reads it as UTF-8. */
export function accountingCsv(m: AccountingMonth, name: string): string | null {
  let head: string[];
  let rows: (string | number | null)[][];
  if (name === 'invoices') {
    head = [
      'Fatura No',
      'Tarih',
      'Unvan',
      'VKN',
      'Vergi Dairesi',
      'Matrah',
      'KDV',
      'Toplam',
      'Durum',
      'Dosya Sayisi',
      'Emanet No',
    ];
    rows = m.invoices.map((i) => [
      i.number,
      date(i.issued_at),
      i.partner,
      i.vkn,
      i.tax_office,
      tl(i.net_kurus),
      tl(i.kdv_kurus),
      tl(i.total_kurus),
      i.status,
      i.cases,
      i.id,
    ]);
  } else if (name === 'receipts') {
    head = ['Valor Tarihi', 'Unvan', 'Tutar', 'Banka Referansi', 'Fatura No', 'Emanet No'];
    rows = m.receipts.map((r) => [
      r.value_date,
      r.partner,
      tl(r.amount_kurus),
      r.bank_ref,
      r.invoice_number,
      r.id,
    ]);
  } else if (name === 'payouts') {
    head = [
      'Odeme Tarihi',
      'Ad Soyad',
      'TCKN',
      'VKN',
      'Adres',
      'Vergi Durumu',
      'Brut',
      'Stopaj',
      'Net',
      'IBAN',
      'Banka Referansi',
      'Emanet No',
    ];
    rows = m.payouts.map((p) => [
      date(p.paid_at),
      p.name,
      p.tckn,
      p.vkn,
      p.address,
      p.tax_profile,
      tl(p.gross_kurus),
      tl(p.withholding_kurus),
      tl(p.net_kurus),
      p.iban,
      p.bank_ref,
      p.id,
    ]);
  } else if (name === 'journal') {
    head = [
      'Tarih',
      'Kayit No',
      'Tur',
      'Aciklama',
      'Belge',
      'Hesap Kodu',
      'Hesap Adi',
      'Borc',
      'Alacak',
    ];
    rows = m.journal.map((j) => [
      date(j.occurred_at),
      j.entry_id,
      j.kind,
      j.memo,
      j.ref_id,
      j.account_code,
      j.account_name,
      tl(j.debit_kurus),
      tl(j.credit_kurus),
    ]);
  } else {
    return null;
  }
  return `\uFEFF${[head, ...rows].map((row) => row.map(cell).join(';')).join('\r\n')}\r\n`;
}

// ---- Search ----------------------------------------------------------------------------------------

export function searchPage(
  nav: Nav,
  q: string,
  agents: AgentRow[],
  partners: PartnerRow[],
): string {
  const none = q.length >= 2 && agents.length === 0 && partners.length === 0;
  return layout(
    'Search',
    nav,
    `<div translate="no"><h1>${esc(L('Search', 'Ara'))}</h1>
       <form method="get" action="/search" class="inline"><label>${esc(L('A name, a phone, an email, a tax number', 'Ad, telefon, e-posta, vergi numarası'))} <input name="q" value="${attr(q)}" minlength="2" required autofocus></label><button type="submit">${esc(L('Search', 'Ara'))}</button></form>
       ${none ? `<div class="panel empty">${scene('inbox')}<p>${esc(L('Nothing found among agents and partners.', 'Görevliler ve kurumlar arasında sonuç yok.'))}</p></div>` : ''}
       ${
         partners.length > 0
           ? `<h2>${esc(L('Partners', 'Kurumlar'))}</h2><ul class="results">${partners.map((p) => `<li><a href="/partners/${attr(p.id)}">${icon('partners')}<strong>${esc(p.legal_name)}</strong><span>${esc(p.vkn ?? '')}</span></a></li>`).join('')}</ul>`
           : ''
       }
       ${
         agents.length > 0
           ? `<h2>${esc(L('Agents', 'Saha görevlileri'))}</h2><ul class="results">${agents.map((a) => `<li><a href="/agents/${attr(a.user_id)}">${icon('agents')}<strong>${esc(a.legal_name ?? '—')}</strong><span>${esc([a.city, a.phone, a.email].filter(Boolean).join(' · '))}</span></a></li>`).join('')}</ul>`
           : ''
       }
       ${q.length >= 2 ? `<p class="hint">${esc(L('Looking for a vehicle, a plate or a person’s data?', 'Araç, plaka ya da bir kişinin verisini mi arıyorsunuz?'))} <a href="/privacy?q=${encodeURIComponent(q)}">${esc(L('Search the records on the Privacy page (recorded)', 'Gizlilik sayfasında kayıtlarda arayın (kaydedilir)'))}</a></p>` : ''}
     </div>`,
  );
}

// ---- Activation ------------------------------------------------------------------------------------

const ACTIVATION_TEXT: Record<string, [string, string]> = {
  application: [
    'The application is complete: rules accepted, name, phone, IBAN, ID number, verified email.',
    'Başvuru tam: kurallar onaylandı; ad, telefon, IBAN, kimlik numarası ve doğrulanmış e-posta var.',
  ],
  documents: [
    'Both e-Devlet documents are verified and clear.',
    'İki e-Devlet belgesi de doğrulandı ve temiz çıktı.',
  ],
  requests: ['Every request to the agent is settled.', 'Görevliden istenenlerin hepsi sonuçlandı.'],
  signoffs: [
    'The sign-offs on the Readiness page are recorded.',
    'Hazırlık sayfasındaki onaylar kaydedildi.',
  ],
  video_call: [
    'A video call passed (advised, doesn’t block).',
    'Görüntülü görüşme başarılı (önerilir, engellemez).',
  ],
  iban: [
    'The IBAN is verified (needed before the first payout, doesn’t block).',
    'IBAN doğrulandı (ilk ödemeden önce gerekir, engellemez).',
  ],
};

/** For an application in the identity check: what is done, what is missing, and the way to finish. */
export function activationPanel(agent: AgentRow, list: ActivationChecklist, act: boolean): string {
  const l = L('en', 'tr') as 'en' | 'tr';
  const index = l === 'en' ? 0 : 1;
  const rows = list.items
    .map((item) => {
      const text = ACTIVATION_TEXT[item.key]?.[index] ?? item.key;
      const mark = item.ok ? 'check' : item.blocking ? 'alert' : 'scale';
      const extra =
        item.key === 'requests' && typeof item.detail === 'number' && item.detail > 0
          ? ` ${esc(`(${String(item.detail)})`)} <a href="#requests">${esc(L('See them', 'Göster'))}</a>`
          : item.key === 'signoffs' && Array.isArray(item.detail) && item.detail.length > 0
            ? ` <a href="/readiness">${esc(L('Open Readiness', 'Hazırlığı aç'))}</a>: ${esc(
                item.detail.map((key) => CHECK_TEXT[key]?.[l][0] ?? key).join(', '),
              )}`
            : '';
      return `<li class="${item.ok ? 'fact-line' : item.blocking ? 'error' : 'hint'}">${icon(mark)}<span>${esc(text)}${extra}</span></li>`;
    })
    .join('');
  const open = list.items.some((item) => item.key === 'signoffs' && !item.ok);
  const finish = list.ready
    ? act
      ? `<form method="post" action="/agents/${agent.user_id}/status" class="stack">
           <input type="hidden" name="status" value="active">
           <label>${esc(L('Reason', 'Gerekçe'))} <input name="reason" required maxlength="200" value="${esc(L('video call, ID matched', 'görüntülü görüşme, kimlik eşleşti'))}"></label>
           <div><button type="submit">${esc(L('Make the agent active', 'Görevliyi etkinleştir'))}</button></div>
         </form>`
      : ''
    : `<p class="hint">${esc(L('Activation is refused until every point that blocks is met.', 'Engelleyen her madde karşılanana kadar etkinleştirme reddedilir.'))}${
        open
          ? ` ${esc(L('While you are only testing, an owner can switch off “Sign-offs before admitting anyone” in Settings → Operations.', 'Yalnızca deneme yapıyorsanız sahip, Ayarlar → Operasyon altında “Kabulden önce onaylar” ayarını kapatabilir.'))}`
          : ''
      }</p>`;
  return `<div class="panel" translate="no"><h2>${esc(L('Before you activate', 'Etkinleştirmeden önce'))}</h2>
    <ul class="plain">${rows}</ul>${finish}</div>`;
}
