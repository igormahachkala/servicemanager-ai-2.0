import { Injectable } from '@nestjs/common';

import { PERMISSION_BLOCKS, ROLE_GRANTS } from '../common/permissions-matrix';
import { PermissionCatalogItemDto } from './dto/permission-catalog.dto';
import { RoleMatrixEntryDto } from './dto/role-matrix.dto';

/**
 * Read-only поставщик справочника прав и матрицы ролей.
 * Источник истины — статическая матрица (src/common/permissions-matrix.ts),
 * поэтому ответ детерминирован и не зависит от состояния seed/БД.
 * НИЧЕГО не мутирует.
 */
@Injectable()
export class PermissionsService {
  /** Группа блока → человекочитаемая категория для UI. */
  private categoryLabel(group: string): string {
    const map: Record<string, string> = {
      TICKETS: 'Tickets',
      LOCATIONS: 'Locations',
      EMPLOYEES: 'Employees',
      ANALYTICS: 'Analytics',
      MANAGEMENT: 'Management',
    };
    return map[group] ?? group;
  }

  getCatalog(): PermissionCatalogItemDto[] {
    return PERMISSION_BLOCKS.map((b) => ({
      code: b.code,
      name: b.name,
      category: this.categoryLabel(b.group),
      description: b.description ?? null,
    }));
  }

  getMatrix(): RoleMatrixEntryDto[] {
    return ROLE_GRANTS.map((g) => ({
      role: g.role,
      companyType: g.companyType,
      permissions: [...g.codes],
    }));
  }
}
