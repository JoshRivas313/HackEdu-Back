// dto/s3-pdf.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export class ExtractFromS3Dto {
  @ApiProperty({
    description: 'URL completa de S3 del archivo PDF',
    example: 's3://hack4edu-bucket/evaluations/test.pdf',
  })
  @IsString()
  @IsNotEmpty()
  s3Url: string;
}

export class AnalyzeS3PdfDto {
  @ApiProperty({
    description: 'URL completa de S3 del archivo PDF',
    example: 's3://hack4edu-bucket/evaluations/test.pdf',
  })
  @IsString()
  @IsNotEmpty()
  s3Url: string;

  @ApiProperty({
    description: 'Prompt o pregunta para analizar el PDF',
    example: '¿Cuáles son los puntos principales de este documento?',
  })
  @IsString()
  @IsNotEmpty()
  prompt: string;

  @ApiPropertyOptional({
    description: 'Modelo de IA a utilizar',
    example: 'gpt-4',
  })
  @IsString()
  @IsOptional()
  model?: string;
}

export class AnalyzeS3PdfWithProviderDto {
  @ApiProperty({
    description: 'URL completa de S3 del archivo PDF s3 or https',
    example: 's3://hack4edu-bucket/evaluations/test.pdf',
  })
  @IsString()
  @IsNotEmpty()
  s3Url: string;

  @ApiProperty({
    description: 'Prompt o pregunta para analizar el PDF',
    example: 'Resume cada sección del documento',
  })
  @IsString()
  @IsNotEmpty()
  prompt: string;

  @ApiProperty({
    description: 'Proveedor de IA a utilizar',
    enum: ['openai', 'gemini'],
    example: 'openai',
  })
  @IsEnum(['openai', 'gemini'])
  @IsNotEmpty()
  provider: 'openai' | 'gemini';
}
