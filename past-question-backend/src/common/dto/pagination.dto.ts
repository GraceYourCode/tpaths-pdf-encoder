import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
export class PaginationDto { @IsOptional() @IsInt() @Min(1) page=1; @IsOptional() @IsInt() @Min(1) @Max(100) limit=20; @IsOptional() @IsString() sortBy?:string; @IsOptional() @IsString() sortOrder?:'asc'|'desc'; @IsOptional() @IsString() search?:string; }
