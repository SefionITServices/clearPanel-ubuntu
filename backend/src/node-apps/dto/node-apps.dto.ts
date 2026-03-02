import { IsString, IsOptional, IsNumber, IsArray, IsIn } from 'class-validator';

export class CreateAppDto {
  @IsString() name!: string;
  @IsIn(['node', 'python', 'static']) runtime!: string;
  @IsString() directory!: string;
  @IsString() startCommand!: string;
  @IsOptional() @IsNumber() port?: number;
  @IsOptional() @IsArray() env?: { key: string; value: string }[];
  @IsOptional() @IsString() nodeVersion?: string;
  @IsOptional() @IsString() pythonVersion?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() domain?: string; // optional nginx reverse-proxy domain
}

export class UpdateAppDto {
  @IsOptional() @IsString() startCommand?: string;
  @IsOptional() @IsNumber() port?: number;
  @IsOptional() @IsArray() env?: { key: string; value: string }[];
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() domain?: string;
}

export class CloneAppDto {
  @IsString() name!: string;
  @IsIn(['node', 'python', 'static']) runtime!: string;
  @IsString() repoUrl!: string;
  @IsOptional() @IsString() branch?: string;
  @IsString() directory!: string;
  @IsString() startCommand!: string;
  @IsOptional() @IsNumber() port?: number;
  @IsOptional() @IsArray() env?: { key: string; value: string }[];
}
