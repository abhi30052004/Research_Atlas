import { escapeHtml } from './utils'

function safeHex(value: unknown, fallback: string) {
  const color = String(value || '').trim()
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback
}

function actualImageUrlForSlide(slide: any) {
  if (slide.image_url) return String(slide.image_url)
  if (slide.imageUrl) return String(slide.imageUrl)
  return ''
}

function slideVisualLabel(slide: any) {
  return String(slide.image_search_query || slide.image_prompt || slide.title || 'Slide visual direction').trim()
}

function renderSlideVisual(slide: any, primary: string, accent: string) {
  const imageUrl = actualImageUrlForSlide(slide)
  const label = slideVisualLabel(slide)
  if (imageUrl) {
    return `
      <figure class="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low shadow-sm">
        <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(slide.image_alt || label || 'Slide visual')}" class="h-56 w-full object-cover bg-surface-container-low" loading="eager" referrerpolicy="no-referrer" />
        <figcaption class="space-y-1 px-3 py-2 text-[11px] text-on-surface-variant">
          ${slide.image_search_query ? `<p><span class="font-bold text-on-surface">Image search:</span> ${escapeHtml(slide.image_search_query)}</p>` : ''}
          ${slide.image_prompt ? `<p><span class="font-bold text-on-surface">AI image prompt:</span> ${escapeHtml(slide.image_prompt)}</p>` : ''}
          <p><span class="font-bold text-on-surface">Image:</span> attached visual asset</p>
        </figcaption>
      </figure>
    `
  }

  return `
    <figure class="relative overflow-hidden rounded-xl border border-outline-variant shadow-sm">
      <div class="h-56 p-5 text-white" style="background:radial-gradient(circle at 82% 18%, rgba(255,255,255,.24), transparent 28%), radial-gradient(circle at 12% 92%, rgba(255,255,255,.16), transparent 32%), linear-gradient(135deg, ${primary}, ${accent})">
        <div class="absolute inset-0 opacity-20" style="background-image:linear-gradient(90deg, rgba(255,255,255,.28) 1px, transparent 1px), linear-gradient(rgba(255,255,255,.28) 1px, transparent 1px); background-size:28px 28px"></div>
        <div class="relative flex h-full flex-col justify-between">
          <p class="text-[11px] font-bold uppercase tracking-[0.24em] text-white/75">Visual Direction</p>
          <div>
            <p class="max-w-sm text-2xl font-black leading-tight">${escapeHtml(label)}</p>
            <p class="mt-2 text-xs text-white/75">Click Unsplash Image in the editor to attach a live photo.</p>
          </div>
        </div>
      </div>
      <figcaption class="space-y-1 bg-white px-3 py-2 text-[11px] text-on-surface-variant">
        ${slide.image_search_query ? `<p><span class="font-bold text-on-surface">Image search:</span> ${escapeHtml(slide.image_search_query)}</p>` : ''}
        ${slide.image_prompt ? `<p><span class="font-bold text-on-surface">AI image prompt:</span> ${escapeHtml(slide.image_prompt)}</p>` : ''}
      </figcaption>
    </figure>
  `
}

function renderSlideChart(slide: any, accent: string) {
  const data = slide.chart_data
  const labels = Array.isArray(data?.labels) ? data.labels : []
  const values = Array.isArray(data?.values) ? data.values : []
  const numericValues = values.map((value: unknown) => Number(value)).filter((value: number) => Number.isFinite(value))
  if (!labels.length || !numericValues.length) return ''

  const max = Math.max(...numericValues, 1)
  return `
    <div class="rounded-lg border border-outline-variant bg-white p-3">
      <div class="mb-3">
        <p class="text-[11px] font-bold uppercase text-outline">Chart</p>
        <h4 class="text-sm font-bold text-on-surface">${escapeHtml(data.title || slide.chart_type || 'Slide data')}</h4>
      </div>
      <div class="space-y-2.5">
        ${numericValues.map((value: number, index: number) => {
          const width = Math.max(8, Math.round((value / max) * 100))
          return `
            <div>
              <div class="mb-1 flex items-center justify-between gap-3 text-[11px]">
                <span class="font-medium text-on-surface-variant">${escapeHtml(labels[index] || `Item ${index + 1}`)}</span>
                <span class="font-bold text-on-surface">${escapeHtml(value)}${escapeHtml(data.unit || '')}</span>
              </div>
              <div class="h-2.5 overflow-hidden rounded-full bg-surface-container-high">
                <div class="h-full rounded-full" style="width:${width}%;background:${accent}"></div>
              </div>
            </div>
          `
        }).join('')}
      </div>
      ${data.insight ? `<p class="mt-3 text-xs leading-relaxed text-on-surface-variant">${escapeHtml(data.insight)}</p>` : ''}
    </div>
  `
}

function renderSlideTable(slide: any) {
  const columns = Array.isArray(slide.table?.columns) ? slide.table.columns : []
  const rows = Array.isArray(slide.table?.rows) ? slide.table.rows : []
  if (!columns.length || !rows.length) return ''

  return `
    <div class="overflow-hidden rounded-lg border border-outline-variant bg-white">
      <table class="min-w-full text-xs">
        <thead class="bg-surface-container-low">
          <tr>
            ${columns.map((column: string) => `<th class="px-3 py-2 text-left font-bold text-on-surface">${escapeHtml(column)}</th>`).join('')}
          </tr>
        </thead>
        <tbody class="divide-y divide-outline-variant">
          ${rows.map((row: string[]) => `
            <tr>
              ${columns.map((_column: string, index: number) => `<td class="px-3 py-2 text-on-surface-variant">${escapeHtml(row[index] || '')}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderSlideTimeline(slide: any, accent: string) {
  const timeline = Array.isArray(slide.timeline) ? slide.timeline : []
  if (!timeline.length) return ''

  return `
    <div class="rounded-lg border border-outline-variant bg-white p-3">
      <p class="mb-3 text-[11px] font-bold uppercase text-outline">Timeline</p>
      <div class="space-y-3">
        ${timeline.map((item: any) => `
          <div class="grid grid-cols-[84px_1fr] gap-3">
            <div class="text-[11px] font-bold text-on-surface" style="color:${accent}">${escapeHtml(item.date || 'Phase')}</div>
            <div class="relative border-l pl-3" style="border-color:${accent}">
              <span class="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full" style="background:${accent}"></span>
              <p class="text-sm font-semibold text-on-surface">${escapeHtml(item.label || '')}</p>
              ${item.description ? `<p class="mt-1 text-xs leading-relaxed text-on-surface-variant">${escapeHtml(item.description)}</p>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `
}

function renderSlideDiagram(slide: any, primary: string) {
  const diagram = slide.diagram
  const nodes = Array.isArray(diagram?.nodes) ? diagram.nodes : []
  if (!nodes.length) return ''

  return `
    <div class="rounded-lg border border-outline-variant bg-white p-3">
      <div class="mb-3 flex items-center justify-between gap-3">
        <p class="text-[11px] font-bold uppercase text-outline">Diagram</p>
        ${diagram.type ? `<span class="rounded-full bg-surface-container-low px-2 py-1 text-[11px] font-semibold text-on-surface-variant">${escapeHtml(diagram.type)}</span>` : ''}
      </div>
      <div class="grid gap-2" style="grid-template-columns:repeat(${Math.min(Math.max(nodes.length, 2), 4)},minmax(0,1fr))">
        ${nodes.map((node: string, index: number) => `
          <div class="rounded-lg border bg-surface-container-low p-3 text-center">
            <div class="mx-auto mb-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white" style="background:${primary}">${index + 1}</div>
            <p class="text-xs font-semibold text-on-surface">${escapeHtml(node)}</p>
            ${Array.isArray(diagram.relationships) && diagram.relationships[index] ? `<p class="mt-1 text-[11px] text-on-surface-variant">${escapeHtml(diagram.relationships[index])}</p>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `
}

export function renderSlideDeckHtml(slides: any[], doc: any = {}) {
  const theme = doc.color_theme || {}
  const primary = safeHex(theme.primary, '#4338CA')
  const accent = safeHex(theme.accent, '#0F766E')
  const background = safeHex(theme.background, '#F8FAFC')

  return `
    <div class="space-y-5">
      <section class="overflow-hidden rounded-2xl border border-outline-variant bg-white shadow-sm">
        <div class="h-2" style="background:linear-gradient(90deg, ${primary}, ${accent})"></div>
        <div class="p-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="text-[11px] font-bold uppercase tracking-[0.22em] text-outline">Slide Deck Studio</p>
            <h2 class="mt-2 text-2xl font-black leading-tight text-on-surface">${escapeHtml(doc.deck_title || 'Generated Slide Deck')}</h2>
            <p class="mt-2 max-w-2xl text-sm leading-relaxed text-on-surface-variant">Professional presentation package with visuals, notes, charts, and structured slide blocks.</p>
          </div>
          <div class="flex flex-wrap gap-2 text-[11px]">
            ${doc.template ? `<span class="rounded-full bg-surface-container-low px-2.5 py-1 font-semibold text-on-surface-variant">Template: ${escapeHtml(doc.template)}</span>` : ''}
            ${theme.name ? `<span class="rounded-full bg-surface-container-low px-2.5 py-1 font-semibold text-on-surface-variant">Theme: ${escapeHtml(theme.name)}</span>` : ''}
            <span class="inline-flex items-center gap-1 rounded-full bg-surface-container-low px-2.5 py-1 font-semibold text-on-surface-variant">
              <span class="h-2.5 w-2.5 rounded-full" style="background:${primary}"></span>
              <span class="h-2.5 w-2.5 rounded-full" style="background:${accent}"></span>
              Palette
            </span>
          </div>
        </div>
        </div>
      </section>
      ${slides.map((slide, index) => {
        return `
        <section class="overflow-hidden rounded-2xl border border-outline-variant bg-white shadow-sm" style="background:linear-gradient(135deg, #fff 0%, ${background} 100%)">
          <div class="flex items-start gap-4 px-5 py-4 border-b border-outline-variant" style="background:linear-gradient(90deg, ${primary}18, ${accent}10)">
            <div class="w-12 h-12 rounded-xl text-white flex items-center justify-center font-black text-sm shadow-sm" style="background:linear-gradient(135deg, ${primary}, ${accent})">${escapeHtml(slide.slide_number || index + 1)}</div>
            <div class="flex-1 min-w-0">
              <div class="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase">
                <span style="color:${primary}">${escapeHtml(slide.slide_type || 'slide')}</span>
                ${slide.layout ? `<span class="rounded-full bg-white/80 px-2 py-0.5 text-outline">${escapeHtml(slide.layout)}</span>` : ''}
                ${slide.icon ? `<span class="rounded-full bg-white/80 px-2 py-0.5 text-outline">Icon: ${escapeHtml(slide.icon)}</span>` : ''}
              </div>
              <h3 class="text-xl font-black text-on-surface mt-1">${escapeHtml(slide.title || `Slide ${index + 1}`)}</h3>
              ${slide.subtitle ? `<p class="text-sm text-on-surface-variant mt-1">${escapeHtml(slide.subtitle)}</p>` : ''}
            </div>
          </div>
          <div class="grid gap-5 md:grid-cols-[1.05fr_1fr] p-5">
            <div class="rounded-xl border border-outline-variant bg-white/80 p-4">
              <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-outline mb-3">Slide Content</p>
              <ul class="space-y-2">
                ${(slide.bullets || []).map((bullet: string) => `<li class="flex gap-2 text-sm leading-relaxed text-on-surface-variant"><span class="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0" style="background:${accent}"></span><span>${escapeHtml(bullet)}</span></li>`).join('')}
              </ul>
              <div class="mt-4 space-y-3">
                ${renderSlideChart(slide, accent)}
                ${renderSlideTable(slide)}
                ${renderSlideTimeline(slide, accent)}
                ${renderSlideDiagram(slide, primary)}
              </div>
            </div>
            <div class="space-y-3">
              ${renderSlideVisual(slide, primary, accent)}
              <div class="rounded-xl border border-outline-variant bg-white/80 p-4">
              <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-outline mb-2">Speaker Notes</p>
              <p class="text-sm leading-relaxed text-on-surface-variant">${escapeHtml(slide.speaker_notes || '')}</p>
              ${(slide.icon || slide.chart_type || slide.image_prompt || slide.table || slide.timeline || slide.diagram) ? `
                <div class="mt-3 flex flex-wrap gap-2 text-[11px]">
                  ${slide.icon ? `<span class="rounded-full bg-violet-100 text-violet-700 px-2 py-1">Icon: ${escapeHtml(slide.icon)}</span>` : ''}
                  ${slide.chart_type ? `<span class="rounded-full bg-blue-100 text-blue-700 px-2 py-1">Chart: ${escapeHtml(slide.chart_type)}</span>` : ''}
                  ${slide.table ? `<span class="rounded-full bg-amber-100 text-amber-700 px-2 py-1">Table</span>` : ''}
                  ${slide.timeline ? `<span class="rounded-full bg-cyan-100 text-cyan-700 px-2 py-1">Timeline</span>` : ''}
                  ${slide.diagram ? `<span class="rounded-full bg-rose-100 text-rose-700 px-2 py-1">Diagram</span>` : ''}
                  ${slide.image_prompt ? `<span class="rounded-full bg-emerald-100 text-emerald-700 px-2 py-1">Image: ${escapeHtml(slide.image_prompt)}</span>` : ''}
                </div>
              ` : ''}
              ${slide.source_reference ? `<p class="mt-3 text-[11px] font-mono text-outline">Source: ${escapeHtml(slide.source_reference)}</p>` : ''}
              </div>
            </div>
          </div>
        </section>
      `}).join('')}
    </div>
  `
}

export function renderFlashcardsHtml(cards: any[]) {
  return `
    <div class="flashcard-grid">
      ${cards.map((card, index) => `
        <section class="flashcard-item">
          <input class="flashcard-toggle" type="checkbox" id="flashcard-${index}" />
          <label class="flashcard-shell" for="flashcard-${index}">
            <div class="flashcard-inner">
              <div class="flashcard-face flashcard-front">
                <div class="flex items-center justify-between gap-3 mb-4">
                  <span class="text-[11px] font-bold uppercase text-amber-700">Card ${escapeHtml(card.id || index + 1)}</span>
                  <span class="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-700 border border-amber-200">${escapeHtml(card.category || 'Study')}</span>
                </div>
                <p class="text-xs font-semibold text-outline mb-2">Front</p>
                <h3 class="text-base font-bold text-on-surface leading-snug">${escapeHtml(card.front || '')}</h3>
                ${card.source ? `<p class="mt-auto pt-4 text-[11px] font-mono text-outline">Source: ${escapeHtml(card.source)}</p>` : ''}
              </div>
              <div class="flashcard-face flashcard-back">
                <div class="flex items-center justify-between gap-3 mb-4">
                  <span class="text-[11px] font-bold uppercase text-amber-700">Card ${escapeHtml(card.id || index + 1)}</span>
                  <span class="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 border border-amber-200">${escapeHtml(card.card_type || 'answer')}</span>
                </div>
                <p class="text-xs font-semibold text-outline mb-2">Back</p>
                <p class="text-sm leading-relaxed text-on-surface-variant">${escapeHtml(card.back || '')}</p>
                ${card.source ? `<p class="mt-auto pt-4 text-[11px] font-mono text-outline">Source: ${escapeHtml(card.source)}</p>` : ''}
              </div>
            </div>
          </label>
        </section>
      `).join('')}
    </div>
  `
}

export function renderQuizHtml(questions: any[]) {
  return `
    <div class="space-y-4">
      ${questions.map((question, index) => {
        const correct = question.correct_answer
        const options = question.options || {}
        return `
          <section class="rounded-xl border border-outline-variant bg-white p-5 shadow-sm">
            <div class="flex flex-wrap items-center gap-2 mb-4">
              <span class="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">${escapeHtml(question.id || index + 1)}</span>
              <span class="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">${escapeHtml(question.difficulty || 'medium')}</span>
            </div>
            <h3 class="text-base font-bold text-on-surface mb-4">${escapeHtml(question.question || '')}</h3>
            <div class="grid gap-2 md:grid-cols-2">
              ${Object.entries(options).map(([key, value]) => `
                <div class="rounded-lg border px-3 py-2.5 text-sm ${key === correct ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-outline-variant bg-surface-container-low text-on-surface-variant'}">
                  <span class="font-bold mr-2">${escapeHtml(key)}.</span>${escapeHtml(value)}
                </div>
              `).join('')}
            </div>
            <div class="mt-4 rounded-lg bg-surface-container-low p-4">
              <p class="text-xs font-semibold text-on-surface mb-1">Answer: ${escapeHtml(correct)}</p>
              <p class="text-sm leading-relaxed text-on-surface-variant">${escapeHtml(question.explanation || '')}</p>
              ${question.source ? `<p class="mt-2 text-[11px] font-mono text-outline">Source: ${escapeHtml(question.source)}</p>` : ''}
            </div>
          </section>
        `
      }).join('')}
    </div>
  `
}

export function renderDataTableHtml(rows: any[]) {
  const columns = ['metric', 'value', 'unit', 'context', 'source']
  const hasRows = rows.length > 0
  return `
    <div class="overflow-hidden rounded-xl border border-outline-variant bg-white shadow-sm">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-outline-variant text-sm">
          <thead class="bg-surface-container-low">
            <tr>
              ${columns.map((column) => `
                <th class="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-on-surface">
                  ${escapeHtml(column.replace(/_/g, ' '))}
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody class="divide-y divide-outline-variant bg-white">
            ${hasRows ? rows.map((row) => `
              <tr class="align-top hover:bg-surface-container-lowest">
                <td class="px-4 py-3 font-semibold text-on-surface">${escapeHtml(row.metric || '')}</td>
                <td class="px-4 py-3 text-on-surface-variant">${escapeHtml(row.value || '')}</td>
                <td class="px-4 py-3 text-on-surface-variant">${escapeHtml(row.unit || '')}</td>
                <td class="px-4 py-3 min-w-[260px] text-on-surface-variant">${escapeHtml(row.context || '')}</td>
                <td class="px-4 py-3 whitespace-nowrap">${row.source ? `<span class="source-cite">${escapeHtml(row.source)}</span>` : ''}</td>
              </tr>
            `).join('') : `
              <tr>
                <td colspan="${columns.length}" class="px-4 py-6 text-center text-sm text-on-surface-variant">
                  No table rows were generated from the selected sources.
                </td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </div>
  `
}

export function renderMindMapHtml(map: any) {
  const branches = Array.isArray(map?.branches) ? map.branches : []
  return `
    <div class="space-y-5">
      <div class="rounded-xl border border-outline-variant bg-surface-container-low px-5 py-4">
        <p class="text-[11px] font-bold uppercase tracking-wide text-outline">Central Topic</p>
        <h2 class="mt-1 text-xl font-bold text-on-surface">${escapeHtml(map?.topic || 'Mind Map')}</h2>
      </div>
      <div class="grid gap-4 md:grid-cols-2">
        ${branches.map((branch: any, branchIndex: number) => {
          const color = /^#[0-9a-f]{6}$/i.test(String(branch.color || '')) ? branch.color : '#4F46E5'
          const children = Array.isArray(branch.children) ? branch.children : []
          return `
            <section class="rounded-xl border border-outline-variant bg-white p-4 shadow-sm">
              <div class="mb-4 flex items-center gap-3">
                <span class="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white" style="background:${escapeHtml(color)}">${branchIndex + 1}</span>
                <h3 class="text-base font-bold text-on-surface">${escapeHtml(branch.name || `Branch ${branchIndex + 1}`)}</h3>
              </div>
              <div class="space-y-3">
                ${children.map((child: any) => {
                  const grandchildren = Array.isArray(child.children) ? child.children : []
                  return `
                    <div class="rounded-lg bg-surface-container-low p-3">
                      <p class="text-sm font-semibold text-on-surface">${escapeHtml(child.name || '')}</p>
                      ${grandchildren.length ? `
                        <ul class="mt-2 space-y-1.5">
                          ${grandchildren.map((item: any) => `
                            <li class="flex gap-2 text-sm text-on-surface-variant">
                              <span class="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full" style="background:${escapeHtml(color)}"></span>
                              <span>${escapeHtml(item.name || '')}</span>
                            </li>
                          `).join('')}
                        </ul>
                      ` : ''}
                    </div>
                  `
                }).join('')}
              </div>
            </section>
          `
        }).join('')}
      </div>
    </div>
  `
}
