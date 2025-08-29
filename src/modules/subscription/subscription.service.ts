import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { Subscription, MembershipType, MembershipStatus } from './entities/subscription.entity';
import { CreditUsage } from './entities/token-usage.entity';
import { User } from '../auth/entities/user.entity';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UseCreditsDto } from './dto/token-usage.dto';

@Injectable()
export class SubscriptionService {
  private stripe: Stripe;
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    @InjectRepository(CreditUsage)
    private creditUsageRepository: Repository<CreditUsage>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    
    this.stripe = new Stripe(stripeKey, {
      apiVersion: '2025-07-30.basil',
    });
  }

  // Map Stripe price IDs to membership types
  private readonly PRICE_TO_MEMBERSHIP_MAP = {
    [process.env.STRIPE_PREMIUM_PRICE_ID || '']: MembershipType.PREMIUM,
    [process.env.STRIPE_EXCLUSIVE_PRICE_ID || '']: MembershipType.EXCLUSIVE,
  };

  async createSubscription(userId: number, createSubscriptionDto: CreateSubscriptionDto): Promise<Subscription> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Deactivate any existing active subscription
    await this.deactivateExistingSubscriptions(userId);

    const subscription = this.subscriptionRepository.create({
      ...createSubscriptionDto,
      userId,
      startDate: new Date(),
      endDate: this.calculateEndDate(createSubscriptionDto.membershipType),
      status: MembershipStatus.ACTIVE,
    });

    const savedSubscription = await this.subscriptionRepository.save(subscription);

    // Update user's membership type
    await this.userRepository.update(userId, {
      membershipType: createSubscriptionDto.membershipType,
    });

    return savedSubscription;
  }

  async getCurrentSubscription(userId: number): Promise<{ 
    hasSubscription: boolean; 
    subscription?: Subscription; 
    message: string;
    membershipType?: MembershipType;
  }> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { userId, status: MembershipStatus.ACTIVE },
      relations: ['user'],
    });

    if (!subscription) {
      // User has no active subscription
      return {
        hasSubscription: false,
        message: 'No active subscription found. You are on Free plan.',
        membershipType: MembershipType.FREE
      };
    }

    // User has active subscription
    return {
      hasSubscription: true,
      subscription,
      message: `Active ${subscription.membershipType} subscription`,
      membershipType: subscription.membershipType
    };
  }

  async useCredits(userId: number, useCreditsDto: UseCreditsDto): Promise<{ success: boolean; message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user can use credits based on membership
    if (user.membershipType === MembershipType.FREE) {
      if (user.freeCreditsUsed) {
        throw new ForbiddenException('Free users only get 1 credit. Upgrade to Premium for unlimited access.');
      }
      
      // Mark free credit as used
      await this.userRepository.update(userId, { freeCreditsUsed: true });
    }

    // Create credit usage record
    const creditUsage = this.creditUsageRepository.create({
      userId,
      creditsUsed: useCreditsDto.creditsToUse,
      feature: useCreditsDto.feature || 'ai_feature',
    });

    await this.creditUsageRepository.save(creditUsage);

    return {
      success: true,
      message: user.membershipType === MembershipType.FREE 
        ? 'Free credit used successfully. Upgrade to Premium for unlimited access.'
        : 'Credits used successfully.',
    };
  }

  async checkCreditBalance(userId: number): Promise<{ 
    membershipType: MembershipType; 
    canUseCredits: boolean; 
    message: string;
    freeCreditsUsed: boolean;
  }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    let canUseCredits = false;
    let message = '';

    switch (user.membershipType) {
      case MembershipType.FREE:
        canUseCredits = !user.freeCreditsUsed;
        message = user.freeCreditsUsed 
          ? 'Free credit already used. Upgrade to Premium for unlimited access.'
          : 'You have 1 free credit available.';
        break;
      
      case MembershipType.PREMIUM:
      case MembershipType.EXCLUSIVE:
        canUseCredits = true;
        message = 'Unlimited credits available.';
        break;
    }

    return {
      membershipType: user.membershipType,
      canUseCredits,
      message,
      freeCreditsUsed: user.freeCreditsUsed,
    };
  }

  async getCreditUsageHistory(userId: number): Promise<CreditUsage[]> {
    return this.creditUsageRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async createCheckoutSession(userId: number, membershipType: MembershipType): Promise<{ sessionId: string; url: string }> {
    if (membershipType === MembershipType.FREE) {
      throw new BadRequestException('Free membership cannot be purchased');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get or create Stripe customer
    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await this.stripe.customers.create({
        email: user.email,
        metadata: { userId: userId.toString() },
      });
      stripeCustomerId = customer.id;
      
      // Save Stripe customer ID to user
      await this.userRepository.update(userId, { stripeCustomerId });
    }

    // Get price ID based on membership type
    let priceId: string | undefined;
    if (membershipType === MembershipType.PREMIUM) {
      priceId = process.env.STRIPE_PREMIUM_PRICE_ID;
    } else if (membershipType === MembershipType.EXCLUSIVE) {
      priceId = process.env.STRIPE_EXCLUSIVE_PRICE_ID;
    } else {
      throw new BadRequestException('Invalid membership type');
    }

    if (!priceId) {
      throw new Error('Stripe price ID not configured for this membership type');
    }

    const session = await this.stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/subscription/cancelled`,
      metadata: {
        userId: userId.toString(),
        membershipType: membershipType,
      },
    });

    if (!session.url) {
      throw new Error('Failed to create checkout session URL');
    }

    return {
      sessionId: session.id,
      url: session.url,
    };
  }

  private async deactivateExistingSubscriptions(userId: number): Promise<void> {
    await this.subscriptionRepository.update(
      { userId, status: MembershipStatus.ACTIVE },
      { status: MembershipStatus.CANCELLED }
    );
  }

  private calculateEndDate(membershipType: MembershipType): Date {
    const now = new Date();
    switch (membershipType) {
      case MembershipType.PREMIUM:
      case MembershipType.EXCLUSIVE:
        // Monthly subscription
        return new Date(now.setMonth(now.getMonth() + 1));
      default:
        return now;
    }
  }

  // Webhook handlers
  async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const userId = parseInt(session.metadata?.userId || '0');
    const membershipType = session.metadata?.membershipType as MembershipType;

    if (!userId || !membershipType) {
      throw new Error('Invalid session metadata');
    }

    // Check if already processed
    const existingSubscription = await this.subscriptionRepository.findOne({
      where: { stripeSubscriptionId: session.subscription as string },
    });

    if (existingSubscription) {
     
      return;
    }

    // Create subscription record
    await this.createSubscription(userId, {
      membershipType,
      stripeSubscriptionId: session.subscription as string,
      stripeCustomerId: session.customer as string,
    });
  }

  async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    // For subscription invoices, the subscription ID is available
    if (invoice.billing_reason === 'subscription_cycle') {
      // Get subscription ID from the invoice
      const subscriptionId = (invoice as any).subscription;
      
      if (subscriptionId) {
        const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
        const userId = parseInt(subscription.metadata?.userId || '0');

        if (userId) {
          // Renew subscription
          await this.subscriptionRepository.update(
            { stripeSubscriptionId: subscription.id },
            { 
              status: MembershipStatus.ACTIVE,
              endDate: new Date((subscription as any).current_period_end * 1000),
            }
          );
        }
      }
    }
  }

  async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const userId = parseInt(subscription.metadata?.userId || '0');

    if (userId) {
      // Downgrade user to free
      await this.userRepository.update(userId, { 
        membershipType: MembershipType.FREE,
        freeCreditsUsed: false, // Reset free credit
      });

      // Update subscription status
      await this.subscriptionRepository.update(
        { stripeSubscriptionId: subscription.id },
        { status: MembershipStatus.CANCELLED }
      );
    }
  }

  //Cancel subscription endpoint
  async cancelSubscription(userId: number): Promise<{ success: boolean; message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Find active subscription
    const subscription = await this.subscriptionRepository.findOne({
      where: { userId, status: MembershipStatus.ACTIVE }
    });

    if (!subscription) {
      return {
        success: false,
        message: 'No active subscription found to cancel'
      };
    }

    if (!subscription.stripeSubscriptionId) {
      return {
        success: false,
        message: 'Subscription not linked to Stripe'
      };
    }

    try {
      // Cancel subscription in Stripe
      await this.stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
      
      // Update local subscription status
      await this.subscriptionRepository.update(
        { id: subscription.id },
        { status: MembershipStatus.CANCELLED }
      );

      // Downgrade user to free
      await this.userRepository.update(userId, {
        membershipType: MembershipType.FREE,
        freeCreditsUsed: false // Reset free credit
      });

      return {
        success: true,
        message: 'Subscription cancelled successfully. You have been downgraded to Free plan.'
      };
    } catch (error) {
      this.logger.error(`Error cancelling subscription: ${error.message}`);
      return {
        success: false,
        message: 'Failed to cancel subscription. Please try again or contact support.'
      };
    }
  }
}
