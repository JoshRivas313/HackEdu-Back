import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as fs from 'fs/promises';
import { PDFParse } from 'pdf-parse';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  /**
   * Extrae texto de un archivo PDF
   * @param filePath - Ruta al archivo PDF
   * @returns Texto extraído del PDF
   */
  async extractText(filePath: string): Promise<string> {
    try {
      this.logger.log(`Extrayendo texto del PDF: ${filePath}`);

      // Verificar que el archivo existe
      const stats = await fs.stat(filePath);
      
      if (stats.size > this.MAX_FILE_SIZE) {
        throw new BadRequestException(
          `El archivo es demasiado grande. Máximo: ${this.MAX_FILE_SIZE / 1024 / 1024}MB`
        );
      }

      // Leer el archivo como buffer
      const dataBuffer = await fs.readFile(filePath);
      
      // Crear instancia del parser con el buffer
      const parser = new PDFParse({ data: dataBuffer });
      
      // Extraer texto
      const result = await parser.getText();

      this.logger.log(`Texto extraído exitosamente. Páginas: ${result.pages.length}`);

      return result.text;
    } catch (error) {
      this.logger.error('Error al extraer texto del PDF:', error);
      throw error;
    }
  }

  /**
   * Extrae texto y retorna información detallada
   */
  async extractTextWithMetadata(filePath: string): Promise<{
    text: string;
    numPages: number;
    info: any;
    metadata: any;
  }> {
    try {
      this.logger.log(`Extrayendo texto y metadata del PDF: ${filePath}`);

      const dataBuffer = await fs.readFile(filePath);
      const parser = new PDFParse({ data: dataBuffer });
      const result = await parser.getText();

      // Obtener información adicional
      const infoResult = await parser.getInfo();

      return {
        text: result.text,
        numPages: result.pages.length,
        info: infoResult.info || {},
        metadata: infoResult.metadata || {},
      };
    } catch (error) {
      this.logger.error('Error al extraer texto y metadata:', error);
      throw error;
    }
  }

  /**
   * Extrae texto de un buffer (útil cuando el archivo viene directamente del upload)
   */
  async extractTextFromBuffer(buffer: Buffer): Promise<string> {
    try {
      this.logger.log('Extrayendo texto desde buffer');

      if (buffer.length > this.MAX_FILE_SIZE) {
        throw new BadRequestException(
          `El archivo es demasiado grande. Máximo: ${this.MAX_FILE_SIZE / 1024 / 1024}MB`
        );
      }

      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      
      this.logger.log(`Texto extraído exitosamente. Páginas: ${result.pages.length}`);

      return result.text;
    } catch (error) {
      this.logger.error('Error al extraer texto desde buffer:', error);
      throw error;
    }
  }

  /**
   * Limpia y optimiza el texto extraído para enviarlo a las APIs de IA
   * Elimina espacios excesivos, saltos de línea innecesarios, etc.
   */
  cleanText(text: string): string {
    return text
      // Eliminar múltiples espacios
      .replace(/\s+/g, ' ')
      // Eliminar múltiples saltos de línea
      .replace(/\n\s*\n/g, '\n\n')
      // Trim
      .trim();
  }

  /**
   * Trunca el texto si excede un límite de tokens aproximado
   * @param text - Texto a truncar
   * @param maxTokens - Número máximo de tokens (aproximado: 1 token ≈ 4 caracteres)
   */
  truncateText(text: string, maxTokens: number = 100000): string {
    const maxChars = maxTokens * 4;
    
    if (text.length <= maxChars) {
      return text;
    }

    this.logger.warn(
      `Texto truncado de ${text.length} a ${maxChars} caracteres (aprox ${maxTokens} tokens)`
    );

    return text.substring(0, maxChars) + '\n\n[... texto truncado ...]';
  }

  /**
   * Divide el texto en chunks para procesamiento por partes
   * Útil para PDFs muy grandes
   */
  splitTextIntoChunks(text: string, chunkSize: number = 10000): string[] {
    const chunks: string[] = [];
    let currentIndex = 0;

    while (currentIndex < text.length) {
      let endIndex = currentIndex + chunkSize;

      // Si no es el último chunk, buscar el último punto o salto de línea
      if (endIndex < text.length) {
        const lastPeriod = text.lastIndexOf('.', endIndex);
        const lastNewline = text.lastIndexOf('\n', endIndex);
        const breakPoint = Math.max(lastPeriod, lastNewline);

        if (breakPoint > currentIndex) {
          endIndex = breakPoint + 1;
        }
      }

      chunks.push(text.substring(currentIndex, endIndex).trim());
      currentIndex = endIndex;
    }

    this.logger.log(`Texto dividido en ${chunks.length} chunks`);

    return chunks;
  }

  /**
   * Cuenta tokens aproximados (1 token ≈ 4 caracteres en español)
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Elimina el archivo después de procesarlo
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      this.logger.log(`Archivo eliminado: ${filePath}`);
    } catch (error) {
      this.logger.error(`Error al eliminar archivo ${filePath}:`, error);
    }
  }
}