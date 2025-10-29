import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3PdfService } from '../s3-pdf/s3-pdf.service';
import { PdfService } from '../pdf/pdf.service';
import { OpenaiService } from '../openai/openai.service';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';

// Schema Zod para la respuesta estructurada de OpenAI
const RubricAnalysisSchema = z.object({
  groupName: z.string().describe('Nombre del grupo evaluado'),
  groupCode: z.string().describe('Código del grupo evaluado'),
  totalScore: z.number().describe('Puntaje total obtenido'),
  maxScore: z.number().describe('Puntaje máximo posible'),
  percentage: z.number().describe('Porcentaje de logro (0-100)'),
  status: z.enum(['PASS', 'FAIL', 'PARTIAL']).describe('Estado de la evaluación'),
  criteria: z.array(
    z.object({
      criterionName: z.string().describe('Nombre del criterio evaluado'),
      score: z.number().describe('Puntaje obtenido en este criterio'),
      maxScore: z.number().describe('Puntaje máximo de este criterio'),
      level: z.enum(['SATISFACTORIO', 'BUENO', 'REGULAR', 'INSATISFACTORIO']).describe('Nivel de logro'),
      feedback: z.string().describe('Retroalimentación específica del criterio'),
    })
  ).describe('Evaluación detallada por criterio'),
  generalFeedback: z.string().describe('Retroalimentación general del trabajo'),
  strengths: z.array(z.string()).describe('Fortalezas identificadas'),
  improvements: z.array(z.string()).describe('Áreas de mejora'),
  recommendations: z.array(
    z.object({
      priority: z.number().min(1).max(3).describe('Prioridad: 1=Alta, 2=Media, 3=Baja'),
      summary: z.string().describe('Resumen corto de la recomendación'),
      details: z.string().describe('Detalles de la recomendación'),
    })
  ).describe('Recomendaciones específicas para mejorar'),
});

type RubricAnalysisResponse = z.infer<typeof RubricAnalysisSchema>;

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3PdfService: S3PdfService,
    private readonly pdfService: PdfService,
    private readonly openaiService: OpenaiService,
  ) {}

  /**
   * Analizar una evaluación completa usando OpenAI
   */
  async analyzeEvaluation(evaluationId: string) {
    this.logger.log(`Iniciando análisis para evaluación: ${evaluationId}`);

    try {
      // 1. Obtener la evaluación completa
      const evaluation = await this.prisma.evaluation.findUnique({
        where: { id: evaluationId },
        include: {
          rubrics: {
            include: {
              rubricItems: {
                orderBy: { itemOrder: 'asc' },
              },
            },
          },
          groups: {
            include: {
              submissions: {
                orderBy: { uploadedAt: 'desc' },
                take: 1, // Solo la más reciente
              },
            },
          },
        },
      });

      if (!evaluation) {
        throw new Error('Evaluación no encontrada');
      }

      // 2. Crear registro de análisis
      const analysis = await this.prisma.analysis.create({
        data: {
          evaluationId,
          engine: 'OPENAI',
          notes: 'Análisis con GPT-4 y respuestas estructuradas',
        },
      });

      // 3. Preparar el contexto de las rúbricas
      const rubricContext = await this.prepareRubricContext(evaluation.rubrics);

      // 4. Analizar cada grupo
      const analysisPromises = evaluation.groups.map(async (group) => {
        if (!group.submissions || group.submissions.length === 0) {
          this.logger.warn(`Grupo ${group.code} no tiene submissions`);
          return null;
        }

        const latestSubmission = group.submissions[0];
        
        try {
          // Extraer texto del PDF
          const pdfText = await this.s3PdfService.extractTextFromS3Url(latestSubmission.fileUrl!);
          const cleanText = this.pdfService.cleanText(pdfText);

          // Analizar con OpenAI
          const result = await this.analyzeGroupWithOpenAI(
            group.code!,
            group.name || group.code!,
            cleanText,
            rubricContext,
            evaluation.title!,
          );

          // Guardar resultados
          await this.saveAnalysisResults(analysis.id, group.id, result, evaluation.rubrics[0]?.id);

          return result;
        } catch (error) {
          this.logger.error(`Error al analizar grupo ${group.code}:`, error);
          return null;
        }
      });

      await Promise.all(analysisPromises);

      // 5. Finalizar análisis
      await this.prisma.analysis.update({
        where: { id: analysis.id },
        data: { endedAt: new Date() },
      });

      this.logger.log(`Análisis completado para evaluación: ${evaluationId}`);

      return {
        success: true,
        analysisId: analysis.id,
        message: 'Análisis completado exitosamente',
      };
    } catch (error) {
      this.logger.error('Error en análisis:', error);
      throw error;
    }
  }

  /**
   * Preparar contexto de rúbricas para el prompt
   */
  private async prepareRubricContext(rubrics: any[]): Promise<string> {
    let context = '# RÚBRICAS DE EVALUACIÓN\n\n';

    for (const rubric of rubrics) {
      context += `## ${rubric.title}\n\n`;

      // Si hay PDF de rúbrica, extraer su contenido
      if (rubric.rubricPdfUrl) {
        try {
          this.logger.log(`Extrayendo contenido de rúbrica PDF: ${rubric.rubricPdfUrl}`);
          const rubricText = await this.s3PdfService.extractTextFromS3Url(rubric.rubricPdfUrl);
          context += `### Contenido de la rúbrica (desde PDF):\n${this.pdfService.cleanText(rubricText)}\n\n`;
        } catch (error) {
          this.logger.warn(`No se pudo extraer PDF de rúbrica: ${error.message}`);
        }
      }

      // Agregar items de rúbrica
      if (rubric.rubricItems && rubric.rubricItems.length > 0) {
        context += '### Criterios de evaluación:\n\n';
        
        for (const item of rubric.rubricItems) {
          context += `**${item.itemOrder}. ${item.title}** (Puntaje máximo: ${item.maxScore})\n`;
          if (item.conditions) {
            context += `   Condiciones: ${item.conditions}\n`;
          }
          context += '\n';
        }
      }

      context += '\n';
    }

    return context;
  }

  /**
   * Analizar un grupo específico usando OpenAI con respuesta estructurada
   */
  private async analyzeGroupWithOpenAI(
    groupCode: string,
    groupName: string,
    documentText: string,
    rubricContext: string,
    evaluationTitle: string,
  ): Promise<RubricAnalysisResponse> {
    this.logger.log(`Analizando grupo: ${groupCode}`);

    // Calcular puntaje total disponible
    const maxScore = this.calculateMaxScoreFromContext(rubricContext);

    const systemPrompt = `Eres un evaluador académico experto y minucioso. Tu tarea es evaluar trabajos de estudiantes basándote ESTRICTAMENTE en las rúbricas proporcionadas.

INSTRUCCIONES CRÍTICAS:

1. **ANÁLISIS MINUCIOSO**: Lee el documento completo y evalúa cada criterio de la rúbrica con precisión.

2. **SISTEMA DE PUNTAJE**:
   - Si la rúbrica tiene puntajes explícitos, úsalos.
   - Si NO tiene puntajes explícitos, distribuye ${maxScore} puntos equitativamente entre los criterios.
   - Cada criterio puede tener niveles: SATISFACTORIO (100%), BUENO (75%), REGULAR (50%), INSATISFACTORIO (25%).

3. **NIVELES DE LOGRO**:
   - SATISFACTORIO: Cumple completamente con todos los requisitos del criterio.
   - BUENO: Cumple con la mayoría de los requisitos, con pequeñas omisiones.
   - REGULAR: Cumple parcialmente, falta desarrollo significativo.
   - INSATISFACTORIO: No cumple con los requisitos o está ausente.

4. **FEEDBACK ESPECÍFICO**: 
   - Cita evidencias del documento.
   - Señala qué está bien y qué falta.
   - Sé constructivo pero honesto.

5. **RECOMENDACIONES**: 
   - Prioriza las recomendaciones (1=Alta, 2=Media, 3=Baja).
   - Enfócate en mejoras concretas y accionables.`;

    const userPrompt = `# EVALUACIÓN: ${evaluationTitle}

${rubricContext}

---

# DOCUMENTO A EVALUAR

**Grupo**: ${groupCode}
**Nombre**: ${groupName}

## Contenido del documento:

${documentText}

---

# TAREA

Evalúa este documento siguiendo ESTRICTAMENTE los criterios de la rúbrica. Sé minucioso, justo y constructivo.`;

    try {
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const completion = await openai.chat.completions.parse({
        model: 'gpt-4.1-nano', // Modelo que soporta structured outputs
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: zodResponseFormat(RubricAnalysisSchema, 'rubric_analysis'),
        temperature: 0.3, // Más determinístico para evaluaciones
      });

      const result = completion.choices[0].message.parsed;

      if (!result) {
        throw new Error('No se pudo parsear la respuesta de OpenAI');
      }

      this.logger.log(`Análisis completado para grupo ${groupCode}: ${result.totalScore}/${result.maxScore}`);

      return result;
    } catch (error) {
      this.logger.error('Error al analizar con OpenAI:', error);
      throw error;
    }
  }

  /**
   * Calcular puntaje máximo basado en el contexto de la rúbrica
   */
  private calculateMaxScoreFromContext(rubricContext: string): number {
    // Buscar puntajes máximos en el contexto
    const matches = rubricContext.match(/Puntaje máximo:\s*([\d.]+)/gi);
    
    if (matches && matches.length > 0) {
      return matches.reduce((sum, match) => {
        const score = parseFloat(match.replace(/[^\d.]/g, ''));
        return sum + (isNaN(score) ? 0 : score);
      }, 0);
    }

    // Si no hay puntajes explícitos, usar 20 como default
    return 20;
  }

  /**
   * Guardar resultados del análisis en la base de datos
   */
  private async saveAnalysisResults(
    analysisId: string,
    groupId: string,
    result: RubricAnalysisResponse,
    rubricId: string,
  ) {
    try {
      // Guardar resultado general
      await this.prisma.analysisResult.create({
        data: {
          analysisId,
          rubricId,
          status: result.status,
          score: result.totalScore,
          feedback: `${result.generalFeedback}\n\n**Fortalezas:**\n${result.strengths.join('\n')}\n\n**Áreas de mejora:**\n${result.improvements.join('\n')}`,
        },
      });

      // Guardar recomendaciones
      for (const recommendation of result.recommendations) {
        await this.prisma.recommendation.create({
          data: {
            analysisId,
            groupId,
            priority: recommendation.priority,
            summary: recommendation.summary,
            details: recommendation.details,
          },
        });
      }

      this.logger.log(`Resultados guardados para análisis ${analysisId}`);
    } catch (error) {
      this.logger.error('Error al guardar resultados:', error);
      throw error;
    }
  }

  /**
   * Obtener resultados de un análisis
   */
  async getAnalysisResults(analysisId: string) {
    return await this.prisma.analysis.findUnique({
      where: { id: analysisId },
      include: {
        evaluation: true,
        analysisResults: {
          include: {
            rubric: true,
          },
        },
        recommendations: {
          include: {
            group: true,
          },
          orderBy: [
            { priority: 'asc' },
            { createdAt: 'desc' },
          ],
        },
      },
    });
  }
}