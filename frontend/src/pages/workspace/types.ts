import { ReactNode } from 'react'

export interface Message {
  id: string
  role: 'user' | 'ai'
  content: string
  citations?: Citation[]
}

export interface Citation {
  source_name?: string
  sourceName?: string
  filename?: string
  source_id?: string
  sourceId?: string
  page_number?: number
  page?: number
}

export interface StudioTool {
  category: string
  icon: ReactNode
  label: string
  type: string
}
