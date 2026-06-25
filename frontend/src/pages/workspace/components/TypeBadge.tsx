import { Source } from '../../../api/workspace'

export function TypeBadge({ type }: { type: Source['type'] }) {
  const colors: Record<Source['type'], string> = {
    PDF: 'text-red-600 bg-red-50',
    WEB: 'text-blue-600 bg-blue-50',
    DOCX: 'text-indigo-600 bg-indigo-50',
    TXT: 'text-zinc-600 bg-zinc-50',
    CSV: 'text-emerald-600 bg-emerald-50',
    XLSX: 'text-green-600 bg-green-50',
    PPTX: 'text-orange-600 bg-orange-50',
  }
  return <span className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded ${colors[type]}`}>{type}</span>
}
