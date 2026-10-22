import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { appControllers } from './app.controllers';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SpecializationsModule } from './specializations/specializations.module';
import { ProblemCategoriesModule } from './problem-categories/problem-categories.module';
import { FailureCausesModule } from './failure-causes/failure-causes.module';
import { TechniciansModule } from './technicians/technicians.module';
import { CompanyModule } from './company/company.module';
import { LocationsModule } from './locations/locations.module';
import { TicketsModule } from './tickets/tickets.module';
import { AnalyticsModule } from './analytics/analytics.module';

import { SlaModule } from './sla/sla.module';
import { AssignmentModule } from './assignment/assignment.module';
import { TimelineModule } from './timeline/timeline.module';
import { MapModule } from './map/map.module';
import { EquipmentModule } from './equipment/equipment.module';
import { IdempotencyModule } from './common/idempotency/idempotency.module';
import { PublicRequestModule } from './public-request/public-request.module';
import { ServiceContractsModule } from './service-contracts/service-contracts.module';
import { PermissionsModule } from './permissions/permissions.module';
import { InspectionModule } from './inspection/inspection.module';
import { AgentTasksModule } from './agent-tasks/agent-tasks.module';
import { RealtimeModule } from './realtime/realtime.module';
import { UploadsModule } from './uploads/uploads.module';
import { MaxBotModule } from './max-bot/max-bot.module';
import { PushModule } from './push/push.module';
import { WorkforceModule } from './workforce/workforce.module';
import { MaterialsModule } from './materials/materials.module';
import { PlannerModule } from './planner/planner.module';
import { ProductUpdatesModule } from './product-updates/product-updates.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    SpecializationsModule,
    ProblemCategoriesModule,
    FailureCausesModule,
    TechniciansModule,
    CompanyModule,
    LocationsModule,
    TicketsModule,
    AnalyticsModule,
    SlaModule,
    AssignmentModule,
    TimelineModule,
    MapModule,
    EquipmentModule,
    IdempotencyModule,
    PublicRequestModule,
    ServiceContractsModule,
    PermissionsModule,
    InspectionModule,
    AgentTasksModule,
    RealtimeModule,
    UploadsModule,
    MaxBotModule,
    PushModule,
    WorkforceModule,
    MaterialsModule,
    PlannerModule,
    ProductUpdatesModule,
  ],
  controllers: appControllers(),
  providers: [AppService],
})
export class AppModule {}
