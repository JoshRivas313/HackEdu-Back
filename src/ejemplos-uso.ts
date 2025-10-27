/**
 * EJEMPLOS DE USO DE LOS SERVICIOS
 * 
 * Estos son ejemplos de cómo usar los servicios directamente
 * en tu código, no solo a través de HTTP requests.
 */

// ============================================
// EJEMPLOS CON OPENAI SERVICE
// ============================================

import { OpenaiService } from './openai/openai.service';

// Ejemplo 1: Generar texto simple
async function ejemploOpenAITexto(openaiService: OpenaiService) {
  const respuesta = await openaiService.generateText(
    '¿Cuáles son las ventajas de usar TypeScript?'
  );
  console.log('Respuesta:', respuesta);
}

// Ejemplo 2: Chat con contexto
async function ejemploOpenAIChat(openaiService: OpenaiService) {
  const mensajes = [
    { role: 'system', content: 'Eres un experto en programación' },
    { role: 'user', content: '¿Qué es un decorador en TypeScript?' },
  ];
  
  const respuesta = await openaiService.chat(mensajes);
  console.log('Respuesta del chat:', respuesta);
}

// Ejemplo 3: Generar imagen
async function ejemploOpenAIImagen(openaiService: OpenaiService) {
  const urlImagen = await openaiService.generateImage(
    'Un robot escribiendo código en una computadora futurista',
    '1024x1024'
  );
  console.log('URL de la imagen:', urlImagen);
}

// Ejemplo 4: Stream de respuestas
async function ejemploOpenAIStream(openaiService: OpenaiService) {
  const stream = await openaiService.streamText(
    'Escribe un cuento corto sobre la programación'
  );
  
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    process.stdout.write(content);
  }
}

// ============================================
// EJEMPLOS CON GEMINI SERVICE
// ============================================

import { GeminiService } from './gemini/gemini.service';

// Ejemplo 1: Generar texto simple
async function ejemploGeminiTexto(geminiService: GeminiService) {
  const respuesta = await geminiService.generateText(
    'Explica qué es la recursión en programación con un ejemplo'
  );
  console.log('Respuesta:', respuesta);
}

// Ejemplo 2: Chat con historial
async function ejemploGeminiChat(geminiService: GeminiService) {
  const historial = [
    { role: 'user', parts: 'Hola, soy nuevo en programación' },
    { role: 'model', parts: '¡Hola! Encantado de ayudarte a aprender' },
  ];
  
  const respuesta = await geminiService.chat(
    historial,
    '¿Por dónde debería empezar?'
  );
  console.log('Respuesta del chat:', respuesta);
}

// Ejemplo 3: Analizar imagen
async function ejemploGeminiImagen(geminiService: GeminiService) {
  // Nota: imageBase64 debe ser una cadena base64 real
  const imageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  
  const respuesta = await geminiService.analyzeImage(
    '¿Qué colores hay en esta imagen?',
    imageBase64,
    'image/png'
  );
  console.log('Análisis de imagen:', respuesta);
}

// Ejemplo 4: Contar tokens
async function ejemploGeminiTokens(geminiService: GeminiService) {
  const texto = `
    Este es un texto de ejemplo para contar tokens.
    Los tokens son unidades de texto que los modelos de IA usan para procesar información.
  `;
  
  const tokens = await geminiService.countTokens(texto);
  console.log('Número de tokens:', tokens);
}

// Ejemplo 5: Stream de respuestas
async function ejemploGeminiStream(geminiService: GeminiService) {
  const stream = await geminiService.streamText(
    'Escribe una historia corta sobre un desarrollador'
  );
  
  for await (const chunk of stream) {
    const text = chunk.text();
    process.stdout.write(text);
  }
}

// ============================================
// EJEMPLO DE USO COMBINADO
// ============================================

async function ejemploCombinado(
  openaiService: OpenaiService,
  geminiService: GeminiService
) {
  console.log('=== Comparando respuestas de OpenAI y Gemini ===\n');
  
  const pregunta = '¿Qué es la inteligencia artificial?';
  
  // Obtener respuesta de OpenAI
  console.log('Consultando a OpenAI...');
  const respuestaOpenAI = await openaiService.generateText(pregunta);
  console.log('OpenAI dice:', respuestaOpenAI);
  console.log('\n---\n');
  
  // Obtener respuesta de Gemini
  console.log('Consultando a Gemini...');
  const respuestaGemini = await geminiService.generateText(pregunta);
  console.log('Gemini dice:', respuestaGemini);
}

// ============================================
// MANEJO DE ERRORES
// ============================================

async function ejemploManejoErrores(openaiService: OpenaiService) {
  try {
    const respuesta = await openaiService.generateText(
      'Tu pregunta aquí',
      'modelo-que-no-existe' // Esto causará un error
    );
    console.log(respuesta);
  } catch (error) {
    console.error('Error capturado:', error.message);
    // Aquí puedes manejar el error apropiadamente
    // Por ejemplo: registrar en logs, notificar al usuario, etc.
  }
}

// ============================================
// USO EN CONTROLADORES
// ============================================

/*
// Ejemplo de cómo usar los servicios en un controlador personalizado

import { Controller, Post, Body } from '@nestjs/common';
import { OpenaiService } from './openai/openai.service';
import { GeminiService } from './gemini/gemini.service';

@Controller('ai')
export class AiController {
  constructor(
    private readonly openaiService: OpenaiService,
    private readonly geminiService: GeminiService,
  ) {}

  @Post('compare')
  async comparar(@Body() body: { prompt: string }) {
    const [openaiResponse, geminiResponse] = await Promise.all([
      this.openaiService.generateText(body.prompt),
      this.geminiService.generateText(body.prompt),
    ]);

    return {
      prompt: body.prompt,
      openai: openaiResponse,
      gemini: geminiResponse,
    };
  }

  @Post('traducir')
  async traducir(@Body() body: { texto: string; idioma: string }) {
    const prompt = `Traduce el siguiente texto al ${body.idioma}: "${body.texto}"`;
    const traduccion = await this.openaiService.generateText(prompt);
    
    return {
      textoOriginal: body.texto,
      idioma: body.idioma,
      traduccion,
    };
  }

  @Post('resumir')
  async resumir(@Body() body: { texto: string }) {
    const prompt = `Resume el siguiente texto en 3 puntos clave: "${body.texto}"`;
    const resumen = await this.geminiService.generateText(prompt);
    
    return {
      textoOriginal: body.texto,
      resumen,
    };
  }
}
*/

// ============================================
// TIPS Y MEJORES PRÁCTICAS
// ============================================

/*
1. GESTIÓN DE COSTOS:
   - Usa modelos más económicos para tareas simples (gpt-4o-mini en OpenAI)
   - Implementa caché para respuestas frecuentes
   - Monitorea el uso de tokens

2. SEGURIDAD:
   - Valida y sanitiza todas las entradas del usuario
   - Implementa rate limiting
   - No expongas las API keys en el código

3. RENDIMIENTO:
   - Usa streaming para respuestas largas
   - Implementa timeouts apropiados
   - Considera usar Promise.all() para llamadas paralelas

4. MANEJO DE ERRORES:
   - Siempre envuelve las llamadas en try-catch
   - Implementa reintentos con backoff exponencial
   - Proporciona mensajes de error útiles al usuario

5. TESTING:
   - Mockea los servicios en tus tests
   - Prueba diferentes escenarios de error
   - Valida la estructura de las respuestas
*/

export {
  ejemploOpenAITexto,
  ejemploOpenAIChat,
  ejemploOpenAIImagen,
  ejemploOpenAIStream,
  ejemploGeminiTexto,
  ejemploGeminiChat,
  ejemploGeminiImagen,
  ejemploGeminiTokens,
  ejemploGeminiStream,
  ejemploCombinado,
  ejemploManejoErrores,
};
