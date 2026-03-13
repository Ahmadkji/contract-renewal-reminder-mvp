"use client"

import * as React from "react"
import { SlideOverPanel } from "./slide-over-panel"
import { cn } from "@/lib/utils"
import { 
  Mail, Bell, Clock, Globe, Shield, Check,
  ChevronRight, ExternalLink
} from "lucide-react"
import { Toggle } from "./form-inputs"
import { toast } from "@/hooks/use-toast"

// ============================================
// Types
// ============================================
interface EmailSettings {
  // General
  emailNotifications: boolean
  digestEmail: boolean
  digestFrequency: "daily" | "weekly" | "monthly"
  
  // Reminder Schedule
  defaultReminders: number[]
  
  // Advanced
  includeContractDetails: boolean
  includeRenewalLink: boolean
  timezone: string
  
  // Notification Preferences
  criticalAlerts: boolean
  expiringAlerts: boolean
  weeklyDigest: boolean
  marketingEmails: boolean
}

const DEFAULT_SETTINGS: EmailSettings = {
  emailNotifications: true,
  digestEmail: true,
  digestFrequency: "weekly",
  defaultReminders: [60, 30, 14, 7],
  includeContractDetails: true,
  includeRenewalLink: true,
  timezone: "America/New_York",
  criticalAlerts: true,
  expiringAlerts: true,
  weeklyDigest: true,
  marketingEmails: false,
}

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Shanghai", label: "Shanghai (CST)" },
]

const REMINDER_PRESETS = [
  { value: 90, label: "90 days" },
  { value: 60, label: "60 days" },
  { value: 30, label: "30 days" },
  { value: 14, label: "14 days" },
  { value: 7, label: "7 days" },
  { value: 3, label: "3 days" },
  { value: 1, label: "1 day" },
]

// ============================================
// Component
// ============================================
interface EmailSettingsPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EmailSettingsPanel({ open, onOpenChange }: EmailSettingsPanelProps) {
  const [settings, setSettings] = React.useState<EmailSettings>(DEFAULT_SETTINGS)
  const [hasChanges, setHasChanges] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)

  // Update a setting
  const updateSetting = <K extends keyof EmailSettings>(key: K, value: EmailSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  // Toggle a reminder day
  const toggleReminder = (day: number) => {
    const current = settings.defaultReminders
    if (current.includes(day)) {
      updateSetting("defaultReminders", current.filter(d => d !== day))
    } else {
      updateSetting("defaultReminders", [...current, day].sort((a, b) => b - a))
    }
  }

  // Save settings
  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800))
      toast.success("Settings saved", "Your email preferences have been updated.")
      setHasChanges(false)
    } catch (error) {
      toast.error("Failed to save", "Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <SlideOverPanel
      open={open}
      onOpenChange={onOpenChange}
      title="Email Settings"
      description="Configure your notification preferences"
      width="lg"
      footer={
        <>
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-sm font-medium text-white/60 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className={cn(
              "flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg transition-colors",
              hasChanges
                ? "bg-white text-black hover:bg-white/90"
                : "bg-white/10 text-white/40 cursor-not-allowed"
            )}
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </>
      }
    >
      <div className="space-y-8">
        {/* Master Toggle */}
        <div className="p-4 bg-[#06b6d4]/10 border border-[#06b6d4]/20 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#06b6d4]/20 flex items-center justify-center">
                <Mail className="w-5 h-5 text-[#06b6d4]" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Email Notifications</p>
                <p className="text-xs text-white/50">Master toggle for all email alerts</p>
              </div>
            </div>
            <Toggle
              checked={settings.emailNotifications}
              onChange={(checked) => updateSetting("emailNotifications", checked)}
            />
          </div>
        </div>

        {/* Reminder Schedule */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
              <Clock className="w-4 h-4 text-white/60" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-white">Default Reminder Schedule</h3>
              <p className="text-xs text-white/50">When to send renewal reminders</p>
            </div>
          </div>

          <div className="pl-11">
            <div className="flex flex-wrap gap-2">
              {REMINDER_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => toggleReminder(preset.value)}
                  className={cn(
                    "px-3 py-1.5 text-sm rounded-lg border transition-all duration-200",
                    settings.defaultReminders.includes(preset.value)
                      ? "bg-[#06b6d4]/20 border-[#06b6d4] text-[#06b6d4]"
                      : "bg-transparent border-white/10 text-white/60 hover:border-white/20"
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Timezone */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
              <Globe className="w-4 h-4 text-white/60" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-white">Timezone</h3>
              <p className="text-xs text-white/50">For scheduling email delivery</p>
            </div>
          </div>

          <div className="pl-11">
            <select
              value={settings.timezone}
              onChange={(e) => updateSetting("timezone", e.target.value)}
              className="w-full h-10 px-3 bg-[#0a0a0a] border border-white/10 rounded-lg text-sm text-white hover:border-white/20 focus:outline-none focus:border-[#06b6d4] focus:ring-2 focus:ring-[#06b6d4]/20 transition-all"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Notification Types */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
              <Bell className="w-4 h-4 text-white/60" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-white">Notification Types</h3>
              <p className="text-xs text-white/50">Choose what you want to be notified about</p>
            </div>
          </div>

          <div className="pl-11 space-y-3">
            <Toggle
              checked={settings.criticalAlerts}
              onChange={(checked) => updateSetting("criticalAlerts", checked)}
              label="Critical Alerts"
              description="Contracts expiring within 7 days"
            />

            <Toggle
              checked={settings.expiringAlerts}
              onChange={(checked) => updateSetting("expiringAlerts", checked)}
              label="Expiring Soon Alerts"
              description="Contracts expiring within 30 days"
            />

            <Toggle
              checked={settings.weeklyDigest}
              onChange={(checked) => updateSetting("weeklyDigest", checked)}
              label="Weekly Digest"
              description="Summary of all upcoming renewals"
            />

            <Toggle
              checked={settings.marketingEmails}
              onChange={(checked) => updateSetting("marketingEmails", checked)}
              label="Product Updates"
              description="New features and announcements"
            />
          </div>
        </div>

        {/* Email Content */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white/60" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-white">Email Content</h3>
              <p className="text-xs text-white/50">Customize what's included in emails</p>
            </div>
          </div>

          <div className="pl-11 space-y-3">
            <Toggle
              checked={settings.includeContractDetails}
              onChange={(checked) => updateSetting("includeContractDetails", checked)}
              label="Include Contract Details"
              description="Show vendor, value, and dates in emails"
            />

            <Toggle
              checked={settings.includeRenewalLink}
              onChange={(checked) => updateSetting("includeRenewalLink", checked)}
              label="Include Quick Actions"
              description="Add links to renew or edit contracts"
            />
          </div>
        </div>

        {/* Test Email */}
        <div className="pt-6 border-t border-white/10">
          <button
            type="button"
            className="flex items-center gap-2 text-sm text-[#06b6d4] hover:text-[#06b6d4]/80 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Send test email
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </SlideOverPanel>
  )
}
