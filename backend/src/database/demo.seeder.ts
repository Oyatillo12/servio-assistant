import { Injectable, Logger } from '@nestjs/common';
import { ClientService } from '../client/client.service.js';
import { OrderService } from '../order/order.service.js';
import { LeadService } from '../lead/lead.service.js';

@Injectable()
export class DemoSeederService {
  private readonly logger = new Logger(DemoSeederService.name);

  constructor(
    private readonly clientService: ClientService,
    private readonly orderService: OrderService,
    private readonly leadService: LeadService,
  ) {}

  async seed() {
    this.logger.log('Checking if demo data needs to be seeded...');
    const demoClient = await this.clientService.findBySlug('burger-demo');
    if (demoClient) {
      this.logger.log(
        `Demo clients already exist in database. Skipping demo seed.`,
      );
      return;
    }

    this.logger.log('Seeding demo data...');

    // Demo Store
    const store = await this.clientService.create({
      name: 'Burger & Co (Demo)',
      slug: 'burger-demo',
      systemPrompt:
        'You are a polite assistant for Burger & Co. Help users order our delicious fast food.',
      isActive: true,
      type: 'order',
      defaultLang: 'en',
      hasProducts: true,
      hasServices: false,
    });

    await this.clientService.addProduct(store.id, {
      name: 'Classic Burger',
      description: 'Beef patty, lettuce, tomato',
      price: 5,
    });
    await this.clientService.addProduct(store.id, {
      name: 'Cheese Pizza',
      description: 'Large cheese pizza',
      price: 12,
    });
    await this.clientService.addProduct(store.id, {
      name: 'Coca Cola',
      description: '0.5L',
      price: 2,
    });

    // Dummy orders
    const storeProducts = await this.clientService.findOne(store.id);
    for (let i = 0; i < 5; i++) {
      await this.orderService.create({
        chatId: 1000 + i,
        clientId: store.id,
        phone: `+1234567890${i}`,
        address: `Main St ${i + 1}, Area ${i}`,
        items: [
          {
            productId: storeProducts.products[0].id,
            productName: storeProducts.products[0].name,
            price: storeProducts.products[0].price ?? null,
            quantity: (i % 2) + 1,
          },
        ],
      });
    }

    // Demo Clinic
    const clinic = await this.clientService.create({
      name: 'Smile Care Clinic (Demo)',
      slug: 'smile-clinic',
      systemPrompt:
        'You are a receptionist for Smile Care Clinic. Answer questions about our dental services and collect patient contact info.',
      isActive: true,
      type: 'lead',
      defaultLang: 'en',
      hasProducts: false,
      hasServices: true,
    });

    await this.clientService.addService(clinic.id, {
      name: 'Initial Consultation',
      description: 'Free checkup and x-rays',
    });
    await this.clientService.addService(clinic.id, {
      name: 'Teeth Whitening',
      description: 'Professional laser whitening',
    });

    // Dummy leads
    for (let i = 0; i < 3; i++) {
      await this.leadService.create({
        chatId: 2000 + i,
        clientId: clinic.id,
        name: `John Doe ${i}`,
        phone: `+9876543210${i}`,
        notes: `Interested in Teeth Whitening. Preferred time: 1${i}:00.`,
      });
    }

    this.logger.log('Demo data seeded successfully.');
  }
}
