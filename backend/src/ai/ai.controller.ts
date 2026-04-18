import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AiService } from './ai.service.js';

export class GenerateDescriptionDto {
  name: string;
  type: 'product' | 'service';
  keywords?: string;
}

@Controller('api/ai')
@UseGuards(AuthGuard('jwt'))
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('generate-description')
  async generateDescription(@Body() dto: GenerateDescriptionDto) {
    const description = await this.aiService.generateProductDescription(
      dto.name,
      dto.type,
      dto.keywords,
    );
    return { description };
  }
}
