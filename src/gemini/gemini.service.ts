import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private genAI: GoogleGenerativeAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY no está configurada');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Genera texto con Gemini
   * @param prompt - El prompt del usuario
   * @param modelName - Modelo a usar (default: gemini-2.5-flash-live)
   */
  async generateText(
    prompt: string,
    modelName: string = 'gemini-2.5-flash-lite',
  ): Promise<string> {
    try {
      this.logger.log(`Generando texto con modelo: ${modelName}`);
      
      const model = this.genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = result.response;
      
      return response.text();
    } catch (error) {
      this.logger.error('Error al generar texto con Gemini:', error);
      throw error;
    }
  }

  /**
   * Chat con historial de conversación
   */
  async chat(history: Array<{ role: string; parts: string }>, message: string) {
    try {
      this.logger.log('Iniciando chat con Gemini');
      
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
      
      const chat = model.startChat({
        history: history.map(h => ({
          role: h.role,
          parts: [{ text: h.parts }],
        })),
      });

      const result = await chat.sendMessage(message);
      const response = result.response;
      
      return response.text();
    } catch (error) {
      this.logger.error('Error en chat con Gemini:', error);
      throw error;
    }
  }

  /**
   * Análisis de imagen y texto (multimodal)
   */
  async analyzeImage(prompt: string, imageBase64: string, mimeType: string = 'image/jpeg') {
    try {
      this.logger.log('Analizando imagen con Gemini');
      
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
      
      const result = await model.generateContent([
        {
          inlineData: {
            data: imageBase64,
            mimeType,
          },
        },
        prompt,
      ]);

      const response = result.response;
      return response.text();
    } catch (error) {
      this.logger.error('Error al analizar imagen:', error);
      throw error;
    }
  }

  /**
   * Stream de respuestas
   */
  async streamText(prompt: string) {
    try {
      this.logger.log('Iniciando stream con Gemini');
      
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
      const result = await model.generateContentStream(prompt);
      
      return result.stream;
    } catch (error) {
      this.logger.error('Error en stream con Gemini:', error);
      throw error;
    }
  }

  /**
   * Contar tokens de un texto
   */
  async countTokens(text: string) {
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
      const result = await model.countTokens(text);
      
      return result.totalTokens;
    } catch (error) {
      this.logger.error('Error al contar tokens:', error);
      throw error;
    }
  }
}
