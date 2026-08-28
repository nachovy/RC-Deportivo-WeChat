import { useRef, useState, type PointerEvent, type ReactNode } from 'react'

type Identifiable = { id: string }

type SortableListProps<T extends Identifiable> = {
  items: T[]
  onMove: (id: string, toIndex: number) => void
  renderItem: (item: T) => ReactNode
}

export function SortableList<T extends Identifiable>({
  items,
  onMove,
  renderItem,
}: SortableListProps<T>) {
  const listRef = useRef<HTMLUListElement>(null)
  const fromIndexRef = useRef(-1)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  function indexFromPoint(clientY: number) {
    const rows = listRef.current?.querySelectorAll<HTMLElement>('[data-sort-id]')
    if (!rows?.length) return -1
    for (let index = 0; index < rows.length; index += 1) {
      const rect = rows[index].getBoundingClientRect()
      if (clientY < rect.top + rect.height / 2) return index
    }
    return rows.length - 1
  }

  function startDrag(event: PointerEvent<HTMLButtonElement>, index: number) {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    fromIndexRef.current = index
    setActiveId(items[index]?.id ?? null)
    setOverIndex(index)
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    if (fromIndexRef.current < 0) return
    const nextIndex = indexFromPoint(event.clientY)
    if (nextIndex >= 0) setOverIndex(nextIndex)
  }

  function endDrag(event: PointerEvent<HTMLButtonElement>) {
    if (fromIndexRef.current < 0) return
    const fromIndex = fromIndexRef.current
    const toIndex = overIndex ?? indexFromPoint(event.clientY)
    const id = items[fromIndex]?.id
    if (id && toIndex >= 0 && toIndex !== fromIndex) onMove(id, toIndex)
    fromIndexRef.current = -1
    setActiveId(null)
    setOverIndex(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <ul ref={listRef} className="divide-y divide-slate-100">
      {items.map((item, index) => (
        <li
          key={item.id}
          data-sort-id={item.id}
          className={`flex items-start gap-2 py-3 ${
            activeId === item.id ? 'opacity-55' : ''
          } ${
            overIndex === index && activeId && activeId !== item.id
              ? 'border-t-2 border-[var(--club-blue)]'
              : ''
          }`}
        >
          <button
            type="button"
            aria-label="拖动排序"
            className="drag-handle mt-0.5 shrink-0 rounded px-1 py-2 text-slate-400"
            onPointerDown={(event) => startDrag(event, index)}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            ⋮⋮
          </button>
          <div className="min-w-0 flex-1">{renderItem(item)}</div>
        </li>
      ))}
    </ul>
  )
}
