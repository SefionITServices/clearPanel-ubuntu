import { IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateFtpAccountDto {
  @IsString()
  @IsNotEmpty()
  domain!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9_.-]+$/)
  username!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password!: string;

  @IsString()
  @IsOptional()
  rootPath?: string;
}

export class ResetFtpPasswordDto {
  @IsString()
  @IsNotEmpty()
  login!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password!: string;
}
