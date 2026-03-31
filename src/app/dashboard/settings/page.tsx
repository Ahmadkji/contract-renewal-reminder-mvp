'use client'

import { useState, useEffect } from 'react'
import { User, Bell, Shield, LogOut, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { updateProfileAction } from '@/actions/auth'
import { toast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'

export default function SettingsPage() {
  const { user, logout, loading: authLoading } = useAuth()
  const [userEmail, setUserEmail] = useState<string>('')
  const [fullName, setFullName] = useState<string>('')
  const [avatarUrl, setAvatarUrl] = useState<string>('')
  const [emailNotifications, setEmailNotifications] = useState<boolean>(true)
  const [timezone, setTimezone] = useState<string>('UTC')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Load user profile on mount
  useEffect(() => {
    if (authLoading) {
      return
    }

    const loadProfile = async () => {
      if (!user?.id) {
        setUserEmail('')
        setLoading(false)
        return
      }

      setLoading(true)
      const supabase = createClient()

      setUserEmail(user.email || '')
      setFullName(user.full_name || '')

      // Load profile from database
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('[Settings] Failed to load profile:', error)
        setLoading(false)
        return
      }

      if (profile) {
        setFullName(profile.full_name || '')
        setAvatarUrl(profile.avatar_url || '')
        setEmailNotifications(profile.email_notifications ?? true)
        setTimezone(profile.timezone || 'UTC')
      }

      setLoading(false)
    }
    
    void loadProfile()
  }, [authLoading, user?.email, user?.full_name, user?.id])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    
    const formData = new FormData()
    formData.append('fullName', fullName)
    formData.append('avatarUrl', avatarUrl)
    formData.append('emailNotifications', emailNotifications.toString())
    formData.append('timezone', timezone)
    
    const result = await updateProfileAction(formData)
    
    setSaving(false)
    
    if (result.success) {
      toast({
        title: 'Profile updated',
        description: 'Your profile has been successfully updated.',
      })
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to update profile',
        variant: 'destructive',
      })
    }
  }

  const handleLogout = async () => {
    await logout()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-semibold text-white mb-6">Settings</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Account Settings */}
        <div className="bg-[#141414] border border-white/[0.08] rounded-xl p-6">
          <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
            <User className="w-5 h-5" />
            Account
          </h2>
          
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[#a3a3a3] mb-2 block">Email</label>
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-white">
                <span className="text-sm">{userEmail}</span>
              </div>
            </div>
            
            <div>
              <label htmlFor="fullName" className="text-sm font-medium text-white mb-2 block">Full Name</label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="Enter your full name"
              />
            </div>
            
            <div>
              <label htmlFor="avatarUrl" className="text-sm font-medium text-white mb-2 block">Avatar URL</label>
              <input
                id="avatarUrl"
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="https://example.com/avatar.jpg"
              />
            </div>
            
            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 h-10 px-4 text-sm font-medium bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-all focus-ring disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
        
        {/* Notifications Settings */}
        <div className="bg-[#141414] border border-white/[0.08] rounded-xl p-6">
          <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notifications
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-white block">Email notifications</label>
                <p className="text-xs text-[#a3a3a3]">Receive email updates</p>
              </div>
              <button
                onClick={() => setEmailNotifications(!emailNotifications)}
                className={`w-12 h-6 rounded-full relative transition-colors ${
                  emailNotifications ? 'bg-cyan-600' : 'bg-slate-700'
                }`}
              >
                <input type="checkbox" checked={emailNotifications} className="sr-only" />
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    emailNotifications ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-3">
              <label className="text-sm font-medium text-white block">Reminder emails</label>
              <p className="text-xs text-[#a3a3a3] mt-1">
                Controlled per contract. If global email notifications are off, reminder delivery is skipped.
              </p>
            </div>
          </div>
        </div>
        
        {/* Security Settings */}
        <div className="bg-[#141414] border border-white/[0.08] rounded-xl p-6">
          <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Security
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-white block">Authentication</label>
              <p className="text-xs text-[#a3a3a3] mt-1">You are securely logged in</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-white block">Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full mt-2 bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
                <option value="Europe/London">London</option>
                <option value="Europe/Paris">Paris</option>
                <option value="Asia/Tokyo">Tokyo</option>
                <option value="Asia/Shanghai">Shanghai</option>
                <option value="Asia/Karachi">Karachi</option>
                <option value="Asia/Dubai">Dubai</option>
              </select>
            </div>
            
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 h-10 px-4 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-500 transition-all focus-ring"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
