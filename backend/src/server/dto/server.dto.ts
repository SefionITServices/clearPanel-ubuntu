import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';

export class SetHostnameDto {
  @IsString()
  @IsNotEmpty()
  hostname!: string;
}

export class ConfigureNameserversDto {
  @IsString()
  @IsOptional()
  primaryDomain?: string;

  @IsString()
  @IsOptional()
  serverIp?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  nameservers?: string[];
}
