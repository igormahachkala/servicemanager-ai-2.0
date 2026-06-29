import { loadProjects } from '../../domain/projects'
import { AI_PHOTO_LAB_PROJECT_ID, AI_PHOTO_LAB_WORKSPACE_ID } from '../../domain/projects/aiPhotoLabIds'
import { loadWorkspaces } from '../../domain/workspaces/workspace'
import { useI18n } from '../../i18n'

type Props = {
  projectId: string
  workspaceId: string
  onChange: (patch: { projectId?: string; workspaceId?: string }) => void
}

export function ProjectSelector({ projectId, workspaceId, onChange }: Props) {
  const { t } = useI18n()
  const projects = loadProjects()
  const workspaces = loadWorkspaces()

  return (
    <div className="mcTaskRunnerProjectRow">
      <label className="mcField">
        <span className="mcFieldLabel">{t.taskRunner.fields.project}</span>
        <select
          className="mcSelect"
          value={projectId}
          onChange={(event) => {
            const nextProject = event.target.value
            onChange({
              projectId: nextProject,
              workspaceId:
                nextProject === AI_PHOTO_LAB_PROJECT_ID ? AI_PHOTO_LAB_WORKSPACE_ID : workspaceId,
            })
          }}
        >
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.title}
            </option>
          ))}
        </select>
      </label>

      <label className="mcField">
        <span className="mcFieldLabel">{t.taskRunner.fields.workspace}</span>
        <select
          className="mcSelect"
          value={workspaceId}
          onChange={(event) => onChange({ workspaceId: event.target.value })}
        >
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
