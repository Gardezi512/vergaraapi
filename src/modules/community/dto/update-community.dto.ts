// src/modules/community/dto/update-community.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateCommunityDto } from './create-community.dto';

export class UpdateCommunityDto extends PartialType(CreateCommunityDto) { }
