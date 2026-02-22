import { IsString, IsNotEmpty, IsEmail, IsBoolean, IsOptional } from 'class-validator';

export class InstallCertificateDto {
  @IsString()
  @IsNotEmpty()
  domain!: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsBoolean()
  @IsOptional()
  includeWww?: boolean;
}

export class RenewCertificateDto {
  @IsString()
  @IsOptional()
  domain?: string;
}
