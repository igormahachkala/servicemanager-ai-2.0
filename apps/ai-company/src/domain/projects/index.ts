export {
  DEFAULT_COMPANY_ID,
  createMilestone,
  createProject,
  createProjectRisk,
  createProjectTeamMember,
  createRoadmapItem,
  getProjectById,
  getProjectsByCompanyId,
  getProjectsByWorkspaceId,
  loadProjects,
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  saveProjects,
  STORAGE_KEY,
  updateProject,
  type CreateProjectInput,
  type Project,
  type ProjectPriority,
  type ProjectStatus,
} from './project'
export { ensureSeedProjects, ensureAiPhotoLabActivation, AI_PHOTO_LAB_PROJECT_ID, AI_PHOTO_LAB_WORKSPACE_ID, AI_PHOTO_LAB_CHAT_ID } from './projectSeed'
export { type Milestone, type MilestoneStatus, MILESTONE_STATUSES } from './milestone'
export { type RoadmapItem, type RoadmapHorizon, ROADMAP_HORIZONS } from './roadmap'
export { type ProjectRisk, type RiskSeverity, type RiskStatus, RISK_SEVERITIES } from './risk'
export { type ProjectTeamMember, type ProjectTeamRole, TEAM_ROLES } from './projectTeam'
