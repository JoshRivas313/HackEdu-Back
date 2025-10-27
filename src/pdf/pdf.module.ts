import { Module } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { PdfController } from './pdf.controller';
import { OpenaiModule } from '../openai/openai.module';
import { GeminiModule } from '../gemini/gemini.module';

@Module({
  imports: [OpenaiModule, GeminiModule],
  controllers: [PdfController],
  providers: [PdfService],
  exports: [PdfService],
})
export class PdfModule {}
