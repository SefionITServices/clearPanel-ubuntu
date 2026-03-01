import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateDirPrivacyDto {
  @IsString() @IsNotEmpty()
  domain!: string;

  /** Path to protect, relative to document root, e.g. /admin */
  @IsString() @IsNotEmpty()
  dirPath!: string;

  /** Message shown in the browser auth prompt */
  @IsString() @IsNotEmpty()
  label!: string;
}

export class AddDirUserDto {
  @IsString() @IsNotEmpty()
  username!: string;

  @IsString() @MinLength(6)
  password!: string;
}
