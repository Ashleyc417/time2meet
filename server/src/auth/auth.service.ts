// import { BadRequestException, Injectable, Logger } from '@nestjs/common';
// import * as bcrypt from 'bcrypt';
// import ConfigService from '../config/config.service';
// import User from '../users/user.entity';
// import UsersService from '../users/users.service';
// import LocalSignupDto from './local-signup.dto';
// import MailService from '../mail/mail.service';
// import CustomJwtService from '../custom-jwt/custom-jwt.service';
// import VerifyEmailAddressDto, {
//   VerifyEmailAddressEntity,
// } from './verify-email-address.dto';
// import { SECONDS_PER_MINUTE, getSecondsSinceUnixEpoch } from '../dates.utils';
// import { encodeQueryParams } from '../misc.utils';

// const SALT_ROUNDS = 10;

// @Injectable()
// export default class AuthService {
//   private readonly logger = new Logger(AuthService.name);
//   private readonly publicURL: string;

//   constructor(
//     private usersService: UsersService,
//     private mailService: MailService,
//     private jwtService: CustomJwtService,
//     configService: ConfigService,
//   ) {
//     this.publicURL = configService.get('PUBLIC_URL');
//   }

//   async validateUser(email: string, password: string): Promise<User | null> {
//     const user = await this.usersService.findOneByEmail(email);
//     if (user === null) {
//       return null;
//     }
//     if (!user.PasswordHash) {
//       // Not present for users who signed up using OIDC
//       return null;
//     }
//     if (!(await bcrypt.compare(password, user.PasswordHash))) {
//       return null;
//     }
//     return user;
//   }

//   private createEmailVerificationEmailBody(
//     name: string,
//     url: string,
//     expiresMinutes: number,
//   ): string {
//     return (
//       `Hello ${name},\n` +
//       '\n' +
//       'Please click the following link to verify your email address:\n' +
//       '\n' +
//       `${url}\n` +
//       '\n' +
//       `This code will expire in ${expiresMinutes} minutes.\n` +
//       '\n' +
//       '-- \n' +
//       `CabbageMeet | ${this.publicURL}\n`
//     );
//   }

//   async generateAndSendVerificationEmail(body: LocalSignupDto) {
//     const expiresMinutes = 30;
//     const bodyWithExp: VerifyEmailAddressEntity = {
//       ...body,
//       exp: getSecondsSinceUnixEpoch() + expiresMinutes * SECONDS_PER_MINUTE,
//     };
//     const { encrypted, iv, salt, tag } = await this.jwtService.encryptText(
//       JSON.stringify(bodyWithExp),
//     );
//     const params: VerifyEmailAddressDto = {
//       encrypted_entity: encrypted.toString('base64url'),
//       iv: iv.toString('base64url'),
//       salt: salt.toString('base64url'),
//       tag: tag.toString('base64url'),
//     };
//     const url =
//       this.publicURL +
//       '/verify-email?' +
//       encodeQueryParams(params as unknown as Record<string, string>);
//     const sent = await this.mailService.sendNowIfAllowed({
//       recipient: { address: body.email, name: body.name },
//       subject: 'CabbageMeet signup confirmation',
//       body: this.createEmailVerificationEmailBody(
//         body.name,
//         url,
//         expiresMinutes,
//       ),
//     });
//     if (!sent) {
//       return false;
//     }
//     if (process.env.NODE_ENV === 'development') {
//       this.logger.debug(`verification url=${url}`);
//     }
//     return true;
//   }

//   async signup({
//     name,
//     email,
//     password,
//     subscribe_to_notifications,
//   }: LocalSignupDto): Promise<User> {
//     const user: Partial<User> = {
//       Name: name,
//       Email: email,
//       IsSubscribedToNotifications: subscribe_to_notifications,
//       PasswordHash: await bcrypt.hash(password, SALT_ROUNDS),
//     };
//     return this.usersService.create(user);
//   }

//   async signupIfEmailIsVerified({
//     encrypted_entity,
//     iv,
//     salt,
//     tag,
//   }: VerifyEmailAddressDto): Promise<User | null> {
//     let decryptedText: string | undefined;
//     try {
//       decryptedText = await this.jwtService.decryptText(
//         Buffer.from(encrypted_entity, 'base64url'),
//         Buffer.from(iv, 'base64url'),
//         Buffer.from(salt, 'base64url'),
//         Buffer.from(tag, 'base64url'),
//       );
//     } catch (err) {
//       this.logger.error(err);
//       throw new BadRequestException('Invalid encrypted entity');
//     }
//     const entity = JSON.parse(decryptedText) as VerifyEmailAddressEntity;
//     if (
//       !(
//         typeof entity === 'object' &&
//         typeof entity.name === 'string' &&
//         typeof entity.email === 'string' &&
//         typeof entity.password === 'string' &&
//         typeof entity.exp === 'number'
//       )
//     ) {
//       this.logger.debug(entity);
//       throw new BadRequestException('Invalid encrypted entity');
//     }
//     if (getSecondsSinceUnixEpoch() > entity.exp) {
//       throw new BadRequestException('Link expired');
//     }
//     const { exp, ...signupArgs } = entity;
//     return this.signup(signupArgs);
//   }

//   private createPasswordResetEmailBody(user: User): string {
//     const { token } = this.jwtService.serializeUserToJwt(user, 'pwreset');
//     const url =
//       this.publicURL + `/confirm-password-reset?pwresetToken=${token}`;
//     if (process.env.NODE_ENV === 'development') {
//       this.logger.debug(`password reset URL=${url}`);
//     }
//     return (
//       `Hello ${user.Name},\n` +
//       '\n' +
//       'Someone (hopefully you) recently requested a password reset for your\n' +
//       'CabbageMeet account. If this was you, please click the following link\n' +
//       'to proceed:\n' +
//       '\n' +
//       url +
//       '\n' +
//       '\n' +
//       'If this was not you, you may disregard this email.\n' +
//       '\n' +
//       '-- \n' +
//       'CabbageMeet | ' +
//       this.publicURL +
//       '\n'
//     );
//   }

//   async resetPassword(email: string) {
//     if (!this.mailService.isConfigured()) {
//       this.logger.warn('SMTP was not configured on this server');
//       return;
//     }
//     const user = await this.usersService.findOneByEmail(email);
//     if (!user) {
//       this.logger.debug(`User not found for email=${email}`);
//       return;
//     }
//     if (!user.PasswordHash) {
//       // If the user signed up via OAuth2, they should not be allowed to reset
//       // their password, because they never had one to begin with
//       this.logger.debug(`User for email=${email} does not have a password`);
//       return;
//     }
//     this.mailService.sendNowOrLater({
//       recipient: { address: email, name: user.Name },
//       subject: 'CabbageMeet password reset',
//       body: this.createPasswordResetEmailBody(user),
//     });
//   }

//   async confirmResetPassword(user: User, newPassword: string) {
//     await this.usersService.editUser(user.ID, {
//       PasswordHash: await bcrypt.hash(newPassword, SALT_ROUNDS),
//       // sign out everywhere
//       TimestampOfEarliestValidToken: null,
//     });
//   }
// }

// NEW CODE:
import { Injectable, Logger } from '@nestjs/common';
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

@Injectable()
export default class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly client: CognitoIdentityProviderClient;
  private readonly clientId: string;

  constructor(
    private usersService: UsersService,
    configService: ConfigService,
  ) {
    this.clientId = configService.get('COGNITO_CLIENT_ID') as string;
    this.client = new CognitoIdentityProviderClient({
      region: configService.get('COGNITO_REGION') as string,
    });
  }

  async signUp(name: string, email: string, password: string, subscribe_to_notifications: boolean): Promise<void> {
    await this.client.send(new SignUpCommand({
      ClientId: this.clientId,
      Username: email,
      Password: password,
      UserAttributes: [{ Name: 'email', Value: email }],
    }));
    // Create local user record (without password hash)
    await this.usersService.create({
      Name: name,
      Email: email,
      IsSubscribedToNotifications: subscribe_to_notifications,
    });
  }

  async confirmSignUp(email: string, code: string): Promise<void> {
    await this.client.send(new ConfirmSignUpCommand({
      ClientId: this.clientId,
      Username: email,
      ConfirmationCode: code,
    }));
  }

  async signIn(email: string, password: string): Promise<string> {
    const response = await this.client.send(new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: this.clientId,
      AuthParameters: { USERNAME: email, PASSWORD: password },
    }));
    return response.AuthenticationResult!.AccessToken!;
  }

  async forgotPassword(email: string): Promise<void> {
    await this.client.send(new ForgotPasswordCommand({
      ClientId: this.clientId,
      Username: email,
    }));
  }

  async confirmForgotPassword(email: string, code: string, newPassword: string): Promise<void> {
    await this.client.send(new ConfirmForgotPasswordCommand({
      ClientId: this.clientId,
      Username: email,
      ConfirmationCode: code,
      Password: newPassword,
    }));
  }
}