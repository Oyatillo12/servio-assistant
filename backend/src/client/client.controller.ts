import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard, Roles } from '../auth/guards/roles.guard.js';
import { ClientAccessGuard } from '../auth/guards/client-access.guard.js';
import { Role, User } from '../auth/entities/user.entity.js';
import { ClientService } from './client.service.js';
import { CreateClientDto } from './dto/create-client.dto.js';
import { UpdateClientDto } from './dto/update-client.dto.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { CreateServiceDto } from './dto/create-service.dto.js';
import { UpdateServiceDto } from './dto/update-service.dto.js';

@Controller('api/clients')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  // ── Clients ──────────────────────────────────────────────

  @Get()
  findAll(@Request() req: { user: User }) {
    // Client admins only see their own client
    if (req.user.role === Role.CLIENT_ADMIN && req.user.clientId) {
      return this.clientService.findOne(req.user.clientId).then((c) => [c]);
    }
    return this.clientService.findAll();
  }

  @Get(':id')
  @UseGuards(ClientAccessGuard)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.clientService.findOne(id);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN)
  create(@Body() dto: CreateClientDto) {
    return this.clientService.create(dto);
  }

  @Post('demo')
  @Roles(Role.SUPER_ADMIN)
  createDemo(
    @Body() body: { type?: 'order' | 'lead'; lang?: 'uz' | 'ru' | 'en' },
  ) {
    return this.clientService.createDemo(body.type ?? 'order', body.lang ?? 'en');
  }

  @Patch(':id')
  @UseGuards(ClientAccessGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateClientDto,
    @Request() req: { user: User },
  ) {
    return this.clientService.update(id, dto, req.user.role);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.clientService.remove(id);
  }

  // ── Products ─────────────────────────────────────────────

  @Post(':id/products')
  @UseGuards(ClientAccessGuard)
  addProduct(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateProductDto,
  ) {
    return this.clientService.addProduct(id, dto);
  }

  @Patch('products/:productId')
  updateProduct(
    @Param('productId', ParseIntPipe) productId: number,
    @Body() dto: UpdateProductDto,
  ) {
    return this.clientService.updateProduct(productId, dto);
  }

  @Delete('products/:productId')
  removeProduct(@Param('productId', ParseIntPipe) productId: number) {
    return this.clientService.removeProduct(productId);
  }

  // ── Services ─────────────────────────────────────────────

  @Post(':id/services')
  @UseGuards(ClientAccessGuard)
  addService(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateServiceDto,
  ) {
    return this.clientService.addService(id, dto);
  }

  @Patch('services/:serviceId')
  updateService(
    @Param('serviceId', ParseIntPipe) serviceId: number,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.clientService.updateService(serviceId, dto);
  }

  @Delete('services/:serviceId')
  removeService(@Param('serviceId', ParseIntPipe) serviceId: number) {
    return this.clientService.removeService(serviceId);
  }
}
