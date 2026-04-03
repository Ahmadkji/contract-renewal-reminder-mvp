import type {
  ContractActivityItem,
  ContractDetail,
  ContractInput,
  ContractStatus,
  ContractSummary,
} from "@/types/contract";
import type { SerializedUser } from "@/lib/serializers/user";
import { getDaysUntil, toDateOnlyString } from "@/lib/utils/date-utils";

export type MvpBillingPlanCode = "monthly" | "yearly";

export interface MvpProfile {
  fullName: string;
  email: string;
  avatarUrl: string;
  emailNotifications: boolean;
  timezone: string;
}

export interface MvpBillingState {
  planCode: MvpBillingPlanCode | null;
  subscriptionStatus: "free" | "active";
  isPremium: boolean;
  effectiveTo: string | null;
  currentPeriodStartDate: string | null;
  currentPeriodEndDate: string | null;
}

const CONTRACTS_STORAGE_KEY = "renewly:mvp:contracts";
const PROFILE_STORAGE_KEY = "renewly:mvp:profile";
const BILLING_STORAGE_KEY = "renewly:mvp:billing";
const STORE_EVENT = "renewly:mvp-store-changed";

const DEFAULT_PROFILE: MvpProfile = {
  fullName: "MVP Workspace",
  email: "workspace@renewly.app",
  avatarUrl: "",
  emailNotifications: true,
  timezone: "Asia/Karachi",
};

const BILLING_PRICING = [
  {
    planCode: "monthly" as const,
    displayName: "Monthly",
    priceCents: 1900,
    currency: "USD",
    billingPeriod: "month",
    monthlyEquivalentCents: 1900,
    yearlySavingsPercent: 0,
  },
  {
    planCode: "yearly" as const,
    displayName: "Yearly",
    priceCents: 19000,
    currency: "USD",
    billingPeriod: "year",
    monthlyEquivalentCents: 1583,
    yearlySavingsPercent: 17,
  },
];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createDateFromOffset(daysFromNow: number): string {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  value.setDate(value.getDate() + daysFromNow);
  return toDateOnlyString(value);
}

function createActivity(
  id: string,
  type: ContractActivityItem["type"],
  message: string,
  date: string
): ContractActivityItem {
  return {
    id,
    type,
    message,
    date,
    user: "MVP Workspace",
  };
}

function createSeedContracts(): ContractDetail[] {
  const now = new Date().toISOString();

  return [
    {
      id: "contract-hubspot-enterprise",
      name: "HubSpot Enterprise",
      vendor: "HubSpot",
      type: "subscription",
      startDate: createDateFromOffset(-310),
      endDate: createDateFromOffset(12),
      expiryDate: createDateFromOffset(12),
      daysLeft: 12,
      status: "expiring",
      value: 24000,
      currency: "USD",
      autoRenew: false,
      renewalTerms: "Requires 30-day written notice before renewal.",
      notes: "Marketing wants to renegotiate contact seats before renewal.",
      tags: ["marketing", "crm"],
      vendorContact: "Mia Carter",
      vendorEmail: "mia.carter@hubspot.example",
      reminderDays: [30, 14, 7],
      emailReminders: true,
      notifyEmails: ["ops@renewly.app", "finance@renewly.app"],
      createdAt: now,
      updatedAt: now,
      activity: [
        createActivity("hubspot-created", "created", "Contract added to the MVP workspace.", now),
        createActivity(
          "hubspot-reminder",
          "reminder",
          "Reminder scheduled for 14 days before renewal.",
          now
        ),
      ],
    },
    {
      id: "contract-notion-business",
      name: "Notion Business",
      vendor: "Notion",
      type: "subscription",
      startDate: createDateFromOffset(-180),
      endDate: createDateFromOffset(48),
      expiryDate: createDateFromOffset(48),
      daysLeft: 48,
      status: "active",
      value: 7200,
      currency: "USD",
      autoRenew: true,
      renewalTerms: "Auto-renews annually unless canceled.",
      notes: "Keep as baseline example for product and HR teams.",
      tags: ["workspace", "documentation"],
      vendorContact: "Leo Brooks",
      vendorEmail: "leo.brooks@notion.example",
      reminderDays: [30, 7],
      emailReminders: true,
      notifyEmails: ["ops@renewly.app"],
      createdAt: now,
      updatedAt: now,
      activity: [
        createActivity("notion-created", "created", "Imported from the original backend seed.", now),
      ],
    },
    {
      id: "contract-slack-grid",
      name: "Slack Enterprise Grid",
      vendor: "Slack",
      type: "license",
      startDate: createDateFromOffset(-320),
      endDate: createDateFromOffset(5),
      expiryDate: createDateFromOffset(5),
      daysLeft: 5,
      status: "critical",
      value: 18000,
      currency: "USD",
      autoRenew: false,
      renewalTerms: "Manual renewal required to preserve pricing.",
      notes: "Leadership needs a final approval before renewal.",
      tags: ["internal-comms", "critical"],
      vendorContact: "Nina Patel",
      vendorEmail: "nina.patel@slack.example",
      reminderDays: [14, 7, 3],
      emailReminders: true,
      notifyEmails: ["ceo@renewly.app", "ops@renewly.app"],
      createdAt: now,
      updatedAt: now,
      activity: [
        createActivity("slack-created", "created", "Critical contract added for demo urgency.", now),
      ],
    },
    {
      id: "contract-aws-support",
      name: "AWS Business Support",
      vendor: "Amazon Web Services",
      type: "support",
      startDate: createDateFromOffset(-240),
      endDate: createDateFromOffset(36),
      expiryDate: createDateFromOffset(36),
      daysLeft: 36,
      status: "renewing",
      value: 12000,
      currency: "USD",
      autoRenew: true,
      renewalTerms: "Auto-renewal enabled with a 15-day review window.",
      notes: "Keep active unless infra budget changes next quarter.",
      tags: ["infrastructure", "support"],
      vendorContact: "Ava Morgan",
      vendorEmail: "ava.morgan@aws.example",
      reminderDays: [30, 14],
      emailReminders: true,
      notifyEmails: ["infra@renewly.app"],
      createdAt: now,
      updatedAt: now,
      activity: [
        createActivity("aws-created", "created", "Support contract synced into the MVP workspace.", now),
      ],
    },
    {
      id: "contract-legal-counsel",
      name: "Outside Counsel Retainer",
      vendor: "Northline Legal",
      type: "service",
      startDate: createDateFromOffset(-120),
      endDate: createDateFromOffset(82),
      expiryDate: createDateFromOffset(82),
      daysLeft: 82,
      status: "active",
      value: 9000,
      currency: "USD",
      autoRenew: false,
      renewalTerms: "Quarterly review before extension.",
      notes: "Useful sample for service contracts without auto-renew.",
      tags: ["legal", "services"],
      vendorContact: "Olivia Chen",
      vendorEmail: "olivia.chen@northline.example",
      reminderDays: [30, 7],
      emailReminders: true,
      notifyEmails: ["legal@renewly.app"],
      createdAt: now,
      updatedAt: now,
      activity: [
        createActivity("legal-created", "created", "Added as a service contract example.", now),
      ],
    },
  ];
}

function getSeedContracts(): ContractDetail[] {
  return createSeedContracts().map(applyDerivedContractFields);
}

function getDefaultBillingState(): MvpBillingState {
  return {
    planCode: null,
    subscriptionStatus: "free",
    isPremium: false,
    effectiveTo: null,
    currentPeriodStartDate: null,
    currentPeriodEndDate: null,
  };
}

function getStorageItem<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return clone(fallback);
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return clone(fallback);
    }

    return JSON.parse(raw) as T;
  } catch {
    return clone(fallback);
  }
}

function setStorageItem<T>(key: string, value: T): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

function emitStoreChange(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(STORE_EVENT));
}

function sortContracts(contracts: ContractDetail[]): ContractDetail[] {
  return [...contracts].sort((left, right) => left.endDate.localeCompare(right.endDate));
}

function getContractStatus(contract: ContractDetail): ContractStatus {
  const daysLeft = getDaysUntil(contract.endDate);

  if (daysLeft <= 7) {
    return "critical";
  }

  if (daysLeft <= 30) {
    return "expiring";
  }

  if (contract.autoRenew && daysLeft <= 45) {
    return "renewing";
  }

  return "active";
}

function applyDerivedContractFields(contract: ContractDetail): ContractDetail {
  const normalizedStartDate = toDateOnlyString(contract.startDate);
  const normalizedEndDate = toDateOnlyString(contract.endDate);
  const daysLeft = getDaysUntil(normalizedEndDate);

  return {
    ...contract,
    startDate: normalizedStartDate,
    endDate: normalizedEndDate,
    expiryDate: normalizedEndDate,
    daysLeft,
    status: getContractStatus({
      ...contract,
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
      expiryDate: normalizedEndDate,
      daysLeft,
    }),
  };
}

function toContractSummary(contract: ContractDetail): ContractSummary {
  return {
    ...contract,
  };
}

function readContracts(): ContractDetail[] {
  const stored = getStorageItem<ContractDetail[]>(CONTRACTS_STORAGE_KEY, getSeedContracts());
  return sortContracts(stored.map(applyDerivedContractFields));
}

function writeContracts(contracts: ContractDetail[]): ContractDetail[] {
  const normalized = sortContracts(contracts.map(applyDerivedContractFields));
  setStorageItem(CONTRACTS_STORAGE_KEY, normalized);
  emitStoreChange();
  return normalized;
}

function createMvpId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `contract-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeOptionalText(value: string | undefined, fallback = ""): string {
  return value?.trim() || fallback;
}

function normalizeOptionalList(values: string[] | undefined): string[] {
  return (values ?? []).map((value) => value.trim()).filter(Boolean);
}

export function getInitialContractSummaries(limit = 5): ContractSummary[] {
  return getSeedContracts().slice(0, limit).map(toContractSummary);
}

export async function listMvpContracts(
  page = 1,
  limit = 50,
  search?: string
): Promise<{ contracts: ContractSummary[]; total: number }> {
  const normalizedSearch = search?.trim().toLowerCase() ?? "";
  const contracts = readContracts().filter((contract) => {
    if (!normalizedSearch) {
      return true;
    }

    return [
      contract.name,
      contract.vendor,
      contract.type,
      ...(contract.tags ?? []),
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch);
  });

  const offset = Math.max(0, (page - 1) * limit);
  return {
    contracts: contracts.slice(offset, offset + limit).map(toContractSummary),
    total: contracts.length,
  };
}

export async function getMvpContract(contractId: string): Promise<ContractDetail> {
  const contract = readContracts().find((entry) => entry.id === contractId);

  if (!contract) {
    throw new Error("Contract not found");
  }

  return contract;
}

export async function createMvpContract(data: ContractInput): Promise<ContractDetail> {
  const now = new Date().toISOString();
  const newContract: ContractDetail = applyDerivedContractFields({
    id: createMvpId(),
    name: data.name.trim(),
    vendor: data.vendor.trim(),
    type: data.type,
    startDate: data.startDate,
    endDate: data.endDate,
    expiryDate: data.endDate,
    daysLeft: 0,
    status: "active",
    value: data.value ?? 0,
    currency: data.currency ?? "USD",
    autoRenew: data.autoRenew ?? false,
    renewalTerms: normalizeOptionalText(data.renewalTerms),
    notes: normalizeOptionalText(data.notes),
    tags: normalizeOptionalList(data.tags),
    vendorContact: normalizeOptionalText(data.vendorContact),
    vendorEmail: normalizeOptionalText(data.vendorEmail),
    reminderDays: [...(data.reminderDays ?? [])].sort((left, right) => right - left),
    emailReminders: data.emailReminders ?? false,
    notifyEmails: normalizeOptionalList(data.notifyEmails),
    createdAt: now,
    updatedAt: now,
    activity: [
      createActivity(createMvpId(), "created", "Contract added in frontend-only MVP mode.", now),
    ],
  });

  writeContracts([newContract, ...readContracts()]);
  return newContract;
}

export async function updateMvpContract(params: {
  id: string;
  data: ContractInput;
}): Promise<ContractDetail> {
  const { id, data } = params;
  const now = new Date().toISOString();
  const contracts = readContracts();
  const existing = contracts.find((contract) => contract.id === id);

  if (!existing) {
    throw new Error("Contract not found");
  }

  const updated: ContractDetail = applyDerivedContractFields({
    ...existing,
    name: data.name.trim(),
    vendor: data.vendor.trim(),
    type: data.type,
    startDate: data.startDate,
    endDate: data.endDate,
    expiryDate: data.endDate,
    value: data.value ?? 0,
    currency: data.currency ?? "USD",
    autoRenew: data.autoRenew ?? false,
    renewalTerms: normalizeOptionalText(data.renewalTerms),
    notes: normalizeOptionalText(data.notes),
    tags: normalizeOptionalList(data.tags),
    vendorContact: normalizeOptionalText(data.vendorContact),
    vendorEmail: normalizeOptionalText(data.vendorEmail),
    reminderDays: [...(data.reminderDays ?? [])].sort((left, right) => right - left),
    emailReminders: data.emailReminders ?? false,
    notifyEmails: normalizeOptionalList(data.notifyEmails),
    updatedAt: now,
    activity: [
      createActivity(createMvpId(), "updated", "Contract updated in MVP mode.", now),
      ...existing.activity,
    ],
  });

  writeContracts(contracts.map((contract) => (contract.id === id ? updated : contract)));
  return updated;
}

export async function deleteMvpContract(contractId: string): Promise<void> {
  writeContracts(readContracts().filter((contract) => contract.id !== contractId));
}

export function getMvpProfile(): MvpProfile {
  return {
    ...DEFAULT_PROFILE,
    ...getStorageItem<MvpProfile>(PROFILE_STORAGE_KEY, DEFAULT_PROFILE),
  };
}

export function updateMvpProfile(update: Partial<MvpProfile>): MvpProfile {
  const next = {
    ...getMvpProfile(),
    ...update,
  };

  setStorageItem(PROFILE_STORAGE_KEY, next);
  emitStoreChange();
  return next;
}

export function getMvpUser(): SerializedUser {
  const profile = getMvpProfile();

  return {
    id: "mvp-workspace-user",
    email: profile.email,
    email_confirmed: true,
    created_at: "2026-01-01T00:00:00.000Z",
    full_name: profile.fullName,
  };
}

export function getMvpBillingState(): MvpBillingState {
  return {
    ...getDefaultBillingState(),
    ...getStorageItem<MvpBillingState>(BILLING_STORAGE_KEY, getDefaultBillingState()),
  };
}

export function getMvpBillingPricing() {
  return clone(BILLING_PRICING);
}

export function setMvpBillingPlan(planCode: MvpBillingPlanCode | null): MvpBillingState {
  const now = toDateOnlyString(new Date());
  const periodEnd = toDateOnlyString(createDateFromOffset(planCode === "yearly" ? 365 : 30));
  const nextState: MvpBillingState = planCode
    ? {
        planCode,
        subscriptionStatus: "active",
        isPremium: true,
        effectiveTo: periodEnd,
        currentPeriodStartDate: now,
        currentPeriodEndDate: periodEnd,
      }
    : getDefaultBillingState();

  setStorageItem(BILLING_STORAGE_KEY, nextState);
  emitStoreChange();
  return nextState;
}

export function resetMvpWorkspace(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(CONTRACTS_STORAGE_KEY);
    window.localStorage.removeItem(PROFILE_STORAGE_KEY);
    window.localStorage.removeItem(BILLING_STORAGE_KEY);
  }

  emitStoreChange();
}

export function subscribeToMvpStore(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (
      event.key === null ||
      [CONTRACTS_STORAGE_KEY, PROFILE_STORAGE_KEY, BILLING_STORAGE_KEY].includes(event.key)
    ) {
      callback();
    }
  };

  window.addEventListener(STORE_EVENT, callback);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(STORE_EVENT, callback);
    window.removeEventListener("storage", handleStorage);
  };
}
