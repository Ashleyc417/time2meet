import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import ConfigService from '../config/config.service';
import UsersService from '../users/users.service';
import User from '../users/user.entity';
import MailService from '../mail/mail.service';
import CustomJwtService from '../custom-jwt/custom-jwt.service';
import LocalSignupDto from './local-signup.dto';
import VerifyEmailAddressDto, {
  VerifyEmailAddressEntity,
} from './verify-email-address.dto';
import { SECONDS_PER_MINUTE, getSecondsSinceUnixEpoch } from '../dates.utils';
import { encodeQueryParams } from '../misc.utils';

const SALT_ROUNDS = 10;

@Injectable()
export default class AuthService {
  readonly cognitoConfigured: boolean;
  private readonly logger = new Logger(AuthService.name);
  private readonly client: CognitoIdentityProviderClient | null = null;
  private readonly clientId: string = '';
  private readonly publicURL: string;

  constructor(
    private usersService: UsersService,
    private mailService: MailService,
    private jwtService: CustomJwtService,
    configService: ConfigService,
  ) {
    this.publicURL = configService.get('PUBLIC_URL') as string;
    const clientId = configService.get('COGNITO_CLIENT_ID');
    const userPoolId = configService.get('COGNITO_USER_POOL_ID');
    this.cognitoConfigured = !!(clientId && userPoolId);
    if (this.cognitoConfigured) {
      this.clientId = clientId as string;
      this.client = new CognitoIdentityProviderClient({
        region: configService.get('COGNITO_REGION') as string,
      });
    }
  }

  // ── Non-Cognito (local) auth methods ─────────────────────────────────────────

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findOneByEmail(email);
    if (!user || !user.PasswordHash) return null;
    if (!(await bcrypt.compare(password, user.PasswordHash))) return null;
    return user;
  }

  private createEmailVerificationEmailBody(
    name: string,
    url: string,
    expiresMinutes: number,
  ): string {
    return (
      `Hello ${name},\n` +
      '\n' +
      'Please click the following link to verify your email address:\n' +
      '\n' +
      `${url}\n` +
      '\n' +
      `This code will expire in ${expiresMinutes} minutes.\n` +
      '\n' +
      '-- \n' +
      `CabbageMeet | ${this.publicURL}\n`
    );
  }

  async generateAndSendVerificationEmail(body: LocalSignupDto): Promise<boolean> {
    const expiresMinutes = 30;
    const bodyWithExp: VerifyEmailAddressEntity = {
      ...body,
      exp: getSecondsSinceUnixEpoch() + expiresMinutes * SECONDS_PER_MINUTE,
    };
    const { encrypted, iv, salt, tag } = await this.jwtService.encryptText(
      JSON.stringify(bodyWithExp),
    );
    const params: Omit<VerifyEmailAddressDto, 'email' | 'code'> = {
      encrypted_entity: encrypted.toString('base64url'),
      iv: iv.toString('base64url'),
      salt: salt.toString('base64url'),
      tag: tag.toString('base64url'),
    };
    const url =
      this.publicURL +
      '/verify-email?' +
      encodeQueryParams(params as Record<string, string>);
    const sent = await this.mailService.sendNowIfAllowed({
      recipient: { address: body.email, name: body.name },
      subject: 'CabbageMeet signup confirmation',
      body: this.createEmailVerificationEmailBody(body.name, url, expiresMinutes),
    });
    if (!sent) return false;
    if (process.env.NODE_ENV === 'development') {
      this.logger.debug(`verification url=${url}`);
    }
    return true;
  }

  async localSignup(body: LocalSignupDto): Promise<User> {
    return this.usersService.create({
      Name: body.name,
      Email: body.email,
      IsSubscribedToNotifications: body.subscribe_to_notifications ?? false,
      PasswordHash: await bcrypt.hash(body.password, SALT_ROUNDS),
    });
  }

  async signupIfEmailIsVerified(dto: VerifyEmailAddressDto): Promise<User | null> {
    let decryptedText: string | undefined;
    try {
      decryptedText = await this.jwtService.decryptText(
        Buffer.from(dto.encrypted_entity!, 'base64url'),
        Buffer.from(dto.iv!, 'base64url'),
        Buffer.from(dto.salt!, 'base64url'),
        Buffer.from(dto.tag!, 'base64url'),
      );
    } catch (err) {
      this.logger.error(err);
      throw new BadRequestException('Invalid encrypted entity');
    }
    const entity = JSON.parse(decryptedText) as VerifyEmailAddressEntity;
    if (
      !(
        typeof entity === 'object' &&
        typeof entity.name === 'string' &&
        typeof entity.email === 'string' &&
        typeof entity.password === 'string' &&
        typeof entity.exp === 'number'
      )
    ) {
      this.logger.debug(entity);
      throw new BadRequestException('Invalid encrypted entity');
    }
    if (getSecondsSinceUnixEpoch() > entity.exp) {
      throw new BadRequestException('Link expired');
    }
    const { exp, ...signupArgs } = entity;
    return this.localSignup(signupArgs);
  }

  // ── Cognito auth methods ─────────────────────────────────────────────────────

  async signUp(
    name: string,
    email: string,
    password: string,
    subscribe_to_notifications: boolean,
  ): Promise<void> {
    await this.client!.send(
      new SignUpCommand({
        ClientId: this.clientId,
        Username: email,
        Password: password,
        UserAttributes: [{ Name: 'email', Value: email }],
      }),
    );
    await this.usersService.create({
      Name: name,
      Email: email,
      IsSubscribedToNotifications: subscribe_to_notifications,
    });
  }

  async confirmSignUp(email: string, code: string): Promise<void> {
    await this.client!.send(
      new ConfirmSignUpCommand({
        ClientId: this.clientId,
        Username: email,
        ConfirmationCode: code,
      }),
    );
  }

  async signIn(email: string, password: string): Promise<string> {
    const response = await this.client!.send(
      new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: this.clientId,
        AuthParameters: { USERNAME: email, PASSWORD: password },
      }),
    );
    return response.AuthenticationResult!.AccessToken!;
  }

  async forgotPassword(email: string): Promise<void> {
    await this.client!.send(
      new ForgotPasswordCommand({
        ClientId: this.clientId,
        Username: email,
      }),
    );
  }

  async confirmForgotPassword(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<void> {
    await this.client!.send(
      new ConfirmForgotPasswordCommand({
        ClientId: this.clientId,
        Username: email,
        ConfirmationCode: code,
        Password: newPassword,
      }),
    );
  }
}
