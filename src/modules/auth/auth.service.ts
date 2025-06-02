import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { instanceToPlain } from 'class-transformer';
import { LoginUserDto } from './dto/auth-login-dto';
import { OAuth2Client } from 'google-auth-library';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly usersRepo: Repository<User>,
        private readonly jwtService: JwtService,
    ) { }

    async create(data: CreateUserDto): Promise<User> {
        let userData = { ...data };

        try {
            if (data.password) {
                const hashed = await bcrypt.hash(data.password, 10);
                userData = { ...data, password: hashed };
            }

            const user = this.usersRepo.create(userData);
            return await this.usersRepo.save(user);
        } catch (error) {
            // Handle unique constraint violation (e.g., email already exists)
            if (error.code === '23505') {
                throw new BadRequestException('Email is already in use');
            }

            throw new InternalServerErrorException('Failed to create user');
        }
    }

    async login(loginDto: LoginUserDto) {
        const { email, password } = loginDto;

        try {
            const user = await this.usersRepo.findOne({ where: { email } });

            if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
                throw new UnauthorizedException('Invalid email or password');
            }

            const payload = { id: user.id, email: user.email, role: user.role };
            const token = this.jwtService.sign(payload);

            const { password: _, ...userWithoutPassword } = instanceToPlain(user);

            return {
                status: true,
                data: {
                    ...userWithoutPassword,
                    accessToken: token,
                },
            };
        } catch (error) {
            if (error instanceof UnauthorizedException) throw error;
            throw new InternalServerErrorException('Login failed. Please try again later.');
        }
    }


    // async loginOrCreateWithNextAuth(token: string) {
    //     let decoded: any;
    //     try {
    //         // decoded = verify(token, process.env.NEXTAUTH_SECRET!);
    //         decoded = await this.jwtService.verify(token, { secret: process.env.NEXTAUTH_SECRET! });

    //     } catch (err) {
    //         throw new UnauthorizedException('Invalid NextAuth token');
    //     }

    //     const { email, name, id } = decoded;
    //     if (!email || !name) throw new UnauthorizedException('Invalid payload');

    //     let user = await this.usersRepo.findOne({ where: { email } });

    //     if (!user) {
    //         user = this.usersRepo.create({
    //             email,
    //             name,
    //         });
    //         user = await this.usersRepo.save(user);
    //     }

    //     const payload = { email: user.email, id: user.id, role: user.role };
    //     const accessToken = this.jwtService.sign(payload);

    //     const { password: _, ...userWithoutPassword } = user;

    //     return {
    //         status: true,
    //         data: {
    //             ...userWithoutPassword,
    //             accessToken,
    //         },
    //     };
    // }


    async loginOrCreateWithNextAuth(googleToken: string) {
        const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
        let ticket;

        try {
            ticket = await client.verifyIdToken({
                idToken: googleToken,
                audience: process.env.GOOGLE_CLIENT_ID,
            });
        } catch (err) {
            throw new UnauthorizedException('Invalid Google token');
        }
        console.log(`Google token verified: ${googleToken}`);

        const payload = ticket.getPayload();
        if (!payload || !payload.email || !payload.name) {
            throw new UnauthorizedException('Invalid Google user data');
        }
        console.log(`Google user data: ${JSON.stringify(payload)}`);

        const { email, name } = payload;

        let user = await this.usersRepo.findOne({ where: { email } });

        // If user doesn't exist, create it
        if (!user) {
            try {
                user = this.usersRepo.create({ email, name });
                await this.usersRepo.save(user);
                console.log('New user saved:', user.id);
            } catch (err) {
                console.error('[DB ERROR]', err);
                throw new InternalServerErrorException('Failed to save user');
            }
        } else {
            console.log('Existing user found:', user.id);
        }

        const accessToken = this.jwtService.sign({
            id: user.id,
            email: user.email,
            role: user.role,
        });
        console.log(`User logged in or created: ${user.email}`);
        console.log(`Access Token: ${accessToken}`);


        return {
            status: true,
            data: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                accessToken,
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
