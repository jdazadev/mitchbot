/*
 * Página del chat del widget (dentro del iframe, mismo origen que el backend).
 * La configuración llega en <script id="mitchbot-config" type="application/json">.
 * La conversación se recuerda en este navegador con su token de acceso.
 */
(function () {
  'use strict';
  var config = JSON.parse(document.getElementById('mitchbot-config').textContent);
  var t = config.strings;
  var api = '/api/public/widget/' + encodeURIComponent(config.slug);
  var chatApi = '/api/public/test-chat/' + encodeURIComponent(config.slug);
  var storageKey = 'mitchbot:widget:' + config.slug;

  var list = document.getElementById('messages');
  var form = document.getElementById('composer');
  var input = document.getElementById('message');
  var sendButton = document.getElementById('send');
  var errorBox = document.getElementById('error');
  var live = document.getElementById('live');

  var state = load();
  var rendered = {};
  var socket = null;
  var sending = false;

  function load() {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch (e) { return {}; }
  }
  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch (e) { /* Navegación privada: solo dura la sesión. */ }
  }
  function forget() {
    state = { clientIdentifier: state.clientIdentifier };
    save();
  }
  function identifier() {
    if (!state.clientIdentifier) {
      state.clientIdentifier = 'widget-' + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(16).slice(2));
      save();
    }
    return state.clientIdentifier;
  }

  // === Mensajes ===

  /** Lo que ve el cliente: sus mensajes, los del bot y del equipo, y las confirmaciones. */
  function visible(message) {
    if (message.contentType === 'tool_call' || message.contentType === 'tool_result') return false;
    return message.sender !== 'tool' || message.contentType === 'confirmation_request';
  }

  function render(message) {
    if (!visible(message)) return;
    var existing = rendered[message._id];
    var bubble = existing || document.createElement('div');
    bubble.className = 'bubble ' + (message.sender === 'contact' ? 'out' : 'in');
    bubble.setAttribute('data-message-id', message._id);
    bubble.setAttribute('data-sender', message.sender);
    bubble.textContent = '';

    if (message.sender === 'human_agent' && message.senderName) {
      var who = document.createElement('span');
      who.className = 'who';
      who.textContent = message.senderName;
      bubble.appendChild(who);
    }

    if (!message.content) {
      var typing = document.createElement('span');
      typing.className = 'typing';
      typing.setAttribute('aria-label', t.typing);
      typing.innerHTML = '<span></span><span></span><span></span>';
      bubble.appendChild(typing);
    } else {
      var text = document.createElement('span');
      text.textContent = message.content;
      bubble.appendChild(text);
    }

    var tool = message.toolData;
    if (message.contentType === 'confirmation_request' && tool && tool.executionId) {
      var actions = document.createElement('div');
      actions.className = 'actions';
      if (tool.status === 'needs_confirmation') {
        actions.appendChild(actionButton('confirm', t.confirm, message, tool));
        actions.appendChild(actionButton('cancel', t.cancel, message, tool));
      } else {
        var note = document.createElement('span');
        note.className = 'note';
        note.textContent = tool.status === 'cancelled' ? t.cancelled : t.confirmed;
        actions.appendChild(note);
      }
      bubble.appendChild(actions);
    }

    if (!existing) {
      rendered[message._id] = bubble;
      list.appendChild(bubble);
    }
    list.scrollTop = list.scrollHeight;
  }

  function actionButton(action, label, message, tool) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = action;
    button.textContent = label;
    button.addEventListener('click', function () {
      if (!socket) return;
      var buttons = button.parentNode.querySelectorAll('button');
      for (var i = 0; i < buttons.length; i++) buttons[i].disabled = true;
      socket.emit('tool:confirm', { conversationId: state.conversationId, executionId: tool.executionId, action: action });
    });
    return button;
  }

  function greet() {
    if (config.greeting && !list.querySelector('[data-greeting]')) {
      var bubble = document.createElement('div');
      bubble.className = 'bubble in';
      bubble.setAttribute('data-greeting', '');
      bubble.textContent = config.greeting;
      list.appendChild(bubble);
    }
  }

  function note(text) {
    var element = document.createElement('p');
    element.className = 'note';
    element.textContent = text;
    list.appendChild(element);
    list.scrollTop = list.scrollHeight;
  }

  function announce(message) {
    if (message.sender !== 'contact' && message.content) live.textContent = t.newMessage.replace('{message}', message.content.slice(0, 140));
  }

  function showError(text) {
    errorBox.textContent = text || '';
    errorBox.hidden = !text;
  }

  // === Tiempo real ===

  function connect() {
    if (socket || typeof io !== 'function') return;
    socket = io({ query: { isPublic: 'true', slug: config.slug }, transports: ['websocket', 'polling'] });
    socket.on('connect', join);
    socket.on('chat:message', function (message) {
      if (message.conversationId !== state.conversationId) return;
      var isNew = !rendered[message._id];
      render(message);
      if (isNew) announce(message);
    });
    socket.on('chat:message_chunk', function (data) {
      if (!data.isDone || data.conversationId !== state.conversationId) return;
      var bubble = rendered[data.messageId];
      render({ _id: data.messageId, sender: bubble ? bubble.getAttribute('data-sender') : 'ai_agent', content: data.content, contentType: 'text' });
      announce({ sender: 'ai_agent', content: data.content });
    });
    socket.on('chat:message_updated', function (data) {
      var bubble = rendered[data.messageId];
      if (!bubble || !data.status) return;
      var actions = bubble.querySelector('.actions');
      if (actions) {
        actions.textContent = '';
        var label = document.createElement('span');
        label.className = 'note';
        label.textContent = data.status === 'cancelled' ? t.cancelled : t.confirmed;
        actions.appendChild(label);
      }
    });
    socket.on('chat:status', function (data) {
      if (data && data.status === 'closed') {
        note(t.closedConversation);
        forget();
      }
    });
  }

  function join() {
    if (socket && state.conversationId && state.clientToken) {
      socket.emit('join:room', { roomId: state.conversationId, clientToken: state.clientToken });
    }
  }

  // === Envío ===

  function request(url, options) {
    return fetch(url, options).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (!res.ok) { var error = new Error(body.error || 'HTTP ' + res.status); error.status = res.status; throw error; }
        return body;
      });
    });
  }

  function start(text) {
    return request(chatApi + '/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: 'Web', clientIdentifier: identifier(), initialMessage: text }),
    }).then(function (result) {
      state.conversationId = result.conversation._id;
      state.clientToken = result.clientToken;
      save();
      join();
      render(result.message);
    });
  }

  function send(text) {
    return request(chatApi + '/' + state.conversationId + '/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Client-Token': state.clientToken },
      body: JSON.stringify({ content: text }),
    }).then(render, function (error) {
      // La conversación ya no es accesible (borrada o token antiguo): se empieza otra.
      if (error.status === 403 || error.status === 404) { forget(); return start(text); }
      throw error;
    });
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var text = input.value.trim();
    if (!text || sending) return;
    sending = true;
    sendButton.disabled = true;
    showError('');
    (state.conversationId && state.clientToken ? send(text) : start(text))
      .then(function () { input.value = ''; })
      .catch(function () { showError(t.error); })
      .then(function () { sending = false; sendButton.disabled = false; input.focus(); });
  });

  document.getElementById('close').addEventListener('click', requestClose);
  document.addEventListener('keydown', function (event) { if (event.key === 'Escape') requestClose(); });
  window.addEventListener('message', function (event) {
    if (event.data && event.data.type === 'mitchbot:opened') input.focus();
  });

  function requestClose() {
    if (window.parent !== window) window.parent.postMessage({ type: 'mitchbot:close' }, '*');
  }

  // === Arranque ===

  greet();
  connect();
  if (state.conversationId && state.clientToken) {
    request(api + '/conversations/' + state.conversationId + '/messages', { headers: { 'X-Client-Token': state.clientToken } })
      .then(function (messages) { messages.forEach(render); })
      .catch(function () { forget(); });
  }
})();
