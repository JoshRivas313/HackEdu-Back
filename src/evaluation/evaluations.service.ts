import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3PdfService } from '../s3-pdf/s3-pdf.service';
import { PdfService } from '../pdf/pdf.service';
import { OpenaiService } from '../openai/openai.service';
import {
  CreateEvaluationDto,
  UpdateEvaluationDto,
  CreateGroupDto,
  UpdateGroupDto,
  CreateSubmissionDto,
} from './dto/evaluation.dto';

@Injectable()
export class EvaluationsService {
  private readonly logger = new Logger(EvaluationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3PdfService: S3PdfService,
    private readonly pdfService: PdfService,
    private readonly openaiService: OpenaiService,
  ) {}

  /**
   * Crear una evaluación con PDF opcional y rúbricas adicionales
   */
  async createEvaluation(dto: CreateEvaluationDto, pdfFile?: Express.Multer.File) {
    try {
      this.logger.log(`Creando evaluación: ${dto.title}`);

      return await this.prisma.$transaction(async (tx) => {
        // 1. Crear la evaluación
        const evaluation = await tx.evaluation.create({
          data: {
            title: dto.title,
            description: dto.description,
            totalGroups: dto.totalGroups,
            ownerId: dto.ownerId,
          },
        });

        // 2. Si hay PDF, subirlo a S3 y crear rúbrica desde PDF
        if (pdfFile) {
          this.logger.log(`Subiendo PDF a S3: ${pdfFile.originalname}`);
          
          // Aquí deberías implementar la subida a S3
          // Por ahora asumimos que tienes un método en S3PdfService
          const s3Url = await this.uploadPdfToS3(pdfFile, evaluation.id);

          await tx.rubric.create({
            data: {
              evaluationId: evaluation.id,
              title: pdfFile.originalname.replace('.pdf', ''),
              rubricPdfUrl: s3Url,
            },
          });
        } else {
          // Crear rúbrica por defecto sin PDF
          await tx.rubric.create({
            data: {
              evaluationId: evaluation.id,
              title: `rubrica_de_${dto.title.toLowerCase().replace(/\s+/g, '_')}`,
            },
          });
        }

        // 3. Crear rúbricas adicionales con sus items
        if (dto.additionalRubrics && dto.additionalRubrics.length > 0) {
          for (const additionalRubric of dto.additionalRubrics) {
            const rubric = await tx.rubric.create({
              data: {
                evaluationId: evaluation.id,
                title: additionalRubric.title,
              },
            });

            // Crear items de la rúbrica
            for (const item of additionalRubric.items) {
              await tx.rubricItem.create({
                data: {
                  rubricId: rubric.id,
                  itemOrder: item.itemOrder,
                  title: item.title,
                  conditions: item.conditions,
                  maxScore: item.maxScore || 1.0,
                },
              });
            }
          }
        }

        // Registrar actividad
        await tx.activityLog.create({
          data: {
            actorId: dto.ownerId,
            evaluationId: evaluation.id,
            type: 'CREATE',
            message: `Evaluación "${dto.title}" creada`,
          },
        });

        return evaluation;
      });
    } catch (error) {
      this.logger.error('Error al crear evaluación:', error);
      throw new BadRequestException('Error al crear evaluación: ' + error.message);
    }
  }

  /**
   * Obtener evaluación completa con todas las relaciones
   */
  async getEvaluation(id: string) {
    const evaluation = await this.prisma.evaluation.findUnique({
      where: { id },
      include: {
        owner: true,
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
        analyses: {
          orderBy: { startedAt: 'desc' },
          include: {
            analysisResults: {
              include: {
                rubric: true,
              },
            },
          },
        },
      },
    });

    if (!evaluation) {
      throw new NotFoundException(`Evaluación con ID ${id} no encontrada`);
    }

    return evaluation;
  }

  /**
   * Listar todas las evaluaciones
   */
  async listEvaluations(ownerId?: string) {
    const where = ownerId ? { ownerId, isArchived: false } : { isArchived: false };

    return await this.prisma.evaluation.findMany({
      where,
      include: {
        owner: true,
        rubrics: {
          include: {
            rubricItems: true,
          },
        },
        groups: {
          include: {
            submissions: {
              orderBy: { uploadedAt: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Actualizar evaluación (puede agregar más rúbricas)
   */
  async updateEvaluation(id: string, dto: UpdateEvaluationDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Actualizar datos básicos
        const evaluation = await tx.evaluation.update({
          where: { id },
          data: {
            title: dto.title,
            description: dto.description,
            totalGroups: dto.totalGroups,
          },
        });

        // Agregar nuevas rúbricas adicionales
        if (dto.additionalRubrics && dto.additionalRubrics.length > 0) {
          for (const additionalRubric of dto.additionalRubrics) {
            const rubric = await tx.rubric.create({
              data: {
                evaluationId: id,
                title: additionalRubric.title,
              },
            });

            for (const item of additionalRubric.items) {
              await tx.rubricItem.create({
                data: {
                  rubricId: rubric.id,
                  itemOrder: item.itemOrder,
                  title: item.title,
                  conditions: item.conditions,
                  maxScore: item.maxScore || 1.0,
                },
              });
            }
          }
        }

        return evaluation;
      });
    } catch (error) {
      this.logger.error('Error al actualizar evaluación:', error);
      throw new BadRequestException('Error al actualizar evaluación');
    }
  }

  /**
   * Eliminar evaluación (cascade delete)
   */
  async deleteEvaluation(id: string) {
    try {
      // Prisma automáticamente eliminará todos los registros relacionados
      // gracias a las reglas onDelete: Cascade en el schema
      await this.prisma.evaluation.delete({
        where: { id },
      });

      this.logger.log(`Evaluación ${id} eliminada correctamente`);

      return { success: true, message: 'Evaluación eliminada correctamente' };
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Evaluación con ID ${id} no encontrada`);
      }
      throw new BadRequestException('Error al eliminar evaluación');
    }
  }

  // ============================================
  // CRUD DE GRUPOS
  // ============================================

  async createGroup(dto: CreateGroupDto) {
    return await this.prisma.group.create({
      data: {
        evaluationId: dto.evaluationId,
        code: dto.code,
        name: dto.name,
        studentCount: dto.studentCount || 0,
      },
      include: {
        submissions: true,
      },
    });
  }

  async getGroup(id: string) {
    const group = await this.prisma.group.findUnique({
      where: { id },
      include: {
        submissions: {
          orderBy: { uploadedAt: 'desc' },
        },
        evaluation: true,
      },
    });

    if (!group) {
      throw new NotFoundException(`Grupo con ID ${id} no encontrado`);
    }

    return group;
  }

  async listGroups() {
    return await this.prisma.group.findMany({
      include: {
        submissions: {
          orderBy: { uploadedAt: 'desc' },
        },
        evaluation: true,
      },
    });
  }

  async updateGroup(id: string, dto: UpdateGroupDto) {
    return await this.prisma.group.update({
      where: { id },
      data: dto,
      include: {
        submissions: true,
      },
    });
  }

  async deleteGroup(id: string) {
    await this.prisma.group.delete({
      where: { id },
    });

    return { success: true, message: 'Grupo eliminado correctamente' };
  }

  /**
   * Obtener grupos de una evaluación con sus recomendaciones del último análisis
   */
  async getGroupsWithRecommendations(evaluationId: string) {
    // Obtener el último análisis
    const lastAnalysis = await this.prisma.analysis.findFirst({
      where: { evaluationId },
      orderBy: { startedAt: 'desc' },
    });

    if (!lastAnalysis) {
      // Si no hay análisis, solo retornar grupos
      const groups = await this.prisma.group.findMany({
        where: { evaluationId },
        include: {
          submissions: {
            orderBy: { uploadedAt: 'desc' },
            take: 1,
          },
        },
      });

      return {
        evaluationId,
        analysisId: null,
        groups: groups.map((group) => ({
          ...group,
          recommendations: [],
        })),
      };
    }

    // Obtener grupos con sus recomendaciones
    const groups = await this.prisma.group.findMany({
      where: { evaluationId },
      include: {
        submissions: {
          orderBy: { uploadedAt: 'desc' },
          take: 1,
        },
        recommendations: {
          where: { analysisId: lastAnalysis.id },
          orderBy: { priority: 'asc' },
        },
      },
    });

    return {
      evaluationId,
      analysisId: lastAnalysis.id,
      analysisDate: lastAnalysis.startedAt,
      groups,
    };
  }

  // ============================================
  // SUBMISSIONS
  // ============================================

  async createSubmission(dto: CreateSubmissionDto) {
    return await this.prisma.submission.create({
      data: {
        groupId: dto.groupId,
        fileName: dto.fileName,
        fileUrl: dto.fileUrl,
        status: 'RECEIVED',
      },
    });
  }

  // ============================================
  // HELPER: Subir PDF a S3
  // ============================================

  private async uploadPdfToS3(file: Express.Multer.File, evaluationId: string): Promise<string> {
  try {
    // 1. Validar que sea un PDF
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('El archivo debe ser un PDF');
    }

    // 2. Validar tamaño (10MB máximo)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException(`Archivo demasiado grande. Máximo: 10MB`);
    }

    // 3. Generar nombre único
    const timestamp = Date.now();
    const sanitizedFileName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `evaluations/${evaluationId}/rubrics/${timestamp}_${sanitizedFileName}`;

    // 4. Subir a S3 usando el servicio
    const s3Url = await this.s3PdfService.uploadToS3WithHttpsUrl(
      file.buffer,
      fileName,
      file.mimetype,
    );

    this.logger.log(`✅ PDF subido exitosamente: ${s3Url}`);

    return s3Url;
  } catch (error) {
    this.logger.error('❌ Error al subir PDF a S3:', error);
    throw new BadRequestException('Error al subir archivo a S3: ' + error.message);
  }
}
}