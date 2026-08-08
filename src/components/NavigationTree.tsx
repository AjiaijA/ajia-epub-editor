import type { NavigationItem } from '../models/publication.js'

interface NavigationTreeProps {
  readonly activePath: string | null
  readonly availablePaths: ReadonlySet<string>
  readonly items: readonly NavigationItem[]
  readonly onSelect: (path: string) => void
}

export function NavigationTree({
  activePath,
  availablePaths,
  items,
  onSelect,
}: NavigationTreeProps) {
  return (
    <nav aria-label="书籍目录" className="navigation-tree">
      <TreeLevel
        activePath={activePath}
        availablePaths={availablePaths}
        items={items}
        level={1}
        onSelect={onSelect}
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
}: NavigationTreeProps & { readonly level: number }) {
  return (
    <ul
      aria-label={level === 1 ? '目录' : undefined}
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
                path !== null && path === activePath ? 'page' : undefined
              }
              className="toc-button"
              disabled={disabled}
              onClick={() => {
                if (path !== null) onSelect(path)
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
              />
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
