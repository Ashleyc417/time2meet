import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import ConfigService from '../config/config.service';

@Injectable()
export class CognitoAuthGuard implements CanActivate {
  private verifier;

  constructor(configService: ConfigService) {
    this.verifier = CognitoJwtVerifier.create({
    userPoolId: configService.get('COGNITO_USER_POOL_ID') as string,
    clientId: configService.get('COGNITO_CLIENT_ID') as string,
    tokenUse: 'access',
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) throw new UnauthorizedException();
    try {
      req.user = await this.verifier.verify(token);
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}