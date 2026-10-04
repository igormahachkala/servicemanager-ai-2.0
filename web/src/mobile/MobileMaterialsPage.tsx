import { Link, useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../lib/api'
import { MaterialMovementsList, MaterialsBalanceList, SelfPurchaseForm } from '../components/materials/MaterialsPanels'
import { mobilePath } from './mobileRoute'

export function MobileMaterialsPage() {
  const qc = useQueryClient()
  const location = useLocation()
  const materialsQ = useQuery({ queryKey: ['materials-directory'], queryFn: api.materials })
  const balancesQ = useQuery({ queryKey: ['mobile-my-material-balances'], queryFn: api.myMaterialBalances })
  const historyQ = useQuery({ queryKey: ['mobile-my-material-history'], queryFn: api.myMaterialMovements })
  const purchaseM = useMutation({
    mutationFn: api.recordMaterialSelfPurchase,
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['mobile-my-material-balances'] }),
        qc.invalidateQueries({ queryKey: ['mobile-my-material-history'] }),
      ])
    },
  })

  return (
    <div className="mobileSection">
      <div className="mobileTicketDetailsToolbar">
        <Link to={mobilePath(location.pathname, '/settings')} className="mobileDetailsBackLink mobilePatrolBackLink">
          ← Настройки
        </Link>
      </div>
      <h1 className="mobileTitle">Мои материалы</h1>
      <div className="mobileSubtitle">Остатки техника и личные покупки</div>

      <div className="mobileCard">
        <div className="mobileSectionTitle" style={{ marginBottom: 10 }}>Текущий остаток</div>
        {balancesQ.isLoading ? <div className="mobileMeta">Загружаем остатки…</div> : null}
        {balancesQ.isError ? <div className="mobileNotice mobileNoticeError">{(balancesQ.error as Error).message}</div> : null}
        {!balancesQ.isLoading && !balancesQ.isError ? <MaterialsBalanceList balances={balancesQ.data || []} /> : null}
      </div>

      <div className="mobileCard" style={{ marginTop: 8 }}>
        <div className="mobileSectionTitle" style={{ marginBottom: 10 }}>+ Купил материал</div>
        {materialsQ.isError ? <div className="mobileNotice mobileNoticeError">{(materialsQ.error as Error).message}</div> : null}
        {purchaseM.isError ? <div className="mobileNotice mobileNoticeError">{(purchaseM.error as Error).message}</div> : null}
        {purchaseM.isSuccess ? <div className="mobileCardInlineSuccess">Покупка сохранена</div> : null}
        <SelfPurchaseForm materials={materialsQ.data || []} submitting={purchaseM.isPending} onSubmit={(input) => purchaseM.mutate(input)} />
      </div>

      <div className="mobileCard" style={{ marginTop: 8 }}>
        <div className="mobileSectionTitle" style={{ marginBottom: 10 }}>История</div>
        {historyQ.isLoading ? <div className="mobileMeta">Загружаем историю…</div> : null}
        {historyQ.isError ? <div className="mobileNotice mobileNoticeError">{(historyQ.error as Error).message}</div> : null}
        {!historyQ.isLoading && !historyQ.isError ? <MaterialMovementsList movements={historyQ.data || []} /> : null}
      </div>
    </div>
  )
}
