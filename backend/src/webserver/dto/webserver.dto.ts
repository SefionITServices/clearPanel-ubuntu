import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateVhostDto {
  @IsString()
  @IsNotEmpty()
  documentRoot!: string;

  @IsString()
  @IsOptional()
  phpVersion?: string;
}
