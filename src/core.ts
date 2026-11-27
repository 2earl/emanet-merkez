/**
 * The contract with emanet-core's `ControlApi` entrypoint (2earl/emanet-core src/index.ts), as this
 * console uses it, and with login's StaffDirectory. The core is the source of truth.
 */

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
  }[];
  cases?: {
    id: string;
    legal_name: string;
    external_ref: string;
    fee_kurus: number;
    icra_office: string;
    icra_file_no: string;
  }[];
}

export interface BalanceRow {
  code: string;
  name: string;
  debit_kurus: number;
  credit_kurus: number;
}

export type Settings = Record<
  | 'claim_hours'
  | 'reporting_hours'
  | 'cooldown_hours'
  | 'max_active_claims'
  | 'kdv_bp'
  | 'dual_approval_kurus'
  | 'withholding_individual_bp'
  | 'withholding_sole_trader_bp'
  | 'withholding_company_bp',
  number
>;

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
  provider(): Promise<Result<ProviderRecord | null>>;
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
  createPartner(
    staffId: string,
    input: {
      orgId: string;
      kind: PartnerKind;
      legalName: string;
      vkn?: string;
      taxOffice?: string;
      kepAddress?: string;
      eInvoice?: boolean;
      reconfirmDays?: number;
    },
  ): Promise<Result<{ id: string }>>;
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
  ): Promise<
    Result<{ cases: string[]; payout: { id: string; gross_kurus: number; net_kurus: number } }>
  >;
  uninvoiced(): Promise<Result<UninvoicedRow[]>>;
  invoices(partnerId: string | null): Promise<Result<InvoiceRow[]>>;
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
