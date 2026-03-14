import { IsString, IsNotEmpty, IsIn, IsBoolean, IsOptional } from 'class-validator';

export class SaveErrorPageDto {
  @IsString()
  @IsNotEmpty()
  domain!: string;

  @IsString()
  @IsIn(['404', '500', '503'])
  code!: string;

  @IsString()
  html!: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}
