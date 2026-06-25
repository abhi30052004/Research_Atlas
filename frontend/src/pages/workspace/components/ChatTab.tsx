import React from 'react'
import { Copy, Check, ThumbsUp, RefreshCw, Paperclip, Send } from 'lucide-react'
import { Message } from '../types'
import { Source } from '../../../api/workspace'
import { MessageContent } from './MessageContent'
import { SUGGESTED } from '../constants'

interface ChatTabProps {
  messages: Message[]
  sources: Source[]
  selectedReadySources: Source[]
  readySources: Source[]
  isTyping: boolean
  canChat: boolean
  input: string
  setInput: (val: string) => void
  sendMessage: (text?: string) => Promise<void>
  copyMessage: (msg: Message) => void
  copiedId: string | null
  likeMessage: (msgId: string) => void
  likedIds: string[]
  regenerateMessage: (msgId: string) => Promise<void>
  messagesEndRef: React.RefObject<HTMLDivElement>
}

export function ChatTab({
  messages,
  sources,
  selectedReadySources,
  readySources,
  isTyping,
  canChat,
  input,
  setInput,
  sendMessage,
  copyMessage,
  copiedId,
  likeMessage,
  likedIds,
  regenerateMessage,
  messagesEndRef,
}: ChatTabProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''} max-w-3xl ${msg.role === 'user' ? 'ml-auto' : ''}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${msg.role === 'ai' ? 'bg-primary' : 'bg-secondary'}`}>
              {msg.role === 'ai' ? (
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              ) : (
                <span className="text-white text-xs font-bold">U</span>
              )}
            </div>
            <div className="space-y-2">
              <div className={`p-4 rounded-xl text-sm leading-relaxed ${msg.role === 'ai' ? 'bg-surface-container-low border border-outline-variant rounded-tl-none' : 'bg-secondary-container text-on-secondary-container rounded-tr-none'}`}>
                <MessageContent content={msg.content} isUser={msg.role === 'user'} citations={msg.citations} sources={sources} />
              </div>
              {msg.role === 'ai' && (
                <div className="flex gap-1.5">
                  <button
                    onClick={() => copyMessage(msg)}
                    className={`px-3 py-1.5 border rounded-full text-xs transition-colors flex items-center gap-1 ${copiedId === msg.id
                      ? 'border-green-400 bg-green-50 text-green-600'
                      : 'border-outline-variant hover:bg-surface-container'
                      }`}
                  >
                    {copiedId === msg.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedId === msg.id ? 'Copied!' : 'Copy'}
                  </button>
                  <button
                    onClick={() => likeMessage(msg.id)}
                    className={`px-2.5 py-1.5 border rounded-full text-xs transition-colors ${likedIds.includes(msg.id)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-outline-variant hover:bg-surface-container'
                      }`}
                  >
                    <ThumbsUp className={`w-3 h-3 ${likedIds.includes(msg.id) ? 'fill-primary' : ''}`} />
                  </button>
                  <button
                    onClick={() => regenerateMessage(msg.id)}
                    disabled={!canChat}
                    className="px-3 py-1.5 border border-outline-variant rounded-full text-xs hover:bg-surface-container transition-colors flex items-center gap-1 disabled:opacity-45 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className="w-3 h-3" /> Regenerate
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-3 max-w-3xl">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl rounded-tl-none flex items-center gap-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className="w-2 h-2 bg-outline rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-6 pb-5 bg-surface-container-lowest border-t border-outline-variant pt-3 flex-shrink-0">
        <div className="mb-2 flex items-center justify-between text-[11px] text-on-surface-variant">
          <span>
            {selectedReadySources.length > 0
              ? `Using ${selectedReadySources.length} of ${readySources.length} ready sources`
              : readySources.length > 0
                ? 'No ready sources selected'
                : 'No ready sources available'}
          </span>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3">
          {SUGGESTED.map((s) => (
            <button
              key={s}
              onClick={() => sendMessage(s.slice(1, -1))}
              disabled={!canChat}
              className="whitespace-nowrap px-3 py-1.5 bg-surface-container border border-outline-variant rounded-full text-xs hover:bg-surface-container-high transition-all disabled:opacity-45 disabled:cursor-not-allowed"
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2 bg-surface border border-outline-variant shadow-sm p-2 rounded-xl focus-within:border-secondary focus-within:ring-2 focus-within:ring-secondary/10 transition-all">
          <button className="p-2 text-outline hover:text-secondary transition-colors">
            <Paperclip className="w-4 h-4" />
          </button>
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            placeholder={canChat ? 'Ask Atlas anything about your selected sources...' : 'Select a ready source to chat...'}
            disabled={!canChat}
            className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 focus:border-transparent resize-none py-2 text-sm placeholder:text-outline-variant disabled:cursor-not-allowed disabled:opacity-60"
            style={{ maxHeight: '120px' }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || !canChat}
            className="bg-primary text-white p-2 rounded-lg hover:bg-zinc-800 transition-all disabled:opacity-40 active:scale-95"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
