import { IsIn, IsOptional, IsString } from 'class-validator'

export class ReviewRunReportDto {
  @IsIn(['APPROVED', 'REJECTED'])
  decision!: 'APPROVED' | 'REJECTED'

  @IsOptional()
  @IsString()
  comment?: string
}