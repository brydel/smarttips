import { IntegrationProvider } from '@prisma/client';

import { UnsupportedCapabilityError } from '../errors/connector.errors';
import { ConnectorCapability } from './connector.types';
import { SmartTipsConnector } from './smarttips-connector.interface';

export class ConnectorRegistry {
  private readonly connectors = new Map<IntegrationProvider, SmartTipsConnector>();

  register(connector: SmartTipsConnector): void {
    if (this.connectors.has(connector.provider)) {
      throw new UnsupportedCapabilityError({
        safeMessage: 'Connector provider is already registered.',
        provider: connector.provider,
      });
    }

    this.connectors.set(connector.provider, connector);
  }

  get(provider: IntegrationProvider): SmartTipsConnector {
    const connector = this.connectors.get(provider);

    if (!connector) {
      throw new UnsupportedCapabilityError({
        safeMessage: 'Connector provider is not available.',
        provider,
      });
    }

    return connector;
  }

  getForCapability(
    provider: IntegrationProvider,
    capability: ConnectorCapability,
  ): SmartTipsConnector {
    const connector = this.get(provider);

    if (!connector.capabilities.includes(capability)) {
      throw new UnsupportedCapabilityError({
        safeMessage: 'Connector capability is not available.',
        provider,
      });
    }

    return connector;
  }

  availableProviders(): IntegrationProvider[] {
    return Array.from(this.connectors.keys());
  }

  availableCapabilities(provider: IntegrationProvider): readonly ConnectorCapability[] {
    return this.get(provider).capabilities;
  }
}
