import { Prisma, ServiceContractStatus } from '@prisma/client'

export function activeServiceContractWhere(now = new Date()): Prisma.ServiceContractWhereInput {
  return {
    status: ServiceContractStatus.ACTIVE,
    AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
      { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
    ],
  }
}

export function isServiceContractEffective(
  contract: { status: ServiceContractStatus; startsAt?: Date | null; endsAt?: Date | null },
  now = new Date(),
) {
  if (contract.status !== ServiceContractStatus.ACTIVE) return false
  if (contract.startsAt && contract.startsAt.getTime() > now.getTime()) return false
  if (contract.endsAt && contract.endsAt.getTime() < now.getTime()) return false
  return true
}
