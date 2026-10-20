import type { ButtonHTMLAttributes, ReactNode } from 'react'

type TicketActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: 'primary' | 'ghost'
}

export function TicketActionButton(props: TicketActionButtonProps) {
  const { variant = 'primary', className, type = 'button', children, ...rest } = props
  const merged = [variant === 'ghost' ? 'ghost' : '', className].filter(Boolean).join(' ')
  return (
    <button type={type} className={merged || undefined} {...rest}>
      {children}
    </button>
  )
}
