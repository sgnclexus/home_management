import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentAuditService } from './payment-audit.service';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { WebhookController } from './webhook.controller';
import { FirebaseModule } from '../../config/firebase.module';

@Module({
  imports: [
    ConfigModule,
    FirebaseModule,
  ],
  controllers: [
    PaymentController,
    WebhookController,
  ],
  providers: [
    PaymentAuditService,
    PaymentService,
  ],
  exports: [
    PaymentAuditService,
    PaymentService,
  ],
})
export class PaymentsModule {}