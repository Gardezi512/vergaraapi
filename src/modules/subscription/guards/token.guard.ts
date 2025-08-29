import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { SubscriptionService } from '../subscription.service';

@Injectable()
export class CreditGuard implements CanActivate {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const creditBalance = await this.subscriptionService.checkCreditBalance(user.id);
    
    if (!creditBalance.canUseCredits) {
      throw new ForbiddenException(creditBalance.message);
    }

    return true;
  }
}
