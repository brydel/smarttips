import { IntegrationCategory, IntegrationProvider } from '@prisma/client';

import {
  ConnectInput,
  ConnectResult,
  ConnectorCapability,
  ConnectorHealth,
  ConnectorListEmployeesResult,
  ConnectorListLocationsResult,
  ConnectorRequestContext,
  ConnectorSyncSalesResult,
  ConnectorSyncTimeEntriesResult,
  ConnectorSyncTipsResult,
  CredentialRefreshResult,
  DisconnectInput,
  DisconnectResult,
  RefreshCredentialsInput,
  SyncWindowRequest,
  ValidateConfigInput,
  ValidationResult,
} from './connector.types';

export interface SmartTipsConnector {
  readonly provider: IntegrationProvider;
  readonly category: IntegrationCategory;
  readonly capabilities: readonly ConnectorCapability[];

  validateConfig(input: ValidateConfigInput): Promise<ValidationResult>;
  connect(input: ConnectInput): Promise<ConnectResult>;
  refreshCredentials(input: RefreshCredentialsInput): Promise<CredentialRefreshResult>;
  disconnect(input: DisconnectInput): Promise<DisconnectResult>;
  listLocations(input: ConnectorRequestContext): Promise<ConnectorListLocationsResult>;
  listEmployees(input: ConnectorRequestContext): Promise<ConnectorListEmployeesResult>;
  syncSales(input: SyncWindowRequest): Promise<ConnectorSyncSalesResult>;
  syncTips(input: SyncWindowRequest): Promise<ConnectorSyncTipsResult>;
  syncTimeEntries(input: SyncWindowRequest): Promise<ConnectorSyncTimeEntriesResult>;
  healthCheck(input: ConnectorRequestContext): Promise<ConnectorHealth>;
}
