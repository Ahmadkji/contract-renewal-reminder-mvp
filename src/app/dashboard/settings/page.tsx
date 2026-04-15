'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bell, Save, Settings2, User } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'

interface ProfileState {
  full_name: string
  avatar_url: string
  timezone: string
  email_notifications: boolean
}

const TIMEZONE_OPTIONS = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Karachi',
  'Asia/Dubai',
]

function profileToState(profile: {
  full_name: string | null
  avatar_url: string | null
  timezone: string
  email_notifications: boolean
} | null): ProfileState {
  return {
    full_name: profile?.full_name || '',
    avatar_url: profile?.avatar_url || '',
    timezone: profile?.timezone || 'UTC',
    email_notifications: profile?.email_notifications ?? true,
  }
}

export default function SettingsPage() {
  const { user, profile, refreshSession } = useAuth()
  const [form, setForm] = useState<ProfileState>(() => profileToState(profile))
  const [saving, setSaving] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(true)

  useEffect(() => {
    setForm(profileToState(profile))
    setLoadingProfile(false)
  }, [profile])

  const timezoneOptions = useMemo(() => {
    const values = new Set(TIMEZONE_OPTIONS)
    if (form.timezone) {
      values.add(form.timezone)
    }
    return Array.from(values)
  }, [form.timezone])

  const updateField = <K extends keyof ProfileState>(field: K, value: ProfileState[K]) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)

    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          full_name: form.full_name.trim() || null,
          avatar_url: form.avatar_url.trim() || null,
          timezone: form.timezone,
          email_notifications: form.email_notifications,
        }),
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to save settings')
      }

      await refreshSession()
      toast({
        title: 'Settings saved',
        description: 'Your profile is now stored in Supabase.',
      })
    } catch (error) {
      toast({
        title: 'Failed to save settings',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loadingProfile) {
    return (
      <div className="max-w-5xl mx-auto p-6 text-sm text-[#a3a3a3]">
        Loading settings...
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-white/[0.08] bg-[#141414] p-6 lg:col-span-2">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-medium text-white">
            <User className="h-5 w-5" />
            Workspace profile
          </h2>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <Field label="Full Name">
              <input
                type="text"
                value={form.full_name}
                onChange={(event) => updateField('full_name', event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="Doc Renewal Team"
              />
            </Field>

            <Field label="Account Email">
              <input
                type="email"
                value={user?.email || ''}
                readOnly
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-300"
              />
            </Field>

            <Field label="Avatar URL">
              <input
                type="url"
                value={form.avatar_url}
                onChange={(event) => updateField('avatar_url', event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="https://example.com/avatar.png"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Timezone">
                <select
                  value={form.timezone}
                  onChange={(event) => updateField('timezone', event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  {timezoneOptions.map((timezone) => (
                    <option key={timezone} value={timezone}>
                      {timezone}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Email Notifications">
                <button
                  type="button"
                  onClick={() => updateField('email_notifications', !form.email_notifications)}
                  className={`flex h-12 w-full items-center justify-between rounded-lg border px-4 text-sm transition-colors ${
                    form.email_notifications
                      ? 'border-cyan-500/30 bg-cyan-500/10 text-white'
                      : 'border-slate-700 bg-slate-800/50 text-[#a3a3a3]'
                  }`}
                >
                  <span>{form.email_notifications ? 'Enabled' : 'Disabled'}</span>
                  <Bell className="h-4 w-4" />
                </button>
              </Field>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 text-sm font-medium text-white transition-colors hover:bg-cyan-500 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save settings'}
            </button>
          </form>
        </section>

        <section className="space-y-6">
          <div className="rounded-xl border border-white/[0.08] bg-[#141414] p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-medium text-white">
              <Settings2 className="h-5 w-5" />
              Account
            </h2>
            <p className="text-sm leading-6 text-[#a3a3a3]">
              Profile changes are written to Supabase and immediately used by the reminder processor.
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-[#141414] p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-medium text-white">
              <Bell className="h-5 w-5" />
              Reminder delivery
            </h2>
            <p className="text-sm leading-6 text-[#a3a3a3]">
              Email reminders respect your timezone and the email notification toggle in this profile row.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-white">{label}</span>
      {children}
    </label>
  )
}
