/**
 * The handbook (Merkez → Handbook): what Emanet is, how each flow runs, who decides what, and what
 * the words mean. Written in both languages here, not through the sentence catalogue, because it
 * is prose: each chapter is rendered whole in the reader's language and marked translate="no".
 *
 * Keep it true. When a flow or a rule changes in emanet-core, the chapter changes in the same
 * pull request. Numbers that are settings are never written here as fixed: `{{key}}` is replaced
 * with the setting's current value when the page is rendered.
 */
import type { IconName } from './icons';

export type GuideLocale = 'en' | 'tr';

export interface Chapter {
  slug: string;
  icon: IconName;
  title: Record<GuideLocale, string>;
  summary: Record<GuideLocale, string>;
  body: (l: GuideLocale) => string;
}

/** A row of steps with arrows between them: a flow at a glance. */
const flow = (steps: string[]) =>
  `<ol class="flow">${steps.map((step) => `<li>${step}</li>`).join('')}</ol>`;

const note = (text: string) => `<p class="callout">${text}</p>`;

const table = (head: string[], rows: string[][]) =>
  `<table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>`;

export const CHAPTERS: Chapter[] = [
  {
    slug: 'overview',
    icon: 'home',
    title: { en: 'What Emanet is', tr: 'Emanet nedir' },
    summary: {
      en: 'The service in one page: who takes part, what each app is for, and the one rule that never bends.',
      tr: 'Tek sayfada hizmet: kimler yer alır, hangi uygulama ne işe yarar ve hiç esnemeyen tek kural.',
    },
    body: (l) =>
      l === 'tr'
        ? `<p>Emanet, üzerinde <strong>yakalama şerhi</strong> bulunan araçların bulunmasına yardım eder. Alacaklı kurum aracını ekler; kimliği doğrulanmış bir saha görevlisi aracı sokakta arar; gördüğünde fotoğraflar ve <strong>112</strong>’yi arar; kolluk aracı yakalar ve yediemine teslim eder. Kurum yalnızca yediemine ulaşan araç için ödeme yapar.</p>
${note('<strong>Hiç esnemeyen kural:</strong> Emanet ve saha görevlileri araca dokunmaz, aracı çekmez, borçluyla konuşmaz, para almaz. Yakalama ve teslim yalnızca kolluğun işidir. Emanet bir kamu kurumu değildir ve icra işlemi yapmaz.')}
<h2>Kimler yer alır</h2>
${table(
  ['Taraf', 'Kim', 'Ne yapar'],
  [
    [
      'Kurum (alacaklı)',
      'Banka, varlık yönetim şirketi, leasing şirketi, hukuk bürosu',
      'Araçlarını ekler, dosyalarını onaylar, belgelerini ve faturalarını alır.',
    ],
    [
      'Saha görevlisi',
      'Kimliği doğrulanmış gerçek kişi',
      'Şehrindeki araçları üstlenir, arar, görünce 112’yi arar ve belgeleri yükler.',
    ],
    [
      'Merkez ekibi',
      '2earl çalışanları',
      'Kurumları ve görevlileri kabul eder, teslimleri inceler, fatura keser, ödeme yapar.',
    ],
    [
      'Kolluk ve yediemin',
      'Polis, jandarma; yediemin otoparkı',
      'Aracı yakalar, tutanağı düzenler, aracı teslim alır. Emanet’in kullanıcısı değildir.',
    ],
  ],
)}
<h2>Uygulamalar</h2>
${table(
  ['Uygulama', 'Adres', 'Kimin için'],
  [
    [
      'Emanet Kurumsal',
      'kurumsal.emanet.dev',
      'Kurumlar: dosyalar, CSV yükleme, API, webhook, faturalar, raporlar.',
    ],
    [
      'Emanet Saha',
      'saha.emanet.dev',
      'Saha görevlileri: başvuru, araçlar, üstlenme, görme bildirimi, kazançlar.',
    ],
    ['Emanet Merkez', 'merkez.emanet.dev', 'Ekip: bu konsol.'],
    ['emanet.dev', 'emanet.dev', 'Herkese açık site ve hukuki metinler.'],
  ],
)}
<p>Hepsi aynı çekirdeğe (emanet-core) bağlıdır; çekirdeğin internete açık bir adresi yoktur. Giriş 2earl hesabıyla yapılır; Merkez’e giriş ikinci doğrulama adımı ister.</p>
<h2>Bir aracın yolculuğu</h2>
${flow(['Kurum dosyayı ekler', 'Kimlik kontrolü', 'Görevli üstlenir', 'Görür, 112’yi arar', 'Kolluk yakalar', 'Yediemin teslim alır', 'Merkez inceler', 'Fatura ve ödeme'])}`
        : `<p>Emanet helps find vehicles that carry a <strong>seizure order</strong> (yakalama şerhi). The creditor adds its vehicle; a field agent whose identity has been verified looks for it on the street; on seeing it, the agent photographs it and calls <strong>112</strong>; the police seize it and deliver it to a custodian car park (yediemin). The creditor pays only for a vehicle that reaches custody.</p>
${note('<strong>The rule that never bends:</strong> Emanet and its agents never touch or tow a vehicle, never speak to the debtor, never take money. Seizure and delivery are the police’s work alone. Emanet is not a public authority and carries out no enforcement.')}
<h2>Who takes part</h2>
${table(
  ['Party', 'Who', 'What they do'],
  [
    [
      'Partner (creditor)',
      'Bank, asset-management company, leasing company, law firm',
      'Adds its vehicles, confirms its cases, gets the documents and the invoices.',
    ],
    [
      'Field agent',
      'A person whose identity has been verified',
      'Claims vehicles in their city, looks, calls 112 on sight and uploads the documents.',
    ],
    [
      'Merkez staff',
      '2earl employees',
      'Admit partners and agents, review deliveries, invoice and pay.',
    ],
    [
      'Police and custodian',
      'Police, gendarmerie; the custodian car park',
      'Seize the vehicle, write the report, take it into custody. They don’t use Emanet.',
    ],
  ],
)}
<h2>The apps</h2>
${table(
  ['App', 'Address', 'For whom'],
  [
    [
      'Emanet Kurumsal',
      'kurumsal.emanet.dev',
      'Partners: cases, CSV upload, API, webhooks, invoices, reports.',
    ],
    [
      'Emanet Saha',
      'saha.emanet.dev',
      'Agents: application, vehicles, claims, sightings, earnings.',
    ],
    ['Emanet Merkez', 'merkez.emanet.dev', 'Staff: this console.'],
    ['emanet.dev', 'emanet.dev', 'The public site and the legal texts.'],
  ],
)}
<p>All of them talk to one core (emanet-core), which has no public address. Everyone signs in with a 2earl account; Merkez also needs a second factor.</p>
<h2>A vehicle’s journey</h2>
${flow(['Partner adds the case', 'Identity check', 'Agent claims', 'Sees it, calls 112', 'Police seize', 'Custodian receives', 'Merkez reviews', 'Invoice and payout'])}`,
  },
  {
    slug: 'cases',
    icon: 'folder',
    title: { en: 'A case, start to end', tr: 'Bir dosya, baştan sona' },
    summary: {
      en: 'What a case is, the states it passes through, and what ends it.',
      tr: 'Dosya nedir, hangi durumlardan geçer ve ne ile kapanır.',
    },
    body: (l) =>
      l === 'tr'
        ? `<p>Bir <strong>dosya</strong>, bir kurumun bir araç üzerindeki alacağıdır: icra dairesi, dosya numarası, şerh tarihi, hukuki dayanak (rehin veya haciz) ve aracın aranabileceği yerler. Aynı araç için birden fazla kurumun dosyası olabilir; araç tek, dosyalar ayrıdır.</p>
<h2>Durumlar</h2>
${table(
  ['Durum', 'Anlamı', 'Sonraki adım'],
  [
    [
      'Kimlik bekliyor',
      'Şasi numarası yok ya da plaka başka bir araçta kayıtlı. Görevliler aracı görmez.',
      'Merkez İncelemeler’de aracı belirler veya dosyayı reddeder.',
    ],
    [
      'Etkin',
      'Görevliler aracı görebilir ve üstlenebilir.',
      'Teslim, geri çekme veya süre dolması.',
    ],
    ['Teslim edildi', 'Araç yediemin otoparkında; belgeler dosyada.', 'Fatura.'],
    [
      'Geri çekildi',
      'Kurum dosyayı geri çekti (borç ödendi, şerh kalktı) ya da kimlik reddedildi.',
      '—',
    ],
    [
      'Süresi doldu',
      'Kurum şerhin sürdüğünü zamanında onaylamadı.',
      'Kurum dosyayı yeniden gönderirse yeniden etkinleşir.',
    ],
  ],
)}
<h2>Onaylama (yeniden teyit)</h2>
<p>Yakalama şerhi kalkmış bir aracı aramak hukuka aykırı olur. Bu yüzden her kurum, dosyalarının hâlâ geçerli olduğunu belirli aralıklarla onaylar (kurumun sözleşmesindeki gün sayısı; genellikle 14). Onaylanmayan dosyanın süresi dolar ve görevliler aramayı bırakır. Süre dolmadan {{expiry_warning_days}} önce kurumun operasyon adresine uyarı gider.</p>
<h2>Ücret</h2>
<p>Ücret, dosya eklendiği anda kurumun fiyat listesinden belirlenir ve sabitlenir; sonradan fiyat listesi değişse de dosyanın ücreti değişmez. Ücret yalnızca teslimde doğar.</p>
<h2>Teslimden sonra</h2>
<p>Dosya kapandıktan {{place_retention_days}} sonra borçluya ait açık adresler, koordinatlar ve notlar silinir. İlçe ve il raporlar için kalır.</p>
${note('Bir teslim incelemedeyken o aracın etkin dosyaları değiştirilemez, geri çekilemez ve süresi dolmaz. İnceleme bitince kilit kalkar.')}`
        : `<p>A <strong>case</strong> is one creditor’s claim on one vehicle: the enforcement office, the file number, the date of the seizure order, the legal basis (pledge or attachment), and the places where the vehicle may be found. Several partners can have a case on the same vehicle; the vehicle is one, the cases are separate.</p>
<h2>States</h2>
${table(
  ['State', 'Meaning', 'Next'],
  [
    [
      'Waiting for identity',
      'No chassis number, or the plate is recorded on another vehicle. Agents don’t see it.',
      'Merkez settles which vehicle it is under Reviews, or rejects the case.',
    ],
    ['Active', 'Agents can see and claim the vehicle.', 'Delivery, withdrawal or expiry.'],
    [
      'Delivered',
      'The vehicle is in a custodian car park; the documents are on the case.',
      'Invoice.',
    ],
    [
      'Withdrawn',
      'The partner withdrew it (debt paid, order lifted), or its identity was rejected.',
      '—',
    ],
    [
      'Expired',
      'The partner didn’t confirm in time that the order still stands.',
      'Sending the case again makes it active again.',
    ],
  ],
)}
<h2>Confirming</h2>
<p>Looking for a vehicle whose seizure order has been lifted would be unlawful. So each partner confirms at intervals that its cases still stand (the number of days in the partner’s agreement, usually 14). A case that isn’t confirmed expires and agents stop looking. {{expiry_warning_days}} before, the partner’s operations contact is warned.</p>
<h2>The fee</h2>
<p>The fee is taken from the partner’s price list when the case is added and is fixed then; a later price list doesn’t change it. It is owed only on delivery.</p>
<h2>After it closes</h2>
<p>{{place_retention_days}} after a case closes, the debtor’s street addresses, coordinates and notes are erased. District and city stay for reports.</p>
${note('While a delivery is under review, the active cases on that vehicle can’t be changed, withdrawn, or expire. The hold ends when the review does.')}`,
  },
  {
    slug: 'agents',
    icon: 'agents',
    title: {
      en: 'Agents: joining, working, discipline',
      tr: 'Saha görevlileri: katılım, çalışma, disiplin',
    },
    summary: {
      en: 'The checks before an agent is active, how a claim runs, and what strikes and suspension mean.',
      tr: 'Görevli etkinleşmeden önceki kontroller, üstlenmenin işleyişi, ihtar ve askıya almanın anlamı.',
    },
    body: (l) =>
      l === 'tr'
        ? `<h2>Katılım</h2>
${flow(['E-posta kodu', 'Kimlik ve banka bilgileri', 'Kurallar', 'Başvuru gönderilir', 'Görüntülü görüşme', 'Karar'])}
<ol>
<li><strong>E-posta.</strong> Başvuran, adresine gelen altı haneli kodla adresini doğrular (kod {{email_code_minutes}} geçerlidir).</li>
<li><strong>Kimlik.</strong> Ad soyad, T.C. kimlik numarası, doğum yılı, cep telefonu, IBAN. Numara önce hane kontrolünden, sonra (yanıt verirse) nüfus kayıt sorgusundan geçer. Numaranın kendisi saklanmaz; yalnızca anahtarlı özeti tutulur. E-posta, telefon ve kimlik numarası her biri tek hesapta bulunabilir.</li>
<li><strong>Kurallar.</strong> Başvuran saha kurallarını okur ve kabul eder.</li>
<li><strong>Görüntülü görüşme.</strong> Merkez {{agent_sla_hours}} içinde arar: kişi kimlik kartını gösterir, IBAN’ın kendisine ait olduğu doğrulanır. Sonuç görevlinin sayfasına işlenir.</li>
<li><strong>Karar.</strong> Etkinleştir, <em>düzeltme için geri gönder</em> (başvuran notu okur, düzeltir, yeniden gönderir) ya da reddet. Etkinleştirme, doğrulanmış e-posta ve kayıtlı kimlik numarası olmadan yapılamaz ve son 15 dakikada ikinci doğrulama ister.</li>
</ol>
${note('SMS ile telefon doğrulaması ve kimlik kartının NFC ile okunması henüz yok; görüntülü görüşme bunların yerini tutar. Kontrol listesinde yerleri hazırdır.')}
<h2>Üstlenme</h2>
${flow(['Üstlenir', 'Arar', 'Görür: fotoğraf + konum', '112’yi arar', 'Kolluk yakalar', 'Yediemin makbuzu', 'İnceleme'])}
<ul>
<li>Bir görevli aynı anda en fazla {{max_active_claims}} araç üstlenebilir. Üstlenme {{claim_hours}} sürer; adresleri yalnızca üstlenen görevli ve yalnızca bu sürede görür. Her görüntüleme kaydedilir.</li>
<li>Görme bildirimi yapıldığında üstlenme en az {{reporting_hours}} daha sürer.</li>
<li>Üstlenme teslimsiz biterse aynı görevli aynı aracı {{cooldown_hours}} boyunca yeniden üstlenemez.</li>
<li>Görevli borcun tutarını ve borçlunun adını hiçbir zaman görmez.</li>
</ul>
<h2>İhtar ve askıya alma</h2>
<p>Onaylanmayan bir teslim, yanlış veya özensiz bildirim ise <strong>ihtar</strong> olarak işlenebilir. İhtar sayısı {{strike_limit}} olduğunda sistem hesabı askıya alır ve açık üstlenmeleri sonlandırır. Ekip ayrıca gerekçe yazarak askıya alabilir veya hesabı kapatabilir. Onaylanmış teslimlerin ödemesi bunlardan etkilenmez.</p>
<h2>Görevliye bildirimler</h2>
<p>Her karar görevlinin doğruladığı adrese, başvuru dilinde e-postayla gider: başvuru alındı, onaylandı, geri gönderildi; teslim onaylandı veya onaylanmadı (gerekçesiyle); ödeme gönderildi; hesap askıya alındı, kapatıldı, yeniden açıldı.</p>`
        : `<h2>Joining</h2>
${flow(['Email code', 'Identity and bank details', 'Rules', 'Application sent', 'Video call', 'Decision'])}
<ol>
<li><strong>Email.</strong> The applicant proves the address with a six-digit code (valid for {{email_code_minutes}}).</li>
<li><strong>Identity.</strong> Full name, T.C. kimlik no, birth year, mobile number, IBAN. The number is checked by its digits and then, when the service answers, against the population registry. The number itself isn’t kept, only a keyed hash. An email, a phone and an ID number can each belong to one account only.</li>
<li><strong>Rules.</strong> The applicant reads and accepts the field rules.</li>
<li><strong>Video call.</strong> Merkez calls within {{agent_sla_hours}}: the person shows their ID card, and the IBAN is confirmed as theirs. The result is recorded on the agent’s page.</li>
<li><strong>Decision.</strong> Activate, <em>send back for correction</em> (the applicant reads the note, corrects, sends again), or refuse. Activation isn’t possible without a verified email and an ID number on record, and needs a second factor from the last 15 minutes.</li>
</ol>
${note('Phone verification by SMS and reading the ID card over NFC aren’t built yet; the video call stands in for them. Their places in the checklist are ready.')}
<h2>A claim</h2>
${flow(['Claims', 'Looks', 'Sees it: photo + location', 'Calls 112', 'Police seize', 'Custodian’s receipt', 'Review'])}
<ul>
<li>An agent holds at most {{max_active_claims}} vehicles at once. A claim lasts {{claim_hours}}; only the claiming agent sees the addresses, and only for that time. Every view is recorded.</li>
<li>After a sighting the claim lasts at least another {{reporting_hours}}.</li>
<li>If a claim ends without a delivery, the same agent can’t claim that vehicle again for {{cooldown_hours}}.</li>
<li>An agent never sees the amount of the debt or the debtor’s name.</li>
</ul>
<h2>Strikes and suspension</h2>
<p>A delivery that isn’t accepted can be recorded as a <strong>strike</strong> when the report was false or careless. At {{strike_limit}} strikes the system suspends the account and ends its open claims. Staff can also suspend or close an account with a written reason. Payment for deliveries already confirmed isn’t affected.</p>
<h2>What the agent is told</h2>
<p>Every decision is mailed to the address the agent proved, in the language they applied in: application received, approved, sent back; delivery confirmed or not (with the reason); payout sent; account suspended, closed, reinstated.</p>`,
  },
  {
    slug: 'partners',
    icon: 'partners',
    title: { en: 'Partners: from invitation to active', tr: 'Kurumlar: davetten etkinliğe' },
    summary: {
      en: 'How a company joins, why the agreement can’t be skipped, and what staff set for each partner.',
      tr: 'Bir kurum nasıl katılır, sözleşme neden atlanamaz ve ekip her kurum için neleri belirler.',
    },
    body: (l) =>
      l === 'tr'
        ? `${flow(['Davet', 'Kurum hesabı bağlar', 'Bilgiler ve belgeler', 'Sözleşme onayı', 'Merkez onayı', 'Etkin'])}
<ol>
<li><strong>Davet.</strong> Ekip, Kurum kabul sayfasından kurumu davet eder: unvan, yetkili, e-posta, dil, fiyat listesi ve teyit aralığı. Davet {{invitation_days}} geçerlidir; yolda hatırlatmalar gider.</li>
<li><strong>Hesap.</strong> Yetkili, davet edilen adresle 2earl hesabına girer ve kurumun 2earl organizasyonunu bağlar.</li>
<li><strong>Bilgiler ve belgeler.</strong> Unvan, vergi dairesi ve numarası, MERSİS, KEP, adres, iletişim adresleri; imza sirküleri ve yetki belgeleri.</li>
<li><strong>Sözleşme.</strong> Yetkili Emanet Hizmet Sözleşmesi’ni okur ve onaylar. Onaylanan metnin özeti (SHA-256) saklanır; metin sonradan değişmez.</li>
<li><strong>Merkez onayı.</strong> Daveti gönderen kişiden <em>farklı</em> bir yönetici bilgileri ve belgeleri kontrol eder: onaylar, düzeltme ister ya da reddeder. Hedef süre {{onboarding_sla_hours}}.</li>
</ol>
${note('Sözleşme olmadan kurum etkinleştirilemez. “Kurum ekle” gibi bir kısa yol yoktur; bu bilinçli bir tercihtir: her etkin kurumun arkasında onaylanmış bir sözleşme ve iki kişinin kararı vardır.')}
<h2>Kurum sayfasında</h2>
<ul>
<li><strong>Fiyat listesi.</strong> Varsayılan ücret ve marka veya modele göre kurallar. Yeni liste yalnızca bundan sonra eklenen dosyalara uygulanır.</li>
<li><strong>Özel alanlar.</strong> Kurumun dosya, araç veya yer için istediği ek alanlar. Kişisel veri olarak işaretlenen alan veritabanında şifreli saklanır.</li>
<li><strong>Bildirimler.</strong> Teslim ve süre dolumu e-postaları açılıp kapatılabilir.</li>
<li><strong>Durum.</strong> Askıya alınan kurum giriş yapamaz, API anahtarları çalışmaz ve araçları aranmaz.</li>
</ul>
<h2>Entegrasyon</h2>
<p>Kurum, Kurumsal’da API anahtarı ve en fazla {{max_webhooks}} webhook tanımlar. Art arda {{webhook_disable_after}} kez hata veren webhook kapatılır ve kuruma e-posta gider. Anahtar ve webhook değişiklikleri Denetim kaydına işlenir.</p>`
        : `${flow(['Invitation', 'Company links its account', 'Details and documents', 'Agreement accepted', 'Merkez approves', 'Active'])}
<ol>
<li><strong>Invitation.</strong> Staff invite the company from Onboarding: legal name, contact, email, language, price list and how often cases must be confirmed. The invitation works for {{invitation_days}}; reminders go out on the way.</li>
<li><strong>Account.</strong> The contact signs in to a 2earl account with the invited address and links the company’s 2earl organization.</li>
<li><strong>Details and documents.</strong> Legal name, tax office and number, MERSİS, KEP, address, contact addresses; the signature circular and proof of authority.</li>
<li><strong>Agreement.</strong> The contact reads and accepts the Emanet service agreement. A digest (SHA-256) of the accepted text is kept; the text can’t change afterwards.</li>
<li><strong>Merkez approval.</strong> An admin <em>other than</em> the one who sent the invitation checks the details and documents: approves, asks for a correction, or rejects. The target is {{onboarding_sla_hours}}.</li>
</ol>
${note('A company can’t be made active without the agreement. There is no “add a partner” shortcut, on purpose: behind every active partner there is an accepted agreement and two people’s decision.')}
<h2>On the partner’s page</h2>
<ul>
<li><strong>Price list.</strong> A default fee and rules by make or model. A new list applies only to cases added from then on.</li>
<li><strong>Custom fields.</strong> Extra fields the partner wants on a case, vehicle or place. A field marked as personal data is stored encrypted.</li>
<li><strong>Notices.</strong> Emails about deliveries and expiring cases can be switched on or off.</li>
<li><strong>Status.</strong> A suspended partner can’t sign in, its API keys stop working, and its vehicles aren’t looked for.</li>
</ul>
<h2>Integration</h2>
<p>In Kurumsal the partner creates API keys and up to {{max_webhooks}} webhooks. A webhook that fails {{webhook_disable_after}} times in a row is switched off and the partner is mailed. Changes to keys and webhooks are written to the audit log.</p>`,
  },
  {
    slug: 'reviews',
    icon: 'reviews',
    title: { en: 'Reviewing a delivery', tr: 'Teslimi incelemek' },
    summary: {
      en: 'What to check before money is owed, when not to accept, and when a strike is fair.',
      tr: 'Para doğmadan önce neye bakılır, ne zaman onaylanmaz ve ihtar ne zaman yerindedir.',
    },
    body: (l) =>
      l === 'tr'
        ? `<p>Teslim onayı, Emanet’te para doğuran tek karardır: kurum faturalanır, görevliye ödeme oluşur. Bu yüzden yalnızca yönetici veya sahip rolü, son 15 dakikada ikinci doğrulamayla onaylayabilir. Hedef süre {{review_sla_hours}}.</p>
<h2>Kontrol listesi</h2>
${table(
  ['Madde', 'Neye bakılır'],
  [
    [
      'Plaka eşleşiyor',
      'Olay yeri fotoğrafındaki plaka, dosyadaki plakadır. Plaka okunmuyorsa şasi numarası veya ruhsat görülmelidir.',
    ],
    [
      'Yediemin makbuzu',
      'Makbuz bu aracı (plaka veya şasi) ve yediemin otoparkını gösterir; tarih üstlenmeden sonradır.',
    ],
    [
      'Yer ve zaman tutarlı',
      'Görme bildiriminin konumu ve saati, fotoğrafların saatiyle ve bilinen adreslerle çelişmiyor.',
    ],
    [
      'Fotoğraflar özgün',
      'Ekran görüntüsü, internetten alınmış veya başka bir teslimde kullanılmış görüntü değil. Sistem aynı dosyayı ikinci kez kabul etmez.',
    ],
  ],
)}
<p>Sayfadaki <strong>işaretler</strong> yardımcıdır: üstlenmeden görmeye geçen süre (çok kısa ise iki kez bakın), en yakın bilinen yere uzaklık, görevlinin ihtar ve teslim geçmişi, üstlenmeden önce çekilmiş fotoğraf.</p>
<h2>Onaylamamak</h2>
<p>Kanıt yetmiyorsa teslimi onaylamayın ve görevlinin okuyacağı kısa, somut bir gerekçe yazın (“Makbuzdaki plaka 34 ABC 123; dosya 34 ABD 123”). Üstlenme biter, fotoğraflar yeniden kullanılamaz, hiçbir kurum bilgilendirilmez ve hiçbir şey kayda geçmez.</p>
<h2>İhtar ne zaman</h2>
<ul>
<li><strong>Evet:</strong> başka araca ait fotoğraf, sahte veya değiştirilmiş belge, kolluk olmadan “teslim” bildirimi, kurala aykırı davranış (araca dokunma, borçluyla konuşma).</li>
<li><strong>Hayır:</strong> eksik ama düzeltilebilir belge, okunmayan fotoğraf, iyi niyetli hata. Bunlarda gerekçe yeter.</li>
</ul>
<h2>Araç kimliği incelemeleri</h2>
<p>Şasi numarası olmayan veya plakası başka araçta görünen dosya görevlilere açılmaz. Ruhsat veya icra dosyasından şasi numarasını girip kabul edin ya da kuruma gerekçesiyle reddedin. Hedef süre {{identity_sla_hours}}.</p>`
        : `<p>Confirming a delivery is the one decision in Emanet that creates money: the partner is invoiced and the agent’s payout is created. So only an admin or owner can confirm, with a second factor from the last 15 minutes. The target is {{review_sla_hours}}.</p>
<h2>The checklist</h2>
${table(
  ['Point', 'What to look at'],
  [
    [
      'The plate matches',
      'The plate in the scene photo is the case’s plate. If it can’t be read, the chassis number or the registration must be visible.',
    ],
    [
      'The custodian’s receipt',
      'The receipt names this vehicle (plate or chassis number) and the custodian car park, and is dated after the claim.',
    ],
    [
      'Place and time are plausible',
      'The sighting’s location and time don’t contradict the photos’ times or the known addresses.',
    ],
    [
      'The photos are originals',
      'Not a screenshot, not taken from the internet, not used in another delivery. The system refuses the same file twice.',
    ],
  ],
)}
<p>The <strong>signals</strong> on the page help: the time from claim to sighting (look twice if very short), the distance to the nearest known place, the agent’s record of strikes and deliveries, a photo taken before the claim.</p>
<h2>Not accepting</h2>
<p>If the evidence isn’t enough, don’t accept, and write a short, concrete reason the agent will read (“The receipt says 34 ABC 123; the case is 34 ABD 123”). The claim ends, the photos can’t be used again, no partner is told and nothing is booked.</p>
<h2>When a strike is fair</h2>
<ul>
<li><strong>Yes:</strong> a photo of another vehicle, a forged or altered document, a “delivery” reported without the police, a breach of the rule (touching the vehicle, speaking to the debtor).</li>
<li><strong>No:</strong> a document that is missing but can be supplied, an unreadable photo, an honest mistake. The reason is enough.</li>
</ul>
<h2>Vehicle-identity reviews</h2>
<p>A case without a chassis number, or whose plate appears on another vehicle, isn’t shown to agents. Enter the chassis number from the registration or the enforcement file and accept, or reject it to the partner with a reason. The target is {{identity_sla_hours}}.</p>`,
  },
  {
    slug: 'money',
    icon: 'money',
    title: { en: 'Money: invoices and payouts', tr: 'Para: faturalar ve ödemeler' },
    summary: {
      en: 'From a confirmed delivery to an invoice paid and an agent paid, and where two people are needed.',
      tr: 'Onaylanan teslimden ödenen faturaya ve ödenen görevliye; iki kişinin gerektiği yerler.',
    },
    body: (l) =>
      l === 'tr'
        ? `${flow(['Teslim onaylandı', 'Fatura kesilir', 'e-Fatura numarası', 'Tahsilat kaydı', 'Ödeme talimatı', 'İkinci onay', 'Ödeme gönderildi'])}
<h2>Fatura</h2>
<ul>
<li>Teslim edilen dosyalar kurum bazında <strong>Faturalanacaklar</strong>’da birikir. Fatura, teslimden itibaren {{invoice_days}} içinde kesilmelidir (VUK 231/5); Bugün sayfası yaklaşanları ve gecikenleri gösterir.</li>
<li>Faturaya {{kdv_bp}} KDV eklenir. Fatura Merkez’de oluşturulur; e-Fatura sistemindeki numara sonradan faturaya işlenir.</li>
<li>Kurumdan gelen ödeme <strong>tahsilat</strong> olarak kaydedilir; fatura “ödendi” olur.</li>
</ul>
<h2>Görevli ödemesi</h2>
<ul>
<li>Ödeme tutarı, teslim onaylandığı anda geçerli olan <strong>ödeme kuralından</strong> hesaplanır (ücretin bir yüzdesi veya sabit tutar; alt ve üst sınırla). Bir araçta birden fazla dosya varsa görevliye en yüksek ücret üzerinden bir kez ödenir.</li>
<li>Görevlinin vergi durumuna göre stopaj kesilir (gerçek kişi {{withholding_individual_bp}}, serbest meslek {{withholding_sole_trader_bp}}, şirket {{withholding_company_bp}}).</li>
<li>Ödeme yalnızca ekipçe doğrulanmış IBAN’a yapılır. Görevli IBAN’ını değiştirirse doğrulama düşer.</li>
<li>{{dual_approval_kurus}} ve üzeri ödemelerde talimatı veren ile onaylayan farklı iki yönetici olmalıdır.</li>
<li>Banka havalesi yapıldıktan sonra dekont numarasıyla “gönderildi” işaretlenir; görevliye e-posta gider.</li>
</ul>
${note('Kayıtlar çift taraflıdır: her fatura, tahsilat ve ödeme büyük deftere borç ve alacak olarak aynı anda yazılır ve değiştirilemez. Yanlış kayıt, ters kayıtla düzeltilir. Mizan sayfası her an sıfıra denk gelmelidir.')}`
        : `${flow(['Delivery confirmed', 'Invoice issued', 'E-invoice number', 'Receipt recorded', 'Payout ordered', 'Second approval', 'Payout sent'])}
<h2>Invoices</h2>
<ul>
<li>Delivered cases gather per partner under <strong>To invoice</strong>. An invoice must be issued within {{invoice_days}} of the delivery (VUK 231/5); Today shows what is close and what is late.</li>
<li>{{kdv_bp}} VAT is added. The invoice is created in Merkez; its number in the e-invoice system is recorded on it afterwards.</li>
<li>The partner’s payment is recorded as a <strong>receipt</strong>, and the invoice becomes paid.</li>
</ul>
<h2>Paying the agent</h2>
<ul>
<li>The amount comes from the <strong>payout rule</strong> in force when the delivery is confirmed (a share of the fee or a fixed amount, with a floor and a ceiling). When a vehicle has several cases, the agent is paid once, on the highest fee.</li>
<li>Tax is withheld by the agent’s tax profile (individual {{withholding_individual_bp}}, sole trader {{withholding_sole_trader_bp}}, company {{withholding_company_bp}}).</li>
<li>Money goes only to an IBAN staff have verified. If the agent changes the IBAN, the verification lapses.</li>
<li>For payouts of {{dual_approval_kurus}} or more, the admin who orders and the admin who approves must be two different people.</li>
<li>After the bank transfer, the payout is marked sent with the bank’s reference, and the agent is mailed.</li>
</ul>
${note('The books are double-entry: every invoice, receipt and payout is written to the ledger as debits and credits at once and can’t be edited. A wrong entry is corrected by a reversing one. The trial balance must net to zero at any moment.')}`,
  },
  {
    slug: 'privacy',
    icon: 'privacy',
    title: { en: 'Privacy and data subjects’ requests', tr: 'Gizlilik ve ilgili kişi başvuruları' },
    summary: {
      en: 'What personal data Emanet holds, how long, and how to answer a request step by step.',
      tr: 'Emanet hangi kişisel verileri, ne kadar süre tutar ve bir başvuru adım adım nasıl yanıtlanır.',
    },
    body: (l) =>
      l === 'tr'
        ? `<h2>Ne tutulur, ne kadar</h2>
${table(
  ['Veri', 'Nerede', 'Ne kadar'],
  [
    [
      'Borçlunun adresleri, notlar',
      'Dosyanın yerleri',
      'Dosya kapandıktan {{place_retention_days}} sonra silinir.',
    ],
    [
      'Kişisel veri işaretli özel alanlar',
      'Dosya, araç, yer',
      'Şifreli saklanır; dosyayla birlikte silinir.',
    ],
    [
      'Teslim fotoğrafları ve belgeleri',
      'Kanıt deposu',
      '{{evidence_retention_days}} (ticari kayıt).',
    ],
    [
      'Teslimle bitmeyen üstlenmenin fotoğrafları',
      'Kanıt deposu',
      '{{failed_claim_evidence_days}}.',
    ],
    [
      'Kurum belgeleri',
      'Belge deposu',
      'Etkin kurum: {{evidence_retention_days}}. Tamamlanmayan başvuru: {{abandoned_onboarding_days}}.',
    ],
    [
      'Görevli kimliği',
      'Görevli kaydı',
      'T.C. kimlik no saklanmaz (yalnızca anahtarlı özet). Hesap silinince e-posta, telefon, doğum yılı silinir.',
    ],
    ['Hata kayıtları', 'Sistem', '{{ops_keep_days}}; kişisel veri içermez.'],
  ],
)}
<h2>Başvuru nasıl yanıtlanır</h2>
<ol>
<li><strong>Kaydet.</strong> Gizlilik → Başvurular’da başvuruyu açın: türü (erişim, silme, düzeltme, itiraz), kimin hakkında, hangi kanaldan ve hangi tarihte geldiği. Son tarih kendiliğinden hesaplanır: geliş tarihinden itibaren {{privacy_request_days}} (kanuni üst sınır 30 gün).</li>
<li><strong>Kimliği doğrula.</strong> Başvuranın, verinin sahibi olduğundan emin olun (KEP, ıslak imza veya kayıtlı e-posta).</li>
<li><strong>Ara.</strong> Gizlilik sayfasında plaka, şasi numarası, hesap kimliği veya adresle arayın. Arama, bulunan her kaydı ve dosyayı listeler; her arama denetim kaydına işlenir.</li>
<li><strong>Karar ver.</strong> Ticari saklama yükümlülüğü olan teslim kayıtları silinmeyebilir; bu durumda başvuru gerekçesiyle reddedilir. Diğerlerinde dosyayı gerekçe yazarak silin; kapanmış dosyanın adreslerini hemen temizleyin.</li>
<li><strong>Yanıtla ve kapat.</strong> Başvurana aynı kanaldan yanıt verin; başvuruyu sonucuyla kapatın.</li>
</ol>
${note('Silme geri alınamaz. Her silme gerekçe ve son 15 dakikada ikinci doğrulama ister; dosya depodan birkaç dakika içinde kalkar ve kurumun gördüğü listeden hemen düşer.')}`
        : `<h2>What is held, and for how long</h2>
${table(
  ['Data', 'Where', 'How long'],
  [
    [
      'The debtor’s addresses, notes',
      'The case’s places',
      'Erased {{place_retention_days}} after the case closes.',
    ],
    [
      'Custom fields marked as personal',
      'Case, vehicle, place',
      'Stored encrypted; erased with the case.',
    ],
    [
      'Photos and documents of a delivery',
      'Evidence storage',
      '{{evidence_retention_days}} (a commercial record).',
    ],
    [
      'Photos of a claim that didn’t end in delivery',
      'Evidence storage',
      '{{failed_claim_evidence_days}}.',
    ],
    [
      'A partner’s documents',
      'Document storage',
      'Active partner: {{evidence_retention_days}}. Unfinished onboarding: {{abandoned_onboarding_days}}.',
    ],
    [
      'An agent’s identity',
      'The agent’s record',
      'The T.C. kimlik no isn’t kept (only a keyed hash). When the account is deleted, email, phone and birth year go.',
    ],
    ['Error records', 'System', '{{ops_keep_days}}; no personal data.'],
  ],
)}
<h2>Answering a request</h2>
<ol>
<li><strong>Record it.</strong> Under Privacy → Requests, open the request: its kind (access, erasure, correction, objection), whom it is about, how and when it arrived. The deadline is worked out for you: {{privacy_request_days}} from the day it arrived (the law’s ceiling is 30 days).</li>
<li><strong>Verify who is asking.</strong> Be sure the person is the one the data is about (KEP, wet signature, or the address on record).</li>
<li><strong>Search.</strong> On the Privacy page, search by plate, chassis number, account ID or address. The search lists every record and file found; each search is written to the audit log.</li>
<li><strong>Decide.</strong> Delivery records that commercial law requires us to keep may not be erased; then the request is refused with that reason. Otherwise erase the file with a written reason, and clear a closed case’s addresses at once.</li>
<li><strong>Answer and close.</strong> Reply through the channel the request came by, and close the request with its outcome.</li>
</ol>
${note('Erasing can’t be undone. Each erasure needs a reason and a second factor from the last 15 minutes; the file leaves storage within minutes and disappears from the partner’s list at once.')}`,
  },
  {
    slug: 'operations',
    icon: 'system',
    title: { en: 'Running the day', tr: 'Günü yürütmek' },
    summary: {
      en: 'What to look at each morning, what each queue’s deadline is, and what to do when an alert arrives.',
      tr: 'Her sabah neye bakılır, her kuyruğun süresi nedir ve uyarı geldiğinde ne yapılır.',
    },
    body: (l) =>
      l === 'tr'
        ? `<h2>Her gün</h2>
<ol>
<li><strong>Bugün</strong> sayfasını açın. Her kuyruk süresine göre renklenir: yeşil zamanında, sarı yaklaşıyor, kırmızı gecikmiş.</li>
<li>Önce kırmızıları, sonra en eski bekleyeni alın.</li>
<li>Faturalanacakları ve gönderilecek ödemeleri kapatın.</li>
<li><strong>Sistem</strong> sayfasında bir işin durup durmadığına bakın.</li>
</ol>
<h2>Kuyruklar ve süreleri</h2>
${table(
  ['Kuyruk', 'Süre', 'Neden'],
  [
    ['Teslim incelemeleri', '{{review_sla_hours}}', 'Görevli ödemesini, kurum belgelerini bekler.'],
    ['Araç kimliği incelemeleri', '{{identity_sla_hours}}', 'Karar verilene kadar araç aranmaz.'],
    ['Görevli başvuruları', '{{agent_sla_hours}}', 'Başvurana bu sürede aranacağı bildirildi.'],
    [
      'Onay bekleyen kurumlar',
      '{{onboarding_sla_hours}}',
      'Kurum sözleşmeyi onayladı, başlamak için bekliyor.',
    ],
    ['İlgili kişi başvuruları', '{{privacy_request_days}}', 'Kanuni süre (KVKK 13).'],
    ['Faturalanacak teslimler', '{{invoice_days}}', 'Kanuni süre (VUK 231/5).'],
  ],
)}
<p>Süresi aşan kuyruk günde bir kez hata olarak kaydedilir ve uyarı e-postasına girer. Uyarı e-postaları en sık {{alert_interval_minutes}} arayla gider.</p>
<h2>Uyarı geldiğinde</h2>
${table(
  ['Uyarı', 'Anlamı', 'Ne yapılır'],
  [
    [
      '<code>sla.*</code>',
      'Bir kuyrukta süresi aşan iş var.',
      'Bugün sayfasından o kuyruğu açın ve en eskiyi alın.',
    ],
    [
      '<code>cron.*</code>',
      'Zamanlanmış bir iş hata verdi.',
      'Sistem → İşler: iş bir sonraki turda düzeldiyse bir şey gerekmez. İki turdur duruyorsa geliştiriciye haber verin.',
    ],
    [
      '<code>GET /…</code>, <code>POST /…</code>',
      'Bir sayfa veya form hata verdi.',
      'Aynı hata tekrarlıyorsa adresi ve saati geliştiriciye iletin. Kayıtlarda kişisel veri yoktur.',
    ],
    [
      '<code>webhook.disabled</code>',
      'Bir kurumun webhook’u kapatıldı.',
      'Kuruma e-posta zaten gitti; sorarlarsa Kurumsal → Entegrasyonlar’dan yeniden açabileceklerini söyleyin.',
    ],
  ],
)}
<h2>Karar kaydı</h2>
<p>Yaptığınız her değişiklik adınızla <strong>Denetim</strong> kaydına yazılır ve silinemez. Bir kararın neden verildiği sorulduğunda yanıt orada olmalıdır: gerekçe alanlarını boş veya “tamam” gibi anlamsız bırakmayın.</p>`
        : `<h2>Every day</h2>
<ol>
<li>Open <strong>Today</strong>. Each queue is coloured by its deadline: green on time, amber due soon, red overdue.</li>
<li>Take the red ones first, then whatever has waited longest.</li>
<li>Clear what is to invoice and the payouts to send.</li>
<li>Look at <strong>System</strong> to see whether a job has stopped.</li>
</ol>
<h2>Queues and their limits</h2>
${table(
  ['Queue', 'Limit', 'Why'],
  [
    [
      'Delivery reviews',
      '{{review_sla_hours}}',
      'The agent waits for payment, the partner for its documents.',
    ],
    [
      'Vehicle-identity reviews',
      '{{identity_sla_hours}}',
      'Nobody looks for the vehicle until this is decided.',
    ],
    [
      'Agent applications',
      '{{agent_sla_hours}}',
      'The applicant was told to expect a call within this time.',
    ],
    [
      'Companies to approve',
      '{{onboarding_sla_hours}}',
      'The company accepted the agreement and waits to start.',
    ],
    ['Data subjects’ requests', '{{privacy_request_days}}', 'A legal deadline (KVKK 13).'],
    ['Deliveries to invoice', '{{invoice_days}}', 'A legal deadline (VUK 231/5).'],
  ],
)}
<p>A queue past its limit is recorded as an error once a day and goes into the alert email. Alert emails go out at most once every {{alert_interval_minutes}}.</p>
<h2>When an alert arrives</h2>
${table(
  ['Alert', 'Meaning', 'What to do'],
  [
    [
      '<code>sla.*</code>',
      'A queue has overdue work.',
      'Open that queue from Today and take the oldest item.',
    ],
    [
      '<code>cron.*</code>',
      'A scheduled job failed.',
      'System → Jobs: if it recovered on its next run, nothing is needed. If it has failed twice, tell the developer.',
    ],
    [
      '<code>GET /…</code>, <code>POST /…</code>',
      'A page or a form failed.',
      'If it repeats, pass the address and the time to the developer. The records hold no personal data.',
    ],
    [
      '<code>webhook.disabled</code>',
      'A partner’s webhook was switched off.',
      'The partner was mailed already; if they ask, they can switch it back on under Kurumsal → Integrations.',
    ],
  ],
)}
<h2>The record of decisions</h2>
<p>Every change you make is written to the <strong>Audit</strong> log with your name and can’t be removed. When someone asks why a decision was made, the answer has to be there: don’t leave a reason empty or meaningless.</p>`,
  },
  {
    slug: 'roles',
    icon: 'lock',
    title: { en: 'Roles and who decides', tr: 'Roller ve karar yetkisi' },
    summary: {
      en: 'What support, admins and owners can do, where a second person is needed, and why the second factor is asked again.',
      tr: 'Destek, yönetici ve sahip neler yapabilir, ikinci kişi nerede gerekir ve ikinci doğrulama neden yeniden istenir.',
    },
    body: (l) =>
      l === 'tr'
        ? `${table(
            ['İş', 'Destek', 'Yönetici', 'Sahip'],
            [
              ['Her sayfayı görmek, belgeleri açmak', '✓', '✓', '✓'],
              ['Kurum davet etmek', '—', '✓', '✓'],
              ['Sözleşmeyi onaylamak (davet edenden farklı kişi)', '—', '✓', '✓'],
              ['Araç kimliği kararı', '—', '✓', '✓'],
              ['Teslimi onaylamak veya onaylamamak', '—', '✓ ²', '✓ ²'],
              ['Görevli durumu, IBAN doğrulama', '—', '✓ ²', '✓ ²'],
              ['Fatura, tahsilat, ödeme', '—', '✓ ²', '✓ ²'],
              ['Ayarlar, fiyat listesi, ödeme kuralı', '—', '✓ ²', '✓ ²'],
              ['Kişisel veri silmek', '—', '✓ ²', '✓ ²'],
            ],
          )}
<p>² Son 15 dakikada yapılmış ikinci doğrulama ister. Oturum açıkken yeniden istenmesinin nedeni budur: açık bırakılmış bir ekrandan para veya kural değiştirilemesin.</p>
<h2>İki kişi kuralı</h2>
<ul>
<li><strong>Kurum onayı:</strong> daveti gönderen ile onaylayan farklı olmalıdır.</li>
<li><strong>Büyük ödemeler:</strong> {{dual_approval_kurus}} ve üzeri ödemede talimatı veren ile onaylayan farklı olmalıdır.</li>
</ul>
<p>Roller 2earl’de, Emanet ekibi organizasyonundaki üyelikten gelir; Merkez’de ayrıca tanımlanmaz. Bir kişinin erişimini kaldırmak için organizasyon üyeliğini kaldırın.</p>`
        : `${table(
            ['Task', 'Support', 'Admin', 'Owner'],
            [
              ['See every page, open documents', '✓', '✓', '✓'],
              ['Invite a company', '—', '✓', '✓'],
              ['Approve an agreement (not the person who invited)', '—', '✓', '✓'],
              ['Decide a vehicle’s identity', '—', '✓', '✓'],
              ['Confirm or not accept a delivery', '—', '✓ ²', '✓ ²'],
              ['Agent status, verifying an IBAN', '—', '✓ ²', '✓ ²'],
              ['Invoices, receipts, payouts', '—', '✓ ²', '✓ ²'],
              ['Settings, price lists, the payout rule', '—', '✓ ²', '✓ ²'],
              ['Erase personal data', '—', '✓ ²', '✓ ²'],
            ],
          )}
<p>² Needs a second factor from the last 15 minutes. That is why it is asked again while you are signed in: a screen left open must not be able to move money or change rules.</p>
<h2>The two-person rule</h2>
<ul>
<li><strong>Approving a company:</strong> the person who invited and the person who approves must differ.</li>
<li><strong>Large payouts:</strong> for {{dual_approval_kurus}} or more, the person who orders and the person who approves must differ.</li>
</ul>
<p>Roles come from membership of the Emanet staff organization in 2earl; they aren’t set in Merkez. To remove someone’s access, remove their membership there.</p>`,
  },
  {
    slug: 'glossary',
    icon: 'guide',
    title: { en: 'Glossary', tr: 'Sözlük' },
    summary: {
      en: 'The legal and product words used in Emanet, in Turkish and English.',
      tr: 'Emanet’te geçen hukuki ve ürüne özgü terimler, Türkçe ve İngilizce.',
    },
    body: (l) => {
      const terms: [string, string, string, string][] = [
        [
          'Yakalama şerhi',
          'Seizure order',
          'İcra dairesinin araç kaydına koydurduğu, kolluğun aracı gördüğünde yakalamasını sağlayan şerh.',
          'The note an enforcement office has put on a vehicle’s registration, on which the police seize it on sight.',
        ],
        [
          'İcra dairesi',
          'Enforcement office',
          'Alacağın tahsili için takibi yürüten resmî daire. Her dosyada dairenin adı ve dosya numarası bulunur.',
          'The public office that runs the collection proceedings. Every case carries its name and file number.',
        ],
        [
          'Rehin / Haciz',
          'Pledge / Attachment',
          'Dosyanın hukuki dayanağı: araç üzerinde rehin hakkı ya da icra yoluyla haciz.',
          'A case’s legal basis: a pledge over the vehicle, or an attachment in enforcement.',
        ],
        [
          'Kolluk',
          'Police',
          'Polis ve jandarma. Aracı yakalayan ve tutanağı düzenleyen yalnızca kolluktur.',
          'Police and gendarmerie. Only they seize the vehicle and write the report.',
        ],
        [
          'Yediemin',
          'Custodian',
          'Yakalanan aracın teslim edildiği yetkili otopark. Teslimde makbuz verir.',
          'The authorized car park a seized vehicle is delivered to. It issues a receipt.',
        ],
        [
          'Tutanak',
          'Report',
          'Kolluğun yakalama sırasında düzenlediği belge.',
          'The document the police write at the seizure.',
        ],
        [
          'Kurum',
          'Partner',
          'Araçlarını ekleyen alacaklı: banka, varlık yönetim şirketi, leasing şirketi, hukuk bürosu.',
          'The creditor that adds its vehicles: bank, asset-management company, leasing company, law firm.',
        ],
        [
          'Dosya',
          'Case',
          'Bir kurumun bir araç üzerindeki alacağı.',
          'One partner’s claim on one vehicle.',
        ],
        [
          'Üstlenme',
          'Claim',
          'Bir görevlinin bir aracı belirli süre için aramayı üzerine alması.',
          'An agent taking on the search for one vehicle for a set time.',
        ],
        [
          'Görme bildirimi',
          'Sighting',
          'Görevlinin aracı gördüğünü konum ve fotoğrafla bildirmesi; ardından 112 aranır.',
          'The agent’s report, with location and photo, of having seen the vehicle; 112 is called next.',
        ],
        [
          'Teslim',
          'Delivery',
          'Aracın kollukça yakalanıp yediemine bırakılması; Merkez inceleyip onaylar.',
          'The vehicle seized by the police and left with the custodian; Merkez reviews and confirms it.',
        ],
        [
          'İhtar',
          'Strike',
          'Yanlış veya özensiz teslim bildirimi nedeniyle görevliye işlenen kayıt.',
          'A mark against an agent for a false or careless delivery report.',
        ],
        [
          'Bekleme süresi',
          'Cooldown',
          'Teslimsiz biten üstlenmeden sonra aynı görevlinin aynı aracı yeniden üstlenemediği süre.',
          'The time after a claim without delivery in which the same agent can’t claim that vehicle again.',
        ],
        [
          'Teyit',
          'Confirmation',
          'Kurumun, dosyasındaki şerhin sürdüğünü belirli aralıklarla onaylaması.',
          'The partner confirming at intervals that the order on its case still stands.',
        ],
        [
          'Kurum kabul',
          'Onboarding',
          'Kurumun davetten sözleşme onayına ve etkinleşmeye kadar geçtiği süreç.',
          'The steps a company takes from invitation to accepted agreement and activation.',
        ],
        [
          'Ödeme kuralı',
          'Payout rule',
          'Görevliye teslim başına ne ödeneceğini belirleyen kural.',
          'The rule that sets what an agent is paid per delivery.',
        ],
        [
          'Stopaj',
          'Withholding',
          'Görevli ödemesinden kaynakta kesilen gelir vergisi.',
          'Income tax withheld at source from an agent’s payout.',
        ],
        [
          'KDV',
          'VAT',
          'Katma değer vergisi; faturada ücrete eklenir.',
          'Value-added tax; added to the fee on the invoice.',
        ],
        [
          'VKN / TCKN',
          'Tax number / ID number',
          'Vergi kimlik numarası (10 hane) ve T.C. kimlik numarası (11 hane).',
          'The tax identification number (10 digits) and the national ID number (11 digits).',
        ],
        [
          'MERSİS',
          'MERSİS',
          'Şirketin merkezi sicil numarası (16 hane).',
          'A company’s central registry number (16 digits).',
        ],
        [
          'KEP',
          'KEP',
          'Kayıtlı elektronik posta: hukuken geçerli resmî e-posta adresi.',
          'Registered electronic mail: an official address with legal effect.',
        ],
        [
          'KVKK',
          'KVKK',
          '6698 sayılı Kişisel Verilerin Korunması Kanunu.',
          'Turkey’s personal data protection law, no. 6698.',
        ],
        [
          'İlgili kişi',
          'Data subject',
          'Kişisel verisi işlenen gerçek kişi: borçlu, görevli, kurum yetkilisi.',
          'The person the data is about: a debtor, an agent, a partner’s contact.',
        ],
        [
          'İkinci doğrulama',
          'Second factor',
          'Paroladan sonra istenen ikinci adım (kod veya anahtar). Para ve kural değişikliklerinde son 15 dakikada yapılmış olmalıdır.',
          'The second step after the password (a code or a key). For money and rules it must be from the last 15 minutes.',
        ],
        [
          'Webhook',
          'Webhook',
          'Emanet’in bir olayı kurumun sistemine kendiliğinden bildirdiği adres.',
          'An address at which Emanet tells the partner’s system about an event as it happens.',
        ],
        [
          'Denetim kaydı',
          'Audit log',
          'Kimin neyi ne zaman değiştirdiğinin silinemeyen kaydı.',
          'The record, which can’t be removed, of who changed what and when.',
        ],
      ];
      const sorted = [...terms].sort((a, b) =>
        (l === 'tr' ? a[0] : a[1]).localeCompare(l === 'tr' ? b[0] : b[1], l),
      );
      return `<dl class="glossary">${sorted
        .map(([tr, en, trText, enText]) =>
          l === 'tr'
            ? `<div><dt>${tr} <span class="alt">${en}</span></dt><dd>${trText}</dd></div>`
            : `<div><dt>${en} <span class="alt" lang="tr">${tr}</span></dt><dd>${enText}</dd></div>`,
        )
        .join('')}</dl>`;
    },
  },
];

export const chapter = (slug: string) => CHAPTERS.find((c) => c.slug === slug) ?? null;

/** Replaces `{{setting_key}}` with the setting's current value, as a person reads it. */
export function withValues(html: string, value: (key: string) => string | null): string {
  return html.replace(/\{\{([a-z_]+)\}\}/g, (whole, key: string) => {
    const shown = value(key);
    return shown === null ? whole : `<strong class="live">${shown}</strong>`;
  });
}
