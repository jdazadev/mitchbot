import { ChannelAdapter } from '../types';

/** Web entrega por la room de Socket.io de la conversación, que ya emite chat.service. */
export const webAdapter: ChannelAdapter = {
  platform: 'Web',
  external: false,
  async send() {
    return {};
  },
};
