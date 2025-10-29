// dto/evaluation.dto.ts
import { 
  IsString, 
  IsOptional, 
  IsArray, 
  IsNumber, 
  IsNotEmpty, 
  ValidateNested, 
  IsUUID 
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRubricItemDto {
  @ApiProperty({
    description: 'Orden del ítem en la rúbrica',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  itemOrder: number;

  @ApiProperty({
    description: 'Título del ítem de la rúbrica',
    example: 'Claridad en la exposición',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({
    description: 'Condiciones o criterios de evaluación',
    example: 'El estudiante debe explicar los conceptos de forma clara y concisa',
  })
  @IsString()
  @IsOptional()
  conditions?: string;

  @ApiPropertyOptional({
    description: 'Puntaje máximo para este ítem',
    example: 10,
  })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  maxScore?: number;
}

export class CreateEvaluationDto {
  @ApiProperty({
    description: 'Título de la evaluación',
    example: 'Examen Final de Matemáticas',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({
    description: 'Descripción de la evaluación',
    example: 'Evaluación comprensiva del curso de álgebra lineal',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Número total de grupos',
    example: 5,
  })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  totalGroups?: number;

  @ApiPropertyOptional({
    description: 'ID del propietario de la evaluación',
    example: 'clx1234567890abcdef',
  })
  @IsUUID()
  @IsOptional()
  ownerId?: string;

  @ApiPropertyOptional({
    description: 'Items de la rúbrica (criterios de evaluación)',
    type: [CreateRubricItemDto],
    example: [
      { itemOrder: 1, title: 'Claridad', conditions: 'Explicación clara y concisa', maxScore: 5 },
      { itemOrder: 2, title: 'Coherencia', conditions: 'Ideas bien estructuradas', maxScore: 5 },
    ]
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateRubricItemDto)
  rubricItems?: CreateRubricItemDto[];
}

export class UpdateEvaluationDto {
  @ApiPropertyOptional({
    description: 'Título de la evaluación',
    example: 'Examen Final Actualizado',
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    description: 'Descripción de la evaluación',
    example: 'Nueva descripción',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Número total de grupos',
    example: 8,
  })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  totalGroups?: number;

  @ApiPropertyOptional({
    description: 'Items adicionales para agregar a la rúbrica',
    type: [CreateRubricItemDto],
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateRubricItemDto)
  additionalRubricItems?: CreateRubricItemDto[];
}


export class CreateGroupDto {
  @ApiProperty({
    description: 'ID de la evaluación a la que pertenece el grupo',
    example: 'clx1234567890abcdef',
  })
  @IsUUID()
  @IsNotEmpty()
  evaluationId: string;

  @ApiProperty({
    description: 'Código único del grupo',
    example: 'G001',
  })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({
    description: 'Nombre del grupo',
    example: 'Grupo A',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'Cantidad de estudiantes en el grupo',
    example: 4,
  })
  @IsNumber()
  @IsOptional()
  studentCount?: number;
}

export class UpdateGroupDto {
  @ApiPropertyOptional({
    description: 'Código del grupo',
    example: 'G002',
  })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional({
    description: 'Nombre del grupo',
    example: 'Grupo B',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'Cantidad de estudiantes',
    example: 5,
  })
  @IsNumber()
  @IsOptional()
  studentCount?: number;
}

export class CreateSubmissionDto {
  @ApiProperty({
    description: 'ID del grupo al que pertenece la submission',
    example: 'clx1234567890abcdef',
  })
  @IsUUID()
  @IsNotEmpty()
  groupId: string;

  @ApiPropertyOptional({
    description: 'Nombre del archivo subido',
    example: 'proyecto_final.pdf',
  })
  @IsString()
  @IsOptional()
  fileName?: string;

  @ApiPropertyOptional({
    description: 'URL del archivo en S3',
    example: 's3://hack4edu-bucket/submissions/grupo1/proyecto.pdf',
  })
  @IsString()
  @IsOptional()
  fileUrl?: string;
}