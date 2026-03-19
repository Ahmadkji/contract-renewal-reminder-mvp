import { createClient } from '@/lib/supabase/server'
import { Contract, ContractInput } from '@/types/contract'

// Helper function to get authenticated Supabase client (uses RLS)
const getSupabase = async () => {
  return await createClient()
}

/**
 * Convert Date object or ISO string to UTC date string (YYYY-MM-DD)
 * 
 * FIX: Now handles both Date objects and ISO strings
 * - For Date objects: extracts components in local timezone (preserves user's selection)
 * - For ISO strings: parses and extracts date-only part
 * 
 * This ensures timezone-safe date storage without date shifting
 */
function toUTCDateOnly(date: Date | string): string {
  // If already a string in YYYY-MM-DD format, return as-is
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }
  
  // Parse the date
  const d = typeof date === 'string' ? new Date(date) : date;
  
  // Get date components in local timezone to preserve user's intended date
  // This prevents timezone-based date shifting (e.g., UTC+5 user selecting Jan 1)
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();
  
  // Format as YYYY-MM-DD (local timezone - no UTC conversion)
  // Database stores as DATE type which handles timezone appropriately
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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
  startDate: string  // ISO 8601 string from database
  endDate: string    // ISO 8601 string from database
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

// Calculate days remaining and status
export function calculateContractStatus(endDate: Date): {
  daysLeft: number
  status: 'active' | 'expiring' | 'critical' | 'renewing'
} {
  const today = new Date()
  const diffTime = endDate.getTime() - today.getTime()
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  let status: 'active' | 'expiring' | 'critical' | 'renewing' = 'active'
  
  if (daysLeft <= 7) {
    status = 'critical'
  } else if (daysLeft <= 30) {
    status = 'expiring'
  }
  
  return { daysLeft, status }
}

// Transform database record to Contract type
function transformContract(record: any): ContractWithDetails {
  const { daysLeft, status } = calculateContractStatus(new Date(record.end_date))
  
  // Safe access to reminders array
  const reminders = Array.isArray(record.reminders) ? record.reminders : []
  
  return {
    id: record.id,
    name: record.name,
    vendor: record.vendor,
    type: record.type,
    expiryDate: new Date(record.end_date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }),
    daysLeft,
    status,
    value: record.value,
    startDate: record.start_date,  // Keep as string from database
    endDate: record.end_date,      // Keep as string from database
    currency: record.currency,
    autoRenew: record.auto_renew,
    renewalTerms: record.renewal_terms,
    notes: record.notes,
    tags: record.tags || [],
    vendorContact: record.vendor_contacts?.[0]?.contact_name,
    vendorEmail: record.vendor_contacts?.[0]?.email,
    // Safe mapping with fallback
    reminderDays: reminders.map((r: any) => r.days_before),
    // Safe access with fallback
    emailReminders: reminders.length > 0 && reminders[0].notify_emails?.length > 0,
    notifyEmails: reminders.length > 0 ? (reminders[0].notify_emails || []) : [],
    // Add missing fields
    createdAt: record.created_at || new Date().toISOString(),
    updatedAt: record.updated_at || new Date().toISOString(),
    // Add activity field (empty array for now)
    activity: []
  }
}

// Get paginated contracts (requires authenticated user)
export async function getAllContracts(
  userId: string,
  page: number = 1,
  pageSize: number = 20
): Promise<{ contracts: ContractWithDetails[]; total: number }> {
  const supabase = await getSupabase()

  // Auth check required - RLS will filter by user_id
  // The userId parameter ensures we only fetch this user's contracts

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  // Get total count for pagination (filtered by user_id via RLS)
  const { count, error: countError } = await supabase
    .from('contracts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId) // RLS ensures this user only sees their contracts

  if (countError) {
    console.error('Error counting contracts:', countError)
    throw countError
  }

  // Get paginated data (filtered by user_id via RLS)
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
    .order('end_date', { ascending: true })
    .range(from, to)

  if (error) {
    console.error('Error fetching contracts:', error)
    throw error
  }

  return {
    contracts: contracts?.map(transformContract) || [],
    total: count || 0
  }
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
        notify_emails
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
    console.error('Error fetching contract:', error)
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

  // Validate dates are present (already validated by API layer)
  if (!input.startDate || !input.endDate) {
    throw new Error('Start date and end date are required')
  }

  // Convert ISO strings to Date objects for database
  const startDate = new Date(input.startDate)
  const endDate = new Date(input.endDate)

  // Create contract with direct INSERT (simpler than stored procedure)
  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .insert({
      user_id: userId, // Use authenticated user's ID
      name: input.name,
      vendor: input.vendor,
      type: input.type,
      start_date: toUTCDateOnly(startDate),
      end_date: toUTCDateOnly(endDate),
      value: input.value,
      currency: input.currency || 'USD',
      auto_renew: input.autoRenew || false,
      renewal_terms: input.renewalTerms,
      notes: input.notes,
      tags: input.tags || []
    })
    .select()
    .single()

  if (contractError) {
    console.error('Error creating contract:', contractError)
    throw new Error(contractError.message || 'Failed to create contract')
  }

  const contractId = contract.id

  // Insert vendor contact if provided - FIX #10: Make failure fatal
  if (input.vendorContact && input.vendorEmail) {
    const { error: contactError } = await supabase
      .from('vendor_contacts')
      .insert({
        contract_id: contractId,
        contact_name: input.vendorContact,
        email: input.vendorEmail
      })

    if (contactError) {
      console.error('Error creating vendor contact:', contactError)
      // FIX #10: Throw error to prevent partial data creation
      throw new Error(`Failed to create vendor contact: ${contactError.message || 'Unknown error'}`)
    }
  }

  // Insert reminders if provided - FIX #11: Make failure fatal
  if (input.reminderDays && input.reminderDays.length > 0) {
    const { error: reminderError } = await supabase
      .from('reminders')
      .insert(
        input.reminderDays.map(days => ({
          contract_id: contractId,
          days_before: days,
          notify_emails: input.notifyEmails || []
        }))
      )

    if (reminderError) {
      console.error('Error creating reminders:', reminderError)
      // FIX #11: Throw error to prevent partial data creation
      throw new Error(`Failed to create reminders: ${reminderError.message || 'Unknown error'}`)
    }
  }

  // Fetch complete contract with relations
  const createdContract = await getContractById(contractId)
  if (!createdContract) {
    throw new Error('Failed to fetch created contract')
  }

  return createdContract
}

// Update contract - RLS ensures user can only update their own contracts
export async function updateContract(
  id: string,
  input: Partial<ContractInput>
): Promise<ContractWithDetails> {
  const supabase = await getSupabase()

  // RLS ensures user can only update their own contracts

  // Validate dates are present if provided (already validated by API layer)
  if (input.startDate !== undefined && input.startDate !== null && !input.endDate) {
    throw new Error('Both startDate and endDate must be provided together')
  }
  if (input.endDate !== undefined && input.endDate !== null && !input.startDate) {
    throw new Error('Both startDate and endDate must be provided together')
  }

  // Convert ISO strings to Date objects for database
  const startDate = input.startDate ? new Date(input.startDate) : undefined
  const endDate = input.endDate ? new Date(input.endDate) : undefined

  // Update contract (RLS filters by user_id automatically)
  const { error: contractError } = await supabase
    .from('contracts')
    .update({
      name: input.name,
      vendor: input.vendor,
      type: input.type,
      start_date: startDate ? toUTCDateOnly(startDate) : undefined,
      end_date: endDate ? toUTCDateOnly(endDate) : undefined,
      value: input.value,
      currency: input.currency,
      auto_renew: input.autoRenew,
      renewal_terms: input.renewalTerms,
      notes: input.notes,
      tags: input.tags
    })
    .eq('id', id)

  if (contractError) {
    console.error('Error updating contract:', contractError)
    throw contractError
  }

  // Update or create vendor contact
  if (input.vendorContact && input.vendorEmail) {
    // Check if contact exists
    const { data: existingContact } = await supabase
      .from('vendor_contacts')
      .select('id')
      .eq('contract_id', id)
      .single()

    if (existingContact) {
      await supabase
        .from('vendor_contacts')
        .update({
          contact_name: input.vendorContact,
          email: input.vendorEmail
        })
        .eq('contract_id', id)
    } else {
      await supabase
        .from('vendor_contacts')
        .insert({
          contract_id: id,
          contact_name: input.vendorContact,
          email: input.vendorEmail
        })
    }
  }

  // Update or create reminders
  if (input.reminderDays) {
    // Delete all existing reminders for this contract
    await supabase
      .from('reminders')
      .delete()
      .eq('contract_id', id)

    // Create new reminder rows (one per day)
    if (input.reminderDays.length > 0) {
      await supabase
        .from('reminders')
        .insert(
          input.reminderDays.map(days => ({
            contract_id: id,
            days_before: days,
            notify_emails: input.notifyEmails || []
          }))
        )
    }
  }

  const updatedContract = await getContractById(id)
  if (!updatedContract) {
    throw new Error('Failed to fetch updated contract')
  }

  return updatedContract
}

// Delete contract - RLS ensures user can only delete their own contracts
export async function deleteContract(id: string): Promise<void> {
  const supabase = await getSupabase()

  // RLS ensures user can only delete their own contracts

  const { error } = await supabase
    .from('contracts')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting contract:', error)
    throw error
  }
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
    console.error('Error searching contracts:', error)
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
      query = query.lte('end_date', toUTCDateOnly(sevenDaysLater))
      break
    case 'expiring':
      query = query
        .gt('end_date', toUTCDateOnly(sevenDaysLater))
        .lte('end_date', toUTCDateOnly(thirtyDaysLater))
      break
    case 'active':
      query = query.gt('end_date', toUTCDateOnly(thirtyDaysLater))
      break
    case 'renewing':
      query = query.eq('auto_renew', true)
      break
  }

  const { data: contracts, error } = await query.order('end_date', { ascending: true })

  if (error) {
    console.error('Error fetching contracts by status:', error)
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
    .gte('end_date', today.toISOString().split('T')[0])
    .lte('end_date', sixtyDaysLater.toISOString().split('T')[0])
    .order('end_date', { ascending: true })

  if (error) {
    console.error('Error fetching upcoming expiries:', error)
    throw error
  }

  return contracts?.map(transformContract) || []
}

// Search contracts with pagination (requires authenticated user)
export async function searchContractsPaginated(
  userId: string,
  query: string,
  page: number = 1,
  pageSize: number = 20
): Promise<{ contracts: ContractWithDetails[]; total: number }> {
  const supabase = await getSupabase()
  
  // Auth check required - RLS will filter by user_id
  // The userId parameter ensures we only search this user's contracts
  
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  
  // Escape ILIKE wildcards (%) and (_) to prevent unintended search results
  const escapedQuery = query.replace(/[%_]/g, '\\$&')
  
  // Get count (filtered by user_id via RLS)
  const { count } = await supabase
    .from('contracts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId) // RLS ensures this user only sees their contracts
    .or(`name.ilike.%${escapedQuery}%,vendor.ilike.%${escapedQuery}%`)
  
  // Get paginated data (filtered by user_id via RLS)
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
    .or(`name.ilike.%${escapedQuery}%,vendor.ilike.%${escapedQuery}%`)
    .order('end_date', { ascending: true })
    .range(from, to)
  
  if (error) {
    console.error('Error searching contracts:', error)
    throw error
  }
  
  return {
    contracts: contracts.map(transformContract),
    total: count || 0
  }
}

// Get upcoming expiries with pagination (requires authenticated user)
export async function getUpcomingExpiriesPaginated(
  userId: string,
  page: number = 1,
  pageSize: number = 20
): Promise<{ contracts: ContractWithDetails[]; total: number }> {
  const supabase = await getSupabase()
  
  // Auth check required - RLS will filter by user_id
  // The userId parameter ensures we only fetch this user's contracts
  
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  
  // Calculate date thresholds (timezone-safe)
  const today = new Date()
  const sixtyDaysLater = new Date(today.getTime() + (60 * 24 * 60 * 60 * 1000))
  
  // Get count (filtered by user_id via RLS)
  const { count } = await supabase
    .from('contracts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId) // RLS ensures this user only sees their contracts
    .gte('end_date', toUTCDateOnly(today))
    .lte('end_date', toUTCDateOnly(sixtyDaysLater))

  // Get paginated data (filtered by user_id via RLS)
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
    .gte('end_date', toUTCDateOnly(today))
    .lte('end_date', toUTCDateOnly(sixtyDaysLater))
    .order('end_date', { ascending: true })
    .range(from, to)

  if (error) {
    console.error('Error fetching upcoming expiries:', error)
    throw error
  }

  return {
    contracts: contracts?.map(transformContract) || [],
    total: count || 0
  }
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
    console.error('Error fetching contract stats:', error)
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
