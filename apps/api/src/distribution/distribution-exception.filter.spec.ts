import { ArgumentsHost, Logger } from '@nestjs/common';

import {
  DistributionInputError,
  DistributionInvariantError,
} from './distribution-calculator/allocation';
import { DistributionExceptionFilter } from './distribution-exception.filter';

function host(response: { status: jest.Mock; json: jest.Mock }): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;
}

describe('DistributionExceptionFilter', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps input errors to HTTP 400 with the i18n key', () => {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const filter = new DistributionExceptionFilter();

    filter.catch(new DistributionInputError('error.distribution.invalidWeights'), host(response));

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 400,
      message: 'error.distribution.invalidWeights',
      error: 'Bad Request',
    });
  });

  it('maps invariant errors to HTTP 500 and masks the internal key', () => {
    const logger = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const filter = new DistributionExceptionFilter();

    filter.catch(
      new DistributionInvariantError('error.distribution.createManyCountMismatch'),
      host(response),
    );

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'error.distribution.internal',
      error: 'Internal Server Error',
    });
    expect(logger).toHaveBeenCalledWith({
      event: 'distribution_invariant_violation',
      message: 'error.distribution.createManyCountMismatch',
    });
  });
});
