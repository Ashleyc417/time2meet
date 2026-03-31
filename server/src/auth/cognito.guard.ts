import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import ConfigService from '../config/config.service';
import UsersService from '../users/users.service';

@Injectable()
export class CognitoAuthGuard implements CanActivate {
  private readonly cognitoConfigured: boolean;
  private verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

  constructor(
    private usersService: UsersService,
    configService: ConfigService,
  ) {
    const userPoolId = configService.get('COGNITO_USER_POOL_ID');
    const clientId = configService.get('COGNITO_CLIENT_ID');
    this.cognitoConfigured = !!(userPoolId && clientId);
    if (this.cognitoConfigured) {
      this.verifier = CognitoJwtVerifier.create({
        userPoolId: userPoolId as string,
        clientId: clientId as string,
        tokenUse: 'id',
      });
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.cognitoConfigured) throw new UnauthorizedException();
    const req = context.switchToHttp().getRequest();
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) throw new UnauthorizedException();
    try {
      const payload = await this.verifier!.verify(token);
      const email = payload.email as string;
      let user = await this.usersService.findOneByEmail(email);
      if (!user) {
        // First login: auto-provision the user from their Cognito profile
        const name = (payload['name'] as string | undefined) || email.split('@')[0];
        user = await this.usersService.create({ Name: name, Email: email });
      }
      req.user = user;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}

@Injectable()
export class OptionalCognitoAuthGuard implements CanActivate {
  private readonly cognitoConfigured: boolean;
  private verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

  constructor(
    private usersService: UsersService,
    configService: ConfigService,
  ) {
    const userPoolId = configService.get('COGNITO_USER_POOL_ID');
    const clientId = configService.get('COGNITO_CLIENT_ID');
    this.cognitoConfigured = !!(userPoolId && clientId);
    if (this.cognitoConfigured) {
      this.verifier = CognitoJwtVerifier.create({
        userPoolId: userPoolId as string,
        clientId: clientId as string,
        tokenUse: 'id',
      });
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    if (!this.cognitoConfigured) {
      req.user = null;
      return true;
    }
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      req.user = null;
      return true;
    }
    try {
      const payload = await this.verifier!.verify(token);
      const email = payload.email as string;
      let user = await this.usersService.findOneByEmail(email);
      if (!user) {
        const name = (payload['name'] as string | undefined) || email.split('@')[0];
        user = await this.usersService.create({ Name: name, Email: email });
      }
      req.user = user;
    } catch {
      req.user = null;
    }
    return true;
  }
}
