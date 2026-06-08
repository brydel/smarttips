import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';

import {
  DistributionInputError,
  DistributionInvariantError,
} from './distribution-calculator/allocation';

// Maps the framework-agnostic allocation errors back onto HTTP. Without this filter
// registered, DistributionInputError would surface as 500 instead of 400.
// Register globally (app.useGlobalFilters) or on the distribution controller
// (@UseFilters(DistributionExceptionFilter)). Assumes Express (Nest default).
@Catch(DistributionInputError, DistributionInvariantError)
export class DistributionExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DistributionExceptionFilter.name);

  catch(exception: DistributionInputError | DistributionInvariantError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const isInvariant = exception instanceof DistributionInvariantError;
    const status = isInvariant ? HttpStatus.INTERNAL_SERVER_ERROR : HttpStatus.BAD_REQUEST;

    if (isInvariant) {
      // Invariant violations are bugs: log loudly, never leak the internal key.
      this.logger.error({ event: 'distribution_invariant_violation', message: exception.message });
    }

    response.status(status).json({
      statusCode: status,
      message: isInvariant ? 'error.distribution.internal' : exception.message,
      error: isInvariant ? 'Internal Server Error' : 'Bad Request',
    });
  }
}
