import { Module } from '@nestjs/common';
import { EvaluationsController } from './evaluations.controller';
import { EvaluationsService } from './evaluations.service';
import { AnalysisService } from '../analysis/analysis.service';
import { PrismaModule } from '../prisma/prisma.module';
import { S3PdfModule } from '../s3-pdf/s3-pdf.module';
import { PdfModule } from '../pdf/pdf.module';
import { OpenaiModule } from '../openai/openai.module';

@Module({
  imports: [PrismaModule, S3PdfModule, PdfModule, OpenaiModule],
  controllers: [EvaluationsController],
  providers: [EvaluationsService, AnalysisService],
  exports: [EvaluationsService, AnalysisService],
})
export class EvaluationsModule {}