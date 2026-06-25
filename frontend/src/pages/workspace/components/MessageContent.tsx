import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { Citation } from '../types'
import { Source } from '../../../api/workspace'
import { convertSourceCitations } from '../utils'

interface MessageContentProps {
  content: string
  isUser?: boolean
  citations?: Citation[]
  sources?: Source[]
}

export function MessageContent({ content, isUser, citations = [], sources = [] }: MessageContentProps) {
  if (isUser) {
    return <div className="whitespace-pre-wrap">{content}</div>
  }
  const html = DOMPurify.sanitize(marked.parse(convertSourceCitations(content, citations, sources)) as string)
  return <div className="prose-atlas max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
}
