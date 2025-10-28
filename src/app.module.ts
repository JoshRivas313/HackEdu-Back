import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OpenaiModule } from './openai/openai.module';
import { GeminiModule } from './gemini/gemini.module';
import { PdfModule } from './pdf/pdf.module';
import { S3PdfModule } from './s3-pdf/s3-pdf.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    OpenaiModule,
    GeminiModule,
    PdfModule,
    S3PdfModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
