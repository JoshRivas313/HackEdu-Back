import { Body, Controller, Post } from '@nestjs/common';
import { GeminiService } from './gemini.service';

@Controller('gemini')
export class GeminiController {
  constructor(private readonly geminiService: GeminiService) {}

  @Post('generate')
  async generateText(@Body() body: { prompt: string; model?: string }) {
    const response = await this.geminiService.generateText(
      body.prompt,
      body.model,
    );
    return {
      success: true,
      data: response,
    };
  }

  @Post('chat')
  async chat(
    @Body() body: { 
      history: Array<{ role: string; parts: string }>; 
      message: string 
    },
  ) {
    const response = await this.geminiService.chat(body.history, body.message);
    return {
      success: true,
      data: response,
    };
  }

  @Post('analyze-image')
  async analyzeImage(
    @Body() body: { 
      prompt: string; 
      imageBase64: string; 
      mimeType?: string 
    },
  ) {
    const response = await this.geminiService.analyzeImage(
      body.prompt,
      body.imageBase64,
      body.mimeType,
    );
    return {
      success: true,
      data: response,
    };
  }

  @Post('count-tokens')
  async countTokens(@Body() body: { text: string }) {
    const tokens = await this.geminiService.countTokens(body.text);
    return {
      success: true,
      data: {
        tokens,
      },
    };
  }
}
