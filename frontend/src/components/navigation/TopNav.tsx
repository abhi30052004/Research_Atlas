import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bell,
  Settings,
  Search,
  LogOut,
  X,
  User,
  Zap,
  Sun,
  Moon,
  Monitor,
  Check,
  BellRing,
  Bot,
  FileText,
  MessageSquare,
  Layers,
  KeyRound,
  Eye,
  EyeOff,
  AlertTriangle,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useUIStore, type Notification as NotifType, type ThemeOption } from '../../store/uiStore'

interface TopNavProps {
  activeTab?: 'studio' | 'dashboard'
}

type SettingsTab = 'appearance' | 'notifications' | 'ai-limits'

/* ─── Helper: relative time ─── */
function timeAgo(date: Date | string): string {
  const d = new Date(date)
  if (isNaN(d.getTime())) return 'recently'
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  if (diffMs < 0) return 'just now'
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hr ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

/* ─── Notification icon ─── */
function NotifIcon({ type }: { type: NotifType['icon'] }) {
  const base = 'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0'
  switch (type) {
    case 'artifact':
      return <span className={`${base} bg-secondary/10`}><Zap className="w-4 h-4 text-secondary" /></span>
    case 'source':
      return <span className={`${base} bg-blue-50`}><FileText className="w-4 h-4 text-blue-600" /></span>
    case 'chat':
      return <span className={`${base} bg-green-50`}><MessageSquare className="w-4 h-4 text-green-600" /></span>
    case 'workspace':
      return <span className={`${base} bg-amber-50`}><Layers className="w-4 h-4 text-amber-600" /></span>
    default:
      return <span className={`${base} bg-surface-container`}><Bell className="w-4 h-4 text-outline" /></span>
  }
}

export default function TopNav({ activeTab = 'dashboard' }: TopNavProps) {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const {
    notifications,
    markAllNotificationsRead,
    markNotificationRead,
    aiCalls,
    aiDailyLimit,
    setAIDailyLimit,
    addToast,
    theme, setTheme,
    liveStreaming, setLiveStreaming,
    autoSave, setAutoSave,
    emailNotifications, setEmailNotifications,
    pushNotifications, setPushNotifications,
    weeklyDigest, setWeeklyDigest,
  } = useUIStore()

  // Dropdowns
  const [profileOpen, setProfileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  // Edit profile modal
  const [editProfileOpen, setEditProfileOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editUsername, setEditUsername] = useState('')
  const [showPasswordSection, setShowPasswordSection] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [profileSaved, setProfileSaved] = useState(false)

  // Settings modal
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('appearance')

  // AI limit editing
  const [editingLimit, setEditingLimit] = useState(false)
  const [tempLimit, setTempLimit] = useState(aiDailyLimit)

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const initials = user?.name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) ?? 'U'
  const displayName = user?.name || 'User'
  const displayEmail = user?.email || 'user@atlas.com'

  // Today's AI usage
  const today = new Date()
  const todayCalls = aiCalls.filter((c) => {
    const d = new Date(c.timestamp)
    return d.getFullYear() === today.getFullYear()
      && d.getMonth() === today.getMonth()
      && d.getDate() === today.getDate()
  })
  const aiCallsToday = todayCalls.length

  // Unread notification count
  const unreadCount = notifications.filter((n) => !n.read).length

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Init edit profile fields
  const openEditProfile = () => {
    setEditName(user?.name || '')
    setEditUsername(user?.email?.split('@')[0] || '')
    setShowPasswordSection(false)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordError('')
    setProfileSaved(false)
    setProfileOpen(false)
    setEditProfileOpen(true)
  }

  const handleSaveProfile = () => {
    if (showPasswordSection) {
      if (!currentPassword) {
        setPasswordError('Please enter your current password')
        return
      }
      if (newPassword.length < 8) {
        setPasswordError('New password must be at least 8 characters')
        return
      }
      if (newPassword !== confirmPassword) {
        setPasswordError('Passwords do not match')
        return
      }
      // Verify current password (mock check)
      if (currentPassword !== 'password') {
        setPasswordError('Current password is incorrect')
        return
      }
    }
    setPasswordError('')
    // Save profile changes
    const authStore = useAuthStore.getState()
    if (authStore.user) {
      authStore.login({ ...authStore.user, name: editName }, authStore.token || '')
    }
    setProfileSaved(true)
    addToast('Profile updated successfully', 'success')
    setTimeout(() => setEditProfileOpen(false), 800)
  }

  const handleSaveLimit = () => {
    const clamped = Math.max(1, Math.min(100, tempLimit))
    setAIDailyLimit(clamped)
    setEditingLimit(false)
    addToast(`AI daily limit updated to ${clamped} calls`, 'success')
  }

  return (
    <>
      <header className="bg-surface-container-lowest border-b border-outline-variant fixed top-0 w-full z-50 h-14">
        <div className="flex items-center justify-between w-full px-6 h-full max-w-[1400px] mx-auto">
          {/* Logo + Nav */}
          <div className="flex items-center gap-8">
            <Link to="/dashboard" className="flex items-center gap-2">
              <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <span className="font-bold text-on-surface tracking-tight">Atlas</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              <Link to="/workspace/1" className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${activeTab === 'studio' ? 'text-primary border-b-2 border-primary rounded-none pb-[13px]' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'}`}>
                Studio
              </Link>
              <Link to="/dashboard" className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${activeTab === 'dashboard' ? 'text-primary border-b-2 border-primary rounded-none pb-[13px]' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'}`}>
                Dashboard
              </Link>
            </nav>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-sm mx-8 hidden sm:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
              <input type="text" placeholder="Search workspace..." className="w-full pl-9 pr-4 py-1.5 bg-surface-container-low border border-outline-variant rounded-lg text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary/20 transition-all placeholder:text-outline" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">

            {/* ═══ Notification Bell ═══ */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false) }}
                className="p-2 text-on-surface-variant hover:bg-surface-container-high rounded-lg transition-colors relative"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-secondary text-white text-[9px] font-bold rounded-full flex items-center justify-center">{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-11 w-96 bg-white rounded-xl shadow-xl border border-outline-variant overflow-hidden z-50" style={{ animation: 'fadeIn 0.2s ease-out' }}>
                  {/* Header */}
                  <div className="flex items-center justify-between px-5 py-3 border-b border-outline-variant">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-on-surface">Notifications</h3>
                      {unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 bg-secondary text-white text-[10px] font-bold rounded-full">{unreadCount}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button onClick={markAllNotificationsRead} className="text-xs text-secondary font-medium hover:underline">Mark all read</button>
                      )}
                      <button onClick={() => setNotifOpen(false)} className="p-1 text-on-surface-variant hover:text-on-surface rounded transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Notification list */}
                  <div className="max-h-80 overflow-y-auto custom-scrollbar">
                    {notifications.length === 0 ? (
                      <div className="py-10 text-center">
                        <Bell className="w-6 h-6 text-outline mx-auto mb-2" />
                        <p className="text-sm text-on-surface-variant">No notifications yet</p>
                      </div>
                    ) : (
                      notifications.slice(0, 10).map((n) => (
                        <div
                          key={n.id}
                          onClick={() => markNotificationRead(n.id)}
                          className={`flex items-start gap-3 px-5 py-3 border-b border-outline-variant last:border-b-0 cursor-pointer hover:bg-surface-container-low transition-colors ${!n.read ? 'bg-secondary/[0.03]' : ''}`}
                        >
                          <NotifIcon type={n.icon} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-on-surface">{n.title}</p>
                            <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-1">{n.description}</p>
                            <p className="text-[11px] text-outline mt-1">{timeAgo(n.time)}</p>
                          </div>
                          {!n.read && <span className="w-2 h-2 bg-secondary rounded-full mt-2 flex-shrink-0" />}
                        </div>
                      ))
                    )}
                  </div>

                  {notifications.length > 0 && (
                    <div className="border-t border-outline-variant py-2.5 text-center">
                      <button className="text-xs text-secondary font-medium hover:underline">View all activity</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Settings */}
            <button onClick={() => setSettingsOpen(true)} className="p-2 text-on-surface-variant hover:bg-surface-container-high rounded-lg transition-colors">
              <Settings className="w-4 h-4" />
            </button>

            {/* ═══ Profile Avatar + Dropdown ═══ */}
            <div className="relative ml-1" ref={profileRef}>
              <button
                onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false) }}
                className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-white text-xs font-semibold hover:ring-2 hover:ring-secondary/30 transition-all"
              >
                {initials}
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-11 w-80 bg-white rounded-xl shadow-xl border border-outline-variant overflow-hidden z-50" style={{ animation: 'fadeIn 0.2s ease-out' }}>
                  {/* User info */}
                  <div className="flex items-center gap-3 px-5 py-4 border-b border-outline-variant">
                    <div className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center text-white text-base font-bold flex-shrink-0">{initials}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-on-surface truncate">{displayName}</p>
                      <p className="text-xs text-on-surface-variant truncate">{displayEmail}</p>
                    </div>
                  </div>

                  {/* AI Usage */}
                  <div className="px-5 py-3 border-b border-outline-variant">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-on-surface-variant">
                        <Bot className="w-3.5 h-3.5" /> OpenAI calls today
                      </span>
                      <span className="text-xs font-bold text-on-surface">{aiCallsToday} / {aiDailyLimit}</span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant">{Math.max(0, aiDailyLimit - aiCallsToday)} calls remaining</p>
                    <div className="flex gap-2 mt-2.5">
                      <div className="flex-1 bg-surface-container rounded-lg py-2 text-center">
                        <p className="text-lg font-bold text-secondary">{aiCallsToday}</p>
                        <p className="text-[10px] text-on-surface-variant mt-0.5">AI calls today</p>
                      </div>
                      <div className="flex-1 bg-surface-container rounded-lg py-2 text-center">
                        <p className="text-lg font-bold text-on-surface">{Math.max(0, aiDailyLimit - aiCallsToday)}</p>
                        <p className="text-[10px] text-on-surface-variant mt-0.5">Remaining</p>
                      </div>
                    </div>
                  </div>

                  {/* Menu */}
                  <div className="py-2">
                    <button onClick={openEditProfile} className="w-full flex items-center gap-3 px-5 py-2.5 text-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors">
                      <User className="w-4 h-4" /> Edit profile
                    </button>
                  </div>
                  <div className="border-t border-outline-variant py-2">
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-5 py-2.5 text-sm text-on-surface-variant hover:bg-red-50 hover:text-error transition-colors">
                      <LogOut className="w-4 h-4" /> Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ═══════════ Edit Profile Modal ═══════════ */}
      {editProfileOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setEditProfileOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl border border-outline-variant w-full max-w-md overflow-hidden" style={{ animation: 'fadeIn 0.2s ease-out' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
              <h2 className="text-base font-bold text-on-surface">Edit Profile</h2>
              <button onClick={() => setEditProfileOpen(false)} className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Avatar */}
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center text-white text-xl font-bold">{initials}</div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary/20 transition-all"
                  placeholder="Your full name"
                />
              </div>

              {/* Username */}
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Username</label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary/20 transition-all"
                  placeholder="username"
                />
              </div>

              {/* Change password toggle */}
              <div>
                <button
                  onClick={() => setShowPasswordSection(!showPasswordSection)}
                  className="flex items-center gap-2 text-sm text-secondary font-medium hover:underline"
                >
                  <KeyRound className="w-4 h-4" />
                  {showPasswordSection ? 'Cancel password change' : 'Change password'}
                </button>
              </div>

              {showPasswordSection && (
                <div className="space-y-3 p-4 bg-surface-container-low rounded-xl border border-outline-variant">
                  {/* Current password */}
                  <div>
                    <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Current Password</label>
                    <div className="relative">
                      <input
                        type={showCurrentPw ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => { setCurrentPassword(e.target.value); setPasswordError('') }}
                        className="w-full px-3 py-2.5 pr-10 bg-white border border-outline-variant rounded-lg text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary/20 transition-all"
                        placeholder="Enter current password"
                      />
                      <button onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface-variant">
                        {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* New password */}
                  <div>
                    <label className="block text-xs font-medium text-on-surface-variant mb-1.5">New Password</label>
                    <div className="relative">
                      <input
                        type={showNewPw ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => { setNewPassword(e.target.value); setPasswordError('') }}
                        className="w-full px-3 py-2.5 pr-10 bg-white border border-outline-variant rounded-lg text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary/20 transition-all"
                        placeholder="Min 8 characters"
                      />
                      <button onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface-variant">
                        {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm password */}
                  <div>
                    <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError('') }}
                      className="w-full px-3 py-2.5 bg-white border border-outline-variant rounded-lg text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary/20 transition-all"
                      placeholder="Re-enter new password"
                    />
                  </div>

                  {passwordError && (
                    <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg">
                      <AlertTriangle className="w-3.5 h-3.5 text-error flex-shrink-0" />
                      <p className="text-xs text-error">{passwordError}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-outline-variant flex items-center justify-between">
              <button onClick={() => setEditProfileOpen(false)} className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={profileSaved}
                className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${profileSaved
                    ? 'bg-green-500 text-white'
                    : 'bg-secondary text-white hover:bg-indigo-600'
                  }`}
              >
                {profileSaved ? '✓ Saved' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ Settings Modal ═══════════ */}
      {settingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSettingsOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl border border-outline-variant w-full max-w-2xl max-h-[80vh] flex overflow-hidden" style={{ animation: 'fadeIn 0.2s ease-out' }}>
            {/* Sidebar */}
            <div className="w-48 bg-surface-container-low border-r border-outline-variant py-6 px-3 flex-shrink-0">
              <div className="flex items-center gap-2 px-3 mb-6">
                <Settings className="w-4 h-4 text-on-surface" />
                <h2 className="text-sm font-bold text-on-surface">Settings</h2>
              </div>
              <nav className="space-y-0.5">
                {([
                  { id: 'appearance' as SettingsTab, icon: <Sun className="w-4 h-4" />, label: 'Appearance' },
                  { id: 'notifications' as SettingsTab, icon: <BellRing className="w-4 h-4" />, label: 'Notifications' },

                  { id: 'ai-limits' as SettingsTab, icon: <Bot className="w-4 h-4" />, label: 'AI Limits' },
                ]).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSettingsTab(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${settingsTab === item.id ? 'bg-secondary/10 text-secondary' : 'text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'
                      }`}
                  >
                    <span className={settingsTab === item.id ? 'text-secondary' : 'text-outline'}>{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <button onClick={() => setSettingsOpen(false)} className="absolute top-4 right-4 p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>

              <div className="flex-1 overflow-y-auto px-8 py-8">
                {/* ─── Appearance ─── */}
                {settingsTab === 'appearance' && (
                  <div>
                    <h3 className="text-lg font-bold text-on-surface mb-1">Theme</h3>
                    <p className="text-sm text-on-surface-variant mb-5">Choose how Atlas looks to you.</p>
                    <div className="flex gap-3 mb-8">
                      {([
                        { value: 'light' as ThemeOption, icon: <Sun className="w-6 h-6" />, label: 'Light' },
                        { value: 'dark' as ThemeOption, icon: <Moon className="w-6 h-6" />, label: 'Dark' },
                        { value: 'system' as ThemeOption, icon: <Monitor className="w-6 h-6" />, label: 'System' },
                      ]).map((opt) => (
                        <button key={opt.value} onClick={() => setTheme(opt.value)} className={`flex-1 flex flex-col items-center gap-2 py-5 rounded-xl border-2 transition-all ${theme === opt.value ? 'border-secondary bg-secondary/5 text-secondary' : 'border-outline-variant text-on-surface-variant hover:border-outline hover:bg-surface-container'}`}>
                          <span className={theme === opt.value ? 'text-secondary' : 'text-outline'}>{opt.icon}</span>
                          <span className="text-sm font-medium">{opt.label}</span>
                          {theme === opt.value && <Check className="w-4 h-4 text-secondary" />}
                        </button>
                      ))}
                    </div>
                    <h3 className="text-base font-bold text-on-surface mb-4">Chat & Editor</h3>
                    <div className="space-y-3">
                      <ToggleSetting title="Live streaming" description="See AI responses token-by-token" checked={liveStreaming} onChange={setLiveStreaming} />
                      <ToggleSetting title="Auto-save notes" description="Save notes automatically as you type" checked={autoSave} onChange={setAutoSave} />
                    </div>
                  </div>
                )}

                {/* ─── Notifications ─── */}
                {settingsTab === 'notifications' && (
                  <div>
                    <h3 className="text-lg font-bold text-on-surface mb-1">Notifications</h3>
                    <p className="text-sm text-on-surface-variant mb-5">Choose how you want to be notified.</p>
                    <div className="space-y-3">
                      <ToggleSetting title="Email notifications" description="Receive updates about your research via email" checked={emailNotifications} onChange={setEmailNotifications} />
                      <ToggleSetting title="Push notifications" description="Get browser push notifications for important events" checked={pushNotifications} onChange={setPushNotifications} />
                      <ToggleSetting title="Weekly digest" description="Receive a weekly summary of your research activity" checked={weeklyDigest} onChange={setWeeklyDigest} />
                    </div>
                  </div>
                )}


                {/* ─── AI Limits ─── */}
                {settingsTab === 'ai-limits' && (
                  <div>
                    <h3 className="text-lg font-bold text-on-surface mb-1">AI Limits</h3>
                    <p className="text-sm text-on-surface-variant mb-5">Monitor and manage your AI usage.</p>

                    <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant mb-5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-on-surface">Daily API calls</span>
                        <span className="text-sm font-bold text-on-surface">{aiCallsToday} / {aiDailyLimit}</span>
                      </div>
                      <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden mb-2">
                        <div className={`h-full rounded-full transition-all ${aiCallsToday >= aiDailyLimit ? 'bg-error' : 'bg-secondary'}`} style={{ width: `${Math.min(100, (aiCallsToday / aiDailyLimit) * 100)}%` }} />
                      </div>
                      <p className="text-xs text-on-surface-variant">Resets daily at midnight UTC</p>
                      {aiCallsToday >= aiDailyLimit && (
                        <div className="mt-2 flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                          <AlertTriangle className="w-3.5 h-3.5 text-error flex-shrink-0" />
                          <p className="text-xs text-error font-medium">Daily limit reached! Increase your limit or upgrade your plan.</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      {/* Daily limit setting */}
                      <div className="flex items-center justify-between p-4 bg-surface-container-lowest border border-outline-variant rounded-xl">
                        <div>
                          <p className="text-sm font-medium text-on-surface">Daily call limit</p>
                          <p className="text-xs text-on-surface-variant mt-0.5">Get a toast alert when limit is reached</p>
                        </div>
                        {editingLimit ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={tempLimit}
                              onChange={(e) => setTempLimit(parseInt(e.target.value) || 1)}
                              min={1}
                              max={100}
                              className="w-16 px-2 py-1.5 border border-outline-variant rounded-lg text-sm text-center focus:outline-none focus:border-secondary"
                            />
                            <button onClick={handleSaveLimit} className="px-3 py-1.5 bg-secondary text-white rounded-lg text-xs font-medium hover:bg-indigo-600 transition-colors">Save</button>
                            <button onClick={() => setEditingLimit(false)} className="px-2 py-1.5 text-xs text-on-surface-variant hover:text-on-surface">Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => { setTempLimit(aiDailyLimit); setEditingLimit(true) }} className="px-3 py-1.5 border border-outline-variant rounded-lg text-xs font-medium text-on-surface-variant hover:bg-surface-container-high transition-colors">
                            {aiDailyLimit} calls • Edit
                          </button>
                        )}
                      </div>

                      {/* <div className="flex items-center justify-between p-4 bg-surface-container-lowest border border-outline-variant rounded-xl">
                        <div>
                          <p className="text-sm font-medium text-on-surface">Default model</p>
                          <p className="text-xs text-on-surface-variant mt-0.5">GPT-4o</p>
                        </div>
                        <button className="px-3 py-1.5 border border-outline-variant rounded-lg text-xs font-medium text-on-surface-variant hover:bg-surface-container-high transition-colors">Change</button>
                      </div> */}
                      {/* 
                      <div className="flex items-center justify-between p-4 bg-surface-container-lowest border border-outline-variant rounded-xl">
                        <div>
                          <p className="text-sm font-medium text-on-surface">Plan</p>
                          <p className="text-xs text-on-surface-variant mt-0.5">Free — {aiDailyLimit} calls/day</p>
                        </div>
                        <button className="px-3 py-1.5 bg-secondary text-white rounded-lg text-xs font-medium hover:bg-indigo-600 transition-colors">Upgrade</button>
                      </div> */}
                    </div>
                  </div>
                )}
              </div>

              <div className="px-8 py-4 border-t border-outline-variant flex justify-end flex-shrink-0">
                <button onClick={() => setSettingsOpen(false)} className="px-6 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors">
                  Save changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ Toast Notifications ═══════════ */}
      <ToastContainer />
    </>
  )
}

/* ─── Toggle Switch ─── */
function ToggleSetting({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (val: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-4 bg-surface-container-lowest border border-outline-variant rounded-xl">
      <div>
        <p className="text-sm font-medium text-on-surface">{title}</p>
        <p className="text-xs text-on-surface-variant mt-0.5">{description}</p>
      </div>
      <button onClick={() => onChange(!checked)} className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-secondary' : 'bg-outline-variant'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  )
}

/* ─── Toast Container (renders all active toasts) ─── */
function ToastContainer() {
  const { toasts, removeToast } = useUIStore()

  useEffect(() => {
    toasts.forEach((t) => {
      const timer = setTimeout(() => removeToast(t.id), 4000)
      return () => clearTimeout(timer)
    })
  }, [toasts, removeToast])

  if (toasts.length === 0) return null

  const iconMap = {
    success: <Check className="w-4 h-4" />,
    error: <AlertTriangle className="w-4 h-4" />,
    warning: <AlertTriangle className="w-4 h-4" />,
    info: <Bell className="w-4 h-4" />,
  }
  const colorMap = {
    success: 'bg-green-50 border-green-300 text-green-800',
    error: 'bg-red-50 border-red-300 text-red-800',
    warning: 'bg-amber-50 border-amber-300 text-amber-800',
    info: 'bg-blue-50 border-blue-300 text-blue-800',
  }

  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2.5" style={{ maxWidth: '380px' }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg ${colorMap[t.type]} text-sm font-medium`}
          style={{ animation: 'fadeIn 0.3s ease-out' }}
        >
          {iconMap[t.type]}
          <span className="flex-1">{t.message}</span>
          <button onClick={() => removeToast(t.id)} className="p-0.5 opacity-60 hover:opacity-100 transition-opacity">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
