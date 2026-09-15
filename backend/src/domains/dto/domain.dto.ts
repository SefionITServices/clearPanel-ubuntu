import { IsString, IsNotEmpty, IsOptional, IsArray, IsIn, IsInt, Min, Max } from 'class-validator';

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

  @IsString()
  @IsOptional()
  proxyHost?: string;
}

export class LinkAppDto {
  @IsString()
  @IsNotEmpty()
  appId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsString()
  @IsOptional()
  proxyHost?: string;
}

export class LinkContainerDto {
  @IsString()
  @IsNotEmpty()
  containerId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsString()
  @IsOptional()
  proxyHost?: string;
}

export class SaveVhostDto {
  @IsString()
  @IsNotEmpty()
  config!: string;
}
