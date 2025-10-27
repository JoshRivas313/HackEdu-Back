import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { PdfService } from './pdf.service';
import { OpenaiService } from '../openai/openai.service';
import { GeminiService } from '../gemini/gemini.service';

@Controller('pdf')
export class PdfController {
  constructor(
    private readonly pdfService: PdfService,
    private readonly openaiService: OpenaiService,
    private readonly geminiService: GeminiService,
  ) {}

  /**
   * Extrae solo el texto del PDF
   */
  @Post('extract')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `pdf-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
          return cb(new BadRequestException('Solo se permiten archivos PDF'), false);
        }
        cb(null, true);
      },
    }),
  )
  async extractText(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo');
    }

    try {
      const data = await this.pdfService.extractTextWithMetadata(file.path);
      const cleanText = this.pdfService.cleanText(data.text);
      const estimatedTokens = this.pdfService.estimateTokens(cleanText);

      // Eliminar archivo después de procesar
      await this.pdfService.deleteFile(file.path);

      return {
        success: true,
        data: {
          filename: file.originalname,
          text: cleanText,
          numPages: data.numPages,
          estimatedTokens,
          info: data.info,
        },
      };
    } catch (error) {
      // Asegurar que el archivo se elimine incluso si hay error
      await this.pdfService.deleteFile(file.path);
      throw error;
    }
  }

  /**
   * Analiza el PDF con OpenAI (extrae texto y lo envía como prompt)
   */
  @Post('analyze-with-openai')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `pdf-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
          return cb(new BadRequestException('Solo se permiten archivos PDF'), false);
        }
        cb(null, true);
      },
    }),
  )
  async analyzeWithOpenAI(
    @UploadedFile() file: Express.Multer.File,
    @Body('prompt') prompt: string,
    @Body('model') model?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo');
    }

    if (!prompt) {
      throw new BadRequestException('Debes proporcionar un prompt');
    }

    try {
      // Extraer y limpiar texto
      const text = await this.pdfService.extractText(file.path);
      const cleanText = this.pdfService.cleanText(text);
      const truncatedText = this.pdfService.truncateText(cleanText, 100000);

      // Crear prompt completo
      const fullPrompt = `
Documento PDF: "${file.originalname}"

Contenido del documento:
${truncatedText}

Pregunta/Instrucción:
${prompt}
      `.trim();

      // Enviar a OpenAI
      const response = await this.openaiService.generateText(fullPrompt, model);

      // Eliminar archivo
      await this.pdfService.deleteFile(file.path);

      return {
        success: true,
        data: {
          filename: file.originalname,
          prompt,
          response,
          estimatedTokens: this.pdfService.estimateTokens(fullPrompt),
        },
      };
    } catch (error) {
      await this.pdfService.deleteFile(file.path);
      throw error;
    }
  }

  /**
   * Analiza el PDF con Gemini (extrae texto y lo envía como prompt)
   */
  @Post('analyze-with-gemini')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `pdf-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
          return cb(new BadRequestException('Solo se permiten archivos PDF'), false);
        }
        cb(null, true);
      },
    }),
  )
  async analyzeWithGemini(
    @UploadedFile() file: Express.Multer.File,
    @Body('prompt') prompt: string,
    @Body('model') model?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo');
    }

    if (!prompt) {
      throw new BadRequestException('Debes proporcionar un prompt');
    }

    try {
      // Extraer y limpiar texto
      const text = await this.pdfService.extractText(file.path);
      const cleanText = this.pdfService.cleanText(text);
      const truncatedText = this.pdfService.truncateText(cleanText, 100000);

      // Crear prompt completo
      const fullPrompt = `
Documento PDF: "${file.originalname}"

Contenido del documento:
${truncatedText}

Pregunta/Instrucción:
${prompt}
      `.trim();

      // Enviar a Gemini
      const response = await this.geminiService.generateText(fullPrompt, model);

      // Eliminar archivo
      await this.pdfService.deleteFile(file.path);

      return {
        success: true,
        data: {
          filename: file.originalname,
          prompt,
          response,
          estimatedTokens: this.pdfService.estimateTokens(fullPrompt),
        },
      };
    } catch (error) {
      await this.pdfService.deleteFile(file.path);
      throw error;
    }
  }

  /**
   * Analiza el PDF por chunks (útil para documentos muy grandes)
   */
  @Post('analyze-chunks')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `pdf-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
          return cb(new BadRequestException('Solo se permiten archivos PDF'), false);
        }
        cb(null, true);
      },
    }),
  )
  async analyzeInChunks(
    @UploadedFile() file: Express.Multer.File,
    @Body('prompt') prompt: string,
    @Body('provider') provider: 'openai' | 'gemini',
  ) {
    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo');
    }

    if (!prompt) {
      throw new BadRequestException('Debes proporcionar un prompt');
    }

    if (!provider || !['openai', 'gemini'].includes(provider)) {
      throw new BadRequestException('Provider debe ser "openai" o "gemini"');
    }

    try {
      // Extraer texto
      const text = await this.pdfService.extractText(file.path);
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
Procesando parte ${i + 1} de ${chunks.length} del documento "${file.originalname}"

Contenido de esta parte:
${chunks[i]}

Instrucción: ${prompt}
        `.trim();

        let response: string;

        if (provider === 'openai') {
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

      // Eliminar archivo
      await this.pdfService.deleteFile(file.path);

      return {
        success: true,
        data: {
          filename: file.originalname,
          prompt,
          provider,
          totalChunks: chunks.length,
          responses: chunkResponses,
        },
      };
    } catch (error) {
      await this.pdfService.deleteFile(file.path);
      throw error;
    }
  }
}
