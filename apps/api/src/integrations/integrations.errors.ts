import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

export class IntegrationTenantRequiredError extends BadRequestException {
  constructor() {
    super('error.integrations.tenantIdRequired');
  }
}

export class IntegrationAccountNotFoundError extends NotFoundException {
  constructor() {
    super('error.integrations.accountNotFound');
  }
}

export class IntegrationAccountDuplicateError extends ConflictException {
  constructor() {
    super('error.integrations.accountDuplicate');
  }
}

export class IntegrationMappingDuplicateError extends ConflictException {
  constructor() {
    super('error.integrations.mappingDuplicate');
  }
}

export class IntegrationSyncJobDuplicateError extends ConflictException {
  constructor() {
    super('error.integrations.syncJobDuplicate');
  }
}

export class IntegrationCredentialDuplicateError extends ConflictException {
  constructor() {
    super('error.integrations.credentialDuplicate');
  }
}
