import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max } from 'class-validator';

export class CreateVhostDto {
  @IsString()
  @IsNotEmpty()
  documentRoot!: string;

  @IsString()
  @IsOptional()
  phpVersion?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  proxyPort?: number;
}
