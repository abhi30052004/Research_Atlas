import { escapeHtml } from './utils'

export function renderSlideDeckHtml(slides: any[]) {
  return `
    <div class="space-y-4">
      ${slides.map((slide, index) => `
        <section class="rounded-xl border border-outline-variant bg-white overflow-hidden shadow-sm">
          <div class="flex items-start gap-4 bg-violet-50 px-5 py-4 border-b border-violet-100">
            <div class="w-11 h-11 rounded-lg bg-violet-600 text-white flex items-center justify-center font-bold text-sm">${escapeHtml(slide.slide_number || index + 1)}</div>
            <div class="flex-1 min-w-0">
              <p class="text-[11px] font-semibold uppercase text-violet-700">${escapeHtml(slide.slide_type || 'slide')}</p>
              <h3 class="text-lg font-bold text-on-surface mt-1">${escapeHtml(slide.title || `Slide ${index + 1}`)}</h3>
            </div>
          </div>
          <div class="grid gap-5 md:grid-cols-[1fr_1.1fr] p-5">
            <div>
              <p class="text-xs font-semibold text-on-surface mb-2">Slide Content</p>
              <ul class="space-y-2">
                ${(slide.bullets || []).map((bullet: string) => `<li class="flex gap-2 text-sm text-on-surface-variant"><span class="mt-2 w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0"></span><span>${escapeHtml(bullet)}</span></li>`).join('')}
              </ul>
            </div>
            <div class="rounded-lg bg-surface-container-low p-4">
              <p class="text-xs font-semibold text-on-surface mb-2">Speaker Notes</p>
              <p class="text-sm leading-relaxed text-on-surface-variant">${escapeHtml(slide.speaker_notes || '')}</p>
              ${slide.source_reference ? `<p class="mt-3 text-[11px] font-mono text-outline">Source: ${escapeHtml(slide.source_reference)}</p>` : ''}
            </div>
          </div>
        </section>
      `).join('')}
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
