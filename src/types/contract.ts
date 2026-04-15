export type ContractType = string

export type ContractStatus = 'active' | 'expiring' | 'renewing'

export interface ContractSummary {
  id: string
  name: string
  vendor: string
  type: ContractType
  startDate: string | null
  endDate: string | null
  expiryDate: string | null
  daysLeft: number
  status: ContractStatus
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
  createdAt?: string
  updatedAt?: string
}

export type Contract = ContractSummary

export interface ContractActivityItem {
  id: string
  type: 'created' | 'updated' | 'reminder' | 'renewed' | 'note'
  message: string
  date: string
  user?: string
}

export interface ContractDetail extends ContractSummary {
  startDate: string
  endDate: string
  expiryDate: string
  value: number
  currency: string
  autoRenew: boolean
  renewalTerms: string
  notes: string
  tags: string[]
  reminderDays: number[]
  emailReminders: boolean
  notifyEmails: string[]
  createdAt: string
  updatedAt: string
  activity: ContractActivityItem[]
}

export interface ContractFormData {
  name: string
  type: ContractType
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
  type: ContractType
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
