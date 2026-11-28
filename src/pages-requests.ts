/**
 * Asking an agent for more, erasing an agent on request, and the sealed archive of what was
 * erased (emanet-core docs/DESIGN.md §14). Words in both languages here (L); the blocks are
 * marked translate="no".
 */
import type {
  AgentRequest,
  AgentRow,
  AnsweredRequest,
  ArchiveEntry,
  ArchivePayload,
  ArchiveView,
  Hold,
  RetentionOverview,
  RetentionRow,
  ErasureOverview,
} from './core';
import { icon } from './icons';
import { L, attr, confirmFirst, day, error, esc, layout, moment, notice, type Nav } from './pages';

export const DOCUMENT_NAME: Record<string, [string, string]> = {
  criminal_record: ['Criminal record (adli sicil kaydı)', 'Adli sicil kaydı'],
  population_record: ['Population register extract (nüfus kayıt örneği)', 'Nüfus kayıt örneği'],
  residence_record: [
    'Residence record (yerleşim yeri belgesi)',
    'Yerleşim yeri (ikametgâh) belgesi',
  ],
  driving_licence: ['Driving licence', 'Sürücü belgesi'],
  tax_certificate: ['Tax certificate (vergi levhası)', 'Vergi levhası'],
  bank_proof: ['Proof the IBAN is theirs', 'IBAN’ın kendisine ait olduğunu gösteren belge'],
  other: ['Another document', 'Başka bir belge'],
};

export const INFO_NAME: Record<string, [string, string]> = {
  legal_name: ['Name', 'Ad soyad'],
  id_number: ['T.C. kimlik no', 'T.C. kimlik no'],
  phone: ['Mobile number', 'Cep telefonu'],
  email: ['Email address', 'E-posta adresi'],
  address: ['Home address', 'İkamet adresi'],
  city: ['City', 'Şehir'],
  iban: ['IBAN', 'IBAN'],
  tax: ['Tax details', 'Vergi bilgileri'],
  other: ['A question (answered in words)', 'Bir soru (yazıyla yanıtlanır)'],
};

/** Words staff can start from; the agent reads exactly what is sent. */
const SUGGESTIONS: [string, string][] = [
  [
    'Your address is missing the flat number; write it as on your residence record.',
    'Adresinizde daire numarası eksik; yerleşim yeri belgenizdeki gibi yazın.',
  ],
  [
    'The IBAN is not in your own name. Enter an IBAN that is yours.',
    'IBAN kendi adınıza değil. Size ait bir IBAN girin.',
  ],
  [
    'Your name must be exactly as on your ID card, including second names.',
    'Adınız, ikinci adlar dahil, kimlik kartınızdaki ile birebir aynı olmalı.',
  ],
  [
    'The document is older than 30 days. Get a new one from e-Devlet and upload it.',
    'Belge 30 günden eski. e-Devlet’ten yenisini alıp yükleyin.',
  ],
  [
    'The upload can’t be read. Upload the PDF from e-Devlet, not a photo of the screen.',
    'Yüklenen belge okunmuyor. Ekran fotoğrafı değil, e-Devlet’ten indirdiğiniz PDF’i yükleyin.',
  ],
  [
    'Upload a receipt or statement from your bank that shows your name and the IBAN together.',
    'Bankanızdan, adınızı ve IBAN’ı birlikte gösteren bir dekont ya da hesap cüzdanı yükleyin.',
  ],
];

const REQUEST_STATE: Record<AgentRequest['status'], [string, string, string]> = {
  open: ['Waiting for the agent', 'Görevliyi bekliyor', 'pending'],
  answered: ['Answered: check it', 'Yanıtlandı: inceleyin', 'kyc_pending'],
  accepted: ['Accepted', 'Kabul edildi', 'active'],
  cancelled: ['Withdrawn', 'Geri çekildi', 'cancelled'],
};

const subjectName = (r: { kind: string; subject: string }) =>
  L(...((r.kind === 'document' ? DOCUMENT_NAME : INFO_NAME)[r.subject] ?? [r.subject, r.subject]));

const ASK_ROWS = 3;

/**
 * On an agent's page: what was asked and where each request stands, and the form to ask for more.
 * Anyone who reviews can ask; an answer about a document is settled by verifying the document.
 */
export function requestsPanel(
  agent: AgentRow,
  requests: AgentRequest[],
  act: boolean,
  now: number,
): string {
  const path = `/agents/${agent.user_id}`;
  if (agent.erased_at) return '';
  const unsettled = requests.filter((r) => r.status === 'open' || r.status === 'answered');
  const settled = requests.filter((r) => r.status === 'accepted' || r.status === 'cancelled');
  const one = (r: AgentRequest) => {
    const state = REQUEST_STATE[r.status];
    const late = r.status === 'open' && r.due_at < now;
    const settle =
      !act || (r.status !== 'open' && r.status !== 'answered')
        ? ''
        : `<div class="ask-actions">
             ${
               r.status === 'answered' && r.kind === 'info'
                 ? `<form method="post" action="${path}/requests/${attr(r.id)}/settle"><input type="hidden" name="status" value="accepted"><button type="submit">${esc(L('Accept the answer', 'Yanıtı kabul et'))}</button></form>
                    <form method="post" action="${path}/requests/${attr(r.id)}/again" class="inline">
                      <label><span class="sr">${esc(L('What is still missing', 'Hâlâ eksik olan'))}</span><input name="note" required minlength="5" maxlength="300" autocomplete="off"></label>
                      <button class="secondary" type="submit">${esc(L('Ask again', 'Yeniden iste'))}</button>
                    </form>`
                 : ''
             }
             ${r.status === 'answered' && r.kind === 'document' ? `<p class="hint">${esc(L('Verify the uploaded document above: a clear result accepts this request; “doesn’t match” or “not valid” asks for it again.', 'Yukarıda yüklenen belgeyi doğrulayın: temiz sonuç bu talebi kabul eder; “eşleşmiyor” ya da “geçersiz” belgeyi yeniden ister.'))}</p>` : ''}
             <form method="post" action="${path}/requests/${attr(r.id)}/settle"><input type="hidden" name="status" value="cancelled"><button class="link" type="submit">${esc(L('Withdraw this request', 'Bu talebi geri çek'))}</button></form>
           </div>`;
    return `<li class="ask-item">
        <div class="doc-head"><strong>${icon(r.kind === 'document' ? 'file' : 'user')}${esc(subjectName(r))}</strong><span class="status ${late ? 'overdue' : state[2]}">${esc(late ? L('Late', 'Gecikti') : L(state[0], state[1]))}</span></div>
        <p class="asked"><span class="hint">${esc(L('Asked', 'İstenen'))} ${day(r.created_at)} · ${esc(L('answer by', 'son gün'))} ${day(r.due_at)}:</span> ${esc(r.note)}</p>
        ${r.answer ? `<p class="answered"><span class="hint">${esc(L('The agent wrote', 'Görevlinin yanıtı'))} ${day(r.answered_at)}:</span> ${esc(r.answer)}</p>` : r.status === 'answered' && r.kind === 'info' ? `<p class="answered"><span class="hint">${esc(L('The agent says it is corrected', 'Görevli düzelttiğini bildirdi'))} ${day(r.answered_at)}.</span> ${esc(L('Compare with the details at the top of this page.', 'Sayfanın başındaki bilgilerle karşılaştırın.'))}</p>` : ''}
        ${settle}
      </li>`;
  };
  const options = `<option value="">${esc(L('Choose', 'Seçin'))}</option>
    <optgroup label="${attr(L('A detail to correct', 'Düzeltilecek bilgi'))}">${Object.entries(
      INFO_NAME,
    )
      .map(([key, name]) => `<option value="info:${key}">${esc(L(...name))}</option>`)
      .join('')}</optgroup>
    <optgroup label="${attr(L('A document to upload', 'Yüklenecek belge'))}">${Object.entries(
      DOCUMENT_NAME,
    )
      .map(([key, name]) => `<option value="document:${key}">${esc(L(...name))}</option>`)
      .join('')}</optgroup>`;
  const rows = Array.from({ length: ASK_ROWS }, (_, i) => {
    const n = String(i + 1);
    return `<fieldset class="ask-row"><legend>${esc(L(`Request ${n}`, `Talep ${n}`))}${i === 0 ? '' : ` <span class="hint">${esc(L('(optional)', '(isteğe bağlı)'))}</span>`}</legend>
        <div class="grid2">
          <label>${esc(L('What', 'Ne'))} <select name="what${n}"${i === 0 ? ' required' : ''}>${options}</select></label>
          <label>${esc(L('Your words to the agent', 'Görevliye notunuz'))} <input name="note${n}" maxlength="300" minlength="5" list="ask-words" autocomplete="off"${i === 0 ? ' required' : ''}></label>
        </div>
      </fieldset>`;
  }).join('');
  const form = !act
    ? ''
    : agent.status === 'banned'
      ? ''
      : `<details class="ask-form"${unsettled.length === 0 ? '' : ''}>
           <summary>${icon('plus')}<span>${esc(L('Ask for a detail or a document', 'Bilgi ya da belge iste'))}</span></summary>
           <form method="post" action="${path}/ask" class="stack">
             ${rows}
             <datalist id="ask-words">${SUGGESTIONS.map((s) => `<option value="${attr(L(...s))}">`).join('')}</datalist>
             <p class="hint">${esc(
               agent.status === 'kyc_pending'
                 ? L(
                     'The application goes back to the applicant until everything is answered; they are emailed your words. Write to them as you would speak: what is wrong and what to do.',
                     'Her şey yanıtlanana kadar başvuru başvurana geri döner; yazdıklarınız kendisine e-postayla gider. Konuşur gibi yazın: ne yanlış ve ne yapmalı.',
                   )
                 : L(
                     'The agent is emailed your words and answers in Emanet Saha. An active agent keeps working meanwhile.',
                     'Yazdıklarınız görevliye e-postayla gider; Emanet Saha’dan yanıtlar. Etkin görevli bu sırada çalışmaya devam eder.',
                   ),
             )}</p>
             <div><button type="submit">${esc(L('Send the request', 'Talebi gönder'))}</button></div>
           </form>
         </details>`;
  return `<section class="vetting asks" id="requests" translate="no">
      <h2>${esc(L('Requests to the agent', 'Görevliden istenenler'))}</h2>
      ${
        unsettled.length === 0
          ? `<p class="hint">${esc(L('Nothing is asked right now. If a detail is wrong, or you need a document that isn’t here, ask for it: the agent answers in the app, never by email.', 'Şu an istenen bir şey yok. Bir bilgi yanlışsa ya da burada olmayan bir belgeye ihtiyacınız varsa isteyin: görevli e-postayla değil, uygulamadan yanıtlar.'))}</p>`
          : `<ul class="docs-list">${unsettled.map(one).join('')}</ul>`
      }
      ${form}
      ${settled.length > 0 ? `<details class="history"><summary>${esc(L('Settled requests', 'Sonuçlanan talepler'))} (${String(settled.length)})</summary><ul class="docs-list">${settled.map(one).join('')}</ul></details>` : ''}
    </section>`;
}

/** Reads the ask form: up to three rows, empty ones skipped. */
export function asksFrom(
  v: Record<string, string>,
): { kind: string; subject: string; note: string }[] {
  const asks: { kind: string; subject: string; note: string }[] = [];
  for (let i = 1; i <= ASK_ROWS; i++) {
    const what = v[`what${String(i)}`] ?? '';
    const note = v[`note${String(i)}`] ?? '';
    if (!what && !note) continue;
    const [kind = '', subject = ''] = what.split(':');
    asks.push({ kind, subject, note });
  }
  return asks;
}

/** Today: answers from agents that wait for staff. */
export function answeredPanel(list: AnsweredRequest[]): string {
  if (list.length === 0) return '';
  return `<section class="panel" translate="no">
      <h2>${icon('mail')}<span>${esc(L('Answers from agents', 'Görevlilerden gelen yanıtlar'))}</span></h2>
      <p class="hint">${esc(L('An agent answered something you asked for. Check it; an application can’t go on until each is settled.', 'Bir görevli istediğiniz bir şeyi yanıtladı. İnceleyin; her biri sonuçlanmadan başvuru ilerleyemez.'))}</p>
      <ul class="plain-list">${list
        .map(
          (r) =>
            `<li><a href="/agents/${attr(r.agent_id)}#requests">${esc(r.legal_name ?? '—')}</a> · ${esc(subjectName(r))} · <span class="hint">${moment(r.answered_at)}</span></li>`,
        )
        .join('')}</ul>
    </section>`;
}

// ---- Erasing an agent -------------------------------------------------------------------------------

export function erasePage(
  nav: Nav,
  agent: AgentRow,
  o: ErasureOverview,
  isAdmin: boolean,
  fresh: boolean,
  years: number,
  errorText: string | null,
): string {
  const path = `/agents/${agent.user_id}`;
  const r = o.request?.status === 'open' ? o.request : null;
  const b = o.blockers;
  const blocked = b.payouts_pending > 0;
  const facts = `<dl class="facts">
      <dt>${esc(L('Request', 'Talep'))}</dt><dd>${r ? `${esc(L('Received', 'Alındı'))} ${day(r.received_at)} · ${esc(L('answer by', 'en geç'))} <strong>${day(r.due_at)}</strong>` : esc(L('No open request from the agent. Erase only on a written request that is recorded under Privacy, or on a legal ground you write below.', 'Görevliden açık bir talep yok. Yalnızca Gizlilik sayfasına kaydedilmiş yazılı bir talep ya da aşağıya yazacağınız hukuki bir gerekçe ile silin.'))}</dd>
      <dt>${esc(L('Open claims', 'Açık üstlenmeler'))}</dt><dd>${String(b.open_claims)}${b.open_claims > 0 ? ` · ${esc(L('released when erased', 'silinince bırakılır'))}` : ''}</dd>
      <dt>${esc(L('Payouts not sent', 'Gönderilmemiş ödemeler'))}</dt><dd>${String(b.payouts_pending)}</dd>
      <dt>${esc(L('Payouts sent', 'Gönderilmiş ödemeler'))}</dt><dd>${String(b.payouts_sent)}${b.payouts_sent > 0 ? ` · ${esc(L('ID number and address stay sealed for the tax documents', 'kimlik no ve adres vergi belgeleri için şifreli kalır'))}` : ''}</dd>
    </dl>`;
  const what = `<ul>
      <li>${esc(L('Removed from the working database: name, ID number, phone, email, address, city, IBAN, tax details, identity checks, documents, requests.', 'Çalışan veritabanından kaldırılır: ad soyad, kimlik no, telefon, e-posta, adres, şehir, IBAN, vergi bilgileri, kimlik doğrulamaları, belgeler, talepler.'))}</li>
      <li>${esc(L('Kept, as the law requires: payouts and the journal, tied to an account ID that no longer names anyone.', 'Mevzuat gereği kalır: ödemeler ve yevmiye; artık kimseyi göstermeyen bir hesap kimliğine bağlı olarak.'))}</li>
      <li>${esc(L(`Sealed into the archive for ${String(years)} years: one encrypted copy of what was removed, and the documents still in storage. A criminal-record file is destroyed, never archived.`, `${String(years)} yıl için arşive mühürlenir: kaldırılanların şifreli bir kopyası ve depoda duran belgeler. Adli sicil kaydı dosyası arşivlenmez, yok edilir.`))}</li>
      <li>${esc(L('The account is closed for good and the agent is emailed that it was done.', 'Hesap kalıcı olarak kapatılır ve görevliye işlemin yapıldığı e-postayla bildirilir.'))}</li>
    </ul>`;
  const forms = !isAdmin
    ? `<p class="panel">${esc(L('Only an owner or admin can erase or refuse.', 'Yalnızca sahip ya da yönetici silebilir veya reddedebilir.'))}</p>`
    : !fresh
      ? confirmFirst(`${path}/erase`)
      : `${
          blocked
            ? `<p class="error">${esc(L('Payouts are waiting. Send them first (Money → Payouts), or refuse for now and say so: erasing would remove the IBAN they are paid to.', 'Bekleyen ödemeler var. Önce onları gönderin (Para → Ödemeler) ya da şimdilik reddedip nedenini yazın: silme, ödemenin yapılacağı IBAN’ı da kaldırır.'))}</p>`
            : `<form method="post" action="${path}/erase" class="stack danger-zone">
                 <h2>${esc(L('Erase', 'Sil'))}</h2>
                 <label>${esc(L('Ground (kept with the archive and the audit log)', 'Gerekçe (arşivle ve denetim kaydıyla birlikte saklanır)'))} <input name="reason" required minlength="3" maxlength="300" value="${attr(r ? L('Data subject’s request', 'İlgili kişinin talebi') : '')}"></label>
                 <label>${esc(L('Type SİL to confirm', 'Onaylamak için SİL yazın'))} <input name="confirm" required autocomplete="off" pattern="SİL|SIL|sil"></label>
                 <p class="hint">${esc(L('This can’t be undone from here. The sealed copy is not a way back: it exists for courts, authorities and claims.', 'Bu işlem buradan geri alınamaz. Mühürlü kopya bir geri dönüş yolu değildir: mahkemeler, kurumlar ve uyuşmazlıklar için vardır.'))}</p>
                 <div><button class="danger" type="submit">${esc(L('Erase this agent’s personal data', 'Bu görevlinin kişisel verilerini sil'))}</button></div>
               </form>`
        }
        ${
          r
            ? `<form method="post" action="${path}/erase/refuse" class="stack">
                 <h2>${esc(L('Refuse the request', 'Talebi reddet'))}</h2>
                 <label>${esc(L('Reason (the agent is emailed exactly this)', 'Gerekçe (görevliye aynen e-postayla gider)'))} <input name="reason" required minlength="10" maxlength="300" list="refuse-words"></label>
                 <datalist id="refuse-words">
                   <option value="${attr(L('Payouts are waiting to be sent to you; we will erase your data once they are paid. Ask again after that.', 'Size gönderilmeyi bekleyen ödemeler var; ödendikten sonra verilerinizi sileceğiz. Sonrasında yeniden talep edin.'))}">
                   <option value="${attr(L('A delivery you reported is under review; we must keep your data until it is decided.', 'Bildirdiğiniz bir teslim incelemede; karar verilene kadar verilerinizi saklamak zorundayız.'))}">
                 </datalist>
                 <p class="hint">${esc(L('A refusal must rest on the law (KVKK art. 7, 13): say which obligation stops you, and when they can ask again.', 'Ret hukuka dayanmalıdır (KVKK m.7, 13): hangi yükümlülüğün engel olduğunu ve ne zaman yeniden başvurabileceğini yazın.'))}</p>
                 <div><button class="secondary" type="submit">${esc(L('Refuse', 'Reddet'))}</button></div>
               </form>`
            : ''
        }`;
  return layout(
    L('Erase personal data', 'Kişisel verileri sil'),
    { ...nav, current: 'agents' },
    `<p class="crumbs"><a href="/agents">Agents</a> <span aria-hidden="true">/</span> <a href="${path}" translate="no">${esc(agent.legal_name ?? '—')}</a> <span aria-hidden="true">/</span> <span translate="no">${esc(L('Erase', 'Sil'))}</span></p>
     <div translate="no"><h1>${esc(L('Erase personal data', 'Kişisel verileri sil'))}</h1>
       <p class="lede">${esc(L('Carry out or refuse a request to be erased. A request is answered within thirty days (KVKK art. 13).', 'Silme talebini yerine getirin ya da reddedin. Talep otuz gün içinde yanıtlanır (KVKK m.13).'))}</p></div>
     ${error(errorText)}
     <div translate="no">
       <div class="panel">${facts}</div>
       <div class="panel"><h2>${esc(L('What erasing does', 'Silme ne yapar'))}</h2>${what}<p class="hint"><a href="/guide/erasure">${esc(L('Handbook: erasure and the sealed archive', 'El kitabı: silme ve mühürlü arşiv'))}</a></p></div>
       ${forms}
     </div>`,
  );
}

// ---- The sealed archive -----------------------------------------------------------------------------

const size = (bytes: number) =>
  bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${String(Math.ceil(bytes / 1024))} KB`;

export function archiveList(
  nav: Nav,
  list: ArchiveEntry[],
  term: string,
  noticeText: string | null,
): string {
  const rows = list
    .map(
      (a) => `<tr>
        <td>${day(a.archived_at)}</td>
        <td><a href="/privacy/archive/${attr(a.id)}"><code>${esc(a.subject_ref.slice(0, 13))}…</code></a></td>
        <td>${esc(a.reason)}</td>
        <td>${esc(a.archived_by === 'system' ? L('Account deleted at login', 'Hesap login’de silindi') : L('An admin', 'Yönetici'))}</td>
        <td>${String(a.files.length)}${a.files_pending > 0 ? ` <span class="status pending">+${String(a.files_pending)} ${esc(L('being sealed', 'mühürleniyor'))}</span>` : ''}</td>
        <td>${String(a.views)}${a.last_viewed_at ? ` · ${day(a.last_viewed_at)}` : ''}</td>
        <td>${a.purged_at ? `<span class="status expired">${esc(L('Destroyed', 'Yok edildi'))} ${day(a.purged_at)}</span>` : day(a.purge_at)}</td>
      </tr>`,
    )
    .join('');
  return layout(
    L('Sealed archive', 'Mühürlü arşiv'),
    { ...nav, current: 'privacy' },
    `${notice(noticeText)}
     <p class="crumbs"><a href="/privacy">Privacy</a> <span aria-hidden="true">/</span> <span translate="no">${esc(L('Sealed archive', 'Mühürlü arşiv'))}</span></p>
     <div translate="no">
       <h1>${esc(L('Sealed archive', 'Mühürlü arşiv'))}</h1>
       <p class="lede">${esc(L('What was erased, kept encrypted for a fixed time to answer a court, an authority or a claim. This list names nobody. Opening a record needs a written reason and is recorded.', 'Silinen veriler; mahkemeye, kuruma ya da bir uyuşmazlığa yanıt verebilmek için belirli bir süre şifreli saklanır. Bu liste kimsenin adını göstermez. Bir kaydı açmak yazılı gerekçe ister ve kaydedilir.'))}</p>
       <form method="get" action="/privacy/archive" class="inline">
         <label><span class="sr">${esc(L('Find', 'Bul'))}</span><input name="q" maxlength="254" value="${attr(term)}" autocomplete="off" size="38"></label>
         <button type="submit">${esc(L('Find', 'Bul'))}</button>
         ${term ? `<a href="/privacy/archive">${esc(L('Show all', 'Tümünü göster'))}</a>` : ''}
       </form>
       <p class="hint">${esc(L('Search by the account ID, the archive ID, or the email address the person had (matched by a keyed hash; the address itself isn’t stored here).', 'Hesap kimliği, arşiv kimliği ya da kişinin o zamanki e-posta adresi ile arayın (anahtarlı özetle eşleştirilir; adresin kendisi burada saklanmaz).'))}</p>
       ${
         list.length === 0
           ? `<p class="panel">${esc(term ? L('No archived record matches.', 'Eşleşen arşiv kaydı yok.') : L('Nothing has been erased yet.', 'Henüz silinen bir kayıt yok.'))}</p>`
           : `<div class="table-wrap"><table><thead><tr><th>${esc(L('Erased', 'Silindi'))}</th><th>${esc(L('Account', 'Hesap'))}</th><th>${esc(L('Ground', 'Gerekçe'))}</th><th>${esc(L('By', 'Kim'))}</th><th>${esc(L('Files', 'Dosya'))}</th><th>${esc(L('Opened', 'Açılma'))}</th><th>${esc(L('Destroyed on', 'Yok edilme'))}</th></tr></thead><tbody>${rows}</tbody></table></div>`
       }
       <p class="hint"><a href="/guide/erasure">${esc(L('Handbook: erasure and the sealed archive', 'El kitabı: silme ve mühürlü arşiv'))}</a></p>
     </div>`,
  );
}

export function archiveDetail(
  nav: Nav,
  a: ArchiveEntry,
  views: ArchiveView[],
  fresh: boolean,
  errorText: string | null,
  noticeText: string | null = null,
): string {
  const path = `/privacy/archive/${a.id}`;
  const gone = a.purged_at !== null;
  const reason = (id: string) =>
    `<label>${esc(L('Why you are opening it (case or letter number, who asked)', 'Neden açıyorsunuz (dosya ya da yazı numarası, kim istedi)'))} <input name="reason" required minlength="10" maxlength="300" autocomplete="off" id="${id}"></label>`;
  const open = gone
    ? `<p class="panel">${esc(L('This record’s time ended and its content was destroyed. Only this line remains.', 'Bu kaydın süresi doldu ve içeriği yok edildi. Yalnızca bu satır kaldı.'))}</p>`
    : !fresh
      ? confirmFirst(path)
      : `<form method="post" action="${path}/download" class="stack panel">
           <h2>${icon('download')}<span>${esc(L('Download the record as plain text', 'Kaydı düz metin olarak indir'))}</span></h2>
           ${reason('why-record')}
           <p class="hint">${esc(L('Your name, the time and this reason are written to the audit log before the file is made. Keep the download only as long as the matter needs, then delete it.', 'Dosya oluşturulmadan önce adınız, zaman ve bu gerekçe denetim kaydına yazılır. İndirdiğiniz dosyayı yalnızca iş gerektirdiği sürece saklayın, sonra silin.'))}</p>
           <div><button type="submit">${esc(L('Open and download', 'Aç ve indir'))}</button></div>
         </form>
         ${
           a.files.length === 0
             ? ''
             : `<div class="panel"><h2>${icon('file')}<span>${esc(L('Sealed files', 'Mühürlü dosyalar'))}</span></h2>
                  ${a.files
                    .map(
                      (f, i) => `<form method="post" action="${path}/file" class="stack ask-row">
                        <input type="hidden" name="ref" value="${attr(f.ref)}">
                        <p><strong>${esc(L(...(DOCUMENT_NAME[f.name] ?? [f.name, f.name])))}</strong> <span class="hint">${esc(f.type)} · ${size(f.size)}</span></p>
                        ${reason(`why-file-${String(i)}`)}
                        <div><button class="secondary" type="submit">${esc(L('Open and download the file', 'Dosyayı aç ve indir'))}</button></div>
                      </form>`,
                    )
                    .join('')}
                </div>`
         }
         ${a.files_pending > 0 ? `<p class="hint">${esc(L(`${String(a.files_pending)} file(s) are still being sealed; they appear here within ten minutes.`, `${String(a.files_pending)} dosya hâlâ mühürleniyor; on dakika içinde burada görünür.`))}</p>` : ''}`;
  const log =
    views.length === 0
      ? `<p class="hint">${esc(L('Nobody has opened this record.', 'Bu kaydı kimse açmadı.'))}</p>`
      : `<div class="table-wrap"><table><thead><tr><th>${esc(L('When', 'Ne zaman'))}</th><th>${esc(L('Who', 'Kim'))}</th><th>${esc(L('What', 'Ne'))}</th><th>${esc(L('Why', 'Neden'))}</th></tr></thead><tbody>${views
          .map(
            (v) =>
              `<tr><td>${moment(v.viewed_at)}</td><td><code>${esc(v.staff_id.slice(0, 13))}</code></td><td>${esc(v.what === 'file' ? L('A file', 'Dosya') : L('The record', 'Kayıt'))}</td><td>${esc(v.reason)}</td></tr>`,
          )
          .join('')}</tbody></table></div>`;
  return layout(
    L('Sealed record', 'Mühürlü kayıt'),
    { ...nav, current: 'privacy' },
    `${notice(noticeText)}<p class="crumbs"><a href="/privacy">Privacy</a> <span aria-hidden="true">/</span> <a href="/privacy/archive" translate="no">${esc(L('Sealed archive', 'Mühürlü arşiv'))}</a> <span aria-hidden="true">/</span> <code translate="no">${esc(a.id.slice(0, 13))}</code></p>
     <div translate="no"><h1>${esc(L('Sealed record', 'Mühürlü kayıt'))}</h1></div>
     ${error(errorText)}
     <div translate="no">
       <div class="panel"><dl class="facts">
         <dt>${esc(L('Account ID', 'Hesap kimliği'))}</dt><dd><code>${esc(a.subject_ref)}</code></dd>
         <dt>${esc(L('Erased', 'Silindi'))}</dt><dd>${moment(a.archived_at)}</dd>
         <dt>${esc(L('Ground', 'Gerekçe'))}</dt><dd>${esc(a.reason)}</dd>
         <dt>${esc(L('By', 'Kim'))}</dt><dd><code>${esc(a.archived_by)}</code></dd>
         <dt>${esc(L('Request', 'Talep'))}</dt><dd>${a.request_id ? `<code>${esc(a.request_id)}</code>` : '—'}</dd>
         <dt>${esc(L('Content is destroyed on', 'İçerik şu tarihte yok edilir'))}</dt><dd>${day(a.purge_at)}</dd>
       </dl></div>
       ${open}
       <h2>${esc(L('Who opened it', 'Kim açtı'))}</h2>
       ${log}
     </div>`,
  );
}

const LABEL: Record<string, [string, string]> = {
  profile: ['PROFILE', 'PROFİL'],
  identity_checks: ['IDENTITY CHECKS', 'KİMLİK DOĞRULAMALARI'],
  documents: [
    'DOCUMENTS (records; files are sealed apart)',
    'BELGELER (kayıtlar; dosyalar ayrıca mühürlü)',
  ],
  acceptances: ['ACCEPTANCES', 'ONAYLAR'],
  requests: ['REQUESTS FROM STAFF', 'PERSONELİN TALEPLERİ'],
  privacy_requests: ['DATA SUBJECT REQUESTS', 'İLGİLİ KİŞİ TALEPLERİ'],
};

const TIME_KEY = /_at$/;

function value(key: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '-';
  if (typeof v === 'number' && TIME_KEY.test(key) && v > 1_000_000_000) {
    return `${new Date((v + 3 * 3600) * 1000).toISOString().slice(0, 16).replace('T', ' ')} (TR)`;
  }
  if (typeof v === 'object') return JSON.stringify(v);
  return (typeof v === 'string' ? v : JSON.stringify(v)).replace(/[\r\n]+/g, ' ');
}

/** The opened record as a plain-text file: what an auditor, a court or the person can read. */
export function archiveText(
  a: ArchiveEntry,
  p: ArchivePayload,
  opened: { by: string; at: number; reason: string },
): string {
  const lines: string[] = [];
  const rule = '='.repeat(72);
  const put = (k: string, v: unknown) => lines.push(`  ${k.padEnd(22)} ${value(k, v)}`);
  lines.push(rule, L('EMANET · SEALED ARCHIVE RECORD', 'EMANET · MÜHÜRLÜ ARŞİV KAYDI'), rule);
  put(L('archive_id', 'arsiv_kimligi'), a.id);
  put(L('account_id', 'hesap_kimligi'), p.account_id);
  put('archived_at', p.archived_at);
  put(L('ground', 'gerekce'), p.reason);
  put(
    L('destroyed_on', 'yok_edilme'),
    new Date((a.purge_at + 3 * 3600) * 1000).toISOString().slice(0, 10),
  );
  lines.push('');
  put(L('opened_by', 'acan'), opened.by);
  put('opened_at', opened.at);
  put(L('opened_why', 'acma_nedeni'), opened.reason);
  lines.push(
    '',
    L(
      'CONFIDENTIAL. Personal data under KVKK. Use only for the reason above; delete when done.',
      'GİZLİDİR. KVKK kapsamında kişisel veri içerir. Yalnızca yukarıdaki gerekçe için kullanın; iş bitince silin.',
    ),
    '',
  );
  const section = (key: keyof typeof LABEL, rows: Record<string, unknown>[]) => {
    lines.push('-'.repeat(72), L(...(LABEL[key] ?? [key, key])), '-'.repeat(72));
    if (rows.length === 0) lines.push(`  ${L('(none)', '(yok)')}`);
    rows.forEach((row, i) => {
      if (rows.length > 1) lines.push(`  [${String(i + 1)}]`);
      for (const [k, v] of Object.entries(row)) put(k, v);
    });
    lines.push('');
  };
  section('profile', [p.profile]);
  section('identity_checks', p.identity_checks);
  section('documents', p.documents);
  section('acceptances', p.acceptances);
  section('requests', p.requests);
  section('privacy_requests', p.privacy_requests);
  if (a.files.length > 0) {
    lines.push(
      '-'.repeat(72),
      L('SEALED FILES (download each apart)', 'MÜHÜRLÜ DOSYALAR (ayrı ayrı indirilir)'),
      '-'.repeat(72),
    );
    for (const f of a.files) lines.push(`  ${f.name} · ${f.type} · ${String(f.size)} bytes`);
    lines.push('');
  }
  lines.push(rule);
  return `${lines.join('\r\n')}\r\n`;
}

const HOLD_KIND: Record<Hold['subject_kind'], [string, string]> = {
  agent: ['Agent', 'Görevli'],
  case: ['Case', 'Vaka'],
  onboarding: ['Company application', 'Şirket başvurusu'],
};

/** Legal holds: what automatic deletion must leave alone while a dispute is open. */
export function holdsPage(
  nav: Nav,
  list: Hold[],
  fresh: boolean,
  errorText: string | null,
  noticeText: string | null,
): string {
  const open = list.filter((h) => h.released_at === null);
  const closed = list.filter((h) => h.released_at !== null);
  const kind = (h: Hold) => L(...HOLD_KIND[h.subject_kind]);
  const openRows = open
    .map(
      (h) => `<tr>
        <td>${esc(kind(h))}</td>
        <td><code>${esc(h.subject_ref)}</code></td>
        <td>${esc(h.reason)}</td>
        <td>${day(h.set_at)}</td>
        <td>${
          fresh
            ? `<form method="post" action="/privacy/holds/${attr(h.id)}/release" class="inline">
                 <label><span class="sr">${esc(L('Reason to lift', 'Kaldırma gerekçesi'))}</span><input name="reason" required minlength="3" maxlength="300" placeholder="${attr(L('Why it can be lifted', 'Neden kaldırılabilir'))}"></label>
                 <button class="secondary" type="submit">${esc(L('Lift', 'Kaldır'))}</button>
               </form>`
            : confirmFirst('/privacy/holds')
        }</td>
      </tr>`,
    )
    .join('');
  const closedRows = closed
    .map(
      (h) => `<tr>
        <td>${esc(kind(h))}</td>
        <td><code>${esc(h.subject_ref)}</code></td>
        <td>${esc(h.reason)}</td>
        <td>${day(h.set_at)} → ${h.released_at ? day(h.released_at) : ''}</td>
        <td>${esc(h.release_reason ?? '')}</td>
      </tr>`,
    )
    .join('');
  const form = fresh
    ? `<form method="post" action="/privacy/holds" class="stack">
         <div class="grid2">
           <label>${esc(L('What', 'Neyi'))} <select name="kind">
             <option value="agent">${esc(L('Agent (account ID)', 'Görevli (hesap kimliği)'))}</option>
             <option value="case">${esc(L('Case (case ID)', 'Vaka (vaka kimliği)'))}</option>
             <option value="onboarding">${esc(L('Company application (ID)', 'Şirket başvurusu (kimlik)'))}</option>
           </select></label>
           <label>${esc(L('ID', 'Kimlik'))} <input name="ref" required maxlength="100" autocomplete="off"></label>
         </div>
         <label>${esc(L('Reason (a file number helps)', 'Gerekçe (dosya numarası yardımcı olur)'))} <input name="reason" required minlength="3" maxlength="300"></label>
         <div><button type="submit">${esc(L('Place the hold', 'Tutmayı başlat'))}</button></div>
       </form>`
    : confirmFirst('/privacy/holds');
  return layout(
    L('Legal holds', 'Yasal tutma'),
    { ...nav, current: 'privacy' },
    `${notice(noticeText)}${errorText ? error(errorText) : ''}
     <p class="crumbs"><a href="/privacy">Privacy</a> <span aria-hidden="true">/</span> <span translate="no">${esc(L('Legal holds', 'Yasal tutma'))}</span></p>
     <div translate="no">
       <h1>${esc(L('Legal holds', 'Yasal tutma'))}</h1>
       <p class="lede">${esc(L('While a dispute or an investigation is open, a hold keeps the automatic deletions away from one agent, case or company application: files, addresses, the sealed archive, and erasure itself. Placing and lifting a hold need a reason and are recorded.', 'Bir uyuşmazlık ya da soruşturma sürerken tutma, bir görevli, vaka ya da şirket başvurusunu otomatik silmelerden korur: dosyalar, adresler, mühürlü arşiv ve silmenin kendisi. Tutmayı başlatmak ve kaldırmak gerekçe ister ve kaydedilir.'))}</p>
       <h2>${esc(L('Open holds', 'Açık tutmalar'))}</h2>
       ${
         open.length === 0
           ? `<p class="panel">${esc(L('Nothing is held.', 'Tutulan bir şey yok.'))}</p>`
           : `<div class="table-wrap"><table><thead><tr><th>${esc(L('What', 'Ne'))}</th><th>${esc(L('ID', 'Kimlik'))}</th><th>${esc(L('Reason', 'Gerekçe'))}</th><th>${esc(L('Since', 'Tarih'))}</th><th></th></tr></thead><tbody>${openRows}</tbody></table></div>`
       }
       <h2>${esc(L('Place a hold', 'Tutma başlat'))}</h2>
       ${form}
       <p class="hint">${esc(L('A held erasure request stays open: answer it, citing the hold. When a hold is lifted, the next nightly run applies the retention rules again; an erasure the hold refused isn’t redone on its own.', 'Tutulan bir silme talebi açık kalır: tutmaya dayanarak yanıtlayın. Tutma kalkınca bir sonraki gece çalışması saklama kurallarını yeniden uygular; tutmanın reddettiği silme kendiliğinden yapılmaz.'))}</p>
       ${
         closed.length === 0
           ? ''
           : `<h2>${esc(L('Lifted', 'Kaldırılanlar'))}</h2><div class="table-wrap"><table><thead><tr><th>${esc(L('What', 'Ne'))}</th><th>${esc(L('ID', 'Kimlik'))}</th><th>${esc(L('Reason', 'Gerekçe'))}</th><th>${esc(L('Held', 'Tutuldu'))}</th><th>${esc(L('Lifted because', 'Kaldırma gerekçesi'))}</th></tr></thead><tbody>${closedRows}</tbody></table></div>`
       }
     </div>`,
  );
}

/** The agent's page: whether the account is under a legal hold, and a way to set or lift one. */
export function holdPanel(
  agentId: string,
  hold: Hold | null,
  canChange: boolean,
  fresh: boolean,
): string {
  if (!canChange) return '';
  const back = `<input type="hidden" name="back" value="/agents/${attr(agentId)}">`;
  if (hold) {
    return `<div class="panel" translate="no"><h2>${esc(L('Legal hold', 'Yasal tutma'))}</h2>
      <p>${icon('lock')} ${esc(L('Held since', 'Tutma tarihi'))} ${day(hold.set_at)}: ${esc(hold.reason)}. ${esc(L('Automatic deletion, the sealed archive’s destruction and erasure leave this agent alone.', 'Otomatik silme, mühürlü arşivin yok edilmesi ve silme bu görevliye dokunmaz.'))}</p>
      ${
        fresh
          ? `<form method="post" action="/privacy/holds/${attr(hold.id)}/release" class="stack">${back}
               <label>${esc(L('Reason to lift', 'Kaldırma gerekçesi'))} <input name="reason" required minlength="3" maxlength="300"></label>
               <div><button class="secondary" type="submit">${esc(L('Lift the hold', 'Tutmayı kaldır'))}</button></div>
             </form>`
          : confirmFirst(`/agents/${agentId}`)
      }</div>`;
  }
  return `<div translate="no"><h2>${esc(L('Legal hold', 'Yasal tutma'))}</h2>
    ${
      fresh
        ? `<form method="post" action="/privacy/holds" class="stack">${back}
             <input type="hidden" name="kind" value="agent"><input type="hidden" name="ref" value="${attr(agentId)}">
             <label>${esc(L('Reason (a file number helps)', 'Gerekçe (dosya numarası yardımcı olur)'))} <input name="reason" required minlength="3" maxlength="300"></label>
             <p class="hint">${esc(L('Use this while a dispute or an investigation may need this person’s data. It stops deletion, not the request.', 'Bir uyuşmazlık ya da soruşturma bu kişinin verisini gerektirebilirse kullanın. Silmeyi durdurur, talebi değil.'))}</p>
             <div><button class="secondary" type="submit">${esc(L('Place a legal hold', 'Yasal tutma başlat'))}</button></div>
           </form>`
        : confirmFirst(`/agents/${agentId}`)
    }</div>`;
}

const RETENTION_TEXT: Record<RetentionRow['key'], [string, string, string, string]> = {
  failed_evidence: [
    'Photos of claims that delivered nothing',
    'Teslimatla sonuçlanmayan taleplerin fotoğrafları',
    'After the claim closes',
    'Talep kapandıktan sonra',
  ],
  delivered_evidence: [
    'Photos of deliveries',
    'Teslimat fotoğrafları',
    'After the claim closes (commercial records retention)',
    'Talep kapandıktan sonra (ticari kayıt saklama süresi)',
  ],
  abandoned_documents: [
    'Documents of companies that never became partners',
    'Ortak olmayan şirketlerin belgeleri',
    'After the application ends',
    'Başvuru sona erdikten sonra',
  ],
  partner_documents: [
    'Documents of partners',
    'Ortakların belgeleri',
    'After approval (commercial records retention)',
    'Onaydan sonra (ticari kayıt saklama süresi)',
  ],
  agent_documents: [
    'Applicants’ e-Devlet documents nobody decided on',
    'Kimsenin karara bağlamadığı başvuru e-Devlet belgeleri',
    'After upload',
    'Yüklemeden sonra',
  ],
  case_places: [
    'Debtors’ street addresses on closed cases',
    'Kapanan vakalardaki borçlu adresleri',
    'After the case closes',
    'Vaka kapandıktan sonra',
  ],
  archive: [
    'Sealed archive of erased agents',
    'Silinen görevlilerin mühürlü arşivi',
    'After erasure',
    'Silmeden sonra',
  ],
};

/** What the cron deletes on its own, and how much the next run takes. */
export function retentionPage(nav: Nav, o: RetentionOverview): string {
  const rows = o.rows
    .map((r) => {
      const t = RETENTION_TEXT[r.key];
      return `<tr>
        <td>${esc(L(t[0], t[1]))}</td>
        <td>${esc(L(t[2], t[3]))}</td>
        <td>${String(r.days)} ${esc(L('days', 'gün'))}</td>
        <td>${String(r.due)}</td>
        <td>${r.held > 0 ? `<span class="status pending">${String(r.held)}</span>` : '0'}</td>
      </tr>`;
    })
    .join('');
  return layout(
    L('What is deleted when', 'Ne zaman ne silinir'),
    { ...nav, current: 'privacy' },
    `<p class="crumbs"><a href="/privacy">Privacy</a> <span aria-hidden="true">/</span> <span translate="no">${esc(L('What is deleted when', 'Ne zaman ne silinir'))}</span></p>
     <div translate="no">
       <h1>${esc(L('What is deleted when', 'Ne zaman ne silinir'))}</h1>
       <p class="lede">${esc(L('What the nightly run deletes without anyone asking. The days come from Settings → Privacy. “Next run” is how many records are past their time right now; “Held” are past their time but kept by a legal hold.', 'Gece çalışmasının kimse istemeden sildikleri. Gün sayıları Ayarlar → Gizlilik’ten gelir. “Sonraki çalışma”, süresi şu an dolmuş kayıt sayısıdır; “Tutulan”, süresi dolmuş ama yasal tutma altında kalanlardır.'))}</p>
       <div class="table-wrap"><table><thead><tr><th>${esc(L('Data', 'Veri'))}</th><th>${esc(L('Counted from', 'Başlangıç'))}</th><th>${esc(L('Kept', 'Saklama'))}</th><th>${esc(L('Next run', 'Sonraki çalışma'))}</th><th>${esc(L('Held', 'Tutulan'))}</th></tr></thead><tbody>${rows}</tbody></table></div>
       <p class="hint">${esc(L('Files queued for deletion that storage still holds:', 'Silinmek üzere kuyruğa alınmış, depoda hâlâ duran dosya:'))} ${String(o.files_waiting)}. ${esc(L('Open legal holds:', 'Açık yasal tutma:'))} <a href="/privacy/holds">${String(o.open_holds)}</a>.</p>
     </div>`,
  );
}
