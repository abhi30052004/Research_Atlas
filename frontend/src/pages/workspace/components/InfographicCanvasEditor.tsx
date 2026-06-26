import { useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Rect, Text, Image as KonvaImage, Transformer } from 'react-konva'
import type Konva from 'konva'
import { Download, FileImage, RefreshCw, Sparkles } from 'lucide-react'
import { createVisualAsset, editVisualBlock } from '../../../api/workspace'
import {
  InfographicDocument,
  InfographicElement,
  createEnrichedInfographicDocument,
  renderInfographicHtml,
} from '../utils'

type InfographicCanvasEditorProps = {
  document: InfographicDocument
  onChange: (doc: InfographicDocument) => void
  onSave: (doc: InfographicDocument) => void
}

function useImage(url: string) {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    if (!url) {
      setImg(null)
      return
    }
    const image = new window.Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => setImg(image)
    image.onerror = () => setImg(null)
    image.src = url
  }, [url])
  return img
}

type CanvasElementProps = {
  element: InfographicElement
  onSelect: () => void
  onDragEnd: (x: number, y: number) => void
  onTransformEnd: (payload: { x: number; y: number; width: number; height: number; rotation: number }) => void
  onRef: (node: Konva.Node | null) => void
}

function CanvasElement({ element, onSelect, onDragEnd, onTransformEnd, onRef }: CanvasElementProps) {
  const img = useImage(element.imageUrl || '')
  const common = {
    x: element.x,
    y: element.y,
    rotation: element.rotation || 0,
    draggable: true,
    onClick: onSelect,
    onTap: onSelect,
    onDragEnd: (evt: any) => onDragEnd(evt.target.x(), evt.target.y()),
    onTransformEnd: (evt: any) => {
      const node = evt.target
      const scaleX = node.scaleX()
      const scaleY = node.scaleY()
      node.scaleX(1)
      node.scaleY(1)
      onTransformEnd({
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        width: Math.max(40, node.width() * scaleX),
        height: Math.max(24, node.height() * scaleY),
      })
    },
    ref: onRef,
  }

  if (element.type === 'image' && img) {
    return <KonvaImage {...common} image={img} width={element.width} height={element.height} />
  }

  return (
    <Text
      {...common}
      text={element.text || element.title || ''}
      width={element.width}
      height={element.height}
      fontSize={element.fontSize || 20}
      fontStyle={element.fontStyle || 'normal'}
      fill={element.fill || '#111827'}
      align={element.align || 'left'}
      verticalAlign="middle"
      padding={6}
    />
  )
}

function normalizeBounds(el: InfographicElement): InfographicElement {
  return {
    ...el,
    width: Math.max(40, el.width),
    height: Math.max(24, el.height),
  }
}

export function InfographicCanvasEditor({ document, onChange, onSave }: InfographicCanvasEditorProps) {
  const stageRef = useRef<Konva.Stage | null>(null)
  const transformerRef = useRef<Konva.Transformer | null>(null)
  const nodeMapRef = useRef<Map<string, Konva.Node>>(new Map())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [blockPrompt, setBlockPrompt] = useState('')
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const selectedElement = useMemo(
    () => document.elements.find((el) => el.id === selectedId) || null,
    [document.elements, selectedId]
  )

  useEffect(() => {
    if (!transformerRef.current) return
    if (!selectedId) {
      transformerRef.current.nodes([])
      transformerRef.current.getLayer()?.batchDraw()
      return
    }
    const node = nodeMapRef.current.get(selectedId)
    transformerRef.current.nodes(node ? [node] : [])
    transformerRef.current.getLayer()?.batchDraw()
  }, [selectedId, document.elements])

  const setElement = (id: string, updates: Partial<InfographicElement>) => {
    onChange({
      ...document,
      elements: document.elements.map((el) => (el.id === id ? normalizeBounds({ ...el, ...updates }) : el)),
    })
  }

  const applySelectedBlockEdit = async () => {
    if (!selectedElement || !blockPrompt.trim()) return
    setBusyAction('edit')
    setActionError(null)
    try {
      const response = await editVisualBlock({
        artifact_type: 'infographic_content',
        block: selectedElement as unknown as Record<string, unknown>,
        instruction: blockPrompt,
      })
      setElement(selectedElement.id, {
        ...(response.block as Partial<InfographicElement>),
        id: selectedElement.id,
      })
      setBlockPrompt('')
    } catch (error: any) {
      setActionError(error?.response?.data?.detail || error?.message || 'AI block edit failed.')
    } finally {
      setBusyAction(null)
    }
  }

  const applySelectedImageAsset = async (mode: 'search' | 'generate') => {
    if (!selectedElement) return
    const visualText = selectedElement.title || selectedElement.text || selectedElement.icon || document.title
    setBusyAction(mode)
    setActionError(null)
    try {
      const asset = await createVisualAsset({
        mode,
        query: visualText,
        prompt: visualText,
      })
      setElement(selectedElement.id, {
        type: 'image',
        imageUrl: asset.image_url,
        text: '',
        title: selectedElement.title || visualText,
      })
    } catch (error: any) {
      setActionError(error?.response?.data?.detail || error?.message || 'Visual asset request failed.')
    } finally {
      setBusyAction(null)
    }
  }

  const setLayout = (preset: 'stack' | 'two_col' | 'hero') => {
    const next = { ...document }
    if (preset === 'stack') {
      next.elements = next.elements.map((el, i) => ({ ...el, x: 40, y: 40 + i * 110 }))
    } else if (preset === 'two_col') {
      next.elements = next.elements.map((el, i) => ({ ...el, x: i % 2 === 0 ? 40 : 430, y: 40 + Math.floor(i / 2) * 130 }))
    } else {
      next.elements = next.elements.map((el, i) => {
        if (i === 0) return { ...el, x: 40, y: 30, width: 760, height: 90 }
        return { ...el, x: i % 2 === 1 ? 40 : 430, y: 150 + Math.floor((i - 1) / 2) * 125 }
      })
    }
    onChange(next)
  }

  const exportPng = () => {
    if (!stageRef.current) return
    const uri = stageRef.current.toDataURL({ pixelRatio: 2 })
    const a = window.document.createElement('a')
    a.href = uri
    a.download = `${document.title || 'infographic'}.png`
    window.document.body.appendChild(a)
    a.click()
    window.document.body.removeChild(a)
  }

  const exportPdf = () => {
    if (!stageRef.current) return
    const uri = stageRef.current.toDataURL({ pixelRatio: 2 })
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(`
      <!doctype html><html><head><title>${document.title || 'Infographic'}</title>
      <style>body{margin:0;padding:24px;font-family:Arial,sans-serif;background:#fff}img{max-width:100%;height:auto;display:block;margin:0 auto}</style>
      </head><body><img src="${uri}" alt="infographic"/></body></html>
    `)
    printWindow.document.close()
    setTimeout(() => printWindow.print(), 300)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3 flex flex-wrap gap-2 items-center">
        <button onClick={() => setLayout('stack')} className="px-3 py-1.5 text-xs rounded-lg border border-outline-variant bg-white">Stack</button>
        <button onClick={() => setLayout('two_col')} className="px-3 py-1.5 text-xs rounded-lg border border-outline-variant bg-white">Two Col</button>
        <button onClick={() => setLayout('hero')} className="px-3 py-1.5 text-xs rounded-lg border border-outline-variant bg-white">Hero</button>
        <button
          onClick={() => onChange(createEnrichedInfographicDocument(document))}
          className="px-3 py-1.5 text-xs rounded-lg border border-outline-variant bg-white inline-flex items-center gap-1"
        >
          <Sparkles className="w-3.5 h-3.5" /> Auto Enhance
        </button>
        <div className="flex-1" />
        <button onClick={exportPng} className="px-3 py-1.5 text-xs rounded-lg border border-outline-variant bg-white inline-flex items-center gap-1">
          <FileImage className="w-3.5 h-3.5" /> PNG
        </button>
        <button onClick={exportPdf} className="px-3 py-1.5 text-xs rounded-lg border border-outline-variant bg-white inline-flex items-center gap-1">
          <Download className="w-3.5 h-3.5" /> PDF
        </button>
        <button onClick={() => onSave(document)} className="px-3 py-1.5 text-xs rounded-lg bg-secondary text-white">Save</button>
      </div>

      {selectedElement && (
        <div className="rounded-xl border border-outline-variant p-3 space-y-3">
          <div className="grid gap-2 md:grid-cols-2">
          <input
            value={selectedElement.text || ''}
            onChange={(e) => setElement(selectedElement.id, { text: e.target.value })}
            placeholder="Edit text"
            className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm"
          />
          <input
            value={selectedElement.imageUrl || ''}
            onChange={(e) => setElement(selectedElement.id, { imageUrl: e.target.value })}
            placeholder="Replace image/icon URL"
            className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm"
          />
          </div>
          <div className="rounded-lg border border-secondary/15 bg-secondary/5 p-3">
            <p className="mb-2 text-xs font-semibold text-on-surface">Selected block AI tools</p>
            <div className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
              <input
                value={blockPrompt}
                onChange={(e) => setBlockPrompt(e.target.value)}
                placeholder="Ask AI to edit this selected block only..."
                className="w-full rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={applySelectedBlockEdit}
                disabled={busyAction === 'edit' || !blockPrompt.trim()}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
              >
                {busyAction === 'edit' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Edit Block
              </button>
              <button
                type="button"
                onClick={() => applySelectedImageAsset('search')}
                disabled={busyAction === 'search'}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-outline-variant bg-white px-3 py-2 text-xs font-medium text-on-surface-variant disabled:opacity-50"
              >
                {busyAction === 'search' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
                Unsplash Image
              </button>
              <button
                type="button"
                onClick={() => applySelectedImageAsset('generate')}
                disabled={busyAction === 'generate'}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-outline-variant bg-white px-3 py-2 text-xs font-medium text-on-surface-variant disabled:opacity-50"
              >
                {busyAction === 'generate' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
                AI Generate
              </button>
            </div>
            {actionError && <p className="mt-2 text-xs font-medium text-red-600">{actionError}</p>}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-outline-variant overflow-hidden bg-white">
        <Stage
          width={document.width}
          height={document.height}
          ref={(r) => { stageRef.current = r }}
          onMouseDown={(e) => {
            if (e.target === e.target.getStage()) setSelectedId(null)
          }}
        >
          <Layer>
            <Rect x={0} y={0} width={document.width} height={document.height} fill={document.background || '#f8fafc'} />
            {document.elements.map((el) => {
              return (
                <CanvasElement
                  key={el.id}
                  element={el}
                  onSelect={() => setSelectedId(el.id)}
                  onDragEnd={(x, y) => setElement(el.id, { x, y })}
                  onTransformEnd={(payload) => setElement(el.id, payload)}
                  onRef={(node) => {
                    if (node) nodeMapRef.current.set(el.id, node)
                    else nodeMapRef.current.delete(el.id)
                  }}
                />
              )
            })}
            <Transformer
              ref={(r) => { transformerRef.current = r }}
              rotateEnabled
              enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right']}
              boundBoxFunc={(_, nextBox) => (nextBox.width < 30 || nextBox.height < 20 ? _ : nextBox)}
            />
          </Layer>
        </Stage>
      </div>

      <div className="rounded-xl border border-outline-variant p-3">
        <p className="text-xs font-semibold mb-2 text-on-surface-variant">Rendered Preview</p>
        <div className="prose-atlas max-w-none" dangerouslySetInnerHTML={{ __html: renderInfographicHtml(document) }} />
      </div>
    </div>
  )
}
