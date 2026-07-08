import type { ReactNode } from 'react'

export type MobileActionSheetItem = {
  id: string
  label: string
  description?: string
  icon?: ReactNode
  destructive?: boolean
  disabled?: boolean
  onSelect: () => void
}

type MobileActionSheetProps = {
  items: MobileActionSheetItem[]
  footer?: ReactNode
}

export function MobileActionSheet({ items, footer }: MobileActionSheetProps) {
  return (
    <div className="acMobileActionSheet">
      <ul className="acMobileActionSheetList" role="menu">
        {items.map((item) => (
          <li key={item.id} role="none">
            <button
              type="button"
              role="menuitem"
              className={
                item.destructive
                  ? 'acMobileActionSheetItem acMobileActionSheetItemDestructive'
                  : 'acMobileActionSheetItem'
              }
              disabled={item.disabled}
              onClick={item.onSelect}
            >
              {item.icon ? <span className="acMobileActionSheetIcon">{item.icon}</span> : null}
              <span className="acMobileActionSheetText">
                <span className="acMobileActionSheetLabel">{item.label}</span>
                {item.description ? (
                  <span className="acMobileActionSheetDescription">{item.description}</span>
                ) : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {footer ? <div className="acMobileActionSheetFooter">{footer}</div> : null}
    </div>
  )
}
