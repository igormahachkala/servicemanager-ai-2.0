import { Link } from 'react-router-dom'
import type { OrganizationTreeNode } from '../../domain/organization/organizationNode'
import { OWNER_ID } from '../../domain/organization/organizationStorage'
import { resolveEmployee } from '../../mission-control/data/conversation'
import { useI18n } from '../../i18n'

function TreeNode({ node, depth = 0 }: { node: OrganizationTreeNode; depth?: number }) {
  const { t } = useI18n()
  const isOwner = node.kind === 'owner'
  const employee = node.kind === 'employee' ? resolveEmployee(node.refId) : null
  const isCustom = employee?.source === 'custom'

  return (
    <li className="mcOrgTreeItem">
      <div
        className={`mcOrgTreeRow mcOrgTreeRow${node.kind}`}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
      >
        <span className="mcOrgTreeConnector" aria-hidden>
          {depth > 0 ? '└' : '●'}
        </span>
        <div className="mcOrgTreeBody">
          <div className="mcOrgTreeLabelRow">
            <span className="mcOrgTreeLabel">{node.label}</span>
            {node.subtitle ? (
              <span className="mcOrgTreeSubtitle mcMuted">{node.subtitle}</span>
            ) : null}
          </div>
          {node.kind === 'employee' && employee ? (
            <div className="mcOrgTreeActions">
              <Link
                to={`/ops/chats/${encodeURIComponent(`conv:${employee.id}`)}`}
                className="mcBtn mcBtnSecondary mcBtnSmall"
              >
                {t.conversations.openConversation}
              </Link>
              {isCustom ? (
                <Link to={`/ops/employees/${employee.id}`} className="mcBtn mcBtnSecondary mcBtnSmall">
                  {t.employees.openProfile}
                </Link>
              ) : null}
            </div>
          ) : null}
          {isOwner ? (
            <span className="mcOrgTreeHint mcMuted">{t.organizationEngine.ownerHint}</span>
          ) : null}
        </div>
      </div>
      {node.children.length > 0 ? (
        <ul className="mcOrgTreeChildren">
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export function OrganizationTree({ tree }: { tree: OrganizationTreeNode }) {
  const { t } = useI18n()

  return (
    <div className="mcOrgTree">
      <div className="mcOrgTreeHeader">
        <h3 className="mcOrgTreeTitle">{t.organizationEngine.reportingTree}</h3>
        <span className="mcMuted mcOrgTreeCaption">{t.organizationEngine.reportingTreeHint}</span>
      </div>
      <ul className="mcOrgTreeRoot">
        <TreeNode node={tree} />
      </ul>
      <p className="mcOrgTreeFootnote mcMuted">
        {t.organizationEngine.treeFootnote.replace('{ownerId}', OWNER_ID)}
      </p>
    </div>
  )
}
