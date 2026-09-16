import { IsArray, ArrayNotEmpty, IsString } from 'class-validator';

export class MarkMultipleDto {
  @IsArray()
  // allow empty to be a no-op
  ids!: string[];
}
