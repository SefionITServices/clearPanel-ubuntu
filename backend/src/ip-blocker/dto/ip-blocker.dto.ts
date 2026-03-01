import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

const IP_OR_CIDR = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$|^([0-9a-fA-F:]+)(\/\d{1,3})?$/;

export class CreateIpBlockDto {
  @IsString() @IsNotEmpty()
  domain!: string;

  /** IPv4, IPv6, or CIDR notation */
  @IsString()
  @Matches(IP_OR_CIDR, { message: 'ip must be a valid IPv4/IPv6 address or CIDR range' })
  ip!: string;

  @IsString() @IsOptional()
  note?: string;
}
