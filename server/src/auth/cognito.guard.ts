import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import * as jsonwebtoken from 'jsonwebtoken';
import ConfigService from '../config/config.service';
import UsersService from '../users/users.service';

@Injectable()
export class CognitoAuthGuard implements CanActivate {
  private readonly cognitoConfigured: boolean;
  private verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

  constructor(
    private usersService: UsersService,
    configService: ConfigService,
    @Optional() @Inject('JWT_SIGNING_KEY') private readonly signingKey: string | null,
  ) {
    const userPoolId = configService.get('COGNITO_USER_POOL_ID');
    const clientId = configService.get('COGNITO_CLIENT_ID');
    this.cognitoConfigured = !!(userPoolId && clientId);
    if (this.cognitoConfigured) {
      this.verifier = CognitoJwtVerifier.create({
        userPoolId: userPoolId as string,
        clientId: clientId as string,
        tokenUse: 'access',
      });
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) throw new UnauthorizedException();
    try {
      if (this.cognitoConfigured) {
        const payload = await this.verifier!.verify(token);
        const user = await this.usersService.findOneByEmail(payload.email as string);
        if (!user) throw new UnauthorizedException();
        req.user = user;
      } else {
        const payload = jsonwebtoken.verify(token, this.signingKey!) as { sub: string };
        const user = await this.usersService.findOneByID(+payload.sub);
        if (!user) throw new UnauthorizedException();
        req.user = user;
      }
      return true;
    } catch (err) {
      throw new UnauthorizedException();
    }
  }
}
