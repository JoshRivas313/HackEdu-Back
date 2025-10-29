// common/interceptors/parse-json-form-data.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class ParseJsonFormDataInterceptor implements NestInterceptor {
  constructor(private readonly jsonFields: string[]) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const body = request.body;

    // Parsear campos JSON especificados
    this.jsonFields.forEach((field) => {
      if (body[field] && typeof body[field] === 'string') {
        try {
          body[field] = JSON.parse(body[field]);
        } catch (error) {
          throw new BadRequestException(
            `El campo "${field}" debe ser un JSON válido`,
          );
        }
      }
    });

    return next.handle();
  }
}