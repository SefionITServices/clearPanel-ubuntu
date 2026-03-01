import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateRedirectDto {
  @IsString() @IsNotEmpty()
  domain!: string;

  /** Source path, e.g. /old-page  or  old-domain.com */
  @IsString() @IsNotEmpty()
  from!: string;

  /** Destination URL */
  @IsString() @IsNotEmpty()
  to!: string;

  /** HTTP status code */
  @IsIn(['301', '302'])
  type!: '301' | '302';

  /** If true, capture and append $request_uri to destination */
  @IsBoolean() @IsOptional()
  wildcard?: boolean;
}
