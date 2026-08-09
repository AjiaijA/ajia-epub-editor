import type { NavigationItem } from '../models/publication.js'
import { useI18n } from '../i18n.js'

interface NavigationTreeProps {
  readonly activePath: string | null
  readonly availablePaths: ReadonlySet<string>
  readonly items: readonly NavigationItem[]
  readonly onSelect: (path: string, item: NavigationItem) => void
  readonly selectedItemId: string | null
}

export function NavigationTree({
  activePath,
  availablePaths,
  items,
  onSelect,
  selectedItemId,
}: NavigationTreeProps) {
  const { text } = useI18n()
  const treeLabel = text('Contents', '目录')
  return (
    <nav
      aria-label={text('Book table of contents', '书籍目录')}
      className="navigation-tree"
    >
      <TreeLevel
        activePath={activePath}
        availablePaths={availablePaths}
        items={items}
        level={1}
        onSelect={onSelect}
        selectedItemId={selectedItemId}
        treeLabel={treeLabel}
      />
    </nav>
  )
}

function TreeLevel({
  activePath,
  availablePaths,
  items,
  level,
  onSelect,
  selectedItemId,
  treeLabel,
}: NavigationTreeProps & {
  readonly level: number
  readonly treeLabel: string
}) {
  return (
    <ul
      aria-label={level === 1 ? treeLabel : undefined}
      role={level === 1 ? 'tree' : 'group'}
    >
      {items.map((item) => {
        const path = item.normalizedTarget?.split('#')[0] ?? null
        const disabled = path === null || !availablePaths.has(path)
        return (
          <li
            aria-expanded={item.children.length > 0 ? true : undefined}
            key={item.id}
            role="treeitem"
          >
            <button
              aria-current={
                path !== null &&
                path === activePath &&
                item.id === selectedItemId
                  ? 'page'
                  : undefined
              }
              className="toc-button"
              disabled={disabled}
              onClick={() => {
                if (path !== null) onSelect(path, item)
              }}
              style={{ '--tree-level': level } as React.CSSProperties}
              type="button"
            >
              <span>{item.label}</span>
              {item.children.length > 0 ? (
                <span aria-hidden="true">⌄</span>
              ) : null}
            </button>
            {item.children.length > 0 ? (
              <TreeLevel
                activePath={activePath}
                availablePaths={availablePaths}
                items={item.children}
                level={level + 1}
                onSelect={onSelect}
                selectedItemId={selectedItemId}
                treeLabel={treeLabel}
              />
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
