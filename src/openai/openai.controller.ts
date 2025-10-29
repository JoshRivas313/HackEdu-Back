// openai.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { OpenaiService } from './openai.service';
import { 
  GenerateTextDto, 
  ChatDto, 
  GenerateImageDto 
} from './dto/openai.dto';

@ApiTags('openai')
@Controller('openai')
export class OpenaiController {
  constructor(private readonly openaiService: OpenaiService) {}

  @Post('generate')
  @ApiOperation({ 
    summary: 'Generar texto con OpenAI',
    description: 'Genera texto usando modelos de OpenAI (GPT-3.5, GPT-4, etc.)'
  })
  @ApiBody({ type: GenerateTextDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Texto generado exitosamente',
    schema: {
      example: {
        success: true,
        data: 'Este es el texto generado por OpenAI...'
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Prompt inválido' })
  @ApiResponse({ status: 500, description: 'Error al comunicarse con OpenAI' })
  async generateText(@Body() body: GenerateTextDto) {
    const response = await this.openaiService.generateText(
      body.prompt,
      body.model,
    );
    return {
      success: true,
      data: response,
    };
  }

  @Post('chat')
  @ApiOperation({ 
    summary: 'Chat con OpenAI',
    description: 'Mantiene una conversación con OpenAI usando el formato de mensajes'
  })
  @ApiBody({ type: ChatDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Respuesta del chat generada',
    schema: {
      example: {
        success: true,
        data: 'Respuesta del asistente...'
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Mensajes inválidos' })
  async chat(@Body() body: ChatDto) {
    const response = await this.openaiService.chat(body.messages);
    return {
      success: true,
      data: response,
    };
  }

  @Post('image')
  @ApiOperation({ 
    summary: 'Generar imagen con DALL-E',
    description: 'Genera una imagen usando DALL-E de OpenAI'
  })
  @ApiBody({ type: GenerateImageDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Imagen generada exitosamente',
    schema: {
      example: {
        success: true,
        data: {
          url: 'https://oaidalleapiprodscus.blob.core.windows.net/...'
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Prompt inválido' })
  @ApiResponse({ status: 500, description: 'Error al generar imagen' })
  async generateImage(@Body() body: GenerateImageDto) {
    const imageUrl = await this.openaiService.generateImage(body.prompt, body.size);
    return {
      success: true,
      data: {
        url: imageUrl,
      },
    };
  }
}