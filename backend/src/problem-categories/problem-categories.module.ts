import { Module } from '@nestjs/common';
import { ProblemCategoriesService } from './problem-categories.service';
import { ProblemCategoriesController } from './problem-categories.controller';

@Module({
  providers: [ProblemCategoriesService],
  controllers: [ProblemCategoriesController],
})
export class ProblemCategoriesModule {}
