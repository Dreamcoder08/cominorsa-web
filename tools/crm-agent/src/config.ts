import { CrmError } from './domain.ts';
import type { CrmReadPort } from './domain.ts';
import { createTwentyReadPort } from './twenty.ts';

export function createConfiguredReadPort(env: NodeJS.ProcessEnv, fetchImpl?: typeof fetch): CrmReadPort {
  if (env.COMINORSA_CRM_ALLOW_NETWORK !== '1') {
    throw new CrmError('network_denied', 'CRM network access is disabled.');
  }
  const baseUrl = env.COMINORSA_CRM_URL;
  const apiKey = env.COMINORSA_CRM_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new CrmError('missing_configuration', 'CRM URL and API key are required.');
  }
  return createTwentyReadPort({ baseUrl, apiKey, fetchImpl });
}
