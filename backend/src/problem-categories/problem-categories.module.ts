import { Module } from '@nestjs/common';
import { ProblemCategoriesService } from './problem-categories.service';
import { ProblemCategoriesController } from './problem-categories.controller';
import { ServiceContractsModule } from '../service-contracts/service-contracts.module';

@Module({
  imports: [ServiceContractsModule],
  providers: [ProblemCategoriesService],
  controllers: [ProblemCategoriesController],
})
export class ProblemCategoriesModule {}
