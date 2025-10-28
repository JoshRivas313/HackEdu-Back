// s3-pdf.module.ts
import { Module } from '@nestjs/common';
import { S3PdfService } from './s3-pdf.service';
import { S3PdfController } from './s3-pdf.controller';
import { PdfModule } from '../pdf/pdf.module';
import { OpenaiModule } from '../openai/openai.module';
import { GeminiModule } from '../gemini/gemini.module';

@Module({
  imports: [PdfModule, OpenaiModule, GeminiModule],
  controllers: [S3PdfController],
  providers: [S3PdfService],
  exports: [S3PdfService],
})
export class S3PdfModule {}