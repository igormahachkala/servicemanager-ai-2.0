#!/usr/bin/env python3
"""Split web/src/lib/api.ts into web/src/lib/api/*.ts (Stage 1). Run from repo root: python web/scripts/split_api_layer.py"""
from __future__ import annotations

import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT / "src/lib/api.ts"
OUT_DIR = ROOT / "src/lib/api"


def main() -> None:
    raw = SRC.read_text(encoding="utf8")
    lines = raw.splitlines()

    def sl(a: int, b: int) -> str:
        return "\n".join(lines[a - 1 : b])

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # ---------- types.ts ----------
    types_parts = [
        sl(1, 13),
        sl(19, 73),
        sl(141, 411),
        sl(422, 1029),
        sl(1047, 1051),
        sl(1313, 1313),
        sl(1948, 1951),
        sl(2253, 2519),
        sl(2652, 2707),
    ]
    (OUT_DIR / "types.ts").write_text(
        "/** DTO / API types (Stage 1 split). */\n\n" + "\n\n".join(types_parts) + "\n",
        encoding="utf8",
    )

    # ---------- constants.ts ----------
    notif = sl(74, 86).replace("const NOTIFICATION_TYPE_LABELS", "export const NOTIFICATION_TYPE_LABELS", 1)
    keys = sl(1031, 1042)
    keys_exported = "\n".join(
        ("export " + ln) if ln.startswith("const ") else ln for ln in keys.splitlines()
    )
    (OUT_DIR / "constants.ts").write_text(
        "/** Static keys and lookup tables. */\n\n"
        + notif
        + "\n\n"
        + keys_exported
        + "\n\nexport const FALLBACK_API_BASE_URL = 'http://localhost:3000'\n",
        encoding="utf8",
    )

    # ---------- mappers.ts ----------
    (OUT_DIR / "mappers.ts").write_text(
        """import { NOTIFICATION_TYPE_LABELS } from './constants'

export function getNotificationTypeLabel(type: string): string {
  const t = (type || '').trim()
  if (!t) return 'Уведомление'
  return NOTIFICATION_TYPE_LABELS[t] || t
}

"""
        + sl(98, 113)
        + "\n"
        + sl(115, 139)
        + "\n",
        encoding="utf8",
    )

    # ---------- role-utils.ts ----------
    (OUT_DIR / "role-utils.ts").write_text(
        """import type { LinkedClientSummary, Me, TechnicianBoundContext, TicketGetOne } from './types'

"""
        + sl(15, 17)
        + "\n\n"
        + sl(414, 420)
        + "\n\n"
        + sl(1235, 1238)
        + "\n\n"
        + sl(1246, 1311)
        + "\n\n"
        + sl(1344, 1351)
        + "\n\n"
        + sl(1518, 1525)
        + "\n",
        encoding="utf8",
    )

    # ---------- client.ts ----------
    client_a = sl(1053, 1516)
    client_b = sl(1527, 1599)
    client_c = sl(1941, 1946) + "\n\n" + sl(1953, 1967)
    client_core = "\n\n".join([client_a, client_b, client_c]) + "\n"
    client_core = client_core.replace("async function request<", "export async function request<", 1)
    client_core = client_core.replace("function normalizeArrayResponse<", "export function normalizeArrayResponse<", 1)
    client_core = client_core.replace("function buildTicketScopeSuffix", "export function buildTicketScopeSuffix", 1)

    (OUT_DIR / "client.ts").write_text(
        """import type {
  ImpersonateResponse,
  ImpersonationMeta,
  Me,
  Role,
  TechnicianMobileLinkedSource,
  TicketScopeParams,
} from './types'
import {
  BASE_URL_KEY,
  COMPANY_LABEL_KEY,
  FALLBACK_API_BASE_URL,
  IMPERSONATION_META_KEY,
  LAST_SCOPE_KEY,
  PLATFORM_BACKUP_COMPANY_LABEL_KEY,
  PLATFORM_BACKUP_KEY,
  PLATFORM_BACKUP_ROLE_KEY,
  SCOPE_OWNER_COMPANY_ID_KEY,
  SCOPE_OWNER_ROLE_KEY,
  SCOPE_OWNER_USER_ID_KEY,
  TOKEN_KEY,
  USER_ROLE_KEY,
} from './constants'

"""
        + client_core,
        encoding="utf8",
    )

    # ---------- notifications.ts ----------
    (OUT_DIR / "notifications.ts").write_text(
        """import { request } from './client'
import type { NotificationsListResponse } from './types'

"""
        + sl(1624, 1638)
        + "\n",
        encoding="utf8",
    )

    # ---------- users.ts ----------
    (OUT_DIR / "users.ts").write_text(
        """import { request, normalizeArrayResponse } from './client'
import type {
  CreateProblemCategoryInput,
  CreateSpecializationInput,
  CreateUserInput,
  LoginInput,
  LoginResponse,
  Me,
  ProblemCategoryListItem,
  SpecializationListItem,
  UpdateProblemCategoryInput,
  UpdateSpecializationInput,
  UpdateUserInput,
  UserListItem,
} from './types'

"""
        + sl(1602, 1622)
        + "\n"
        + sl(1640, 1751)
        + "\n",
        encoding="utf8",
    )

    # ---------- technicians.ts ----------
    (OUT_DIR / "technicians.ts").write_text(
        """import { request } from './client'
import type {
  TechnicianBoundContext,
  TechnicianItem,
  TechnicianLocationBindingsResponse,
  TechnicianWorkloadItem,
} from './types'

"""
        + sl(1753, 1812)
        + "\n",
        encoding="utf8",
    )

    # ---------- company.ts ----------
    (OUT_DIR / "company.ts").write_text(
        """import { request } from './client'
import type {
  CompanySettings,
  CreateCompanyAdminInput,
  CreateCompanyInput,
  CreateServiceContractInput,
  LinkedClientSummary,
  PlatformCompanyItem,
  ServiceContractItem,
  UpdateCompanyInput,
  UpdateServiceContractInput,
  UserListItem,
} from './types'

"""
        + sl(1814, 1885)
        + "\n"
        + sl(1921, 1946)
        + "\n",
        encoding="utf8",
    )

    # ---------- locations.ts ----------
    (OUT_DIR / "locations.ts").write_text(
        """import { request, normalizeArrayResponse } from './client'
import type {
  CreateLocationInput,
  EquipmentListItem,
  LocationListItem,
  UpdateLocationInput,
} from './types'

"""
        + sl(1888, 1919)
        + "\n"
        + sl(2521, 2523)
        + "\n",
        encoding="utf8",
    )

    # ---------- board.ts ----------
    (OUT_DIR / "board.ts").write_text(
        """import { request } from './client'
import type { BoardResponse, TicketStatus } from './types'

"""
        + sl(1969, 2004)
        + "\n",
        encoding="utf8",
    )

    # ---------- tickets.ts ----------
    (OUT_DIR / "tickets.ts").write_text(
        """import { buildTicketScopeSuffix, getBaseUrl, getToken, request } from './client'
import type {
  AssignmentCandidatesResponse,
  AssignmentDecisionItem,
  CreateChildTicketInput,
  CreateTicketInput,
  CreateTicketResponse,
  DraftTicketAttachment,
  SmartAssignResult,
  TicketAttachmentItem,
  TicketGetOne,
  TicketScopeParams,
  TimelineResponse,
  UpdateTicketInput,
  UpdateTicketStatusInput,
} from './types'

"""
        + sl(2006, 2215)
        + "\n",
        encoding="utf8",
    )

    # ---------- map-analytics.ts ----------
    (OUT_DIR / "map-analytics.ts").write_text(
        """import { request } from './client'
import type {
  AnalyticsOverviewResponse,
  MapLocationDetail,
  MapLocationItem,
  TicketContextAnalyticsResponse,
} from './types'

"""
        + sl(2217, 2250)
        + "\n",
        encoding="utf8",
    )

    # ---------- inspections.ts ----------
    (OUT_DIR / "inspections.ts").write_text(
        """import { getBaseUrl, getToken, request } from './client'
import type {
  CompleteInspectionRunResponse,
  CreateTicketFromInspectionItemInput,
  CreateTicketResponse,
  InspectionRun,
  InspectionRunItem,
  InspectionRunItemAttachment,
  InspectionRunListItem,
  InspectionRunReport,
  InspectionTemplate,
  ReviewInspectionRunReportInput,
  StartInspectionRunInput,
  TicketStatus,
  TicketUrgency,
  UpdateInspectionRunItemInput,
} from './types'

"""
        + sl(2525, 2651)
        + "\n"
        + sl(2778, 2816)
        + "\n",
        encoding="utf8",
    )

    # ---------- public.ts ----------
    (OUT_DIR / "public.ts").write_text(
        """import { getBaseUrl, request } from './client'
import type {
  PublicQuickRequestInput,
  PublicQuickRequestResponse,
  PublicRequestContext,
  PublicRequestEquipment,
  PublicRequestLocation,
} from './types'

"""
        + sl(2709, 2774)
        + "\n",
        encoding="utf8",
    )

    # ---------- index.ts ----------
    (OUT_DIR / "index.ts").write_text(
        """export * from './types'
export * from './constants'
export * from './mappers'
export * from './role-utils'
export * from './client'
export * from './notifications'
export * from './users'
export * from './technicians'
export * from './company'
export * from './locations'
export * from './board'
export * from './tickets'
export * from './map-analytics'
export * from './inspections'
export * from './public'
""",
        encoding="utf8",
    )

    print("OK:", OUT_DIR)

    if "--apply-barrel" in __import__("sys").argv:
        barrel = ROOT / "src/lib/api.ts"
        barrel.write_text("export * from './api/index'\n", encoding="utf8")
        print("Wrote barrel:", barrel)


if __name__ == "__main__":
    main()
