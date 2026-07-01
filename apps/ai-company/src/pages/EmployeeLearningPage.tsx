import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CertificationList } from '../components/competencies/CertificationList'
import { Goals } from '../components/learning/Goals'
import { LearningDashboard } from '../components/learning/LearningDashboard'
import { LearningTimeline } from '../components/learning/LearningTimeline'
import { Progress } from '../components/learning/Progress'
import { Recommendations } from '../components/learning/Recommendations'
import { SkillGrowthChart } from '../components/learning/SkillGrowthChart'
import { useCompetencies } from '../hooks/useCompetencies'
import { useLearning } from '../hooks/useLearning'
import { PageHeader } from '../mission-control/components/ui'
import { resolveEmployee } from '../mission-control/data/conversation'
import { resolveCanonicalEmployeeId } from '../mission-control/data/employeeIdResolver'
import { useI18n } from '../i18n'

export function EmployeeLearningPage() {
  const { id: routeId } = useParams<{ id: string }>()
  const employeeId = routeId ? resolveCanonicalEmployeeId(routeId) : undefined
  const { t } = useI18n()
  const employee = useMemo(
    () => (employeeId ? resolveEmployee(employeeId) : null),
    [employeeId],
  )

  const { certifications } = useCompetencies(employeeId)
  const {
    goals,
    pendingRecommendations,
    recentSessions,
    skillProgress,
    skillProgressHistory,
    certificatesEarned,
    stats,
    completeSession,
    startSession,
    dismissRecommendation,
    acceptRecommendation,
    refreshRecommendations,
  } = useLearning(employeeId)

  const primarySkill = goals.find((goal) => goal.status === 'active')?.skillName

  if (!employeeId || !employee) {
    return (
      <>
        <PageHeader
          title={t.learningEngine.notFoundTitle}
          description={t.learningEngine.notFoundDescription}
        />
        <div className="mcCompetencyEmptyPage">
          <div className="mcCompetencyEmptyTitle">{t.learningEngine.notFoundTitle}</div>
          <p className="mcCompetencyEmptyDesc">{t.learningEngine.notFoundDescription}</p>
          <Link to="/ops/employees" className="mcBtn mcBtnPrimary">
            {t.employeeProfile.backToEmployees}
          </Link>
        </div>
      </>
    )
  }

  return (
    <div className="mcLearningPage">
      <div className="mcCompetencyPageHeader">
        <Link to={`/ops/employees/${employeeId}`} className="mcProfileBack">
          ← {t.learningEngine.backToProfile}
        </Link>
        <PageHeader
          title={t.learningEngine.pageTitle.replace('{name}', employee.codename)}
          description={t.learningEngine.pageDescription}
        />
        <div className="mcPageHeaderRow" style={{ marginTop: 8 }}>
          <Link to={`/ops/employees/${employeeId}/competencies`} className="mcBtn mcBtnSecondary mcBtnSmall">
            {t.learningEngine.openCompetencies}
          </Link>
          <Link to={`/ops/employees/${employeeId}/runtime`} className="mcBtn mcBtnSecondary mcBtnSmall">
            {t.employeeProfile.sections.runtime}
          </Link>
          <button type="button" className="mcBtn mcBtnGhost mcBtnSmall" onClick={refreshRecommendations}>
            {t.learningEngine.actions.refreshSuggestions}
          </button>
        </div>
      </div>

      <LearningDashboard stats={stats} certificatesEarned={certificatesEarned} employeeName={employee.codename} />
      <Goals goals={goals} />
      <Recommendations
        items={pendingRecommendations}
        onAccept={acceptRecommendation}
        onDismiss={dismissRecommendation}
      />
      <Progress stats={stats} skillProgress={skillProgress} />
      <SkillGrowthChart history={skillProgressHistory} skillName={primarySkill} />
      <LearningTimeline sessions={recentSessions} onStart={startSession} onComplete={completeSession} />
      <CertificationList certifications={certifications} />

      <p className="mcCompetencyLocalNote">{t.learningEngine.localOnly}</p>
    </div>
  )
}
