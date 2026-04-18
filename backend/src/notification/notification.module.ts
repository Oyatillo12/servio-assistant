import { Module, Global } from '@nestjs/common';
import { NotificationService } from './notification.service.js';
import { I18nModule } from '../i18n/i18n.module.js';

@Global()
@Module({
  imports: [I18nModule],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
