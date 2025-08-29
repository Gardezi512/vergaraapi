import { Controller, Post, Get, Body, UseGuards, Request, Param, ParseEnumPipe } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { WebhookService } from './webhook.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreditGuard } from './guards/token.guard';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UseCreditsDto } from './dto/token-usage.dto';
import { MembershipType } from './entities/subscription.entity';

@Controller('subscription')
export class SubscriptionController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly webhookService: WebhookService,
  ) {}

  @Post('checkout/:membershipType')
  @UseGuards(JwtAuthGuard)
  async createCheckoutSession(
    @Request() req,
    @Param('membershipType', new ParseEnumPipe(MembershipType)) membershipType: MembershipType,
  ) {
    return this.subscriptionService.createCheckoutSession(req.user.id, membershipType);
  }

  @Get('current')
  @UseGuards(JwtAuthGuard)
  async getCurrentSubscription(@Request() req) {
    return this.subscriptionService.getCurrentSubscription(req.user.id);
  }

  @Post('credits/use')
  @UseGuards(JwtAuthGuard, CreditGuard)
  async useCredits(@Request() req, @Body() useCreditsDto: UseCreditsDto) {
    return this.subscriptionService.useCredits(req.user.id, useCreditsDto);
  }

  @Get('credits/balance')
  @UseGuards(JwtAuthGuard)
  async checkCreditBalance(@Request() req) {
    return this.subscriptionService.checkCreditBalance(req.user.id);
  }

  @Get('credits/history')
  @UseGuards(JwtAuthGuard)
  async getCreditUsageHistory(@Request() req) {
    return this.subscriptionService.getCreditUsageHistory(req.user.id);
  }

  @Post('webhook')
  async handleWebhook(@Request() req) {
    const signature = req.headers['stripe-signature'] as string;
    const rawBody = req.rawBody; // Use rawBody from middleware, not @Body()
    
    if (!rawBody) {
      throw new Error('Raw body not available for webhook verification');
    }
    
    const event = await this.webhookService.constructEvent(rawBody, signature);
    
    switch (event.type) {
      case 'checkout.session.completed':
        await this.subscriptionService.handleCheckoutCompleted(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await this.subscriptionService.handlePaymentSucceeded(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await this.subscriptionService.handleSubscriptionDeleted(event.data.object);
        break;
    }

    return { received: true };
  }

  @Post('cancel')
  @UseGuards(JwtAuthGuard)
  async cancelSubscription(@Request() req) {
    return this.subscriptionService.cancelSubscription(req.user.id);
  }
}
