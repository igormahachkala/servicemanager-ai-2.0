import { Test } from '@nestjs/testing';

import { InspectionScheduleService } from './inspection-schedule.service';
import { TicketsAssignmentService } from '../tickets/tickets.assignment.service';
import { AssignmentModule } from '../assignment/assignment.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ServiceContractsModule } from '../service-contracts/service-contracts.module';

/**
 * SMA-ROUNDS-ASSIGNMENT-RESOLVER-CYCLE-BREAK-072.
 *
 * Stage 070 exposed a real boot cycle:
 * InspectionScheduleService -> TicketsAssignmentService -> Notifications -> MAX -> Rounds.
 * This regression compiles the schedule provider with its real lightweight modules instead of
 * hand-wired mocks. If schedule planning ever imports ticket orchestration again just to
 * validate assignees, this graph can no longer compile without pulling Tickets/Notifications/MAX.
 */
describe('072 inspection schedule boot graph', () => {
  it('boots schedule planning without depending on ticket orchestration', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, ServiceContractsModule, AssignmentModule],
      providers: [InspectionScheduleService],
    }).compile();

    expect(moduleRef.get(InspectionScheduleService)).toBeInstanceOf(InspectionScheduleService);
    expect(() => moduleRef.get(TicketsAssignmentService, { strict: false })).toThrow();

    await moduleRef.close();
  });
});
