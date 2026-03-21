// import { PickType } from '@nestjs/swagger';
// import LocalSignupDto from './local-signup.dto';

// export default class ConfirmResetPasswordDto extends PickType(LocalSignupDto, [
//   'password',
// ]) {}
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export default class ConfirmResetPasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;
}