import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { instanceToPlain } from 'class-transformer';
import { LoginUserDto } from './dto/auth-login-dto';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly usersRepo: Repository<User>,
        private readonly jwtService: JwtService,
    ) { }

    async create(data: CreateUserDto): Promise<User> {
        let userData = { ...data };

        // Only hash the password if it's provided (manual signup)
        if (data.password) {
            const hashed = await bcrypt.hash(data.password, 10);
            userData = { ...data, password: hashed };
        }

        const user = this.usersRepo.create(userData);
        return await this.usersRepo.save(user);
    }
    async login(loginDto: LoginUserDto) {
        const { email, password } = loginDto;

        const user = await this.usersRepo.findOne({ where: { email } });

        if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const payload = { email: user.email, sub: user.id };
        const token = this.jwtService.sign(payload);

        // Extract user data excluding password
        const { password: _, ...userWithoutPassword } = instanceToPlain(user);

        return {
            status: true,
            data: {
                ...userWithoutPassword,
                accessToken: token,
            },
        };
    }

    async googleLogin(loginDto: { email: string; name: string }) {
        const { email, name } = loginDto;

        let user = await this.usersRepo.findOne({ where: { email } });

        if (!user) {
            user = this.usersRepo.create({
                email,
                name,
                username: '',
            });
            user = await this.usersRepo.save(user);
        }

        const payload = { email: user.email, sub: user.id };
        const token = this.jwtService.sign(payload);

        const userWithoutPassword = instanceToPlain(user);

        return {
            status: true,
            data: {
                ...userWithoutPassword,
                accessToken: token,
            },
        };
    }
    async findByEmail(email: string): Promise<User | null> {
        return this.usersRepo.findOne({ where: { email } });
    }


    async findAll(): Promise<User[]> {
        return this.usersRepo.find();
    }

    async findOne(id: number): Promise<User> {
        const user = await this.usersRepo.findOne({ where: { id } });
        if (!user) throw new NotFoundException(`User with ID ${id} not found`);
        return user;
    }

    async update(id: number, data: UpdateUserDto): Promise<User> {
        const user = await this.findOne(id);
        const updated = Object.assign(user, data);
        return this.usersRepo.save(updated);
    }

    async remove(id: number): Promise<{ message: string }> {
        const user = await this.findOne(id);
        await this.usersRepo.remove(user);
        return { message: `User with ID ${id} deleted successfully` };
    }
}
