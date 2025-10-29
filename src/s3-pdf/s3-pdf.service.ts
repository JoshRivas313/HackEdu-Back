// s3-pdf.service.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { PDFParse } from 'pdf-parse';
import { Readable } from 'stream';

@Injectable()
export class S3PdfService {
  private readonly logger = new Logger(S3PdfService.name);
  private readonly s3Client: S3Client;
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  constructor() {
    // Inicializar cliente S3
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }

  // ============================================
  // MÉTODOS DE DESCARGA Y EXTRACCIÓN
  // ============================================

  /**
   * Descarga un PDF desde S3 y extrae su texto
   * @param s3Url - URL completa de S3 (s3://bucket/key o https://bucket.s3.region.amazonaws.com/key)
   * @returns Texto extraído del PDF
   */
  async extractTextFromS3Url(s3Url: string): Promise<string> {
    try {
      this.logger.log(`Descargando PDF desde S3: ${s3Url}`);

      // Parsear URL de S3
      const { bucket, key } = this.parseS3Url(s3Url);

      // Descargar archivo de S3
      const buffer = await this.downloadFromS3(bucket, key);

      // Extraer texto del PDF usando PDFParse v2.x
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();

      this.logger.log(`Texto extraído exitosamente. Páginas: ${result.pages.length}`);

      return result.text;
    } catch (error) {
      this.logger.error('Error al extraer texto desde S3:', error);
      throw error;
    }
  }

  /**
   * Descarga un PDF desde S3 y extrae texto con metadata
   */
  async extractTextWithMetadataFromS3Url(s3Url: string): Promise<{
    text: string;
    numPages: number;
    info: any;
    metadata: any;
    s3Info: {
      bucket: string;
      key: string;
      size: number;
    };
  }> {
    try {
      this.logger.log(`Descargando PDF con metadata desde S3: ${s3Url}`);

      const { bucket, key } = this.parseS3Url(s3Url);
      const buffer = await this.downloadFromS3(bucket, key);

      // Extraer texto y metadata usando PDFParse v2.x
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      const infoResult = await parser.getInfo();

      return {
        text: result.text,
        numPages: result.pages.length,
        info: infoResult.info || {},
        metadata: infoResult.metadata || {},
        s3Info: {
          bucket,
          key,
          size: buffer.length,
        },
      };
    } catch (error) {
      this.logger.error('Error al extraer texto y metadata desde S3:', error);
      throw error;
    }
  }

  /**
   * Descarga un archivo desde S3 y lo retorna como Buffer
   */
  private async downloadFromS3(bucket: string, key: string): Promise<Buffer> {
    try {
      this.logger.log(`Descargando de S3: bucket=${bucket}, key=${key}`);

      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      if (!response.Body) {
        throw new BadRequestException('El archivo en S3 está vacío');
      }

      // Convertir stream a buffer
      const buffer = await this.streamToBuffer(response.Body as Readable);

      // Validar tamaño
      if (buffer.length > this.MAX_FILE_SIZE) {
        throw new BadRequestException(
          `El archivo es demasiado grande. Máximo: ${this.MAX_FILE_SIZE / 1024 / 1024}MB`,
        );
      }

      // Validar que sea un PDF (magic bytes)
      if (!this.isPDF(buffer)) {
        throw new BadRequestException('El archivo no es un PDF válido');
      }

      this.logger.log(`Archivo descargado: ${buffer.length} bytes`);

      return buffer;
    } catch (error) {
      if (error.name === 'NoSuchKey') {
        throw new BadRequestException('El archivo no existe en S3');
      }
      if (error.name === 'NoSuchBucket') {
        throw new BadRequestException('El bucket no existe');
      }
      throw error;
    }
  }

  // ============================================
  // MÉTODOS DE SUBIDA
  // ============================================

  /**
   * Sube un archivo (Buffer) a S3
   * @param buffer - Contenido del archivo
   * @param key - Ruta/key del archivo en S3 (ej: "evaluations/abc/rubrics/file.pdf")
   * @param contentType - MIME type del archivo
   * @returns URL de S3 del archivo subido (formato: s3://bucket/key)
   */
  async uploadToS3(
    buffer: Buffer,
    key: string,
    contentType: string = 'application/pdf',
  ): Promise<string> {
    try {
      const bucket = process.env.AWS_S3_BUCKET_NAME;
      
      if (!bucket) {
        throw new BadRequestException('AWS_S3_BUCKET_NAME no está configurado en .env');
      }

      this.logger.log(`Subiendo archivo a S3: bucket=${bucket}, key=${key}, size=${buffer.length} bytes`);

      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        // Configuración de acceso (ajustar según necesidad)
        ACL: 'public-read', // Para archivos públicos
        // ACL: 'private', // Para archivos privados (default)
        
        // Metadata opcional
        Metadata: {
          uploadedAt: new Date().toISOString(),
        },
      });

      await this.s3Client.send(command);

      // Construir la URL de S3
      const s3Url = `s3://${bucket}/${key}`;

      this.logger.log(`✅ Archivo subido exitosamente: ${s3Url}`);

      return s3Url;
    } catch (error) {
      this.logger.error('❌ Error al subir archivo a S3:', error);
      throw new BadRequestException('Error al subir archivo a S3: ' + error.message);
    }
  }

  /**
   * Sube un archivo y retorna la URL HTTPS (en lugar de s3://)
   * Útil si necesitas URLs públicas accesibles directamente
   */
  async uploadToS3WithHttpsUrl(
    buffer: Buffer,
    key: string,
    contentType: string = 'application/pdf',
  ): Promise<string> {
    // Primero subir el archivo
    await this.uploadToS3(buffer, key, contentType);
    
    const bucket = process.env.AWS_S3_BUCKET_NAME;
    const region = process.env.AWS_REGION || 'us-east-1';
    
    // Construir URL HTTPS
    const httpsUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    
    this.logger.log(`URL HTTPS generada: ${httpsUrl}`);
    
    return httpsUrl;
  }

  // ============================================
  // MÉTODOS DE ELIMINACIÓN
  // ============================================

  /**
   * Elimina un archivo de S3
   * @param s3Url - URL completa de S3 (s3://bucket/key)
   */
  async deleteFromS3(s3Url: string): Promise<void> {
    try {
      const { bucket, key } = this.parseS3Url(s3Url);

      this.logger.log(`Eliminando archivo de S3: bucket=${bucket}, key=${key}`);

      const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      await this.s3Client.send(command);

      this.logger.log(`✅ Archivo eliminado exitosamente: ${s3Url}`);
    } catch (error) {
      this.logger.error('❌ Error al eliminar archivo de S3:', error);
      throw new BadRequestException('Error al eliminar archivo de S3: ' + error.message);
    }
  }

  // ============================================
  // MÉTODOS AUXILIARES
  // ============================================

  /**
   * Parsea una URL de S3 y extrae el bucket y key
   * Soporta varios formatos:
   * - s3://bucket/path/to/file.pdf
   * - https://bucket.s3.region.amazonaws.com/path/to/file.pdf
   * - https://s3.region.amazonaws.com/bucket/path/to/file.pdf
   */
  private parseS3Url(s3Url: string): { bucket: string; key: string } {
    try {
      // Formato: s3://bucket/key
      if (s3Url.startsWith('s3://')) {
        const urlWithoutProtocol = s3Url.replace('s3://', '');
        const [bucket, ...keyParts] = urlWithoutProtocol.split('/');
        return {
          bucket,
          key: keyParts.join('/'),
        };
      }

      // Formato: https://bucket.s3.region.amazonaws.com/key
      if (s3Url.includes('.s3.') && s3Url.includes('.amazonaws.com')) {
        const url = new URL(s3Url);
        const bucket = url.hostname.split('.s3.')[0];
        const key = url.pathname.substring(1); // Remover el "/" inicial
        return { bucket, key };
      }

      // Formato: https://s3.region.amazonaws.com/bucket/key
      if (s3Url.includes('s3.') && s3Url.includes('.amazonaws.com')) {
        const url = new URL(s3Url);
        const pathParts = url.pathname.substring(1).split('/');
        const bucket = pathParts[0];
        const key = pathParts.slice(1).join('/');
        return { bucket, key };
      }

      throw new BadRequestException(
        'Formato de URL de S3 inválido. Usa: s3://bucket/key o URLs HTTPS de S3',
      );
    } catch (error) {
      this.logger.error('Error al parsear URL de S3:', error);
      throw new BadRequestException('URL de S3 inválida');
    }
  }

  /**
   * Convierte un stream de Node.js a Buffer
   */
  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  /**
   * Verifica si un buffer es un PDF válido chequeando los magic bytes
   * Los PDFs comienzan con "%PDF-"
   */
  private isPDF(buffer: Buffer): boolean {
    const pdfSignature = Buffer.from('%PDF-', 'utf-8');
    return buffer.slice(0, 5).equals(pdfSignature);
  }

  /**
   * Valida que una URL sea de S3
   */
  isValidS3Url(url: string): boolean {
    try {
      this.parseS3Url(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Obtiene información del archivo sin descargarlo completamente
   */
  async getS3FileInfo(s3Url: string): Promise<{
    bucket: string;
    key: string;
    exists: boolean;
    size?: number;
    contentType?: string;
  }> {
    try {
      const { bucket, key } = this.parseS3Url(s3Url);

      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      return {
        bucket,
        key,
        exists: true,
        size: response.ContentLength,
        contentType: response.ContentType,
      };
    } catch (error) {
      if (error.name === 'NoSuchKey' || error.name === 'NoSuchBucket') {
        const { bucket, key } = this.parseS3Url(s3Url);
        return {
          bucket,
          key,
          exists: false,
        };
      }
      throw error;
    }
  }
}