/**
 * What each setting is called and what it does, in both languages. The values, defaults and ranges
 * come from emanet-core (`settingsInfo`); this file is only the words. The Settings page and the
 * handbook's configuration chapter are both written from it, so they can't disagree.
 */

export const SETTING_KEYS = [
  'claim_hours',
  'reporting_hours',
  'cooldown_hours',
  'max_active_claims',
  'max_evidence_per_claim',
  'review_sla_hours',
  'identity_sla_hours',
  'review_checklist',
  'agent_sla_hours',
  'strike_limit',
  'email_code_minutes',
  'agent_mail',
  'require_documents',
  'invitation_days',
  'onboarding_sla_hours',
  'expiry_warning_days',
  'webhook_disable_after',
  'max_webhooks',
  'kdv_bp',
  'invoice_days',
  'dual_approval_kurus',
  'withholding_individual_bp',
  'withholding_sole_trader_bp',
  'withholding_company_bp',
  'evidence_retention_days',
  'failed_claim_evidence_days',
  'place_retention_days',
  'abandoned_onboarding_days',
  'privacy_request_days',
  'alert_interval_minutes',
  'ops_keep_days',
  'require_signoffs',
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];
export type SettingGroup =
  'search' | 'review' | 'agents' | 'partners' | 'money' | 'privacy' | 'operations';
/** The unit the core stores: basis points and kuruş are shown as percent and lira. */
export type SettingUnit = 'hours' | 'days' | 'minutes' | 'count' | 'bp' | 'kurus' | 'switch';

export const SETTING_GROUPS: SettingGroup[] = [
  'search',
  'review',
  'agents',
  'partners',
  'money',
  'privacy',
  'operations',
];

/** The unit of each setting, for reading a form before the core is asked. */
export const SETTING_UNITS: Record<SettingKey, SettingUnit> = {
  claim_hours: 'hours',
  reporting_hours: 'hours',
  cooldown_hours: 'hours',
  max_active_claims: 'count',
  max_evidence_per_claim: 'count',
  review_sla_hours: 'hours',
  identity_sla_hours: 'hours',
  review_checklist: 'switch',
  agent_sla_hours: 'hours',
  strike_limit: 'count',
  email_code_minutes: 'minutes',
  agent_mail: 'switch',
  require_documents: 'switch',
  invitation_days: 'days',
  onboarding_sla_hours: 'hours',
  expiry_warning_days: 'days',
  webhook_disable_after: 'count',
  max_webhooks: 'count',
  kdv_bp: 'bp',
  invoice_days: 'days',
  dual_approval_kurus: 'kurus',
  withholding_individual_bp: 'bp',
  withholding_sole_trader_bp: 'bp',
  withholding_company_bp: 'bp',
  evidence_retention_days: 'days',
  failed_claim_evidence_days: 'days',
  place_retention_days: 'days',
  abandoned_onboarding_days: 'days',
  privacy_request_days: 'days',
  alert_interval_minutes: 'minutes',
  ops_keep_days: 'days',
  require_signoffs: 'switch',
};

interface Words {
  label: string;
  help: string;
}
type Both<T> = { en: T; tr: T };

export const GROUP_TEXT: Record<SettingGroup, Both<Words>> = {
  search: {
    en: {
      label: 'Searching',
      help: 'How long an agent holds a vehicle, and how many at once. Short times keep vehicles moving between agents; long times give one agent room to find it.',
    },
    tr: {
      label: 'Arama',
      help: 'Bir saha görevlisinin aracı ne kadar süre ve aynı anda kaç araçla üstlenebileceği. Kısa süreler araçların görevliler arasında dolaşmasını, uzun süreler tek görevlinin aracı bulmasını kolaylaştırır.',
    },
  },
  review: {
    en: {
      label: 'Reviews and service levels',
      help: 'How quickly staff decide, and how carefully. A queue that waits longer than its limit is shown as overdue on Today and reaches the alert email.',
    },
    tr: {
      label: 'İncelemeler ve hizmet süreleri',
      help: 'Ekibin ne kadar hızlı ve ne kadar dikkatle karar vereceği. Süresini aşan kuyruk Bugün sayfasında gecikmiş görünür ve uyarı e-postasına girer.',
    },
  },
  agents: {
    en: {
      label: 'Agents',
      help: 'Joining, discipline, and what agents are told.',
    },
    tr: {
      label: 'Saha görevlileri',
      help: 'Katılım, disiplin ve görevlilere yapılan bildirimler.',
    },
  },
  partners: {
    en: {
      label: 'Partners and integrations',
      help: 'Invitations, warnings to partners, and the limits on their webhooks.',
    },
    tr: {
      label: 'Kurumlar ve entegrasyonlar',
      help: 'Davetler, kurumlara yapılan uyarılar ve webhook sınırları.',
    },
  },
  money: {
    en: {
      label: 'Money and tax',
      help: 'Rates and thresholds used when an invoice is issued or a payout is created. A change applies from the next invoice or payout; nothing already booked is recalculated.',
    },
    tr: {
      label: 'Para ve vergi',
      help: 'Fatura kesilirken ve ödeme oluşturulurken kullanılan oranlar ve eşikler. Değişiklik bir sonraki fatura veya ödemeden itibaren geçerlidir; kayda geçmiş hiçbir şey yeniden hesaplanmaz.',
    },
  },
  privacy: {
    en: {
      label: 'Privacy and retention',
      help: 'How long personal data is kept before it is deleted automatically. Shorter is safer; the ten-year period for delivery records comes from commercial law.',
    },
    tr: {
      label: 'Gizlilik ve saklama',
      help: 'Kişisel verilerin otomatik silinmeden önce ne kadar saklanacağı. Kısa süre daha güvenlidir; teslim kayıtları için on yıllık süre ticaret hukukundan gelir.',
    },
  },
  operations: {
    en: {
      label: 'Operations',
      help: 'How often staff are alerted and how long the error record is kept.',
    },
    tr: {
      label: 'Operasyon',
      help: 'Ekibin ne sıklıkla uyarılacağı ve hata kayıtlarının ne kadar tutulacağı.',
    },
  },
};

export const SETTING_TEXT: Record<SettingKey, Both<Words>> = {
  claim_hours: {
    en: {
      label: 'A claim lasts',
      help: 'From the moment an agent claims a vehicle until it is free for others, unless they report a sighting first. Only the claiming agent sees the addresses during this time.',
    },
    tr: {
      label: 'Üstlenme süresi',
      help: 'Görevlinin aracı üstlendiği andan, görme bildirimi yapmazsa aracın başkalarına açıldığı ana kadar geçen süre. Bu sürede adresleri yalnızca üstlenen görevli görür.',
    },
  },
  reporting_hours: {
    en: {
      label: 'After a sighting, the claim lasts at least',
      help: 'Once the agent has seen the vehicle and called 112, the claim is extended to at least this long so the police seizure and the custodian’s receipt can be completed.',
    },
    tr: {
      label: 'Görme bildiriminden sonra en az',
      help: 'Görevli aracı görüp 112’yi aradıktan sonra üstlenme en az bu kadar uzatılır; kolluğun yakalaması ve yediemin makbuzu bu sürede tamamlanır.',
    },
  },
  cooldown_hours: {
    en: {
      label: 'Wait before claiming the same vehicle again',
      help: 'After a claim ends without a delivery, the same agent can’t claim that vehicle again for this long. It stops one agent from holding a vehicle by claiming it over and over. 0 means no wait.',
    },
    tr: {
      label: 'Aynı aracı yeniden üstlenmeden önce bekleme',
      help: 'Üstlenme teslimsiz biterse aynı görevli o aracı bu süre boyunca yeniden üstlenemez. Bir görevlinin aracı art arda üstlenerek elinde tutmasını önler. 0 bekleme yok demektir.',
    },
  },
  max_active_claims: {
    en: {
      label: 'Vehicles an agent may hold at once',
      help: 'The limit for every agent unless a different one is set on the agent’s own page. A higher number lets one agent keep vehicles from others.',
    },
    tr: {
      label: 'Bir görevlinin aynı anda üstlenebileceği araç',
      help: 'Görevlinin kendi sayfasında farklı bir sınır tanımlanmadıkça herkes için geçerlidir. Yüksek sayı, bir görevlinin araçları diğerlerinden uzak tutmasına yol açar.',
    },
  },
  max_evidence_per_claim: {
    en: {
      label: 'Files per claim',
      help: 'The most photos and documents an agent may attach to one claim.',
    },
    tr: {
      label: 'Üstlenme başına dosya',
      help: 'Görevlinin bir üstlenmeye ekleyebileceği en fazla fotoğraf ve belge sayısı.',
    },
  },
  review_sla_hours: {
    en: {
      label: 'Decide a reported delivery within',
      help: 'The agent is waiting for payment and the partner for its vehicle’s documents. Past this time the delivery is overdue.',
    },
    tr: {
      label: 'Bildirilen teslimi şu sürede karara bağla',
      help: 'Görevli ödemesini, kurum aracının belgelerini bekler. Bu süre aşılırsa teslim gecikmiş sayılır.',
    },
  },
  identity_sla_hours: {
    en: {
      label: 'Decide a vehicle-identity question within',
      help: 'A case without a chassis number, or with a plate recorded on another vehicle, is hidden from agents until staff decide.',
    },
    tr: {
      label: 'Araç kimliği sorusunu şu sürede karara bağla',
      help: 'Şasi numarası olmayan veya plakası başka araçta kayıtlı dosya, ekip karar verene kadar görevlilere gösterilmez.',
    },
  },
  review_checklist: {
    en: {
      label: 'Checklist before confirming a delivery',
      help: 'On: a delivery can be confirmed only after each point is ticked (plate, custodian’s receipt, place and time, original photos). What was ticked is kept in the audit log. Off: one button.',
    },
    tr: {
      label: 'Teslim onayından önce kontrol listesi',
      help: 'Açık: teslim ancak her madde işaretlenince onaylanır (plaka, yediemin makbuzu, yer ve zaman, özgün fotoğraflar). İşaretlenenler denetim kaydında tutulur. Kapalı: tek düğme.',
    },
  },
  agent_sla_hours: {
    en: {
      label: 'Decide an application within',
      help: 'From the moment an applicant sends the application to the video call and decision. The applicant is told to expect a call within this time, rounded up to days.',
    },
    tr: {
      label: 'Başvuruyu şu sürede karara bağla',
      help: 'Başvurunun gönderilmesinden görüntülü görüşme ve karara kadar geçen süre. Başvurana bu süre (güne yuvarlanarak) içinde aranacağı bildirilir.',
    },
  },
  strike_limit: {
    en: {
      label: 'Strikes before automatic suspension',
      help: 'A refused delivery can cost the agent a strike. At this number the account is suspended at once and its open claims end; staff decide whether to reinstate. 0 switches automatic suspension off.',
    },
    tr: {
      label: 'Otomatik askıya alma için ihtar sayısı',
      help: 'Onaylanmayan teslim görevliye ihtar olarak işlenebilir. Bu sayıya ulaşıldığında hesap hemen askıya alınır ve açık üstlenmeleri biter; yeniden etkinleştirmeye ekip karar verir. 0 otomatik askıya almayı kapatır.',
    },
  },
  email_code_minutes: {
    en: {
      label: 'An emailed code works for',
      help: 'The six-digit code an applicant gets to prove their email address.',
    },
    tr: {
      label: 'E-posta kodunun geçerlilik süresi',
      help: 'Başvuranın e-posta adresini doğrulamak için aldığı altı haneli kod.',
    },
  },
  agent_mail: {
    en: {
      label: 'Email agents about decisions',
      help: 'On: an agent is mailed when their application is received, approved or sent back, when a delivery is confirmed or refused, when a payout is sent, and when the account is suspended or reinstated.',
    },
    tr: {
      label: 'Kararları görevlilere e-postayla bildir',
      help: 'Açık: başvuru alındığında, onaylandığında veya geri gönderildiğinde, teslim onaylandığında veya reddedildiğinde, ödeme gönderildiğinde ve hesap askıya alındığında veya yeniden açıldığında görevliye e-posta gider.',
    },
  },
  require_documents: {
    en: {
      label: 'e-Devlet documents for applicants',
      help: 'On: an application can be sent only with a criminal record and a population register extract uploaded, and an agent becomes active only after staff have verified both at e-Devlet as clear.',
    },
    tr: {
      label: 'Başvuranlardan e-Devlet belgeleri',
      help: 'Açık: başvuru ancak adli sicil kaydı ve nüfus kayıt örneği yüklenmişse gönderilebilir; görevli ancak ekip iki belgeyi de e-Devlet’te doğrulayıp temiz bulduktan sonra etkinleşir.',
    },
  },
  invitation_days: {
    en: {
      label: 'An invitation works for',
      help: 'How long a company has to open its invitation. Reminders go out on the way; after this the link stops working and staff can send it again.',
    },
    tr: {
      label: 'Davetin geçerlilik süresi',
      help: 'Kurumun davetini açması için tanınan süre. Bu sürede hatırlatmalar gider; süre dolunca bağlantı çalışmaz, ekip daveti yeniden gönderebilir.',
    },
  },
  onboarding_sla_hours: {
    en: {
      label: 'Approve a signed agreement within',
      help: 'A company that has accepted the agreement waits for staff to check its details and documents.',
    },
    tr: {
      label: 'Onaylanan sözleşmeyi şu sürede karara bağla',
      help: 'Sözleşmeyi onaylayan kurum, ekibin bilgilerini ve belgelerini kontrol etmesini bekler.',
    },
  },
  expiry_warning_days: {
    en: {
      label: 'Warn a partner before its cases expire',
      help: 'A case expires unless the partner confirms the seizure order still stands. This many days before, its operations contact is mailed once a day.',
    },
    tr: {
      label: 'Dosya süresi dolmadan önce kurumu uyar',
      help: 'Kurum yakalama şerhinin sürdüğünü onaylamazsa dosyanın süresi dolar. Bundan bu kadar gün önce operasyon iletişim adresine günde bir e-posta gider.',
    },
  },
  webhook_disable_after: {
    en: {
      label: 'Switch a webhook off after failures in a row',
      help: 'A partner’s endpoint that keeps failing is switched off and the partner is mailed. They switch it back on themselves.',
    },
    tr: {
      label: 'Art arda şu kadar hatadan sonra webhook’u kapat',
      help: 'Sürekli hata veren kurum adresi kapatılır ve kuruma e-posta gider. Kurum webhook’u kendisi yeniden açar.',
    },
  },
  max_webhooks: {
    en: {
      label: 'Webhooks per organization',
      help: 'The most webhook addresses one company may register.',
    },
    tr: {
      label: 'Kurum başına webhook',
      help: 'Bir kurumun tanımlayabileceği en fazla webhook adresi.',
    },
  },
  kdv_bp: {
    en: {
      label: 'VAT (KDV) on invoices',
      help: 'Added to the fee on every invoice issued from now on.',
    },
    tr: {
      label: 'Faturalarda KDV',
      help: 'Bundan sonra kesilen her faturada ücrete eklenir.',
    },
  },
  invoice_days: {
    en: {
      label: 'Invoice a delivery within',
      help: 'Tax law gives seven days from the service (VUK 231/5), so seven is the most this can be. Set it lower to be warned earlier.',
    },
    tr: {
      label: 'Teslimi şu sürede faturala',
      help: 'Vergi mevzuatı hizmetten itibaren yedi gün tanır (VUK 231/5); bu yüzden en fazla yedi olabilir. Daha erken uyarılmak için düşürün.',
    },
  },
  dual_approval_kurus: {
    en: {
      label: 'Second approval for payouts from',
      help: 'A payout of this amount or more must be approved by a second admin, different from the one who ordered it. 0 makes every payout need two people.',
    },
    tr: {
      label: 'İkinci onay gerektiren ödeme tutarı',
      help: 'Bu tutar ve üzerindeki ödeme, talimatı verenden farklı ikinci bir yönetici tarafından onaylanmalıdır. 0 her ödemeyi iki kişilik yapar.',
    },
  },
  withholding_individual_bp: {
    en: {
      label: 'Withholding for individuals',
      help: 'Income tax withheld from payouts to agents paid as individuals. Set it as the accountant advises.',
    },
    tr: {
      label: 'Gerçek kişiler için stopaj',
      help: 'Gerçek kişi olarak ödeme alan görevlilerin ödemesinden kesilen gelir vergisi. Mali müşavirin önerdiği oranı girin.',
    },
  },
  withholding_sole_trader_bp: {
    en: {
      label: 'Withholding for sole traders',
      help: 'For agents who issue a self-employment receipt (serbest meslek makbuzu).',
    },
    tr: {
      label: 'Serbest meslek erbabı için stopaj',
      help: 'Serbest meslek makbuzu düzenleyen görevliler için.',
    },
  },
  withholding_company_bp: {
    en: {
      label: 'Withholding for companies',
      help: 'Usually none: the company invoices Emanet.',
    },
    tr: {
      label: 'Şirketler için stopaj',
      help: 'Genellikle yoktur: şirket Emanet’e fatura keser.',
    },
  },
  evidence_retention_days: {
    en: {
      label: 'Keep delivery photos and partner documents for',
      help: 'Commercial records are kept ten years (TTK 82; 3650 days). After that the files are deleted from storage.',
    },
    tr: {
      label: 'Teslim fotoğrafları ve kurum belgeleri saklama süresi',
      help: 'Ticari kayıtlar on yıl saklanır (TTK 82; 3650 gün). Sonrasında dosyalar depodan silinir.',
    },
  },
  failed_claim_evidence_days: {
    en: {
      label: 'Keep photos of a claim that didn’t end in delivery for',
      help: 'They prove nothing that has to be kept, so they go quickly.',
    },
    tr: {
      label: 'Teslimle bitmeyen üstlenmenin fotoğraflarını saklama süresi',
      help: 'Saklanması gereken bir şeyi kanıtlamazlar; bu yüzden kısa sürede silinirler.',
    },
  },
  place_retention_days: {
    en: {
      label: 'Keep a closed case’s addresses for',
      help: 'After a case is delivered, withdrawn or expired, its street addresses, coordinates and notes are erased once this time has passed. District and city stay for reports.',
    },
    tr: {
      label: 'Kapanan dosyanın adreslerini saklama süresi',
      help: 'Dosya teslim edildikten, geri çekildikten veya süresi dolduktan bu kadar sonra açık adresleri, koordinatları ve notları silinir. İlçe ve il raporlar için kalır.',
    },
  },
  abandoned_onboarding_days: {
    en: {
      label: 'Keep documents of an unfinished onboarding for',
      help: 'For a company that was rejected, cancelled, or never completed its application.',
    },
    tr: {
      label: 'Tamamlanmayan başvurunun belgelerini saklama süresi',
      help: 'Reddedilen, iptal edilen veya başvurusunu tamamlamayan kurumlar için.',
    },
  },
  privacy_request_days: {
    en: {
      label: 'Answer a data subject’s request within',
      help: 'The law gives thirty days (KVKK 13), so thirty is the most this can be. A lower number sets an earlier internal deadline.',
    },
    tr: {
      label: 'İlgili kişi başvurusunu yanıtlama süresi',
      help: 'Kanun otuz gün tanır (KVKK 13); bu yüzden en fazla otuz olabilir. Daha düşük sayı daha erken bir iç son tarih belirler.',
    },
  },
  alert_interval_minutes: {
    en: {
      label: 'At most one alert email every',
      help: 'Errors and overdue queues are collected and mailed to staff no more often than this.',
    },
    tr: {
      label: 'Uyarı e-postaları arasındaki en kısa süre',
      help: 'Hatalar ve geciken kuyruklar toplanır ve ekibe bundan daha sık gönderilmez.',
    },
  },
  require_signoffs: {
    en: {
      label: 'Sign-offs before admitting anyone',
      help: 'On: a company can’t be approved and an agent can’t be activated until the lawyer’s and the accountant’s sign-offs are recorded on the Readiness page for the texts in force. Switch off only for a test environment.',
    },
    tr: {
      label: 'Kabulden önce onaylar',
      help: 'Açık: yürürlükteki metinler için avukatın ve mali müşavirin onayları Hazırlık sayfasına işlenmeden kurum onaylanamaz, görevli etkinleştirilemez. Yalnızca deneme ortamında kapatın.',
    },
  },
  ops_keep_days: {
    en: {
      label: 'Keep the error record for',
      help: 'Recorded errors and warnings older than this are deleted. They never contain personal data.',
    },
    tr: {
      label: 'Hata kayıtlarını saklama süresi',
      help: 'Bundan eski hata ve uyarı kayıtları silinir. Kişisel veri içermezler.',
    },
  },
};

const UNIT_WORDS: Record<SettingUnit, Both<string>> = {
  hours: { en: 'hours', tr: 'saat' },
  days: { en: 'days', tr: 'gün' },
  minutes: { en: 'minutes', tr: 'dakika' },
  count: { en: '', tr: '' },
  bp: { en: '%', tr: '%' },
  kurus: { en: '₺', tr: '₺' },
  switch: { en: '', tr: '' },
};

export const unitWord = (unit: SettingUnit, locale: 'en' | 'tr') => UNIT_WORDS[unit][locale];

/** A stored value as a person reads it: 2000 basis points is 20 %, 2 500 000 kuruş is ₺25,000. */
export function showSetting(unit: SettingUnit, stored: number, locale: 'en' | 'tr'): string {
  if (unit === 'switch') {
    return stored === 1 ? (locale === 'tr' ? 'Açık' : 'On') : locale === 'tr' ? 'Kapalı' : 'Off';
  }
  if (unit === 'bp')
    return `%${String(stored / 100)}`.replace(/^%(.*)$/, locale === 'tr' ? '%$1' : '$1 %');
  if (unit === 'kurus') {
    return `₺${(stored / 100).toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US', { maximumFractionDigits: 2 })}`;
  }
  const word = UNIT_WORDS[unit][locale];
  return word ? `${String(stored)} ${word}` : String(stored);
}

/** A stored value as its form field shows it for editing. */
export function editSetting(unit: SettingUnit, stored: number): string {
  if (unit === 'bp') return String(stored / 100);
  if (unit === 'kurus') return (stored / 100).toFixed(2);
  return String(stored);
}

/** A range as a person reads it: "1 – 336 hours", "0 – 50 %", "Off or on". */
export function showRange(
  unit: SettingUnit,
  min: number,
  max: number,
  locale: 'en' | 'tr',
): string {
  if (unit === 'bp' || unit === 'kurus') {
    return `${showSetting(unit, min, locale)} – ${showSetting(unit, max, locale)}`;
  }
  return `${String(min)} – ${showSetting(unit, max, locale)}`;
}
