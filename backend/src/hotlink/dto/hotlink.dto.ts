import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SetHotlinkDto {
  @IsString() @IsNotEmpty()
  domain!: string;

  @IsBoolean()
  enabled!: boolean;

  /** Extra hostname referrers to allow (besides self) */
  @IsArray() @IsString({ each: true }) @IsOptional()
  allowedDomains?: string[];

  /** File extensions to protect. Defaults if omitted */
  @IsArray() @IsString({ each: true }) @IsOptional()
  blockExtensions?: string[];
}
