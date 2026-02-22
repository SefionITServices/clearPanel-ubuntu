import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsIn } from 'class-validator';

export class CreateDatabaseDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  engine?: string;
}

export class DeleteDatabaseDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  engine?: string;
}

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsString()
  @IsOptional()
  host?: string;

  @IsString()
  @IsOptional()
  engine?: string;
}

export class DeleteUserDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  host?: string;

  @IsString()
  @IsOptional()
  engine?: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsString()
  @IsOptional()
  host?: string;

  @IsString()
  @IsOptional()
  engine?: string;
}

export class GrantPrivilegesDto {
  @IsString()
  @IsNotEmpty()
  user!: string;

  @IsString()
  @IsNotEmpty()
  database!: string;

  @IsString({ each: true })
  @IsOptional()
  privileges?: string[];

  @IsString()
  @IsOptional()
  host?: string;

  @IsString()
  @IsOptional()
  engine?: string;
}

export class RevokePrivilegesDto {
  @IsString()
  @IsNotEmpty()
  user!: string;

  @IsString()
  @IsNotEmpty()
  database!: string;

  @IsString()
  @IsOptional()
  host?: string;

  @IsString()
  @IsOptional()
  engine?: string;
}

export class ExecuteQueryDto {
  @IsString()
  @IsNotEmpty()
  database!: string;

  @IsString()
  @IsNotEmpty()
  sql!: string;

  @IsString()
  @IsOptional()
  engine?: string;
}

export class EngineActionDto {
  @IsString()
  @IsIn(['mariadb', 'mysql', 'postgresql'])
  engine!: string;
}

export class TableOperationDto {
  @IsString()
  @IsNotEmpty()
  database!: string;

  @IsString()
  @IsNotEmpty()
  table!: string;
}

export class SetRemoteAccessDto {
  @IsString()
  @IsIn(['mysql', 'postgresql'])
  engine!: 'mysql' | 'postgresql';

  @IsBoolean()
  enabled!: boolean;
}
