import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAvitoDto, UpdateAvitoDto } from './dto/avito.dto';

@Injectable()
export class AvitoService {
  constructor(private prisma: PrismaService) {}

  async getChats(query: any) {
    const { status, city, phone } = query;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (city) {
      where.city = city;
    }

    if (phone) {
      where.phone = { contains: phone };
    }

    const chats = await this.prisma.avitoChat.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { messages: true },
        },
      },
      take: 100,
    });

    return {
      success: true,
      data: chats,
    };
  }

  async getChat(chatId: string) {
    const chat = await this.prisma.avitoChat.findUnique({
      where: { chatId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 50,
        },
        orders: {
          select: {
            id: true,
            rk: true,
            clientName: true,
            statusOrder: true,
          },
        },
      },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    return {
      success: true,
      data: chat,
    };
  }

  async getChatMessages(chatId: string) {
    const messages = await this.prisma.avitoMessage.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
    });

    return {
      success: true,
      data: messages,
    };
  }

  async createChat(dto: CreateAvitoDto) {
    const chat = await this.prisma.avitoChat.create({
      data: {
        chatId: dto.chatId,
        city: dto.city,
        name: dto.name,
        phone: dto.phone,
        status: 'active',
      },
    });

    return {
      success: true,
      message: 'Chat created successfully',
      data: chat,
    };
  }

  async updateChat(chatId: string, dto: UpdateAvitoDto) {
    const chat = await this.prisma.avitoChat.update({
      where: { chatId },
      data: {
        ...(dto.city && { city: dto.city }),
        ...(dto.name && { name: dto.name }),
        ...(dto.phone && { phone: dto.phone }),
        ...(dto.status && { status: dto.status }),
        ...(dto.lastMessage && { lastMessage: dto.lastMessage }),
      },
    });

    return {
      success: true,
      message: 'Chat updated successfully',
      data: chat,
    };
  }

  async getChatsByPhone(phone: string) {
    const chats = await this.prisma.avitoChat.findMany({
      where: {
        phone: { contains: phone },
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });

    return {
      success: true,
      data: chats,
    };
  }
}



