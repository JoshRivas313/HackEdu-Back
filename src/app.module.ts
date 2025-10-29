import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OpenaiModule } from './openai/openai.module';
import { GeminiModule } from './gemini/gemini.module';
import { PdfModule } from './pdf/pdf.module';
import { S3PdfModule } from './s3-pdf/s3-pdf.module';
import { PrismaModule } from './prisma/prisma.module';
import { EvaluationsModule } from './evaluation/evaluations.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    OpenaiModule,
    PrismaModule,
    GeminiModule,
    PdfModule,
    S3PdfModule,
    EvaluationsModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
