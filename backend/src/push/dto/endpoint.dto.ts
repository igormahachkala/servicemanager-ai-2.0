import { IsNotEmpty, IsString } from 'class-validator';

/** Тело для DELETE /push/subscriptions и POST /push/subscriptions/heartbeat. */
export class EndpointDto {
  @IsString()
  @IsNotEmpty()
  endpoint!: string;
}
