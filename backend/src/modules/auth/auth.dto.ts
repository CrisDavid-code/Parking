import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

const lower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);
const PASSWORD = /^(?=.*[A-Za-z])(?=.*\d).{10,128}$/;

export class RegisterDto {
  @ApiProperty() @Transform(lower) @IsEmail() @MaxLength(254) email: string;
  @ApiProperty({ description: '10-128 chars, at least one letter and one digit' }) @IsString() @Matches(PASSWORD, { message: 'password must be 10-128 chars with letters and digits' }) password: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) fullName: string;
  @ApiPropertyOptional({ enum: ['personal', 'business'] }) @IsOptional() @IsIn(['personal', 'business']) accountType?: 'personal' | 'business';
}

export class LoginDto {
  @ApiProperty() @Transform(lower) @IsEmail() email: string;
  @ApiProperty() @IsString() @MaxLength(128) password: string;
}

export class RefreshDto {
  @ApiProperty() @IsString() @MaxLength(200) refreshToken: string;
}

export class ForgotPasswordDto {
  @ApiProperty() @Transform(lower) @IsEmail() email: string;
}

export class ResetPasswordDto {
  @ApiProperty() @IsString() @MaxLength(200) token: string;
  @ApiProperty() @IsString() @Matches(PASSWORD, { message: 'password must be 10-128 chars with letters and digits' }) password: string;
}
