import { IsString, IsNotEmpty, IsOptional, IsNumber, IsIn, Min } from 'class-validator';

export class AddDnsRecordDto {
  @IsString()
  @IsIn(['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA'])
  type!: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS' | 'SRV' | 'CAA';

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  value!: string;

  @IsNumber()
  @IsOptional()
  @Min(60)
  ttl?: number;

  @IsNumber()
  @IsOptional()
  priority?: number;
}

export class UpdateDnsRecordDto {
  @IsString()
  @IsIn(['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA'])
  @IsOptional()
  type?: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS' | 'SRV' | 'CAA';

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  value?: string;

  @IsNumber()
  @IsOptional()
  @Min(60)
  ttl?: number;

  @IsNumber()
  @IsOptional()
  priority?: number;
}
