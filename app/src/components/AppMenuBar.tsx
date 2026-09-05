import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export type AppMenuItem =
  | {
      id: string
      type?: 'item'
      label: string
      hint?: string
      shortcut?: string
      icon?: LucideIcon
      disabled?: boolean
      onSelect: () => void
    }
  | { id: string; type: 'separator' }

export interface AppMenuGroup {
  id: string
  label: string
  items: AppMenuItem[]
}

interface AppMenuBarProps {
  menus: AppMenuGroup[]
  trailing?: ReactNode
}

export function AppMenuBar({ menus, trailing }: AppMenuBarProps) {
  const [openId, setOpenId] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!openId) return
    const onDocClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpenId(null)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenId(null)
    }
    document.addEventListener('mousedown', onDocClick)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [openId])

  return (
    <div className="app-menubar-wrap" ref={rootRef}>
      <nav className="app-menubar" aria-label="Application">
        {menus.map((menu) => {
          const open = openId === menu.id
          return (
            <div key={menu.id} className={`app-menu ${open ? 'open' : ''}`}>
              <button
                type="button"
                className={`app-menu-trigger ${open ? 'open' : ''}`}
                aria-haspopup="true"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : menu.id)}
                onMouseEnter={() => {
                  if (openId) setOpenId(menu.id)
                }}
              >
                {menu.label}
              </button>
              {open && (
                <div className="app-menu-dropdown" role="menu">
                  {menu.items.map((item) => {
                    if (item.type === 'separator') {
                      return <div key={item.id} className="app-menu-sep" role="separator" />
                    }
                    const Icon = item.icon
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="menuitem"
                        className="app-menu-item"
                        disabled={item.disabled}
                        onClick={() => {
                          if (item.disabled) return
                          setOpenId(null)
                          item.onSelect()
                        }}
                      >
                        <span className="app-menu-item-icon">{Icon ? <Icon size={15} /> : null}</span>
                        <span className="app-menu-item-text">
                          <strong>{item.label}</strong>
                          {item.hint && <em>{item.hint}</em>}
                        </span>
                        {item.shortcut && <kbd>{item.shortcut}</kbd>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>
      {trailing && <div className="app-menubar-trailing">{trailing}</div>}
    </div>
  )
}
