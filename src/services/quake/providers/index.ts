import { QuakeProvider, QuakeProviderType } from '../types';
import { afadProvider } from './afad';
import { kandilliProvider } from './kandilli';
import { usgsProvider } from './usgs';

export const providerRegistry: Record<QuakeProviderType, QuakeProvider> = {
  USGS: usgsProvider,
  AFAD: afadProvider,
  KANDILLI: kandilliProvider,
};

export { afadProvider, kandilliProvider, usgsProvider };
