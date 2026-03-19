export interface Contract {
  id: string
  name: string
  vendor: string
  type: 'license' | 'service' | 'support' | 'subscription'
  startDate: string  // ISO 8601 string from API/database
  endDate: string    // ISO 8601 string from API/database
  expiryDate: string
  daysLeft: number
  status: 'active' | 'expiring' | 'critical' | 'renewing'
  value?: number
  currency?: string
  autoRenew?: boolean
  renewalTerms?: string
  notes?: string
  tags?: string[]
  vendorContact?: string
  vendorEmail?: string
  reminderDays?: number[]
  emailReminders?: boolean
  notifyEmails?: string[]
}

export interface ContractFormData {
  name: string
  type: 'license' | 'service' | 'support' | 'subscription'
  startDate: Date | null
  endDate: Date | null
  vendor: string
  vendorContact: string
  vendorEmail: string
  value: number
  currency: string
  autoRenew: boolean
  renewalTerms: string
  reminderDays: number[]
  emailReminders: boolean
  notifyEmails: string[]
  notes: string
  tags: string[]
}

export interface ContractInput {
  name: string
  vendor: string
  type: 'license' | 'service' | 'support' | 'subscription'
  startDate: string  // ISO 8601 string from API
  endDate: string    // ISO 8601 string from API
  value?: number
  currency?: string
  autoRenew?: boolean
  renewalTerms?: string
  notes?: string
  tags?: string[]
  vendorContact?: string
  vendorEmail?: string
  reminderDays?: number[]
  emailReminders?: boolean
  notifyEmails?: string[]
}
