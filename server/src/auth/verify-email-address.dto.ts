import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import LocalSignupDto from './local-signup.dto';

// Used internally by the non-Cognito email verification flow
export class VerifyEmailAddressEntity extends LocalSignupDto {
  // Unix epoch timestamp — request is invalid after this time
  @IsNumber()
  exp: number;
}

export default class VerifyEmailAddressDto {
  // ── Cognito flow ────────────────────────────────────────────────────────────
  @ApiProperty({ required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  code?: string;

  // ── Non-Cognito (encrypted-entity) flow ────────────────────────────────────
  @ApiProperty({ required: false })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  encrypted_entity?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  iv?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  salt?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  tag?: string;
}
