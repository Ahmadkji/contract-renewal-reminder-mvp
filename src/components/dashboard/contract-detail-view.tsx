"use client"

import * as React from "react"
import { SlideOverPanel } from "./slide-over-panel"
import { cn } from "@/lib/utils"
import { 
  Calendar, Building2, DollarSign, Clock, Bell, FileText, 
  Tag, Mail, CheckCircle, AlertTriangle, XCircle, ExternalLink,
  Edit, Trash2, MoreHorizontal
} from "lucide-react"

// ============================================
// Types
// ============================================
interface ContractDetail {
  id: string
  name: string
  vendor: string
  type: "license" | "service" | "support" | "subscription"
  status: "active" | "expiring" | "critical" | "renewing"
  
  // Dates
  startDate: Date
  endDate: Date
  createdAt: Date
  updatedAt: Date
  
  // Financial
  value: number
  currency: string
  
  // Vendor
  vendorContact: string
  vendorEmail: string
  
  // Terms
  autoRenew: boolean
  renewalTerms: string
  
  // Reminders
  reminderDays: number[]
  emailReminders: boolean
  notifyEmails: string[]
  
  // Other
  notes: string
  tags: string[]
  color: string
  
  // Activity
  activity: ActivityItem[]
}

interface ActivityItem {
  id: string
  type: "created" | "updated" | "reminder" | "renewed" | "note"
  message: string
  date: Date
  user?: string
}

// ============================================
// Mock Data
// ============================================
const MOCK_CONTRACT_DETAIL: ContractDetail = {
  id: "1",
  name: "Microsoft 365 Enterprise E5",
  vendor: "Microsoft Corporation",
  type: "subscription",
  status: "active",
  
  startDate: new Date("2024-01-15"),
  endDate: new Date("2025-01-15"),
  createdAt: new Date("2024-01-10"),
  updatedAt: new Date("2024-10-20"),
  
  value: 48000,
  currency: "USD",
  
  vendorContact: "Sarah Johnson",
  vendorEmail: "sarah.johnson@microsoft.com",
  
  autoRenew: true,
  renewalTerms: "30-day notice required for cancellation. Auto-renews annually unless cancelled.",
  
  reminderDays: [60, 30, 14, 7],
  emailReminders: true,
  notifyEmails: ["finance@company.com", "legal@company.com"],
  
  notes: "Primary productivity suite for the entire organization. Includes Teams, SharePoint, and advanced security features.",
  tags: ["productivity", "critical", "security"],
  color: "#06b6d4",
  
  activity: [
    { id: "1", type: "updated", message: "Contract value updated to $48,000", date: new Date("2024-10-20"), user: "John Doe" },
    { id: "2", type: "reminder", message: "60-day renewal reminder sent", date: new Date("2024-11-16"), user: null },
    { id: "3", type: "note", message: "Added note about security features", date: new Date("2024-09-05"), user: "Jane Smith" },
    { id: "4", type: "created", message: "Contract created", date: new Date("2024-01-10"), user: "John Doe" },
  ],
}

// ============================================
// Helpers
// ============================================
const statusConfig = {
  active: { label: "Active", color: "#22c55e", bgColor: "bg-[#22c55e]/15", borderColor: "border-[#22c55e]/30", icon: CheckCircle },
  expiring: { label: "Expiring Soon", color: "#eab308", bgColor: "bg-[#eab308]/15", borderColor: "border-[#eab308]/30", icon: AlertTriangle },
  critical: { label: "Critical", color: "#ef4444", bgColor: "bg-[#ef4444]/15", borderColor: "border-[#ef4444]/30", icon: XCircle },
  renewing: { label: "Renewing", color: "#3b82f6", bgColor: "bg-[#3b82f6]/15", borderColor: "border-[#3b82f6]/30", icon: Clock },
}

const typeLabels = {
  license: "Software License",
  subscription: "Subscription",
  service: "Service Agreement",
  support: "Support Contract",
}

const formatDate = (date: Date) => {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

const formatCurrency = (value: number, currency: string) => {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value)
}

const getDaysUntil = (date: Date) => {
  const now = new Date()
  const diff = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return diff
}

// ============================================
// Component
// ============================================
interface ContractDetailViewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contractId?: string
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
}

export function ContractDetailView({ 
  open, 
  onOpenChange, 
  contractId, 
  onEdit, 
  onDelete 
}: ContractDetailViewProps) {
  const [contract, setContract] = React.useState<ContractDetail | null>(null)
  const [loading, setLoading] = React.useState(false)

  // Fetch contract data
  React.useEffect(() => {
    if (open && contractId) {
      setLoading(true)
      // Simulate API call
      setTimeout(() => {
        setContract(MOCK_CONTRACT_DETAIL)
        setLoading(false)
      }, 300)
    } else {
      setContract(null)
    }
  }, [open, contractId])

  const status = contract ? statusConfig[contract.status] : null
  const daysLeft = contract ? getDaysUntil(contract.endDate) : 0

  return (
    <SlideOverPanel
      open={open}
      onOpenChange={onOpenChange}
      title="Contract Details"
      width="xl"
      footer={
        contract && (
          <>
            <button
              onClick={() => onDelete?.(contract.id)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[#ef4444] hover:bg-[#ef4444]/10 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
            <div className="flex-1" />
            <button
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-sm font-medium text-white/60 hover:text-white transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => onEdit?.(contract.id)}
              className="flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-white/90 transition-colors"
            >
              <Edit className="w-4 h-4" />
              Edit Contract
            </button>
          </>
        )
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      ) : contract ? (
        <div className="space-y-6">
          {/* Header Section */}
          <div className="flex items-start gap-4">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${contract.color}20`, border: `1px solid ${contract.color}40` }}
            >
              <FileText className="w-6 h-6" style={{ color: contract.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold text-white truncate">{contract.name}</h2>
              <p className="text-sm text-white/60 mt-1">{contract.vendor}</p>
              <div className="flex items-center gap-3 mt-3">
                {status && (
                  <span className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                    status.bgColor, status.borderColor, "border"
                  )}>
                    <status.icon className="w-3 h-3" style={{ color: status.color }} />
                    <span style={{ color: status.color }}>{status.label}</span>
                  </span>
                )}
                <span className="text-xs text-white/40">
                  {typeLabels[contract.type]}
                </span>
              </div>
            </div>
          </div>

          {/* Countdown Banner */}
          <div className={cn(
            "p-4 rounded-xl border",
            daysLeft <= 7 ? "bg-[#ef4444]/10 border-[#ef4444]/30" :
            daysLeft <= 30 ? "bg-[#eab308]/10 border-[#eab308]/30" :
            "bg-[#06b6d4]/10 border-[#06b6d4]/30"
          )}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/60">Expires in</p>
                <p className={cn(
                  "text-2xl font-bold",
                  daysLeft <= 7 ? "text-[#ef4444]" :
                  daysLeft <= 30 ? "text-[#eab308]" :
                  "text-white"
                )}>
                  {daysLeft} days
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-white/60">End Date</p>
                <p className="text-lg font-medium text-white">{formatDate(contract.endDate)}</p>
              </div>
            </div>
            <div className="mt-3 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  daysLeft <= 7 ? "bg-[#ef4444]" :
                  daysLeft <= 30 ? "bg-[#eab308]" :
                  "bg-[#06b6d4]"
                )}
                style={{ width: `${Math.max(5, 100 - (daysLeft / 365 * 100))}%` }}
              />
            </div>
          </div>

          {/* Three Column Layout */}
          <div className="grid grid-cols-3 gap-4">
            {/* Column 1: Key Details */}
            <div className="space-y-4">
              <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider">Key Details</h3>
              
              <DetailRow 
                icon={<Calendar className="w-4 h-4" />}
                label="Start Date"
                value={formatDate(contract.startDate)}
              />
              
              <DetailRow 
                icon={<Calendar className="w-4 h-4" />}
                label="End Date"
                value={formatDate(contract.endDate)}
              />
              
              <DetailRow 
                icon={<DollarSign className="w-4 h-4" />}
                label="Contract Value"
                value={formatCurrency(contract.value, contract.currency)}
                highlight
              />
              
              <DetailRow 
                icon={<Clock className="w-4 h-4" />}
                label="Auto-Renew"
                value={contract.autoRenew ? "Yes" : "No"}
              />
            </div>

            {/* Column 2: Vendor Info */}
            <div className="space-y-4">
              <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider">Vendor</h3>
              
              <DetailRow 
                icon={<Building2 className="w-4 h-4" />}
                label="Company"
                value={contract.vendor}
              />
              
              <DetailRow 
                icon={<Mail className="w-4 h-4" />}
                label="Contact"
                value={contract.vendorContact}
              />
              
              <DetailRow 
                icon={<ExternalLink className="w-4 h-4" />}
                label="Email"
                value={contract.vendorEmail}
                isLink
              />
            </div>

            {/* Column 3: Reminders */}
            <div className="space-y-4">
              <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider">Reminders</h3>
              
              <DetailRow 
                icon={<Bell className="w-4 h-4" />}
                label="Email Alerts"
                value={contract.emailReminders ? "Enabled" : "Disabled"}
              />
              
              <div className="space-y-1">
                <p className="text-xs text-white/50">Reminder Schedule</p>
                <div className="flex flex-wrap gap-1.5">
                  {contract.reminderDays.map((day) => (
                    <span 
                      key={day}
                      className="px-2 py-0.5 text-xs bg-white/5 border border-white/10 rounded text-white/70"
                    >
                      {day}d
                    </span>
                  ))}
                </div>
              </div>
              
              {contract.notifyEmails.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-white/50">Notify</p>
                  <p className="text-sm text-white/80">{contract.notifyEmails.length} recipients</p>
                </div>
              )}
            </div>
          </div>

          {/* Tags */}
          {contract.tags.length > 0 && (
            <div className="pt-4 border-t border-white/10">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-white/40" />
                <span className="text-xs text-white/40">Tags</span>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {contract.tags.map((tag) => (
                  <span 
                    key={tag}
                    className="px-3 py-1 text-xs bg-white/5 border border-white/10 rounded-full text-white/70"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {contract.notes && (
            <div className="pt-4 border-t border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-white/40" />
                <span className="text-xs text-white/40">Notes</span>
              </div>
              <p className="text-sm text-white/70 leading-relaxed">{contract.notes}</p>
            </div>
          )}

          {/* Renewal Terms */}
          {contract.renewalTerms && (
            <div className="pt-4 border-t border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-white/40" />
                <span className="text-xs text-white/40">Renewal Terms</span>
              </div>
              <p className="text-sm text-white/70 leading-relaxed">{contract.renewalTerms}</p>
            </div>
          )}

          {/* Activity Timeline */}
          <div className="pt-4 border-t border-white/10">
            <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-4">Activity</h3>
            <div className="activity-timeline">
              {contract.activity.map((item) => (
                <ActivityTimelineItem key={item.id} item={item} />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </SlideOverPanel>
  )
}

// ============================================
// Sub-components
// ============================================
function DetailRow({ 
  icon, 
  label, 
  value, 
  highlight,
  isLink 
}: { 
  icon: React.ReactNode
  label: string
  value: string
  highlight?: boolean
  isLink?: boolean
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-5 h-5 flex items-center justify-center text-white/40 flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white/40">{label}</p>
        {isLink ? (
          <a href={`mailto:${value}`} className="text-sm text-[#06b6d4] hover:underline truncate block">
            {value}
          </a>
        ) : (
          <p className={cn(
            "text-sm truncate",
            highlight ? "text-white font-medium" : "text-white/80"
          )}>
            {value}
          </p>
        )}
      </div>
    </div>
  )
}

function ActivityTimelineItem({ item }: { item: ActivityItem }) {
  const iconMap = {
    created: { icon: CheckCircle, color: "text-[#22c55e]", bg: "bg-[#22c55e]/15" },
    updated: { icon: Edit, color: "text-[#3b82f6]", bg: "bg-[#3b82f6]/15" },
    reminder: { icon: Bell, color: "text-[#eab308]", bg: "bg-[#eab308]/15" },
    renewed: { icon: Clock, color: "text-[#06b6d4]", bg: "bg-[#06b6d4]/15" },
    note: { icon: FileText, color: "text-white/60", bg: "bg-white/10" },
  }
  
  const config = iconMap[item.type]
  const Icon = config.icon
  
  return (
    <div className="activity-item">
      <div className={cn("activity-dot", config.bg)}>
        <Icon className={cn("w-3 h-3", config.color)} />
      </div>
      <div className="bg-white/5 rounded-lg p-3">
        <p className="text-sm text-white/80">{item.message}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-xs text-white/40">{formatDate(item.date)}</span>
          {item.user && (
            <>
              <span className="text-white/20">•</span>
              <span className="text-xs text-white/40">{item.user}</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
