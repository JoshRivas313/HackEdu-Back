// s3-pdf.controller.ts
import {
  Controller,
  Post,
  Body,
  BadRequestException,
  Get,
  Query,
} from '@nestjs/common';
import { S3PdfService } from './s3-pdf.service';
import { PdfService } from '../pdf/pdf.service';
import { OpenaiService } from '../openai/openai.service';
import { GeminiService } from '../gemini/gemini.service';

// DTOs
class ExtractFromS3Dto {
  s3Url: string;
}

class AnalyzeS3PdfDto {
  s3Url: string;
  prompt: string;
  model?: string;
}

class AnalyzeS3PdfWithProviderDto {
  s3Url: string;
  prompt: string;
  provider: 'openai' | 'gemini';
}

@Controller('s3-pdf')
export class S3PdfController {
  constructor(
    private readonly s3PdfService: S3PdfService,
    private readonly pdfService: PdfService,
    private readonly openaiService: OpenaiService,
    private readonly geminiService: GeminiService,
  ) {}

  /**
   * Extrae texto de un PDF alojado en S3
   */
  @Post('extract')
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

  /**
   * Valida si una URL de S3 es válida y existe
   */
  @Get('validate')
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

  /**
   * Analiza un PDF de S3 con OpenAI
   */
  @Post('analyze-with-openai')
  async analyzeWithOpenAI(@Body() dto: AnalyzeS3PdfDto) {
    if (!dto.s3Url) {
      throw new BadRequestException('s3Url es requerido');
    }

    if (!dto.prompt) {
      throw new BadRequestException('prompt es requerido');
    }

    try {
      // Extraer texto del PDF en S3
      const text = await this.s3PdfService.extractTextFromS3Url(dto.s3Url);
      const cleanText = this.pdfService.cleanText(text);
      const truncatedText = this.pdfService.truncateText(cleanText, 100000);

      // Crear prompt completo
      const fullPrompt = `
Documento PDF desde S3: "${dto.s3Url}"

Contenido del documento:
${truncatedText}

Pregunta/Instrucción:
${dto.prompt}
      `.trim();

      // Enviar a OpenAI
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

  /**
   * Analiza un PDF de S3 con Gemini
   */
  @Post('analyze-with-gemini')
  async analyzeWithGemini(@Body() dto: AnalyzeS3PdfDto) {
    if (!dto.s3Url) {
      throw new BadRequestException('s3Url es requerido');
    }

    if (!dto.prompt) {
      throw new BadRequestException('prompt es requerido');
    }

    try {
      // Extraer texto del PDF en S3
      const text = await this.s3PdfService.extractTextFromS3Url(dto.s3Url);
      const cleanText = this.pdfService.cleanText(text);
      const truncatedText = this.pdfService.truncateText(cleanText, 100000);

      // Crear prompt completo
      const fullPrompt = `
Documento PDF desde S3: "${dto.s3Url}"

Contenido del documento:
${truncatedText}

Pregunta/Instrucción:
${dto.prompt}
      `.trim();

      // Enviar a Gemini
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

  /**
   * Analiza un PDF de S3 por chunks
   */
  @Post('analyze-chunks')
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
      // Extraer texto
      const text = await this.s3PdfService.extractTextFromS3Url(dto.s3Url);
      const cleanText = this.pdfService.cleanText(text);

      // Dividir en chunks
      const chunks = this.pdfService.splitTextIntoChunks(cleanText, 10000);

      // Procesar cada chunk
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