import { createClient } from '@/lib/supabase/server'
import { ContractInput } from '@/types/contract'
import { formatDate, getDaysUntil, toDateOnlyString } from '@/lib/utils/date-utils'
import { logger } from '@/lib/logger'

// Helper function to get authenticated Supabase client (uses RLS)
const getSupabase = async () => {
  return await createClient()
}

export type ContractsCountMode = 'planned' | 'exact'

function normalizeCountMode(mode?: ContractsCountMode): 'planned' | 'exact' {
  return mode === 'exact' ? 'exact' : 'planned'
}

function normalizeOptionalString(value?: string | null): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function normalizeStringArray(values?: string[] | null): string[] {
  return Array.from(
    new Set(
      (values || [])
        .map((value) => value.trim())
        .filter(Boolean)
    )
  )
}

function normalizeReminderDays(reminderDays?: number[] | null): number[] {
  return Array.from(
    new Set(
      (reminderDays || []).filter(
        (days) => Number.isInteger(days) && days >= 1 && days <= 365
      )
    )
  ).sort((left, right) => left - right)
}

function requireDateOnlyString(value: string | Date | undefined, fieldName: string): string {
  const formatted = value ? toDateOnlyString(value) : ''

  if (!formatted) {
    throw new Error(`${fieldName} is required`)
  }

  return formatted
}

function normalizeContractMutationInput(input: ContractInput) {
  const vendorContact = normalizeOptionalString(input.vendorContact)
  const vendorEmail = normalizeOptionalString(input.vendorEmail)

  if (Boolean(vendorContact) !== Boolean(vendorEmail)) {
    throw new Error('Vendor contact and vendor email must both be provided together')
  }

  return {
    name: input.name.trim(),
    vendor: input.vendor.trim(),
    type: input.type,
    startDate: requireDateOnlyString(input.startDate, 'Start date'),
    endDate: requireDateOnlyString(input.endDate, 'End date'),
    value: input.value ?? null,
    currency: input.currency || 'USD',
    autoRenew: input.autoRenew ?? false,
    renewalTerms: normalizeOptionalString(input.renewalTerms),
    notes: normalizeOptionalString(input.notes),
    tags: normalizeStringArray(input.tags),
    vendorContact,
    vendorEmail,
    reminderDays: normalizeReminderDays(input.reminderDays),
    emailReminders: input.emailReminders ?? false,
    notifyEmails: input.emailReminders === false
      ? []
      : normalizeStringArray(input.notifyEmails),
  }
}

export interface ActivityItem {
  id: string
  type: "created" | "updated" | "reminder" | "renewed" | "note"
  message: string
  date: string  // ISO 8601 string
  user?: string
}

export interface ContractWithDetails {
  id: string
  name: string
  vendor: string
  type: 'license' | 'service' | 'support' | 'subscription'
  startDate: string  // YYYY-MM-DD string from database
  endDate: string    // YYYY-MM-DD string from database
  expiryDate: string
  daysLeft: number
  status: 'active' | 'expiring' | 'critical' | 'renewing'
  value: number
  currency: string
  autoRenew: boolean
  renewalTerms: string
  notes: string
  tags: string[]
  vendorContact?: string
  vendorEmail?: string
  reminderDays?: number[]
  emailReminders?: boolean
  notifyEmails?: string[]
  createdAt: string  // ISO 8601 string
  updatedAt: string  // ISO 8601 string
  activity: ActivityItem[]
}

export interface ContractsQueryTimings {
  countMs: number
  listMs: number
  cacheHit?: boolean
}

function logContractsDbError(message: string, error: unknown): void {
  logger.error(message, error, 'ContractsDB')
}

const CONTRACTS_PAGE_CACHE_TTL_MS = (() => {
  const parsed = Number.parseInt(process.env.CONTRACTS_PAGE_CACHE_TTL_MS || '1500', 10)
  if (!Number.isFinite(parsed)) {
    return 1500
  }
  return Math.max(0, Math.min(parsed, 60_000))
})()
const CONTRACTS_PAGE_CACHE_MAX_ENTRIES = 2_000
const contractsPageCache = new Map<
  string,
  {
    expiresAt: number
    value: { contracts: ContractWithDetails[]; total: number }
  }
>()

function buildContractsPageCacheKey(
  userId: string,
  page: number,
  pageSize: number,
  countMode: ContractsCountMode,
  options: { search?: string | null; upcoming?: boolean }
): string {
  const normalizedSearch = options.search?.trim() || ''
  const normalizedUpcoming = options.upcoming ? '1' : '0'
  return `${userId}:${Math.max(1, page)}:${Math.max(1, pageSize)}:${normalizeCountMode(countMode)}:${normalizedUpcoming}:${normalizedSearch}`
}

function getCachedContractsPage(cacheKey: string): { contracts: ContractWithDetails[]; total: number } | null {
  const cached = contractsPageCache.get(cacheKey)
  if (!cached) {
    return null
  }

  if (cached.expiresAt <= Date.now()) {
    contractsPageCache.delete(cacheKey)
    return null
  }

  return cached.value
}

function setCachedContractsPage(
  cacheKey: string,
  value: { contracts: ContractWithDetails[]; total: number }
): void {
  contractsPageCache.set(cacheKey, {
    expiresAt: Date.now() + CONTRACTS_PAGE_CACHE_TTL_MS,
    value,
  })

  while (contractsPageCache.size > CONTRACTS_PAGE_CACHE_MAX_ENTRIES) {
    const oldestKey = contractsPageCache.keys().next().value as string | undefined
    if (!oldestKey) {
      break
    }
    contractsPageCache.delete(oldestKey)
  }
}

export function invalidateContractsPageCache(userId?: string): void {
  if (!userId) {
    contractsPageCache.clear()
    return
  }

  const prefix = `${userId}:`
  for (const key of contractsPageCache.keys()) {
    if (key.startsWith(prefix)) {
      contractsPageCache.delete(key)
    }
  }
}

// Calculate days remaining and status
export function calculateContractStatus(endDate: string | Date): {
  daysLeft: number
  status: 'active' | 'expiring' | 'critical' | 'renewing'
} {
  const daysLeft = getDaysUntil(endDate)
  
  let status: 'active' | 'expiring' | 'critical' | 'renewing' = 'active'
  
  if (daysLeft <= 7) {
    status = 'critical'
  } else if (daysLeft <= 30) {
    status = 'expiring'
  }
  
  return { daysLeft, status }
}

function toObjectArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
}

function toStringValue(value: unknown, fallback: string = ''): string {
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return fallback
}

function toBooleanValue(value: unknown, fallback: boolean = false): boolean {
  if (typeof value === 'boolean') {
    return value
  }
  return fallback
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.map((item) => toStringValue(item)).filter(Boolean)
}

function buildActivityItems(
  record: Record<string, unknown>,
  options: { includeReminders?: boolean } = {}
): ActivityItem[] {
  const activity: ActivityItem[] = []
  const contractId = toStringValue(record.id)
  const contractName = toStringValue(record.name)
  const createdAt = toStringValue(record.created_at)
  const updatedAt = toStringValue(record.updated_at)

  if (createdAt) {
    activity.push({
      id: `${contractId || 'contract'}-created`,
      type: 'created',
      message: `${contractName || 'Contract'} was created.`,
      date: createdAt,
    })
  }

  if (updatedAt && updatedAt !== createdAt) {
    activity.push({
      id: `${contractId || 'contract'}-updated`,
      type: 'updated',
      message: `${contractName || 'Contract'} was updated.`,
      date: updatedAt,
    })
  }

  if (options.includeReminders) {
    const reminders = toObjectArray(record.reminders)
    reminders
      .filter((reminder) => Boolean(reminder.sent_at))
      .forEach((reminder, index) => {
        const sentAt = toStringValue(reminder.sent_at)
        if (!sentAt) {
          return
        }

        const daysBefore = Math.trunc(toFiniteNumber(reminder.days_before, 0))
        activity.push({
          id: `${contractId || 'contract'}-reminder-${index}`,
          type: 'reminder',
          message: `Reminder sent ${daysBefore > 0 ? `${daysBefore} day${daysBefore === 1 ? '' : 's'}` : 'before renewal'}.`,
          date: sentAt,
        })
      })
  }

  return activity.sort((left, right) => right.date.localeCompare(left.date))
}

function parseContractType(value: unknown): ContractWithDetails['type'] {
  const parsed = toStringValue(value).trim().toLowerCase()
  switch (parsed) {
    case 'license':
    case 'service':
    case 'support':
    case 'subscription':
      return parsed
    default:
      return 'service'
  }
}

// Transform database record to Contract type
function transformContract(record: Record<string, unknown>): ContractWithDetails {
  const endDate = toStringValue(record.end_date)
  const { daysLeft, status } = calculateContractStatus(endDate)
  
  // Safe access to reminders array
  const reminders = toObjectArray(record.reminders)
  const vendorContacts = toObjectArray(record.vendor_contacts)
  const firstReminder = reminders[0]
  const firstVendorContact = vendorContacts[0]
  
  return {
    id: toStringValue(record.id),
    name: toStringValue(record.name),
    vendor: toStringValue(record.vendor),
    type: parseContractType(record.type),
    expiryDate: formatDate(endDate),
    daysLeft,
    status,
    value: toFiniteNumber(record.value, 0),
    startDate: toStringValue(record.start_date),  // Keep as string from database
    endDate,      // Keep as string from database
    currency: toStringValue(record.currency, 'USD'),
    autoRenew: toBooleanValue(record.auto_renew),
    renewalTerms: toStringValue(record.renewal_terms),
    notes: toStringValue(record.notes),
    tags: toStringArray(record.tags),
    vendorContact: toStringValue(firstVendorContact?.contact_name),
    vendorEmail: toStringValue(firstVendorContact?.email),
    // Safe mapping with fallback
    reminderDays: reminders
      .map((reminder) => Math.trunc(toFiniteNumber(reminder.days_before, 0)))
      .filter((days) => days > 0),
    emailReminders: toBooleanValue(record.email_reminders, false),
    notifyEmails: toStringArray(firstReminder?.notify_emails),
    createdAt: toStringValue(record.created_at, new Date().toISOString()),
    updatedAt: toStringValue(record.updated_at, new Date().toISOString()),
    activity: buildActivityItems(record, { includeReminders: true }),
  }
}

function transformContractListRecord(record: Record<string, unknown>): ContractWithDetails {
  const endDate = toStringValue(record.end_date || record.endDate || '')
  const startDate = toStringValue(record.start_date || record.startDate || '')
  const { daysLeft, status } = calculateContractStatus(endDate)

  return {
    id: toStringValue(record.id),
    name: toStringValue(record.name),
    vendor: toStringValue(record.vendor),
    type: parseContractType(record.type),
    expiryDate: endDate ? formatDate(endDate) : '',
    daysLeft,
    status,
    value: toFiniteNumber(record.value, 0),
    startDate,
    endDate,
    currency: toStringValue(record.currency, 'USD'),
    autoRenew: toBooleanValue(record.auto_renew ?? record.autoRenew, false),
    renewalTerms: '',
    notes: '',
    tags: toStringArray(record.tags),
    emailReminders: toBooleanValue(record.email_reminders ?? record.emailReminders, false),
    notifyEmails: [],
    createdAt: toStringValue(record.created_at || record.createdAt, new Date().toISOString()),
    updatedAt: toStringValue(record.updated_at || record.updatedAt, new Date().toISOString()),
    activity: buildActivityItems(record),
  }
}

function toFiniteNumber(value: unknown, fallback: number = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

async function fetchContractsPage(
  userId: string,
  page: number,
  pageSize: number,
  countMode: ContractsCountMode,
  options: {
    search?: string | null
    upcoming?: boolean
  } = {}
): Promise<{ contracts: ContractWithDetails[]; total: number; timings: ContractsQueryTimings }> {
  const normalizedCountMode = normalizeCountMode(countMode)
  const cacheEnabled = CONTRACTS_PAGE_CACHE_TTL_MS > 0 && normalizedCountMode === 'planned'
  const cacheKey = cacheEnabled
    ? buildContractsPageCacheKey(userId, page, pageSize, normalizedCountMode, options)
    : null

  if (cacheKey) {
    const cached = getCachedContractsPage(cacheKey)
    if (cached) {
      return {
        contracts: cached.contracts,
        total: cached.total,
        timings: {
          countMs: 0,
          listMs: 0,
          cacheHit: true,
        },
      }
    }
  }

  const supabase = await getSupabase()

  const { data, error } = await supabase.rpc('get_contracts_page_payload', {
    p_user_id: userId,
    p_page: Math.max(1, page),
    p_limit: Math.max(1, pageSize),
    p_search: options.search?.trim() || null,
    p_upcoming: Boolean(options.upcoming),
    p_count_mode: normalizedCountMode,
  })

  if (error) {
    logContractsDbError('Error fetching paginated contracts via RPC', error)
    throw error
  }

  const payload =
    data && typeof data === 'string'
      ? JSON.parse(data)
      : (data as {
          contracts?: Array<Record<string, unknown>>
          total?: number
          timings?: { countMs?: number; listMs?: number }
        } | null)

  const rows = Array.isArray(payload?.contracts) ? payload.contracts : []

  const result = {
    contracts: rows.map(transformContractListRecord),
    total: Math.max(0, Math.trunc(toFiniteNumber(payload?.total, 0))),
    timings: {
      countMs: Number(toFiniteNumber(payload?.timings?.countMs, 0).toFixed(2)),
      listMs: Number(toFiniteNumber(payload?.timings?.listMs, 0).toFixed(2)),
      cacheHit: false,
    },
  }

  if (cacheKey) {
    setCachedContractsPage(cacheKey, {
      contracts: result.contracts,
      total: result.total,
    })
  }

  return result
}

// Get paginated contracts (requires authenticated user)
export async function getAllContracts(
  userId: string,
  page: number = 1,
  pageSize: number = 20,
  countMode: ContractsCountMode = 'planned'
): Promise<{ contracts: ContractWithDetails[]; total: number; timings: ContractsQueryTimings }> {
  return fetchContractsPage(userId, page, pageSize, countMode)
}

// Get contract by ID - RLS enforces ownership at database level
// Includes user_id for application-level ownership verification
export async function getContractById(id: string, userId?: string): Promise<ContractWithDetails | null> {
  const supabase = await getSupabase()

  // RLS automatically filters by auth.uid() - user can only access their own contracts
  // For application-level verification, we explicitly include user_id in the query

  let query = supabase
    .from('contracts')
    .select(`
      id,
      user_id,
      name,
      vendor,
      type,
      start_date,
      end_date,
      value,
      currency,
      email_reminders,
      auto_renew,
      renewal_terms,
      notes,
      tags,
      created_at,
      updated_at,
      vendor_contacts (
        contact_name,
        email
      ),
      reminders (
        days_before,
        notify_emails,
        sent_at
      )
    `)
    .eq('id', id)

  // Application-level ownership verification when userId is provided
  if (userId) {
    query = query.eq('user_id', userId)
  }

  const { data: contract, error } = await query.single()

  if (error) {
    // Return null for "not found" errors (RLS filtered) or actual not found
    if (error.code === 'PGRST116') {
      return null
    }
    logContractsDbError('Error fetching contract', error)
    throw error
  }

  if (!contract) {
    return null
  }

  return transformContract(contract)
}

// Create new contract - RLS ensures user can only create for themselves
export async function createContract(userId: string, input: ContractInput): Promise<ContractWithDetails> {
  const supabase = await getSupabase()

  // RLS ensures user can only insert with their own user_id

  const normalized = normalizeContractMutationInput(input)

  const { data: contractId, error: contractError } = await supabase.rpc(
    'create_contract_with_relations',
    {
      p_user_id: userId,
      p_name: normalized.name,
      p_vendor: normalized.vendor,
      p_type: normalized.type,
      p_start_date: normalized.startDate,
      p_end_date: normalized.endDate,
      p_value: normalized.value,
      p_currency: normalized.currency,
      p_auto_renew: normalized.autoRenew,
      p_renewal_terms: normalized.renewalTerms,
      p_notes: normalized.notes,
      p_tags: normalized.tags,
      p_vendor_contact: normalized.vendorContact,
      p_vendor_email: normalized.vendorEmail,
      p_reminder_days: normalized.reminderDays,
      p_email_reminders: normalized.emailReminders,
      p_notify_emails: normalized.notifyEmails,
    }
  )

  if (contractError || !contractId) {
    logContractsDbError('Error creating contract', contractError)
    throw new Error(contractError?.message || 'Failed to create contract')
  }

  // Fetch complete contract with relations
  const createdContract = await getContractById(contractId, userId)
  if (!createdContract) {
    throw new Error('Failed to fetch created contract')
  }

  invalidateContractsPageCache(userId)

  return createdContract
}

// Update contract - RLS ensures user can only update their own contracts
export async function updateContract(
  id: string,
  input: ContractInput,
  userId?: string
): Promise<ContractWithDetails> {
  const supabase = await getSupabase()

  // Pre-flight ownership check: verify the contract exists and belongs to the
  // current user BEFORE calling the atomic RPC. This disambiguates "not found"
  // from "access denied" and avoids the opaque RPC error.
  //
  // Note: Auth context is already established by the proxy (proxy.ts) which
  // runs on every request and refreshes expired JWTs. No need for a defensive
  // getUser() call here.
  if (userId) {
    const existingContract = await getContractById(id, userId)
    if (!existingContract) {
      // Contract not found or belongs to another user.
      // Use a generic error — do not distinguish "not found" from "access denied"
      // to avoid leaking existence of other users' contracts.
      throw new Error('Contract not found or access denied')
    }
  }

  // RLS ensures user can only update their own contracts

  const normalized = normalizeContractMutationInput(input)

  const { data: updatedContractId, error: contractError } = await supabase.rpc(
    'update_contract_with_relations',
    {
      p_contract_id: id,
      p_name: normalized.name,
      p_vendor: normalized.vendor,
      p_type: normalized.type,
      p_start_date: normalized.startDate,
      p_end_date: normalized.endDate,
      p_value: normalized.value,
      p_currency: normalized.currency,
      p_auto_renew: normalized.autoRenew,
      p_renewal_terms: normalized.renewalTerms,
      p_notes: normalized.notes,
      p_tags: normalized.tags,
      p_vendor_contact: normalized.vendorContact,
      p_vendor_email: normalized.vendorEmail,
      p_reminder_days: normalized.reminderDays,
      p_email_reminders: normalized.emailReminders,
      p_notify_emails: normalized.notifyEmails,
    }
  )

  if (contractError || !updatedContractId) {
    logContractsDbError('Error updating contract', contractError)
    throw new Error(contractError?.message || 'Failed to update contract')
  }

  const updatedContract = await getContractById(updatedContractId, userId)
  if (!updatedContract) {
    throw new Error('Failed to fetch updated contract')
  }

  if (userId) {
    invalidateContractsPageCache(userId)
  }

  return updatedContract
}

// Delete contract - RLS ensures user can only delete their own contracts
export async function deleteContract(id: string, userId: string): Promise<boolean> {
  const supabase = await getSupabase()

  // RLS ensures user can only delete their own contracts

  const { data, error } = await supabase
    .from('contracts')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()

  if (error) {
    logContractsDbError('Error deleting contract', error)
    throw error
  }

  if (data?.id) {
    invalidateContractsPageCache(userId)
  }

  return Boolean(data?.id)
}

// Search contracts - with escaped wildcards to prevent SQL injection
// Requires userId parameter for security (RLS + app-level filter)
export async function searchContracts(userId: string, query: string): Promise<ContractWithDetails[]> {
  const supabase = await getSupabase()

  // RLS + explicit user_id filter ensures user only searches their own contracts

  // Escape ILIKE wildcards (%) and (_) to prevent unintended search results
  const escapedQuery = query.replace(/[%_]/g, '\\$&')

  const { data: contracts, error } = await supabase
    .from('contracts')
    .select(`
      *,
      vendor_contacts (
        contact_name,
        email
      ),
      reminders (
        days_before,
        notify_emails
      )
    `)
    .eq('user_id', userId) // Explicit ownership filter
    .or(`name.ilike.%${escapedQuery}%,vendor.ilike.%${escapedQuery}%`)
    .order('end_date', { ascending: true })

  if (error) {
    logContractsDbError('Error searching contracts', error)
    throw error
  }

  return contracts?.map(transformContract) || []
}

// Get contracts by status with database-level filtering
export async function getContractsByStatus(
  userId: string,
  status: 'active' | 'expiring' | 'critical' | 'renewing'
): Promise<ContractWithDetails[]> {
  const supabase = await getSupabase()

  // Auth check required - RLS will filter by user_id
  // The userId parameter ensures we only fetch this user's contracts

  // Calculate date thresholds for status filtering (timezone-safe)
  const today = new Date()
  const sevenDaysLater = new Date(today.getTime() + (7 * 24 * 60 * 60 * 1000))
  const thirtyDaysLater = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000))

  let query = supabase
    .from('contracts')
    .select(`
      *,
      vendor_contacts (
        contact_name,
        email
      ),
      reminders (
        days_before,
        notify_emails
      )
    `)
    .eq('user_id', userId) // RLS ensures this user only sees their contracts

  // Apply status-specific filters
  switch (status) {
    case 'critical':
      query = query.lte('end_date', toDateOnlyString(sevenDaysLater))
      break
    case 'expiring':
      query = query
        .gt('end_date', toDateOnlyString(sevenDaysLater))
        .lte('end_date', toDateOnlyString(thirtyDaysLater))
      break
    case 'active':
      query = query.gt('end_date', toDateOnlyString(thirtyDaysLater))
      break
    case 'renewing':
      query = query.eq('auto_renew', true)
      break
  }

  const { data: contracts, error } = await query.order('end_date', { ascending: true })

  if (error) {
    logContractsDbError('Error fetching contracts by status', error)
    throw error
  }

  return contracts?.map(transformContract) || []
}

// Get upcoming expiries (next 60 days)
export async function getUpcomingExpiries(userId: string): Promise<ContractWithDetails[]> {
  const supabase = await getSupabase()

  // Auth check required - RLS will filter by user_id
  // The userId parameter ensures we only fetch this user's contracts

  const today = new Date()
  const sixtyDaysLater = new Date()
  sixtyDaysLater.setDate(today.getDate() + 60)

  const { data: contracts, error } = await supabase
    .from('contracts')
    .select(`
      *,
      vendor_contacts (
        contact_name,
        email
      ),
      reminders (
        days_before,
        notify_emails
      )
    `)
    .eq('user_id', userId) // RLS ensures this user only sees their contracts
    .gte('end_date', toDateOnlyString(today))
    .lte('end_date', toDateOnlyString(sixtyDaysLater))
    .order('end_date', { ascending: true })

  if (error) {
    logContractsDbError('Error fetching upcoming expiries', error)
    throw error
  }

  return contracts?.map(transformContract) || []
}

// Search contracts with pagination (requires authenticated user)
export async function searchContractsPaginated(
  userId: string,
  query: string,
  page: number = 1,
  pageSize: number = 20,
  countMode: ContractsCountMode = 'planned'
): Promise<{ contracts: ContractWithDetails[]; total: number; timings: ContractsQueryTimings }> {
  return fetchContractsPage(userId, page, pageSize, countMode, {
    search: query,
  })
}

// Get upcoming expiries with pagination (requires authenticated user)
export async function getUpcomingExpiriesPaginated(
  userId: string,
  page: number = 1,
  pageSize: number = 20,
  countMode: ContractsCountMode = 'planned'
): Promise<{ contracts: ContractWithDetails[]; total: number; timings: ContractsQueryTimings }> {
  return fetchContractsPage(userId, page, pageSize, countMode, {
    upcoming: true,
  })
}

// Get contract statistics - calculate from contracts table (MVP simplicity)
export async function getContractStats(userId: string): Promise<{
  user_id: string | null
  total_contracts: number
  expired: number
  critical: number
  expiring: number
  active: number
  total_value: number
  average_value: number
}> {
  const supabase = await getSupabase()
  
  // Calculate stats from contracts table directly
  // This is simple and fast enough for MVP scale (<1000 contracts)
  const { data: contracts, error } = await supabase
    .from('contracts')
    .select('end_date, value')
    .eq('user_id', userId) // RLS ensures this user only sees their contracts
  
  if (error) {
    logContractsDbError('Error fetching contract stats', error)
    throw error
  }
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  // Calculate stats from data
  const total_contracts = contracts.length
  const expired = contracts.filter(c => new Date(c.end_date) < today).length
  const critical = contracts.filter(c => {
    const endDate = new Date(c.end_date)
    const diffDays = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return diffDays >= 0 && diffDays <= 7
  }).length
  const expiring = contracts.filter(c => {
    const endDate = new Date(c.end_date)
    const diffDays = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return diffDays > 7 && diffDays <= 30
  }).length
  const active = contracts.filter(c => {
    const endDate = new Date(c.end_date)
    const diffDays = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return diffDays > 30
  }).length
  
  // Calculate value stats
  const values = contracts.map(c => c.value).filter(v => v !== null) as number[]
  const total_value = values.reduce((sum, v) => sum + v, 0)
  const average_value = values.length > 0 ? total_value / values.length : 0
  
  return {
    user_id: userId,
    total_contracts,
    expired,
    critical,
    expiring,
    active,
    total_value,
    average_value
  }
}
