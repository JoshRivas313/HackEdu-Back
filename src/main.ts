import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Habilitar CORS si lo necesitas

  // Habilitar validación global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },

    }),
  );

  // Configuración de Swagger
  const config = new DocumentBuilder()
    .setTitle('HackEdu API')
    .setDescription('API Documentation for HackEdu Backend')
    .setVersion('1.0')
    .addTag('evaluations', 'Endpoints relacionados con evaluaciones')
    .addTag('pdf', 'Endpoints para manejo de PDFs')
    .addTag('s3', 'Endpoints para operaciones con S3')
    .addTag('openai', 'Endpoints de OpenAI')
    .addTag('gemini', 'Endpoints de Gemini')
    .addBearerAuth() // Si usas autenticación JWT
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // Mantiene el token de autorización
    },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`📚 Swagger documentation: http://localhost:${port}/api/docs`);
}
bootstrap();