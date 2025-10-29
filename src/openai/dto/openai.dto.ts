// dto/openai.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsArray, IsEnum, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class GenerateTextDto {
  @ApiProperty({
    description: 'Prompt para generar texto',
    example: 'Explícame qué es la inteligencia artificial',
  })
  @IsString()
  @IsNotEmpty()
  prompt: string;

  @ApiPropertyOptional({
    description: 'Modelo de OpenAI a utilizar',
    example: 'gpt-4',
    enum: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'],
  })
  @IsString()
  @IsOptional()
  model?: string;
}

export class ChatMessageDto {
  @ApiProperty({
    description: 'Rol del mensaje',
    enum: ['system', 'user', 'assistant'],
    example: 'user',
  })
  @IsEnum(['system', 'user', 'assistant'])
  @IsNotEmpty()
  role: string;

  @ApiProperty({
    description: 'Contenido del mensaje',
    example: 'Hola, ¿cómo estás?',
  })
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class ChatDto {
  @ApiProperty({
    description: 'Array de mensajes de la conversación',
    type: [ChatMessageDto],
    example: [
      { role: 'system', content: 'Eres un asistente útil' },
      { role: 'user', content: '¿Qué es NestJS?' }
    ]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: Array<{ role: string; content: string }>;
}

export class GenerateImageDto {
  @ApiProperty({
    description: 'Descripción de la imagen a generar',
    example: 'Un gato astronauta en el espacio, estilo digital art',
  })
  @IsString()
  @IsNotEmpty()
  prompt: string;

  @ApiPropertyOptional({
    description: 'Tamaño de la imagen',
    enum: ['1024x1024', '1792x1024', '1024x1792'],
    example: '1024x1024',
  })
  @IsEnum(['1024x1024', '1792x1024', '1024x1792'])
  @IsOptional()
  size?: '1024x1024' | '1792x1024' | '1024x1792';
}
