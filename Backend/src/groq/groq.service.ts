import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';

@Injectable()
export class GroqService {
  private readonly logger = new Logger(GroqService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('GROQ_API_KEY')?.trim());
  }

  private client(): Groq {
    const key = this.config.get<string>('GROQ_API_KEY')?.trim();
    if (!key) {
      throw new Error('GROQ_API_KEY no configurada');
    }
    return new Groq({ apiKey: key });
  }

  async chatJson(params: {
    system: string;
    user: string;
    model?: string;
    temperature?: number;
  }): Promise<unknown> {
    const model =
      this.config.get<string>('GROQ_MODEL')?.trim() ?? 'llama-3.3-70b-versatile';
    const groq = this.client();
    const res = await groq.chat.completions.create({
      model,
      temperature: params.temperature ?? 0.35,
      messages: [
        { role: 'system', content: params.system },
        { role: 'user', content: params.user },
      ],
      response_format: { type: 'json_object' },
    });
    const text = res.choices[0]?.message?.content?.trim() ?? '';
    if (!text) {
      throw new Error('Respuesta vacía de Groq');
    }
    try {
      return JSON.parse(text) as unknown;
    } catch (e) {
      this.logger.warn(`JSON inválido de Groq: ${text.slice(0, 200)}`);
      throw e;
    }
  }
}
