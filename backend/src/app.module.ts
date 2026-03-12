import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

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
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
