/** Textos de la página del widget; el idioma es el del agente del proyecto. */
export const WIDGET_STRINGS = {
  es: {
    title: 'Chatea con nosotros',
    open: 'Abrir chat',
    close: 'Cerrar chat',
    placeholder: 'Escribe tu mensaje…',
    send: 'Enviar',
    typing: 'Escribiendo…',
    confirm: 'Confirmar',
    cancel: 'Cancelar',
    confirmed: 'Confirmado',
    cancelled: 'Cancelado',
    closedConversation: 'La conversación terminó. Escribe para empezar otra.',
    error: 'No se pudo enviar el mensaje. Inténtalo de nuevo.',
    newMessage: 'Nuevo mensaje: {message}',
    poweredBy: 'Con la tecnología de Mitchbot',
  },
  en: {
    title: 'Chat with us',
    open: 'Open chat',
    close: 'Close chat',
    placeholder: 'Type your message…',
    send: 'Send',
    typing: 'Typing…',
    confirm: 'Confirm',
    cancel: 'Cancel',
    confirmed: 'Confirmed',
    cancelled: 'Cancelled',
    closedConversation: 'The conversation ended. Write to start a new one.',
    error: "Couldn't send the message. Please try again.",
    newMessage: 'New message: {message}',
    poweredBy: 'Powered by Mitchbot',
  },
} as const;

export type WidgetLanguage = keyof typeof WIDGET_STRINGS;
