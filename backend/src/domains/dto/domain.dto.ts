import { IsString, IsNotEmpty, IsOptional, IsArray, IsIn } from 'class-validator';

export class AddDomainDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  folderPath?: string;

  @IsString()
  @IsOptional()
  pathMode?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  nameservers?: string[];

  @IsString()
  @IsOptional()
  phpVersion?: string;
}

export class UpdateDomainPathDto {
  @IsString()
  @IsNotEmpty()
  folderPath!: string;
}

export class UpdateDomainSettingsDto {
  @IsString()
  @IsOptional()
  folderPath?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  nameservers?: string[];

  @IsString()
  @IsOptional()
  phpVersion?: string;
}

export class SaveVhostDto {
  @IsString()
  @IsNotEmpty()
  config!: string;
}
