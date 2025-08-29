import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { SubscriptionService } from './subscription.service';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly stripe: Stripe;

  constructor(private readonly subscriptionService: SubscriptionService) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    
    this.stripe = new Stripe(stripeKey, {
      apiVersion: '2025-07-30.basil',
    });
  }

  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!endpointSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET environment variable is required');
    }

    let event: Stripe.Event;

    try {
      // Verify webhook signature
      event = this.stripe.webhooks.constructEvent(rawBody, signature, endpointSecret);
    } catch (err) {
      this.logger.error('Webhook signature verification failed:', err.message);
      throw new Error(`Webhook signature verification failed: ${err.message}`);
    }

    this.logger.log(`Processing webhook event: ${event.type}`);

    // Webhook events are now handled directly in the controller
    // This service only verifies the signature
    this.logger.log(`Webhook signature verified successfully: ${event.type}`);
  }

  async constructEvent(rawBody: Buffer, signature: string): Promise<Stripe.Event> {
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!endpointSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET environment variable is required');
    }

    return this.stripe.webhooks.constructEvent(rawBody, signature, endpointSecret);
  }
}
