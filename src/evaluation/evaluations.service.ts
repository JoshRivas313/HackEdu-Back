// evaluations.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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
   * Crear una evaluación con PDF opcional y rubric items
   */
  async createEvaluation(
    dto: CreateEvaluationDto,
    pdfFile?: Express.Multer.File,
  ) {
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

        // 2. SIEMPRE crear UNA rúbrica principal (con o sin PDF)
        let rubric;

        if (pdfFile) {
          // Si hay PDF, subirlo a S3 y crear rúbrica con URL
          this.logger.log(`Subiendo PDF a S3: ${pdfFile.originalname}`);
          const s3Url = await this.uploadPdfToS3(pdfFile, evaluation.id);

          rubric = await tx.rubric.create({
            data: {
              evaluationId: evaluation.id,
              title: pdfFile.originalname.replace('.pdf', ''),
              rubricPdfUrl: s3Url,
            },
          });
        } else {
          // Sin PDF, crear rúbrica por defecto
          rubric = await tx.rubric.create({
            data: {
              evaluationId: evaluation.id,
              title: `Rúbrica de ${dto.title}`,
            },
          });
        }

        // 3. Crear los rubricItems vinculados a la rúbrica principal
        if (dto.rubricItems && dto.rubricItems.length > 0) {
          this.logger.log(
            `Creando ${dto.rubricItems.length} rubric items para la rúbrica`,
          );

          for (const item of dto.rubricItems) {
            await tx.rubricItem.create({
              data: {
                rubricId: rubric.id, // ✅ Vinculados a la rúbrica principal
                itemOrder: item.itemOrder,
                title: item.title,
                conditions: item.conditions,
                maxScore: item.maxScore || 1.0,
              },
            });
          }
        }

        // 4. Registrar actividad
        await tx.activityLog.create({
          data: {
            actorId: dto.ownerId,
            evaluationId: evaluation.id,
            type: 'CREATE',
            message: `Evaluación "${dto.title}" creada con rúbrica "${rubric.title}"`,
          },
        });

        // 5. Retornar evaluación completa con la rúbrica y sus items
        return await tx.evaluation.findUnique({
          where: { id: evaluation.id },
          include: {
            rubrics: {
              include: {
                rubricItems: {
                  orderBy: { itemOrder: 'asc' },
                },
              },
            },
          },
        });
      });
    } catch (error) {
      this.logger.error('Error al crear evaluación:', error);
      throw new BadRequestException(
        'Error al crear evaluación: ' + error.message,
      );
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
    const where = ownerId
      ? { ownerId, isArchived: false }
      : { isArchived: false };

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
   * Actualizar evaluación (puede agregar más rubric items a la rúbrica)
   */
  async updateEvaluation(id: string, dto: UpdateEvaluationDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // 1. Actualizar datos básicos de la evaluación
        const evaluation = await tx.evaluation.update({
          where: { id },
          data: {
            title: dto.title,
            description: dto.description,
            totalGroups: dto.totalGroups,
          },
        });

        // 2. Agregar nuevos rubric items a la rúbrica existente
        if (dto.additionalRubricItems && dto.additionalRubricItems.length > 0) {
          // Obtener la rúbrica principal de esta evaluación
          const rubric = await tx.rubric.findFirst({
            where: { evaluationId: id },
          });

          if (!rubric) {
            throw new BadRequestException(
              'No se encontró rúbrica para esta evaluación',
            );
          }

          // Obtener el último itemOrder para continuar la numeración
          const lastItem = await tx.rubricItem.findFirst({
            where: { rubricId: rubric.id },
            orderBy: { itemOrder: 'desc' },
          });

          let nextOrder = lastItem ? lastItem.itemOrder + 1 : 1;

          this.logger.log(
            `Agregando ${dto.additionalRubricItems.length} rubric items adicionales`,
          );

          // Agregar los nuevos items
          for (const item of dto.additionalRubricItems) {
            await tx.rubricItem.create({
              data: {
                rubricId: rubric.id, // ✅ Se vinculan a la rúbrica principal
                itemOrder: item.itemOrder || nextOrder++,
                title: item.title,
                conditions: item.conditions,
                maxScore: item.maxScore || 1.0,
              },
            });
          }
        }

        // 3. Retornar evaluación actualizada con todos los items
        return await tx.evaluation.findUnique({
          where: { id },
          include: {
            rubrics: {
              include: {
                rubricItems: {
                  orderBy: { itemOrder: 'asc' },
                },
              },
            },
          },
        });
      });
    } catch (error) {
      this.logger.error('Error al actualizar evaluación:', error);
      throw new BadRequestException(
        'Error al actualizar evaluación: ' + error.message,
      );
    }
  }

  /**
   * Eliminar evaluación (cascade delete)
   */
  async deleteEvaluation(id: string) {
    try {
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
    const lastAnalysis = await this.prisma.analysis.findFirst({
      where: { evaluationId },
      orderBy: { startedAt: 'desc' },
    });

    if (!lastAnalysis) {
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

  async getGroupsByEvaluationSimple(evaluationId: string) {
    const groups = await this.prisma.group.findMany({
      where: { evaluationId },
      include: {
        submissions: {
          orderBy: { uploadedAt: 'desc' },
          take: 1, // Solo la submission más reciente
        },
      },
      orderBy: { code: 'asc' },
    });

    if (groups.length === 0) {
      // Verificar si la evaluación existe
      const evaluation = await this.prisma.evaluation.findUnique({
        where: { id: evaluationId },
      });

      if (!evaluation) {
        throw new NotFoundException(
          `Evaluación con ID ${evaluationId} no encontrada`,
        );
      }
    }

    return groups;
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

  private async uploadPdfToS3(
    file: Express.Multer.File,
    evaluationId: string,
  ): Promise<string> {
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
      const sanitizedFileName = file.originalname.replace(
        /[^a-zA-Z0-9.-]/g,
        '_',
      );
      const fileName = `evaluations/${evaluationId}/rubrics/${timestamp}_${sanitizedFileName}`;

      // 4. Subir a S3 usando el servicio
      const s3Url = await this.s3PdfService.uploadToS3(
        file.buffer,
        fileName,
        file.mimetype,
      );

      this.logger.log(`✅ PDF subido exitosamente: ${s3Url}`);

      return s3Url;
    } catch (error) {
      this.logger.error('❌ Error al subir PDF a S3:', error);
      throw new BadRequestException(
        'Error al subir archivo a S3: ' + error.message,
      );
    }
  }
}
