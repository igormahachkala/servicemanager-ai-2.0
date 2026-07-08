type MobileLoadingSkeletonProps = {
  variant?: 'card' | 'list' | 'page'
  rows?: number
}

export function MobileLoadingSkeleton({ variant = 'card', rows = 3 }: MobileLoadingSkeletonProps) {
  if (variant === 'page') {
    return (
      <div className="acMobileSkeletonPage" aria-busy="true">
        <div className="acMobileSkeletonBlock acMobileSkeletonHero" />
        <div className="acMobileSkeletonBlock acMobileSkeletonLine acMobileSkeletonLineWide" />
        <div className="acMobileSkeletonBlock acMobileSkeletonLine" />
        <div className="acMobileSkeletonGrid">
          {Array.from({ length: rows }, (_, index) => (
            <div key={index} className="acMobileSkeletonBlock acMobileSkeletonCard" />
          ))}
        </div>
      </div>
    )
  }

  if (variant === 'list') {
    return (
      <div className="acMobileSkeletonList" aria-busy="true">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="acMobileSkeletonListRow">
            <div className="acMobileSkeletonBlock acMobileSkeletonAvatar" />
            <div className="acMobileSkeletonListText">
              <div className="acMobileSkeletonBlock acMobileSkeletonLine acMobileSkeletonLineWide" />
              <div className="acMobileSkeletonBlock acMobileSkeletonLine" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="acMobileSkeletonCardStack" aria-busy="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="acMobileSkeletonBlock acMobileSkeletonCard">
          <div className="acMobileSkeletonBlock acMobileSkeletonLine acMobileSkeletonLineWide" />
          <div className="acMobileSkeletonBlock acMobileSkeletonLine" />
          <div className="acMobileSkeletonBlock acMobileSkeletonLine acMobileSkeletonLineShort" />
        </div>
      ))}
    </div>
  )
}
