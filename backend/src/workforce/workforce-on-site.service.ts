import { Injectable } from '@nestjs/common'
import { Prisma, TechnicianArrivalEventKind, TicketStatus } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'
import { haversineMeters } from '../tickets/ticket-route.service'
import { PLATFORM_ARRIVAL_SETTINGS_ID } from './geo-accuracy.constants'
import {
  ArrivalThresholds,
  confirmsTransition,
  hasFiniteCoordinates,
  pointSide,
  presenceOf,
  toArrivalThresholds,
} from './workforce-on-site.rules'

export type OnSiteGeoPoint = {
  companyId: string
  userId: string
  latitude: number
  longitude: number
  capturedAt: Date
  accuracy: number | null
  receivedAt: Date
}

type ArrivalTicket = {
  id: string
  location: { latitude: number | null; longitude: number | null } | null
}

/**
 * Автомат прибытия. Статус заявки и WorkLog не меняет.
 * companyId строки — компания провайдера из смены, не Ticket.companyId.
 */
@Injectable()
export class WorkforceOnSiteService {
  constructor(private readonly prisma: PrismaService) {}

  async onGeoPoint(point: OnSiteGeoPoint): Promise<void> {
    const thresholds = await this.readThresholds()
    await this.prisma.$transaction((tx) => this.applyPoint(tx, point, thresholds))
  }

  private async readThresholds(): Promise<ArrivalThresholds> {
    const row = await this.prisma.platformArrivalSettings.findUnique({
      where: { id: PLATFORM_ARRIVAL_SETTINGS_ID },
      select: { accuracyMeters: true, freshnessMinutes: true, radiusMeters: true },
    })
    return toArrivalThresholds(row)
  }

  private async applyPoint(
    tx: Prisma.TransactionClient,
    point: OnSiteGeoPoint,
    thresholds: ArrivalThresholds,
  ): Promise<void> {
    const tickets = await tx.ticket.findMany({
      where: {
        assignedTechnicianId: point.userId,
        status: { in: [TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS] },
      },
      select: {
        id: true,
        location: { select: { latitude: true, longitude: true } },
      },
    })

    for (const ticket of tickets) {
      await this.applyTicket(tx, point, ticket, thresholds)
    }
  }

  private async applyTicket(
    tx: Prisma.TransactionClient,
    point: OnSiteGeoPoint,
    ticket: ArrivalTicket,
    thresholds: ArrivalThresholds,
  ): Promise<void> {
    const latitude = ticket.location?.latitude
    const longitude = ticket.location?.longitude
    if (!hasFiniteCoordinates(latitude, longitude)) return

    const distanceMeters = haversineMeters(
      { lat: point.latitude, lon: point.longitude },
      { lat: latitude as number, lon: longitude as number },
    )
    const existing = await tx.technicianArrival.findUnique({
      where: { ticketId_userId: { ticketId: ticket.id, userId: point.userId } },
    })

    if (!confirmsTransition(point.accuracy, point.capturedAt, point.receivedAt, thresholds)) {
      if (!existing) return
      await tx.technicianArrival.update({
        where: { id: existing.id },
        data: {
          lastDistanceMeters: distanceMeters,
          lastCheckedAt: point.receivedAt,
        },
      })
      return
    }

    const side = pointSide(distanceMeters, thresholds.radiusMeters)
    const streak =
      existing && existing.candidateSide === side && existing.candidateStreak > 0
        ? existing.candidateStreak + 1
        : 1

    let arrivedAt = existing?.arrivedAt ?? null
    let departedAt = existing?.departedAt ?? null
    const arrivedNow = presenceOf(arrivedAt, departedAt) === 'arrived'
    const departedNow = presenceOf(arrivedAt, departedAt) === 'departed'
    let eventKind: TechnicianArrivalEventKind | null = null

    if (streak >= 2 && side === 'INSIDE' && !arrivedNow) {
      arrivedAt = point.capturedAt
      eventKind = TechnicianArrivalEventKind.ARRIVED
    } else if (streak >= 2 && side === 'OUTSIDE' && arrivedAt != null && !departedNow) {
      departedAt = point.capturedAt
      eventKind = TechnicianArrivalEventKind.DEPARTED
    }

    const data = {
      lastDistanceMeters: distanceMeters,
      lastCheckedAt: point.receivedAt,
      candidateSide: side,
      candidateStreak: streak,
      arrivedAt,
      departedAt,
    }

    const arrival = existing
      ? await tx.technicianArrival.update({ where: { id: existing.id }, data })
      : await tx.technicianArrival.create({
          data: {
            companyId: point.companyId,
            ticketId: ticket.id,
            userId: point.userId,
            ...data,
          },
        })

    if (!eventKind) return

    await tx.technicianArrivalEvent.create({
      data: {
        companyId: point.companyId,
        arrivalId: arrival.id,
        kind: eventKind,
        occurredAt: point.capturedAt,
        distanceMeters,
      },
    })
  }
}
