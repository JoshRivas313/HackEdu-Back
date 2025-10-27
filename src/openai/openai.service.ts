import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class OpenaiService {
  private readonly logger = new Logger(OpenaiService.name);
  private openai: OpenAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Genera una respuesta usando GPT
   * @param prompt - El prompt del usuario
   * @param model - Modelo a usar (default: gpt-4o-mini)
   */
  async generateText(
    prompt: string,
    model: string = 'gpt-4o-mini',
  ): Promise<string> {
    try {
      this.logger.log(`Generando texto con modelo: ${model}`);
      
      const completion = await this.openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      return completion.choices[0].message.content || '';
    } catch (error) {
      this.logger.error('Error al generar texto con OpenAI:', error);
      throw error;
    }
  }

  /**
   * Chat con contexto (múltiples mensajes)
   */
  async chat(messages: Array<{ role: string; content: string }>) {
    try {
      this.logger.log('Iniciando chat con OpenAI');
      
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: messages as any,
      });

      return completion.choices[0].message;
    } catch (error) {
      this.logger.error('Error en chat con OpenAI:', error);
      throw error;
    }
  }

  /**
   * Stream de respuestas
   */
  async streamText(prompt: string) {
    try {
      this.logger.log('Iniciando stream con OpenAI');
      
      const stream = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      });

      return stream;
    } catch (error) {
      this.logger.error('Error en stream con OpenAI:', error);
      throw error;
    }
  }

  /**
   * Genera imágenes con DALL-E
   */
  async generateImage(
    prompt: string,
    size: '1024x1024' | '1792x1024' | '1024x1792' = '1024x1024',
  ) {
    try {
      this.logger.log('Generando imagen con DALL-E');
      
      const response = await this.openai.images.generate({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size,
      });

      return response.data?.[0]?.url || '';
    } catch (error) {
      this.logger.error('Error al generar imagen:', error);
      throw error;
    }
  }
}
