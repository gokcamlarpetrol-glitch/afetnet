import { EEWProvider, EEWEvent } from './EEWProvider';
import { OfficialWSProvider } from './providers/official-ws';
import { AfadKandilliPoller } from './providers/afadKandilliPoller';

const MODE = process.env.EEW_PROVIDER_MODE || 'poll'; // 'official-ws' | 'poll' | 'multi'
const providers: EEWProvider[] = [];

export async function startEEW(onEvent: (evt: EEWEvent) => Promise<void> | void) {
  if (MODE === 'official-ws' || MODE === 'multi') {
    providers.push(new OfficialWSProvider(process.env.OFFICIAL_WSS_URL || '', process.env.OFFICIAL_WSS_TOKEN));
  }
  if (MODE === 'poll' || MODE === 'multi') {
    if (process.env.AFAD_KANDILLI_URL) providers.push(new AfadKandilliPoller(process.env.AFAD_KANDILLI_URL, 5000));
    if (process.env.USGS_URL) providers.push(new AfadKandilliPoller(process.env.USGS_URL, 5000));
    if (process.env.EMSC_URL) providers.push(new AfadKandilliPoller(process.env.EMSC_URL, 5000));
  }

  for (const p of providers) { p.onEvent((e)=>onEvent(e)); await p.start(); }
}

export async function stopEEW(){ for(const p of providers){ await p.stop(); } }

export async function healthEEW(){ const checks = await Promise.all(providers.map(p=>Promise.resolve(p.health()))); return checks.every(c=>c.ok); }


