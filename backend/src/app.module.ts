import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DebugController } from './common/debug.controller'; // TODO_REMOVE_AFTER_STABILIZATION

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SpecializationsModule } from './specializations/specializations.module';
import { ProblemCategoriesModule } from './problem-categories/problem-categories.module';
import { TechniciansModule } from './technicians/technicians.module';
import { CompanyModule } from './company/company.module';
import { LocationsModule } from './locations/locations.module';
import { TicketsModule } from './tickets/tickets.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { HealthController } from './health.controller';

import { SlaModule } from './sla/sla.module';
import { AssignmentModule } from './assignment/assignment.module';
import { TimelineModule } from './timeline/timeline.module';
import { MapModule } from './map/map.module';
import { EquipmentModule } from './equipment/equipment.module';
import { PublicRequestModule } from './public-request/public-request.module';
import { ServiceContractsModule } from './service-contracts/service-contracts.module';
import { InspectionModule } from './inspection/inspection.module';
import { RealtimeModule } from './realtime/realtime.module';
import { UploadsModule } from './uploads/uploads.module';
import { MaxBotModule } from './max-bot/max-bot.module';
import { PermissionsModule } from './permissions/permissions.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    SpecializationsModule,
    ProblemCategoriesModule,
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
    PublicRequestModule,
    ServiceContractsModule,
    InspectionModule,
    RealtimeModule,
    UploadsModule,
    MaxBotModule,
    PermissionsModule,
  ],
  controllers: [AppController, HealthController, DebugController], // DebugController: TODO_REMOVE_AFTER_STABILIZATION
  providers: [AppService],
})
export class AppModule {}
