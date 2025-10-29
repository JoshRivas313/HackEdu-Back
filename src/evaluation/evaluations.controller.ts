// evaluations.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiParam, 
  ApiQuery, 
  ApiBody,
  ApiConsumes 
} from '@nestjs/swagger';
import { EvaluationsService } from './evaluations.service';
import { AnalysisService } from '../analysis/analysis.service';
import {
  CreateEvaluationDto,
  UpdateEvaluationDto,
  CreateGroupDto,
  UpdateGroupDto,
  CreateSubmissionDto,
} from './dto/evaluation.dto';
import { ParseJsonFormDataInterceptor } from 'src/common/interceptors/parse-json-form-data.interceptors';

@ApiTags('evaluations')
@Controller('evaluations')
export class EvaluationsController {
  constructor(
    private readonly evaluationsService: EvaluationsService,
    private readonly analysisService: AnalysisService,
  ) {}

  // ============================================
  // EVALUACIONES
  // ============================================

  @Post()
  @UseInterceptors(FileInterceptor('pdf'),
 new ParseJsonFormDataInterceptor(['rubricItems']))
  @ApiOperation({ 
    summary: 'Crear nueva evaluación',
    description: 'Crea una evaluación con una rúbrica y sus items de evaluación. Opcionalmente puede incluir un archivo PDF con la rúbrica.'
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['title'],
      properties: {
        title: { 
          type: 'string', 
          example: 'Examen Final Matemáticas',
          description: 'Título de la evaluación'
        },
        description: { 
          type: 'string', 
          example: 'Evaluación comprensiva del curso',
          description: 'Descripción detallada de la evaluación'
        },
        totalGroups: { 
          type: 'number', 
          example: 5,
          description: 'Número esperado de grupos'
        },
        ownerId: { 
          type: 'string', 
          format: 'uuid',
          description: 'ID del profesor propietario'
        },
        rubricItems: { 
          type: 'array',
          description: 'Criterios de evaluación (rubric items)',
          items: {
            type: 'object',
            required: ['itemOrder', 'title'],
            properties: {
              itemOrder: { type: 'number', example: 1 },
              title: { type: 'string', example: 'Claridad en la exposición' },
              conditions: { type: 'string', example: 'Explicación clara y concisa' },
              maxScore: { type: 'number', example: 5 }
            }
          },
          example: [
            { itemOrder: 1, title: 'Claridad', conditions: 'Explicación clara', maxScore: 5 },
            { itemOrder: 2, title: 'Coherencia', conditions: 'Ideas estructuradas', maxScore: 5 },
            { itemOrder: 3, title: 'Originalidad', conditions: 'Aporte creativo', maxScore: 5 }
          ]
        },
        pdf: { 
          type: 'string', 
          format: 'binary',
          description: 'Archivo PDF de la rúbrica (opcional)'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Evaluación creada exitosamente con su rúbrica y rubric items',
    schema: {
      example: {
        success: true,
        message: 'Evaluación creada exitosamente',
        data: {
          id: 'uuid-evaluation',
          title: 'Examen Final',
          rubrics: [
            {
              id: 'uuid-rubric',
              title: 'Rúbrica de Examen Final',
              rubricItems: [
                { id: 'uuid-item-1', itemOrder: 1, title: 'Claridad', maxScore: 5 },
                { id: 'uuid-item-2', itemOrder: 2, title: 'Coherencia', maxScore: 5 }
              ]
            }
          ]
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos o archivo no es PDF' })
  async createEvaluation(
    @Body() dto: CreateEvaluationDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    try {
      if (file && file.mimetype !== 'application/pdf') {
        throw new BadRequestException('El archivo debe ser un PDF');
      }

      const evaluation = await this.evaluationsService.createEvaluation(dto, file);

      return {
        success: true,
        message: 'Evaluación creada exitosamente',
        data: evaluation,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Obtener evaluación por ID',
    description: 'Retorna una evaluación completa con su rúbrica, rubric items, grupos y submissions'
  })
  @ApiParam({ name: 'id', description: 'ID de la evaluación', type: 'string' })
  @ApiResponse({ 
    status: 200, 
    description: 'Evaluación encontrada',
    schema: {
      example: {
        success: true,
        data: {
          id: 'uuid',
          title: 'Examen Final',
          description: 'Evaluación del curso',
          rubrics: [
            {
              id: 'rubric-uuid',
              title: 'Rúbrica Principal',
              rubricItems: [
                { itemOrder: 1, title: 'Claridad' },
                { itemOrder: 2, title: 'Coherencia' }
              ]
            }
          ],
          groups: []
        }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Evaluación no encontrada' })
  async getEvaluation(@Param('id') id: string) {
    const evaluation = await this.evaluationsService.getEvaluation(id);

    return {
      success: true,
      data: evaluation,
    };
  }

  @Get()
  @ApiOperation({ 
    summary: 'Listar todas las evaluaciones',
    description: 'Obtiene todas las evaluaciones con sus rúbricas, opcionalmente filtradas por owner'
  })
  @ApiQuery({ 
    name: 'ownerId', 
    required: false, 
    description: 'Filtrar por ID del propietario',
    type: 'string'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de evaluaciones',
    schema: {
      example: {
        success: true,
        data: [
          { 
            id: 'uuid1', 
            title: 'Evaluación 1',
            rubrics: [{ title: 'Rúbrica 1', rubricItems: [] }]
          },
          { 
            id: 'uuid2', 
            title: 'Evaluación 2',
            rubrics: [{ title: 'Rúbrica 2', rubricItems: [] }]
          }
        ]
      }
    }
  })
  async listEvaluations(@Query('ownerId') ownerId?: string) {
    const evaluations = await this.evaluationsService.listEvaluations(ownerId);

    return {
      success: true,
      data: evaluations,
    };
  }

  @Put(':id')
  @ApiOperation({ 
    summary: 'Actualizar evaluación',
    description: 'Actualiza los datos de una evaluación. Puede agregar más rubric items a la rúbrica existente'
  })
  @ApiParam({ name: 'id', description: 'ID de la evaluación', type: 'string' })
  @ApiBody({ type: UpdateEvaluationDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Evaluación actualizada exitosamente',
    schema: {
      example: {
        success: true,
        message: 'Evaluación actualizada exitosamente',
        data: {
          id: 'uuid',
          title: 'Evaluación Actualizada',
          rubrics: [
            {
              rubricItems: [
                { itemOrder: 1, title: 'Item existente' },
                { itemOrder: 2, title: 'Item nuevo agregado' }
              ]
            }
          ]
        }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Evaluación no encontrada' })
  async updateEvaluation(
    @Param('id') id: string,
    @Body() dto: UpdateEvaluationDto,
  ) {
    const evaluation = await this.evaluationsService.updateEvaluation(id, dto);

    return {
      success: true,
      message: 'Evaluación actualizada exitosamente',
      data: evaluation,
    };
  }

  @Delete(':id')
  @ApiOperation({ 
    summary: 'Eliminar evaluación',
    description: 'Elimina una evaluación y todas sus relaciones: rúbrica, rubric items, grupos, submissions (cascade delete)'
  })
  @ApiParam({ name: 'id', description: 'ID de la evaluación', type: 'string' })
  @ApiResponse({ 
    status: 200, 
    description: 'Evaluación eliminada exitosamente' 
  })
  @ApiResponse({ status: 404, description: 'Evaluación no encontrada' })
  async deleteEvaluation(@Param('id') id: string) {
    return await this.evaluationsService.deleteEvaluation(id);
  }

  @Get(':id/groups-with-recommendations')
  @ApiOperation({ 
    summary: 'Obtener grupos con recomendaciones',
    description: 'Retorna los grupos de una evaluación con las recomendaciones del último análisis'
  })
  @ApiParam({ name: 'id', description: 'ID de la evaluación', type: 'string' })
  @ApiResponse({ 
    status: 200, 
    description: 'Grupos con recomendaciones obtenidos' 
  })
  async getGroupsWithRecommendations(@Param('id') evaluationId: string) {
    const data = await this.evaluationsService.getGroupsWithRecommendations(evaluationId);

    return {
      success: true,
      data,
    };
  }

  // ============================================
  // GRUPOS
  // ============================================

  @Get(':evaluationId/groups')
  @ApiOperation({ 
    summary: 'Obtener grupos por evaluación',
    description: 'Retorna todos los grupos asociados a una evaluación específica con sus submissions y estadísticas'
  })
  @ApiParam({ 
    name: 'evaluationId', 
    description: 'ID de la evaluación', 
    type: 'string',
    example: 'clx1234567890abcdef'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Grupos de la evaluación obtenidos exitosamente',
    schema: {
      example: {
        success: true,
        data: {
          evaluation: {
            id: 'eval-uuid',
            title: 'Examen Final Matemáticas'
          },
          totalGroups: 3,
          groups: [
            {
              id: 'group-uuid-1',
              code: 'G001',
              name: 'Grupo A',
              studentCount: 4,
              createdAt: '2025-10-20T10:00:00Z',
              submissions: [
                {
                  id: 'sub-uuid-1',
                  fileName: 'proyecto_grupoA.pdf',
                  fileUrl: 's3://bucket/file.pdf',
                  status: 'RECEIVED',
                  uploadedAt: '2025-10-25T14:30:00Z'
                }
              ],
              _count: {
                submissions: 1,
                recommendations: 3
              }
            },
            {
              id: 'group-uuid-2',
              code: 'G002',
              name: 'Grupo B',
              studentCount: 3,
              submissions: [],
              _count: {
                submissions: 0,
                recommendations: 0
              }
            }
          ]
        }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Evaluación no encontrada' })
  async getGroupsByEvaluation(@Param('evaluationId') evaluationId: string) {
    const data = await this.evaluationsService.getGroupsByEvaluationSimple(evaluationId);
    return {
      success: true,
      data,
    };
  }

  @Post('groups')
  @ApiOperation({ 
    summary: 'Crear grupo',
    description: 'Crea un nuevo grupo asociado a una evaluación'
  })
  @ApiBody({ type: CreateGroupDto })
  @ApiResponse({ 
    status: 201, 
    description: 'Grupo creado exitosamente' 
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  async createGroup(@Body() dto: CreateGroupDto) {
    const group = await this.evaluationsService.createGroup(dto);

    return {
      success: true,
      message: 'Grupo creado exitosamente',
      data: group,
    };
  }

  @Get('groups/:id')
  @ApiOperation({ 
    summary: 'Obtener grupo por ID',
    description: 'Retorna un grupo con todas sus submissions'
  })
  @ApiParam({ name: 'id', description: 'ID del grupo', type: 'string' })
  @ApiResponse({ 
    status: 200, 
    description: 'Grupo encontrado' 
  })
  @ApiResponse({ status: 404, description: 'Grupo no encontrado' })
  async getGroup(@Param('id') id: string) {
    const group = await this.evaluationsService.getGroup(id);

    return {
      success: true,
      data: group,
    };
  }

  @Get('groups')
  @ApiOperation({ 
    summary: 'Listar todos los grupos',
    description: 'Obtiene todos los grupos del sistema'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de grupos' 
  })
  async listGroups() {
    const groups = await this.evaluationsService.listGroups();

    return {
      success: true,
      data: groups,
    };
  }

  @Put('groups/:id')
  @ApiOperation({ 
    summary: 'Actualizar grupo',
    description: 'Actualiza los datos de un grupo'
  })
  @ApiParam({ name: 'id', description: 'ID del grupo', type: 'string' })
  @ApiBody({ type: UpdateGroupDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Grupo actualizado exitosamente' 
  })
  @ApiResponse({ status: 404, description: 'Grupo no encontrado' })
  async updateGroup(@Param('id') id: string, @Body() dto: UpdateGroupDto) {
    const group = await this.evaluationsService.updateGroup(id, dto);

    return {
      success: true,
      message: 'Grupo actualizado exitosamente',
      data: group,
    };
  }

  @Delete('groups/:id')
  @ApiOperation({ 
    summary: 'Eliminar grupo',
    description: 'Elimina un grupo y todas sus submissions'
  })
  @ApiParam({ name: 'id', description: 'ID del grupo', type: 'string' })
  @ApiResponse({ 
    status: 200, 
    description: 'Grupo eliminado exitosamente' 
  })
  @ApiResponse({ status: 404, description: 'Grupo no encontrado' })
  async deleteGroup(@Param('id') id: string) {
    return await this.evaluationsService.deleteGroup(id);
  }

  // ============================================
  // SUBMISSIONS
  // ============================================

  @Post('submissions')
  @ApiOperation({ 
    summary: 'Crear submission',
    description: 'Crea una nueva submission (evidencia) para un grupo'
  })
  @ApiBody({ type: CreateSubmissionDto })
  @ApiResponse({ 
    status: 201, 
    description: 'Submission creado exitosamente' 
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  async createSubmission(@Body() dto: CreateSubmissionDto) {
    const submission = await this.evaluationsService.createSubmission(dto);

    return {
      success: true,
      message: 'Submission creado exitosamente',
      data: submission,
    };
  }

  // ============================================
  // ANÁLISIS CON OPENAI
  // ============================================

  @Post(':id/analyze')
  @ApiOperation({ 
    summary: 'Analizar evaluación con IA',
    description: 'Inicia el análisis de una evaluación usando OpenAI. Procesa todas las submissions usando los rubric items como criterios y genera recomendaciones'
  })
  @ApiParam({ name: 'id', description: 'ID de la evaluación a analizar', type: 'string' })
  @ApiResponse({ 
    status: 200, 
    description: 'Análisis completado exitosamente',
    schema: {
      example: {
        success: true,
        message: 'Análisis completado',
        data: {
          analysisId: 'uuid',
          evaluationId: 'uuid',
          totalGroups: 5,
          recommendations: []
        }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Evaluación no encontrada' })
  @ApiResponse({ status: 400, description: 'Error en el análisis' })
  async analyzeEvaluation(@Param('id') evaluationId: string) {
    const result = await this.analysisService.analyzeEvaluation(evaluationId);

    return result;
  }

  @Get('analysis/:analysisId')
  @ApiOperation({ 
    summary: 'Obtener resultados de análisis',
    description: 'Retorna los resultados completos de un análisis previamente realizado'
  })
  @ApiParam({ name: 'analysisId', description: 'ID del análisis', type: 'string' })
  @ApiResponse({ 
    status: 200, 
    description: 'Resultados del análisis',
    schema: {
      example: {
        success: true,
        data: {
          id: 'uuid',
          evaluationId: 'uuid',
          recommendations: [],
          createdAt: '2025-01-01T00:00:00Z'
        }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Análisis no encontrado' })
  async getAnalysisResults(@Param('analysisId') analysisId: string) {
    const results = await this.analysisService.getAnalysisResults(analysisId);

    return {
      success: true,
      data: results,
    };
  }
}