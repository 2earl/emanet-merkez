/**
 * The contract with emanet-core's `ControlApi` entrypoint (2earl/emanet-core src/index.ts), as this
 * console uses it, and with login's StaffDirectory. The core is the source of truth.
 */

import type { SettingGroup, SettingKey, SettingUnit } from './settings-text';

export type Result<T> = { ok: true; value: T } | { ok: false; error: string; detail?: string };

export type StaffRole = 'owner' | 'admin' | 'support';
export const STAFF_ROLES: readonly StaffRole[] = ['owner', 'admin', 'support'];

/**
 * Support reads everything and settles identity reviews. Owners and admins also change partners,
 * agents and settings, confirm deliveries (which creates money owed), and move money.
 */
export const can = {
  review: (role: StaffRole) => STAFF_ROLES.includes(role),
  change: (role: StaffRole) => role === 'owner' || role === 'admin',
};

export interface StaffDirectory {
  roleOf(userId: string): Promise<StaffRole | null>;
}
export const staff = (env: Env): StaffDirectory => env.STAFF as unknown as StaffDirectory;

export type PartnerKind = 'bank' | 'vys' | 'law_firm' | 'leasing' | 'other';
export const PARTNER_KINDS: readonly PartnerKind[] = [
  'bank',
  'vys',
  'law_firm',
  'leasing',
  'other',
];

export interface PartnerRow {
  id: string;
  org_id: string;
  kind: PartnerKind;
  legal_name: string;
  vkn: string | null;
  tax_office: string | null;
  kep_address: string | null;
  e_invoice: number;
  status: 'invited' | 'active' | 'suspended';
  reconfirm_days: number;
  created_at: number;
  active_cases: number;
  delivered_cases: number;
  /** Operations contact and invoice address, from onboarding. */
  contact_email?: string | null;
  billing_email?: string | null;
  /** 1: the contact gets delivery and expiry emails. */
  mail_notices?: number;
}

export interface PriceRule {
  make?: string;
  model?: string;
  year_from?: number;
  year_to?: number;
  fee_kurus: number;
}
export interface PriceList {
  default_kurus: number;
  rules: PriceRule[];
}

export interface FieldRow {
  id: string;
  partner_id: string | null;
  entity: 'vehicle' | 'case' | 'place';
  key: string;
  label_tr: string;
  label_en: string;
  type: string;
  enum_values: string | null;
  required: number;
  visibility: string;
  deprecated_at: number | null;
}

export interface NewField {
  partnerId: string | null;
  entity: 'vehicle' | 'case' | 'place';
  key: string;
  labelTr: string;
  labelEn: string;
  type: 'text' | 'number' | 'date' | 'enum' | 'bool' | 'phone' | 'money';
  enumValues?: string[];
  required?: boolean;
  visibility?: 'partner' | 'admin' | 'agent_after_claim';
  pii?: boolean;
}

export interface AgentRow {
  user_id: string;
  status: 'applied' | 'kyc_pending' | 'active' | 'suspended' | 'banned';
  legal_name: string | null;
  city: string | null;
  phone: string | null;
  iban: string | null;
  tax_profile: string;
  vkn: string | null;
  strikes: number;
  created_at: number;
  submitted_at: number | null;
  terms_version: string | null;
  iban_verified: number;
  open_claims: number;
  deliveries: number;
  /** The address the agent proved with a code. */
  email?: string | null;
  /** 1: an ID number is on record (as a keyed hash; the number isn't kept). */
  id_given?: number;
  birth_year?: number | null;
  /** What staff asked the applicant to correct, while the application is back with them. */
  review_note?: string | null;
}

export interface PayoutRow {
  id: string;
  agent_id: string;
  legal_name: string | null;
  case_id: string;
  gross_kurus: number;
  withholding_kurus: number;
  net_kurus: number;
  status: 'awaiting_receipt' | 'ready' | 'approved' | 'sent' | 'cancelled';
  ordered_by: string | null;
  approved_by: string | null;
  bank_ref: string | null;
  created_at: number;
}

export interface InvoiceRow {
  id: string;
  partner_id: string;
  legal_name: string;
  number: string | null;
  issued_at: number;
  net_kurus: number;
  kdv_kurus: number;
  total_kurus: number;
  paid_kurus: number;
  status: 'issued' | 'paid' | 'cancelled';
  cases: number;
}

export interface UninvoicedRow {
  partner_id: string;
  legal_name: string;
  cases: number;
  net_kurus: number;
  oldest_delivery: number;
}

export interface ReviewItem {
  id: string;
  kind: 'plate_conflict' | 'missing_vin' | 'delivery';
  subject_id: string;
  detail: string | Record<string, unknown>;
  created_at: number;
}

export type EvidenceKind =
  'scene' | 'police_report' | 'tow_report' | 'yediemin_receipt' | 'yediemin_vehicle';

export interface ReviewDetail {
  item: ReviewItem & { detail: Record<string, unknown> };
  case?: {
    id: string;
    legal_name: string;
    external_ref: string;
    status: string;
    vehicle_snapshot: { vin: string | null; plate: string; make: string; model: string };
  };
  vehicle?: {
    id: string;
    vin: string | null;
    make: string;
    model: string;
    plate: string | null;
  } | null;
  claim?: {
    id: string;
    agent_id: string;
    agent_name: string | null;
    plate: string | null;
    make: string;
    model: string;
    vin: string | null;
    claimed_at: number;
  };
  sightings?: {
    lat: number;
    lng: number;
    accuracy_m: number | null;
    taken_at: number;
    received_at: number;
  }[];
  evidence?: {
    id: string;
    kind: EvidenceKind;
    file_ref: string;
    sha256: string;
    exif_time: number | null;
    exif_lat: number | null;
    exif_lng: number | null;
    status: string;
    created_at: number;
    /** 1: the file was deleted (a request, or its retention ended). */
    erased?: number;
  }[];
  cases?: {
    id: string;
    legal_name: string;
    external_ref: string;
    fee_kurus: number;
    icra_office: string;
    icra_file_no: string;
  }[];
  /** What to look at twice before confirming a delivery (emanet-core src/control.ts). */
  signals?: {
    seconds_to_sighting: number | null;
    nearest_place_m: number | null;
    agent_deliveries: number;
    agent_strikes: number;
  };
}

export interface KycCheck {
  kind:
    | 'email'
    | 'id_registry'
    | 'id_nfc'
    | 'liveness'
    | 'video_call'
    | 'iban'
    | 'criminal_record'
    | 'phone';
  provider: string;
  result: 'passed' | 'failed' | 'review';
  reviewed_by: string | null;
  created_at: number;
}

type Erased = 'no' | 'due' | 'yes';

/** Everything held for one search term (emanet-core src/privacy.ts). */
export interface Inventory {
  vehicle: {
    id: string;
    plate: string | null;
    vin: string | null;
    cases: {
      id: string;
      partner: string;
      external_ref: string;
      status: string;
      places: number;
      addresses: number;
    }[];
  } | null;
  agent: {
    user_id: string;
    status: string;
    legal_name: string | null;
    email: string | null;
    phone: string | null;
    sightings: number;
    payouts: number;
  } | null;
  evidence: {
    id: string;
    claim_id: string;
    kind: EvidenceKind;
    about: 'vehicle' | 'document';
    created_at: number;
    delivered: boolean;
    erased: Erased;
  }[];
  onboardings: {
    id: string;
    company: string;
    contact_name: string;
    contact_email: string;
    status: string;
    documents: { id: string; kind: string; file_name: string; erased: Erased }[];
  }[];
}

export interface PrivacyRequest {
  id: string;
  kind: 'access' | 'erasure' | 'correction' | 'objection';
  subject_kind: 'agent' | 'vehicle' | 'contact' | 'other';
  subject_ref: string;
  channel: string;
  note: string | null;
  received_at: number;
  due_at: number;
  status: 'open' | 'done' | 'refused';
  outcome: string | null;
  closed_at: number | null;
}

export interface OpsOverview {
  events: {
    id: string;
    at: number;
    source: string;
    level: string;
    event: string;
    detail: string;
  }[];
  heartbeats: {
    name: string;
    ok_at: number | null;
    failed_at: number | null;
    error: string | null;
  }[];
  last_day: { source: string; level: string; n: number }[];
  queues: {
    oldest_review_at: number | null;
    files_due: number;
    requests_open: number;
    requests_overdue: number;
    agents_waiting: number;
  };
}

export interface AuditRow {
  id: string;
  at: number;
  actor: string;
  action: string;
  subject: string;
  detail: Record<string, unknown>;
}

export interface BalanceRow {
  code: string;
  name: string;
  debit_kurus: number;
  credit_kurus: number;
}

export type Settings = Record<SettingKey, number>;

/** One setting as the core reports it. */
export interface SettingInfo {
  key: SettingKey;
  value: number;
  default: number;
  min: number;
  max: number;
  unit: SettingUnit;
  group: SettingGroup;
  updated_by: string | null;
  updated_at: number | null;
}

export type QueueKey = 'delivery' | 'identity' | 'agents' | 'onboarding' | 'privacy' | 'invoicing';

/** One of the queues staff work through, measured against its service level. */
export interface Queue {
  key: QueueKey;
  open: number;
  oldest_at: number | null;
  overdue: number;
  due_soon: number;
  limit_seconds: number;
}

/** What staff tick before a delivery is confirmed (emanet-core's DELIVERY_CHECKS). */
export const DELIVERY_CHECKS = [
  'plate_matches',
  'custody_receipt',
  'place_plausible',
  'photos_original',
] as const;

export interface PayoutRule {
  share_bp?: number;
  fixed_kurus?: number;
  min_kurus?: number;
  max_kurus?: number;
}

/** emanet-core's ControlApi, reached over the CORE Service Binding. */
// ---- Onboarding (2earl/emanet-core src/onboarding.ts) ----------------------------------------

export type OnboardingStatus =
  'invited' | 'in_progress' | 'signed' | 'approved' | 'rejected' | 'cancelled' | 'expired';
export const ONBOARDING_STATUSES: readonly OnboardingStatus[] = [
  'signed',
  'in_progress',
  'invited',
  'approved',
  'rejected',
  'cancelled',
  'expired',
];

export type DocumentKind =
  'signed_contract' | 'signature_circular' | 'tax_certificate' | 'trade_registry' | 'other';
export const REQUIRED_DOCUMENTS: readonly DocumentKind[] = [
  'signature_circular',
  'tax_certificate',
];

export interface OnboardingRow {
  id: string;
  kind: PartnerKind;
  company: string;
  legal_name: string | null;
  contact_name: string;
  contact_email: string;
  locale: 'tr' | 'en';
  status: OnboardingStatus;
  invited_by: string;
  invited_at: number;
  sent_at: number;
  expires_at: number;
  signed_at: number | null;
  decided_at: number | null;
  partner_id: string | null;
  updated_at: number;
}

export interface CompanyDetails {
  legalName: string;
  address: string;
  taxOffice: string;
  vkn: string;
  mersis: string | null;
  kep: string | null;
  signatoryName: string;
  signatoryTitle: string;
  billingEmail: string;
  operationsName: string;
  operationsEmail: string;
  operationsPhone: string;
  eInvoice: boolean;
}

export interface OnboardingDocument {
  id: string;
  kind: DocumentKind;
  file_ref: string;
  sha256: string;
  file_name: string;
  content_type: string;
  size: number;
  uploaded_by: string;
  uploaded_at: number;
}

export interface OnboardingDetail extends Omit<OnboardingRow, 'legal_name'> {
  price_list: PriceList | null;
  reconfirm_days: number;
  note: string | null;
  claimed_by: string | null;
  org_id: string | null;
  details: CompanyDetails | null;
  contract_version: string | null;
  contract_sha256: string | null;
  contract_text: string | null;
  signer_name: string | null;
  signer_title: string | null;
  decision_reason: string | null;
  documents: OnboardingDocument[];
  /** Every acceptance, oldest first, including ones cleared by a send-back. */
  acceptances?: {
    contract_version: string;
    contract_sha256: string;
    signer_name: string;
    signer_title: string;
    signer_ip: string | null;
    signed_at: number;
  }[];
}

export interface Invitation {
  company: string;
  kind: PartnerKind;
  contactName: string;
  contactEmail: string;
  locale: 'tr' | 'en';
  priceList: PriceList;
  reconfirmDays?: number;
  note?: string;
}

/** 2earl's own company details, as the agreement names it (emanet-core src/provider.ts). */
export interface Provider {
  name: string;
  address: string;
  taxOffice: string;
  vkn: string;
  mersis: string;
  kep: string;
  email: string;
}
export interface ProviderRecord {
  details: Provider;
  updated_by: string;
  updated_at: number;
}

export interface ControlApi {
  /** An unexpected error: a route pattern and an error's name, for staff's System page. */
  reportError(event: string, detail: string): Promise<void>;
  /** Records that a staff member opened a document or evidence (personal data). */
  recordView(staffId: string, subject: string, what: string): Promise<Result<null>>;
  provider(): Promise<Result<ProviderRecord | null>>;
  setPartnerNotices(staffId: string, partnerId: string, on: boolean): Promise<Result<null>>;
  setProvider(staffId: string, input: Record<string, unknown>): Promise<Result<Provider>>;
  inviteCompany(
    staffId: string,
    input: Invitation,
  ): Promise<Result<{ id: string; emailed: boolean }>>;
  onboardings(status: OnboardingStatus | null): Promise<Result<OnboardingRow[]>>;
  onboarding(id: string): Promise<Result<OnboardingDetail>>;
  resendInvitation(staffId: string, id: string): Promise<Result<{ emailed: boolean }>>;
  cancelOnboarding(staffId: string, id: string, reason: string): Promise<Result<null>>;
  returnOnboarding(
    staffId: string,
    id: string,
    reason: string,
  ): Promise<Result<{ emailed: boolean }>>;
  approveOnboarding(
    staffId: string,
    id: string,
  ): Promise<Result<{ partnerId: string; emailed: boolean }>>;
  rejectOnboarding(
    staffId: string,
    id: string,
    reason: string,
  ): Promise<Result<{ emailed: boolean }>>;

  partners(): Promise<Result<PartnerRow[]>>;
  partner(id: string): Promise<
    Result<{
      partner: PartnerRow;
      priceList: PriceList | null;
      priceListFrom: number | null;
      fields: FieldRow[];
    }>
  >;
  updatePartner(
    staffId: string,
    partnerId: string,
    input: {
      legalName: string;
      vkn: string | null;
      taxOffice: string | null;
      kepAddress: string | null;
      eInvoice: boolean;
      reconfirmDays: number;
    },
  ): Promise<Result<null>>;
  setPartnerStatus(
    staffId: string,
    partnerId: string,
    status: PartnerRow['status'],
  ): Promise<Result<null>>;
  setPriceList(
    staffId: string,
    partnerId: string,
    list: unknown,
    validFrom?: number,
  ): Promise<Result<PriceList>>;
  defineField(staffId: string, field: NewField): Promise<Result<null>>;
  deprecateField(staffId: string, fieldId: string): Promise<Result<null>>;
  settings(): Promise<Result<Settings>>;
  setSetting(staffId: string, key: keyof Settings, value: number): Promise<Result<null>>;
  payoutRule(): Promise<Result<{ rule: PayoutRule; valid_from: number } | null>>;
  setPayoutRule(staffId: string, rule: unknown, validFrom?: number): Promise<Result<null>>;
  agents(status: string | null): Promise<Result<AgentRow[]>>;
  setAgentStatus(
    staffId: string,
    agentId: string,
    status: AgentRow['status'],
    reason: string,
  ): Promise<Result<null>>;
  /** Verifies only the IBAN the staff member checked: iban_changed if the agent changed it since. */
  verifyIban(staffId: string, agentId: string, iban: string): Promise<Result<null>>;
  reviewQueue(limit?: number): Promise<Result<ReviewItem[]>>;
  review(id: string): Promise<Result<ReviewDetail>>;
  resolveIdentity(
    staffId: string,
    reviewId: string,
    decision: { action: 'accept'; vin?: string } | { action: 'reject'; reason: string },
  ): Promise<Result<{ case_status: string }>>;
  confirmDelivery(
    staffId: string,
    claimId: string,
    checks?: string[],
  ): Promise<
    Result<{ cases: string[]; payout: { id: string; gross_kurus: number; net_kurus: number } }>
  >;
  rejectDelivery(
    staffId: string,
    claimId: string,
    input: { reason: string; strike: boolean },
  ): Promise<Result<{ strikes: number }>>;
  uninvoiced(): Promise<Result<UninvoicedRow[]>>;
  invoices(partnerId: string | null): Promise<Result<InvoiceRow[]>>;
  setInvoiceNumber(
    staffId: string,
    invoiceId: string,
    input: { number: string; uuid?: string | null },
  ): Promise<Result<null>>;
  kycChecks(agentId: string): Promise<Result<KycCheck[]>>;
  recordVideoCall(staffId: string, agentId: string, passed: boolean): Promise<Result<null>>;
  privacySearch(staffId: string, term: string): Promise<Result<Inventory>>;
  eraseEvidence(staffId: string, evidenceId: string, reason: string): Promise<Result<null>>;
  eraseDocument(staffId: string, documentId: string, reason: string): Promise<Result<null>>;
  redactCasePlaces(
    staffId: string,
    caseId: string,
    reason: string,
  ): Promise<Result<{ places: number }>>;
  privacyRequests(): Promise<Result<PrivacyRequest[]>>;
  openPrivacyRequest(
    staffId: string,
    input: {
      kind: string;
      subjectKind: string;
      subjectRef: string;
      channel: string;
      note?: string;
      receivedAt?: number;
    },
  ): Promise<Result<{ id: string; due_at: number }>>;
  closePrivacyRequest(
    staffId: string,
    requestId: string,
    input: { status: string; outcome: string },
  ): Promise<Result<null>>;
  filesDue(
    limit?: number,
  ): Promise<Result<{ file_ref: string; bucket: 'evidence' | 'documents' }[]>>;
  filesErased(refs: string[]): Promise<Result<{ erased: number }>>;
  ops(): Promise<Result<OpsOverview>>;
  /** The work waiting for staff, each queue against its service level. */
  queues(): Promise<Result<Queue[]>>;
  /** Every setting with its value, default, range, unit, group and last change. */
  settingsInfo(): Promise<Result<SettingInfo[]>>;
  resetSetting(staffId: string, key: keyof Settings): Promise<Result<null>>;
  /** Sends a waiting application back to the applicant with what to correct. */
  returnApplication(staffId: string, agentId: string, reason: string): Promise<Result<null>>;
  heartbeat(name: string, error: string | null): Promise<void>;
  audit(
    staffId: string,
    query: { subject?: string; actor?: string; before?: number; limit?: number },
  ): Promise<Result<{ events: AuditRow[]; next_before: number | null }>>;
  issueInvoice(
    staffId: string,
    partnerId: string,
  ): Promise<Result<{ id: string; total_kurus: number }>>;
  recordReceipt(
    staffId: string,
    receipt: {
      partnerId: string;
      invoiceId?: string;
      amountKurus: number;
      valueDate: string;
      bankRef: string;
      source: 'manual' | 'statement' | 'bank_api';
    },
  ): Promise<Result<{ id: string; invoice_paid: boolean }>>;
  payouts(status: string | null): Promise<Result<PayoutRow[]>>;
  orderPayout(staffId: string, payoutId: string): Promise<Result<{ status: 'ready' | 'approved' }>>;
  markPayoutSent(staffId: string, payoutId: string, bankRef: string): Promise<Result<null>>;
  trialBalance(): Promise<Result<BalanceRow[]>>;
}

export const core = (env: Env): ControlApi => env.CORE as unknown as ControlApi;
