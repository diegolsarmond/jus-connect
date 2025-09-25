import type { INotificationProvider } from './types';
import { pjeNotificationProvider } from './pjeNotificationService';
import { juditNotificationProvider } from './juditNotificationService';
import { projudiNotificationProvider } from './projudiNotificationService';

const registry = new Map<string, INotificationProvider>();

export function registerNotificationProvider(
  provider: INotificationProvider,
  identifier?: string,
): void {
  const derivedId = identifier ?? (provider as { id?: string }).id;

  if (!derivedId || typeof derivedId !== 'string') {
    throw new Error('Notification provider must define an identifier');
  }

  registry.set(derivedId.toLowerCase(), provider);
}

export function getNotificationProvider(identifier?: string | null): INotificationProvider | undefined {
  if (!identifier) {
    return undefined;
  }

  return registry.get(identifier.toLowerCase());
}

export function listNotificationProviders(): INotificationProvider[] {
  return Array.from(registry.values());
}

registerNotificationProvider(pjeNotificationProvider, 'pje');
registerNotificationProvider(juditNotificationProvider, 'judit');
registerNotificationProvider(projudiNotificationProvider, 'projudi');

export const notificationProviderRegistry = registry;
