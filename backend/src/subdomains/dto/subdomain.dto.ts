import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

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
  @IsIn(['public_html', 'root', 'websites', 'custom'])
  pathMode?: string;

  @IsString()
  @IsOptional()
  phpVersion?: string;
}
