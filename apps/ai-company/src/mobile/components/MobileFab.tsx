type MobileFabProps = {
  label: string
  onClick: () => void
  icon?: React.ReactNode
}

export function MobileFab({ label, onClick, icon }: MobileFabProps) {
  return (
    <button type="button" className="acMobileFab" onClick={onClick} aria-label={label}>
      <span className="acMobileFabIcon" aria-hidden>
        {icon ?? (
          <svg viewBox="0 0 24 24" className="acMobileFabIconSvg">
            <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
      </span>
      <span className="acMobileFabLabel">{label}</span>
    </button>
  )
}
