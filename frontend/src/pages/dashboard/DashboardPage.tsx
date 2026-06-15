import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PlusCircle, FileText, Users, Grid3X3, Trash2, X } from 'lucide-react'
import TopNav from '../../components/navigation/TopNav'
import { useWorkspaceStore } from '../../store/workspaceStore'

function CreateWorkspaceModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, desc: string) => void }) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl w-full max-w-md p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-on-surface">New Research Lab</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-container-high transition-colors text-outline">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-mono font-medium text-on-surface-variant uppercase tracking-wider block mb-1.5">Workspace Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Market Analysis Q1 2025"
              className="w-full px-4 py-3 bg-white border border-outline-variant rounded-lg text-sm focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/10 transition-all placeholder:text-outline"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-mono font-medium text-on-surface-variant uppercase tracking-wider block mb-1.5">Description</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Brief description of your research focus..."
              rows={3}
              className="w-full px-4 py-3 bg-white border border-outline-variant rounded-lg text-sm focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/10 transition-all placeholder:text-outline resize-none"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 border border-outline-variant rounded-lg text-sm font-medium hover:bg-surface-container transition-colors">
            Cancel
          </button>
          <button
            onClick={() => { if (name.trim()) { onCreate(name, desc); onClose() } }}
            disabled={!name.trim()}
            className="flex-1 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-40"
          >
            Create Workspace
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { workspaces, addWorkspace, deleteWorkspace, fetchWorkspaces } = useWorkspaceStore()
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    fetchWorkspaces()
  }, [fetchWorkspaces])

  const handleCreate = (name: string, desc: string) => {
    addWorkspace({
      title: name,
      description: desc || 'New research workspace.',
      tag: 'Research',
      tagColor: 'text-secondary bg-secondary-fixed/30',
      files: 0,
      members: 1,
      updatedAt: 'just now',
    })
  }

  return (
    <div className="min-h-screen bg-surface font-sans">
      <TopNav activeTab="dashboard" />
      <main className="pt-20 pb-16 px-6 md:px-12 max-w-[1280px] mx-auto">
        {/* Header */}
        <section className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-on-surface tracking-tight mb-2">Workspace Central</h1>
            <p className="text-on-surface-variant max-w-xl text-sm leading-relaxed">
              Your cognitive engine for structured research. Synthesize complex data sources into actionable intelligence.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-primary text-on-primary px-5 py-3 rounded-xl text-sm font-semibold hover:bg-zinc-800 transition-all active:scale-95 shadow-md whitespace-nowrap"
          >
            <PlusCircle className="w-4 h-4" />
            Create Workspace
          </button>
        </section>

        {/* Workspaces */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold flex items-center gap-2 text-on-surface">
              <Grid3X3 className="w-4 h-4 text-secondary" />
              Recent Workspaces
            </h2>
            <button className="text-secondary text-sm font-medium hover:underline">View All</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {/* New card */}
            <div
              onClick={() => setShowModal(true)}
              className="border-2 border-dashed border-outline-variant rounded-xl p-6 flex flex-col items-center justify-center text-center gap-3 group hover:border-secondary hover:bg-secondary/5 transition-all cursor-pointer min-h-[200px]"
            >
              <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center group-hover:bg-secondary group-hover:text-white transition-colors">
                <PlusCircle className="w-5 h-5" />
              </div>
              <div>
                <span className="font-semibold text-sm block text-on-surface">New Research Lab</span>
                <span className="text-xs text-outline font-mono">Initialize a blank canvas</span>
              </div>
            </div>

            {workspaces.map((ws) => (
              <div
                key={ws.id}
                onClick={() => navigate(`/workspace/${ws.id}`)}
                className="tonal-card p-5 rounded-xl group cursor-pointer relative overflow-hidden"
              >
                <button
                  onClick={(e) => { e.stopPropagation(); deleteWorkspace(ws.id) }}
                  className="absolute top-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-error-container hover:text-error transition-all"
                  title="Delete workspace"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <div className="mb-3">
                  <span className={`text-[10px] font-mono font-medium uppercase tracking-wider px-2 py-0.5 rounded-sm ${ws.tagColor}`}>
                    {ws.tag}
                  </span>
                </div>
                <h3 className="font-semibold text-sm text-on-surface mb-1.5 group-hover:text-secondary transition-colors line-clamp-2 pr-4">
                  {ws.title}
                </h3>
                <p className="text-xs text-on-surface-variant mb-4 line-clamp-2 leading-relaxed">{ws.description}</p>
                <div className="flex items-center justify-between border-t border-outline-variant/30 pt-3">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-xs text-outline font-mono">
                      <FileText className="w-3 h-3" /> {ws.files}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-outline font-mono">
                      <Users className="w-3 h-3" /> {ws.members}
                    </span>
                  </div>
                  <span className="text-[11px] text-outline font-mono italic">Updated {ws.updatedAt}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {showModal && (
        <CreateWorkspaceModal onClose={() => setShowModal(false)} onCreate={handleCreate} />
      )}
    </div>
  )
}
