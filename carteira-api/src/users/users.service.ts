import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

const userCredentialsSelect = {
  id: true,
  email: true,
  password: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{
  select: typeof publicUserSelect;
}>;

export type UserCredentials = Prisma.UserGetPayload<{
  select: typeof userCredentialsSelect;
}>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto): Promise<PublicUser> {
    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          select: publicUserSelect,
          data: {
            name: createUserDto.name,
            email: createUserDto.email,
            password: createUserDto.password,
          },
        });

        await tx.wallet.create({
          data: {
            userId: createdUser.id,
            balance: 0,
          },
        });

        return createdUser;
      });

      return user;
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('E-mail já cadastrado.');
      }

      throw error;
    }
  }

  async findByEmail(email: string): Promise<UserCredentials | null> {
    return this.prisma.user.findUnique({
      select: userCredentialsSelect,
      where: { email },
    });
  }

  private isUniqueConstraintError(
    error: unknown,
  ): error is Prisma.PrismaClientKnownRequestError {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
