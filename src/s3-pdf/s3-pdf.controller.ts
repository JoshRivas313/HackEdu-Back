// s3-pdf.controller.ts
import {
  Controller,
  Post,
  Body,
  BadRequestException,
  Get,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiQuery } from '@nestjs/swagger';
import { S3PdfService } from './s3-pdf.service';
import { PdfService } from '../pdf/pdf.service';
import { OpenaiService } from '../openai/openai.service';
import { GeminiService } from '../gemini/gemini.service';
import {
  ExtractFromS3Dto,
  AnalyzeS3PdfDto,
  AnalyzeS3PdfWithProviderDto,
} from './dto/s3-pdf.dto';

@ApiTags('s3-pdf')
@Controller('s3-pdf')
export class S3PdfController {
  constructor(
    private readonly s3PdfService: S3PdfService,
    private readonly pdfService: PdfService,
    private readonly openaiService: OpenaiService,
    private readonly geminiService: GeminiService,
  ) {}

  @Post('extract')
  @ApiOperation({ 
    summary: 'Extraer texto de un PDF alojado en S3',
    description: 'Descarga un PDF desde S3 y extrae su contenido de texto con metadata'
  })
  @ApiBody({ type: ExtractFromS3Dto })
  @ApiResponse({ 
    status: 200, 
    description: 'Texto extraído exitosamente',
    schema: {
      example: {
        success: true,
        data: {
          s3Url: 's3://bucket/file.pdf',
          bucket: 'bucket',
          key: 'file.pdf',
          fileSize: 12345,
          text: 'Contenido del PDF...',
          numPages: 10,
          estimatedTokens: 2500,
          info: {}
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'URL de S3 inválida o error al procesar' })
  async extractText(@Body() dto: ExtractFromS3Dto) {
    if (!dto.s3Url) {
      throw new BadRequestException('s3Url es requerido');
    }

    try {
      const data = await this.s3PdfService.extractTextWithMetadataFromS3Url(
        dto.s3Url,
      );
      const cleanText = this.pdfService.cleanText(data.text);
      const estimatedTokens = this.pdfService.estimateTokens(cleanText);

      return {
        success: true,
        data: {
          s3Url: dto.s3Url,
          bucket: data.s3Info.bucket,
          key: data.s3Info.key,
          fileSize: data.s3Info.size,
          text: cleanText,
          numPages: data.numPages,
          estimatedTokens,
          info: data.info,
        },
      };
    } catch (error) {
      throw new BadRequestException(error.message || 'Error al procesar PDF de S3');
    }
  }

  @Get('validate')
  @ApiOperation({ 
    summary: 'Validar URL de S3',
    description: 'Verifica si una URL de S3 es válida y si el archivo existe'
  })
  @ApiQuery({ 
    name: 'url', 
    description: 'URL de S3 a validar',
    example: 's3://hack4edu-bucket/evaluations/test.pdf'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Validación exitosa',
    schema: {
      example: {
        success: true,
        valid: true,
        exists: true,
        data: {
          bucket: 'bucket',
          key: 'file.pdf',
          exists: true,
          size: 12345,
          contentType: 'application/pdf'
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'URL no proporcionada' })
  async validateS3Url(@Query('url') url: string) {
    if (!url) {
      throw new BadRequestException('URL es requerida');
    }

    const isValid = this.s3PdfService.isValidS3Url(url);
    
    if (!isValid) {
      return {
        success: false,
        valid: false,
        message: 'URL de S3 inválida',
      };
    }

    const fileInfo = await this.s3PdfService.getS3FileInfo(url);

    return {
      success: true,
      valid: isValid,
      exists: fileInfo.exists,
      data: fileInfo,
    };
  }

  @Post('analyze-with-openai')
  @ApiOperation({ 
    summary: 'Analizar PDF de S3 con OpenAI',
    description: 'Extrae el texto de un PDF en S3 y lo analiza usando OpenAI'
  })
  @ApiBody({ type: AnalyzeS3PdfDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Análisis completado exitosamente',
    schema: {
      example: {
        success: true,
        data: {
          s3Url: 's3://bucket/file.pdf',
          prompt: '¿De qué trata el documento?',
          response: 'El documento trata sobre...',
          estimatedTokens: 3000
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos o error en el análisis' })
  async analyzeWithOpenAI(@Body() dto: AnalyzeS3PdfDto) {
    if (!dto.s3Url) {
      throw new BadRequestException('s3Url es requerido');
    }

    if (!dto.prompt) {
      throw new BadRequestException('prompt es requerido');
    }

    try {
      const text = await this.s3PdfService.extractTextFromS3Url(dto.s3Url);
      const cleanText = this.pdfService.cleanText(text);
      const truncatedText = this.pdfService.truncateText(cleanText, 100000);

      const fullPrompt = `
Documento PDF desde S3: "${dto.s3Url}"

Contenido del documento:
${truncatedText}

Pregunta/Instrucción:
${dto.prompt}
      `.trim();

      const response = await this.openaiService.generateText(
        fullPrompt,
        dto.model,
      );

      return {
        success: true,
        data: {
          s3Url: dto.s3Url,
          prompt: dto.prompt,
          response,
          estimatedTokens: this.pdfService.estimateTokens(fullPrompt),
        },
      };
    } catch (error) {
      throw new BadRequestException(error.message || 'Error al analizar PDF de S3');
    }
  }

  @Post('analyze-with-gemini')
  @ApiOperation({ 
    summary: 'Analizar PDF de S3 con Gemini',
    description: 'Extrae el texto de un PDF en S3 y lo analiza usando Google Gemini'
  })
  @ApiBody({ type: AnalyzeS3PdfDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Análisis completado exitosamente',
    schema: {
      example: {
        success: true,
        data: {
          s3Url: 's3://bucket/file.pdf',
          prompt: 'Resume el documento',
          response: 'Resumen: El documento...',
          estimatedTokens: 2800
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos o error en el análisis' })
  async analyzeWithGemini(@Body() dto: AnalyzeS3PdfDto) {
    if (!dto.s3Url) {
      throw new BadRequestException('s3Url es requerido');
    }

    if (!dto.prompt) {
      throw new BadRequestException('prompt es requerido');
    }

    try {
      const text = await this.s3PdfService.extractTextFromS3Url(dto.s3Url);
      const cleanText = this.pdfService.cleanText(text);
      const truncatedText = this.pdfService.truncateText(cleanText, 100000);

      const fullPrompt = `
Documento PDF desde S3: "${dto.s3Url}"

Contenido del documento:
${truncatedText}

Pregunta/Instrucción:
${dto.prompt}
      `.trim();

      const response = await this.geminiService.generateText(
        fullPrompt,
        dto.model,
      );

      return {
        success: true,
        data: {
          s3Url: dto.s3Url,
          prompt: dto.prompt,
          response,
          estimatedTokens: this.pdfService.estimateTokens(fullPrompt),
        },
      };
    } catch (error) {
      throw new BadRequestException(error.message || 'Error al analizar PDF de S3');
    }
  }

  @Post('analyze-chunks')
  @ApiOperation({ 
    summary: 'Analizar PDF de S3 por chunks',
    description: 'Divide el PDF en fragmentos y los analiza por separado usando OpenAI o Gemini'
  })
  @ApiBody({ type: AnalyzeS3PdfWithProviderDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Análisis por chunks completado',
    schema: {
      example: {
        success: true,
        data: {
          s3Url: 's3://bucket/file.pdf',
          prompt: 'Analiza cada sección',
          provider: 'openai',
          totalChunks: 3,
          responses: [
            { chunkIndex: 1, totalChunks: 3, response: 'Análisis parte 1...' },
            { chunkIndex: 2, totalChunks: 3, response: 'Análisis parte 2...' },
            { chunkIndex: 3, totalChunks: 3, response: 'Análisis parte 3...' }
          ]
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos o error en el análisis' })
  async analyzeInChunks(@Body() dto: AnalyzeS3PdfWithProviderDto) {
    if (!dto.s3Url) {
      throw new BadRequestException('s3Url es requerido');
    }

    if (!dto.prompt) {
      throw new BadRequestException('prompt es requerido');
    }

    if (!dto.provider || !['openai', 'gemini'].includes(dto.provider)) {
      throw new BadRequestException('provider debe ser "openai" o "gemini"');
    }

    try {
      const text = await this.s3PdfService.extractTextFromS3Url(dto.s3Url);
      const cleanText = this.pdfService.cleanText(text);
      const chunks = this.pdfService.splitTextIntoChunks(cleanText, 10000);

      const chunkResponses: Array<{
        chunkIndex: number;
        totalChunks: number;
        response: string;
      }> = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunkPrompt = `
Procesando parte ${i + 1} de ${chunks.length} del documento desde S3 "${dto.s3Url}"

Contenido de esta parte:
${chunks[i]}

Instrucción: ${dto.prompt}
        `.trim();

        let response: string;

        if (dto.provider === 'openai') {
          response = await this.openaiService.generateText(chunkPrompt);
        } else {
          response = await this.geminiService.generateText(chunkPrompt);
        }

        chunkResponses.push({
          chunkIndex: i + 1,
          totalChunks: chunks.length,
          response,
        });
      }

      return {
        success: true,
        data: {
          s3Url: dto.s3Url,
          prompt: dto.prompt,
          provider: dto.provider,
          totalChunks: chunks.length,
          responses: chunkResponses,
        },
      };
    } catch (error) {
      throw new BadRequestException(error.message || 'Error al analizar PDF de S3');
    }
  }
}