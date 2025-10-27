import { Body, Controller, Post } from '@nestjs/common';
import { OpenaiService } from './openai.service';

@Controller('openai')
export class OpenaiController {
  constructor(private readonly openaiService: OpenaiService) {}

  @Post('generate')
  async generateText(@Body() body: { prompt: string; model?: string }) {
    const response = await this.openaiService.generateText(
      body.prompt,
      body.model,
    );
    return {
      success: true,
      data: response,
    };
  }

  @Post('chat')
  async chat(@Body() body: { messages: Array<{ role: string; content: string }> }) {
    const response = await this.openaiService.chat(body.messages);
    return {
      success: true,
      data: response,
    };
  }

  @Post('image')
  async generateImage(
    @Body() body: { prompt: string; size?: '1024x1024' | '1792x1024' | '1024x1792' },
  ) {
    const imageUrl = await this.openaiService.generateImage(body.prompt, body.size);
    return {
      success: true,
      data: {
        url: imageUrl,
      },
    };
  }
}
