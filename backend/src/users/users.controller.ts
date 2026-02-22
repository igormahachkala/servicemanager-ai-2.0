import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { UserRole } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @Roles(UserRole.ADMIN)
  @Get()
  list(@Req() req: any) {
    return this.users.list(req.user.companyId);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Req() req: any, @Body() dto: CreateUserDto) {
    return this.users.create(req.user.companyId, dto);
  }
}
