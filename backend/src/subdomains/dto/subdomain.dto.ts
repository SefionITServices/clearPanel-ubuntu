import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateSubdomainDto {
  @IsString()
  @IsNotEmpty()
  prefix!: string;

  @IsString()
  @IsNotEmpty()
  parentDomain!: string;

  @IsString()
  @IsOptional()
  folderPath?: string;

  @IsString()
  @IsOptional()
  phpVersion?: string;
}
