import { IsString, IsOptional, IsArray, IsBoolean } from 'class-validator';

export class PullImageDto {
  @IsString() image!: string;
}

export class RunContainerDto {
  @IsString() name!: string;
  @IsString() image!: string;
  @IsOptional() @IsArray() ports?: string[];   // e.g. ["8080:80"]
  @IsOptional() @IsArray() env?: string[];     // e.g. ["KEY=value"]
  @IsOptional() @IsArray() volumes?: string[]; // e.g. ["/host:/container"]
  @IsOptional() @IsString() network?: string;
  @IsOptional() @IsBoolean() detach?: boolean;
  @IsOptional() @IsString() restartPolicy?: string; // no|always|unless-stopped|on-failure
}

export class ComposeActionDto {
  @IsString() projectPath!: string;
}

export class CreateComposeDto {
  @IsString() name!: string;
  @IsString() projectPath!: string;
  @IsString() composeContent!: string;
}
