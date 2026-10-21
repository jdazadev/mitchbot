import { ChannelAdapter, ChannelPlatform } from './types';
import { webAdapter } from './adapters/web.adapter';

const adapters = new Map<ChannelPlatform, ChannelAdapter>([[webAdapter.platform, webAdapter]]);

export function registerAdapter(adapter: ChannelAdapter) {
  adapters.set(adapter.platform, adapter);
}

export function getAdapter(platform: ChannelPlatform): ChannelAdapter | undefined {
  return adapters.get(platform);
}

/** Un canal es externo si tiene adaptador registrado que entrega fuera del socket. */
export function isExternal(platform: ChannelPlatform): boolean {
  return adapters.get(platform)?.external ?? false;
}

/** Solo para pruebas: deja el registro como al arrancar. */
export function resetAdapters() {
  adapters.clear();
  adapters.set(webAdapter.platform, webAdapter);
}
