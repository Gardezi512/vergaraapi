import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  ParseIntPipe,
  UnauthorizedException,
  UseGuards,
  Req,
} from '@nestjs/common';
import { UsersService } from './auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtService } from '@nestjs/jwt';
import { LoginUserDto } from './dto/auth-login-dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Controller('docs/auth')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    const data = await this.usersService.create(createUserDto);
    return { status: true, data };
  }
  @Post('login')
  async login(@Body() loginDto: LoginUserDto) {
    return await this.usersService.login(loginDto);
  }
  @Post('googleLogin')
  async googleLogin(@Body() body: { idToken: string; accessToken: string }) {
    if (!body?.idToken || !body?.accessToken) {
      throw new UnauthorizedException('Missing Google tokens');
    }

    return this.usersService.loginOrCreateWithNextAuth(body);
  }

  @Get()
  async findAll() {
    const data = await this.usersService.findAll();
    return { status: true, data };
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const data = await this.usersService.findOne(id);
    return { status: true, data };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const data = await this.usersService.update(id, updateUserDto);
    return { status: true, data };
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const data = await this.usersService.remove(id);
    return { status: true, data };
  }
  @Get('youtube/live')
  @UseGuards(JwtAuthGuard)
  async getLiveYouTubeStats(@Req() req) {
    return this.usersService.getLiveYouTubeStats(req.user);
  }
}
