#!/usr/bin/env python3
# Genera el prototipo «Aurora» fiel al producto real de Mitchbot.
# Etiquetas tomadas de apps/frontend/src/locales/es.json. Datos SINTÉTICOS.
import os

# Iconos: SVG inline de Phosphor (regular), mismos que expone AIcon.vue en el código real.
ICONS = {
    "dashboard": '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M104,40H56A16,16,0,0,0,40,56v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,104,40Zm0,64H56V56h48Zm96-64H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,200,40Zm0,64H152V56h48Zm-96,32H56a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,104,136Zm0,64H56V152h48Zm96-64H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,200,136Zm0,64H152V152h48Z"/></svg>',
    "mensajeria": '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M128,24A104,104,0,0,0,36.18,176.88L24.83,210.93a16,16,0,0,0,20.24,20.24l34.05-11.35A104,104,0,1,0,128,24Zm0,192a88,88,0,0,1-46.62-13.44,8,8,0,0,0-6.11-1l-37.72,12.57,12.57-37.72a8,8,0,0,0-1-6.11A88,88,0,1,1,128,216Zm48-80a12,12,0,1,1-12-12A12,12,0,0,1,176,136Zm-48,0a12,12,0,1,1-12-12A12,12,0,0,1,128,136Zm-48,0a12,12,0,1,1-12-12A12,12,0,0,1,80,136Z"/></svg>',
    "clientes": '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M117.25,157.92a60,60,0,1,0-66.5,0A95.83,95.83,0,0,0,3.53,195.63a8,8,0,1,0,13.4,8.74,80,80,0,0,1,134.14,0,8,8,0,0,0,13.4-8.74A95.83,95.83,0,0,0,117.25,157.92ZM40,108a44,44,0,1,1,44,44A44.05,44.05,0,0,1,40,108Zm186.55,73.41a8,8,0,0,1-11.07,2.33,8.09,8.09,0,0,1-2.33-2.33,80,80,0,0,0-54.93-34.11A60.08,60.08,0,0,0,164,108a59.53,59.53,0,0,0-2.42-16.69,8,8,0,0,1,5.42-9.72,8,8,0,0,1,9.72,5.42A76.15,76.15,0,0,1,180,108a76,76,0,0,1-30.1,60.67,96.14,96.14,0,0,1,76.65,50.32A8,8,0,0,1,226.55,181.41Z"/></svg>',
    "cerebro": '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M248,124a56.11,56.11,0,0,0-32-50.61V72a48,48,0,0,0-88-26.49A48,48,0,0,0,40,72v1.39a56,56,0,0,0,0,101.2V176a48,48,0,0,0,88,26.49A48,48,0,0,0,216,176v-1.39A56.11,56.11,0,0,0,248,124ZM88,208a32,32,0,0,1-31.81-28.56A55.87,55.87,0,0,0,64,180h8a8,8,0,0,0,0-16H64A40,40,0,0,1,50.67,86.78,8,8,0,0,0,56,78.48V72a32,32,0,0,1,64,0v6.48a8,8,0,0,0,5.33,8.3A40,40,0,0,1,120,164a8,8,0,0,0,0,16h8a55.87,55.87,0,0,0,7.81-.56A32,32,0,0,1,88,208Zm112-28a32,32,0,0,1-42.67-11.78,8,8,0,0,0-6.9-3.94,40,40,0,0,1-22.43-9.63A55.75,55.75,0,0,0,136,180a8,8,0,0,0,0-16,40,40,0,0,1-22.67-24.23,32,32,0,0,1,32-56.22,8,8,0,0,0,5.33-8.3V72a32,32,0,0,1,64,0v6.48a8,8,0,0,0,5.33,8.3A40,40,0,0,1,200,180Z"/></svg>',
    "usuarios": '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M230.92,212c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,166.78,40.31,185.66,25.08,212a8,8,0,1,0,13.85,8c18.84-32.56,52.14-52,89.07-52s70.23,19.44,89.07,52a8,8,0,1,0,13.85-8ZM72,96a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z"/></svg>',
    "ajustes": '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M128,80a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Zm109.66-32a16.12,16.12,0,0,1-4.69,11.31l-21.4,21.4a16,16,0,0,1-22.63,0l-5.37-5.38a82.51,82.51,0,0,1-17.8,7.37l-3.65,7.5a16,16,0,0,1-14.31,8.83H148.2a16,16,0,0,1-14.31-8.83l-3.65-7.5a82.51,82.51,0,0,1-17.8-7.37l-5.37,5.38a16,16,0,0,1-22.63,0l-21.4-21.4a16.12,16.12,0,0,1-4.69-11.31V128a16.12,16.12,0,0,1,4.69-11.31l21.4-21.4a16,16,0,0,1,22.63,0l5.37,5.38a82.51,82.51,0,0,1,17.8-7.37l3.65-7.5A16,16,0,0,1,133.8,77h7.5a16,16,0,0,1,14.31,8.83l3.65,7.5a82.51,82.51,0,0,1,17.8,7.37l5.37-5.38a16,16,0,0,1,22.63,0l21.4,21.4A16.12,16.12,0,0,1,237.66,128Z"/></svg>',
    "perfil": '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24ZM74.08,197.5a64,64,0,0,1,107.84,0,87.83,87.83,0,0,1-107.84,0ZM96,120a32,32,0,1,1,32,32A32,32,0,0,1,96,120Zm97.76,66.41a79.66,79.66,0,0,0-36.06-28.75,48,48,0,1,0-59.4,0,79.66,79.66,0,0,0-36.06,28.75,88,88,0,1,1,131.52,0Z"/></svg>',
}

# Rutas y labels reales (nav.*), con su icono Phosphor
NAV = [("dashboard", "Panel"), ("mensajeria", "Conversaciones"), ("clientes", "Clientes"),
       ("cerebro", "Brain"), ("usuarios", "Usuarios"), ("ajustes", "Configuración"),
       ("perfil", "Mi Perfil")]

# Títulos de página reales (topbar.*): "Resumen del panel" por dashboard
PAGE_TITLE = {
    "dashboard": "Resumen del panel", "mensajeria": "Conversaciones", "clientes": "Clientes",
    "cerebro": "Brain", "usuarios": "Usuarios", "ajustes": "Configuración", "perfil": "Mi Perfil",
    "pruebas": "Pruebas",
}


def nav_links(actual):
    out = ""
    for f, label in NAV:
        cls = ' class="on"' if f == actual else ""
        out += ('<a href="%s.html"%s><span class="rail-ic">%s</span>%s</a>\n  '
                % (f, cls, ICONS[f], label))
    return out


def shell_rail(actual):
    return ('<aside class="rail">\n'
            '  <div class="brand"><div class="mark">E</div><div class="nm">Estudio Mateo</div></div>\n'
            '  <nav>%s</nav>\n'
            '  <div class="turno"><div class="clock">09:41</div>'
            '<div class="sub">Jueves</div><div class="sub">21/09/2026</div></div>\n'
            '</aside>' % nav_links(actual))


def topbar(page, context="", right_extra=""):
    """Fila de cápsulas flotantes: título + instrumentos de la vista + cluster fijo."""
    out = '<div class="topbar">'
    out += '<span class="cap page">%s</span>' % PAGE_TITLE.get(page, page)
    out += context
    out += '<div class="cluster">'
    out += right_extra
    # Proyectos
    out += ('<span class="cap press"><span class="dot"></span>Estudio Mateo '
            '<span class="caret">▾</span></span>')
    # Idiomas
    out += '<span class="cap press">🌐 Español <span class="caret">▾</span></span>'
    # Notificaciones
    out += '<span class="cap ic" title="Notificaciones">🔔</span>'
    # Usuario
    out += ('<span class="cap press"><span class="dot" style="background:var(--lilac)"></span>'
            'Jorge Daza <span class="caret">▾</span></span>')
    out += '</div></div>'
    return out


def seg(options, active=0):
    out = '<span class="capgroup">'
    for i, (k, label) in enumerate(options):
        out += '<button%s>%s</button>' % (' class="on"' if i == active else "", label)
    return out + '</span>'


def kpis(items):
    out = '<span class="capkpis">'
    for v, l, c in items:
        out += '<span class="kpi %s"><b>%s</b><span>%s</span></span>' % (c, v, l)
    return out + '</span>'


class Page:
    def __init__(self):
        self._s = open("_shell.html").read()

    def render(self, titulo, nav, body, css=""):
        return (self._s.replace("%%TITULO%%", titulo)
                       .replace("%%NAV%%", nav_links(nav))
                       .replace("%%RAIL%%", shell_rail(nav))
                       .replace("%%CSS%%", css)
                       .replace("%%BODY%%", body))


def shell(body):
    return ('<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>Mitchbot · Aurora</title>'
            '<link rel="preconnect" href="https://fonts.googleapis.com">'
            '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
            '<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,400;12..96,75..100,500;12..96,75..100,600;12..96,75..100,700&family=Hanken+Grotesk:wght@400;500;600;700;800&display=swap" rel="stylesheet">'
            '<link rel="stylesheet" href="style.css"><style>body{overflow-x:hidden}</style></head>'
            '<body><div class="haze" aria-hidden="true"></div>' + body + '</body></html>')


P = Page()

# ═══════════════════════════════════════════════════════════════════
# 01 · DASHBOARD — título real "Resumen del panel". Control 7/30/90 + granularidad.
# Widgets reales: Conversaciones totales · Chats activos · Tasa de respuesta ·
# Conversión de leads · Volumen de conversaciones · Distribución por canal · Actividad reciente
# ═══════════════════════════════════════════════════════════════════
ctx = seg([("7", "Últimos 7 días"), ("30", "Últimos 30 días"), ("90", "Últimos 90 días")]) + seg([("d", "Diaria"), ("w", "Semanal"), ("m", "Mensual")])
d = topbar("dashboard", ctx)
d += '<div class="lead"><h1>Buenos días, Jorge.<br><span class="hl butter">Tres conversaciones</span> piden una mano.</h1>'
d += '<div class="dek">El bot va al día por su cuenta. Esto es lo que pasó en el estudio en los últimos 30 días.</div>'
d += '<div class="acts"><button class="btn-2 btn">Exportar</button></div></div>'
d += '<div class="stack">'
d += '<div class="grid g-4" style="grid-template-columns:repeat(4,1fr)">'
for t, v, dl, up in [("Conversaciones totales", "114", "+12% sobre el período", True),
                     ("Chats activos", "12", "en vivo ahora", True),
                     ("Tasa de respuesta", "94%", "+1.2 puntos", True),
                     ("Conversión de leads", "14.0%", "+0.5% sobre el período", True)]:
    d += ('<div class="card pad"><div style="font-size:12px;font-weight:600;color:var(--ink-3)">' + t + '</div>'
          '<div class="metric" style="margin-top:12px">' + v + '</div>'
          '<div class="delta ' + ('up' if up else 'down') + '">' + dl + '</div></div>')
d += '</div>'
d += '<div class="grid g-side" style="grid-template-columns:1.7fr 1fr">'
d += '<div class="card pad"><div style="display:flex;align-items:center;gap:10px">'
d += '<h2 style="font-family:var(--display);font-size:15.5px;font-weight:600">Volumen de conversaciones</h2>'
d += '<span class="note" style="margin-left:auto">Conversaciones iniciadas en el tiempo</span></div>'
d += '<div class="cols" style="height:180px;margin-top:22px">'
for h, hum in [(60, 18), (92, 26), (48, 10), (140, 40), (72, 20), (110, 32), (98, 24), (160, 52),
               (85, 22), (64, 14), (132, 38), (150, 44), (88, 20), (116, 30), (104, 26), (55, 12),
               (90, 24), (128, 36), (142, 42), (99, 28), (76, 18), (44, 10)]:
    pct = round(hum * 100.0 / h)
    d += ('<i style="height:%dpx;background:linear-gradient(180deg,var(--lilac) 0 %d%%,var(--lime) %d%% 100%%)"></i>'
          % (h, pct, pct))
d += '</div><div class="note" style="margin-top:14px">Cada barra es un día. La franja lila de arriba es la parte que tuvo que tomar una persona.</div></div>'
d += '<div class="stack">'
d += '<div class="card pad"><h2 style="font-family:var(--display);font-size:15.5px;font-weight:600">Distribución por canal</h2>'
for ch, pct, col in [("WhatsApp", 61, "var(--sky)"), ("Instagram", 23, "var(--lilac)"), ("Web", 16, "var(--lime)")]:
    d += ('<div style="margin-top:16px"><div style="display:flex;font-size:12.5px;font-weight:600"><span>' + ch + '</span>'
          '<span class="num" style="margin-left:auto;color:var(--ink-3)">' + str(pct) + '%</span></div>'
          '<div class="bar" style="margin-top:7px"><i style="width:' + str(pct) + '%;background:' + col + '"></i></div></div>')
d += '<div class="note" style="margin-top:16px">Total de tráfico: 100% en el período.</div></div>'
d += '</div></div>'
d += '<div class="card"><div class="hd"><h2>Actividad reciente</h2><span class="sub">Ver todo</span></div>'
d += '<div style="padding:6px 12px 14px">'
for hh, txt, cls, ch in [("09:12", "El bot confirmó la cita de María Cano", "lime", "WhatsApp"),
                         ("09:05", "Laura Pérez pasó a atención humana", "lilac", "Web"),
                         ("08:44", "«tarifas-septiembre.pdf» quedó indexado · 42 vectores", "sky", "Brain"),
                         ("08:30", "El pedido #1042 de Tech Store espera tu visto bueno", "butter", "WhatsApp")]:
    d += ('<div style="display:flex;align-items:center;gap:12px;padding:11px 10px;border-radius:var(--r-field)">'
          '<span class="pill ' + cls + '"><span class="d"></span>' + ch + '</span>'
          '<span style="flex:1;font-size:13px">' + txt + '</span>'
          '<span class="num" style="font-size:12px;color:var(--ink-3)">' + hh + '</span></div>')
d += '</div></div></div>'
open("dashboard.html", "w").write(P.render("Resumen del panel", "dashboard", d))

# ═══════════════════════════════════════════════════════════════════
# 02 · MESSAGING — "Bandeja de entrada", buscar chats, filtros de canal,
# modo auto_pilot/human_takeover, insights, guardar contacto.
# ═══════════════════════════════════════════════════════════════════
ctx = kpis([("12", "activas", "sky"), ("3", "piden una mano", "butter")])
m = topbar("mensajeria", ctx)
m += '<div class="work"><div class="queuecard"><div class="qh"><h2>Bandeja de entrada</h2><span class="filt">Buscar chats…</span></div>'
m += '<div class="queue">'
m += ('<div class="row sel"><span class="av lilac">MC</span><div>'
      '<div class="nm">María Cano <span class="pill butter"><span class="d"></span>espera confirmación</span></div>'
      '<div class="ms">«Deja el pedido en marzo, mejor.»</div></div>'
      '<div class="meta"><span class="t">2 min</span><span class="badge">2</span></div></div>')
m += ('<div class="row"><span class="av lime">JR</span><div>'
      '<div class="nm">Jorge Rincón <span class="pill lime"><span class="d"></span>Piloto automático activo</span></div>'
      '<div class="ms">El bot está escribiendo la respuesta…</div></div>'
      '<div class="meta"><span class="t">5 min</span></div></div>')
m += ('<div class="row"><span class="av">TS</span><div>'
      '<div class="nm">Tech Store <span class="pill danger"><span class="d"></span>conflicto de pedidos</span></div>'
      '<div class="ms">Dos pedidos piden el mismo cupo de stock.</div></div>'
      '<div class="meta"><span class="t">14 min</span><span class="badge">1</span></div></div>')
m += ('<div class="row"><span class="av sky">AG</span><div>'
      '<div class="nm">Andrés Gutiérrez <span class="pill lime"><span class="d"></span>cita en curso</span></div>'
      '<div class="ms">El bot está agendando para el jueves.</div></div>'
      '<div class="meta"><span class="t">22 min</span></div></div>')
m += ('<div class="row off"><span class="av">LP</span><div>'
      '<div class="nm">Laura Pérez</div><div class="ms">Cerrada hoy a las 09:12 · quedó conforme.</div></div>'
      '<div class="meta"><span class="t">ayer</span></div></div>')
m += '<div class="row off" style="opacity:.5"><span class="av">DR</span><div>'
m += '<div class="nm">Diego Roldán</div><div class="ms">No hay conversaciones que coincidan con el filtro.</div></div>'
m += '<div class="meta"><span class="t">lunes</span></div></div>'
m += '</div></div>'
m += '<div class="threadcard"><div class="th"><span class="av">MC</span><div>'
m += '<div class="nm">María Cano</div><div class="st">WhatsApp · Atención humana · hace 2 min</div></div>'
m += '<div class="acts"><button class="btn-lilac btn">Tomar control</button>'
m += '<button class="btn-2 btn">Guardar como contacto</button></div></div>'
m += '<div class="thread">'
m += '<div class="day">Hoy</div>'
m += '<div class="bub in">Hola, ¿el curso de julio entra en el presupuesto que me dijeron?</div>'
m += '<div class="bub bot">¡Hola María! Sí: son <b>480.000 por persona</b> y el material va incluido. ¿Te separo un cupo?</div>'
m += '<div class="bub in">Me parece bien. Deja el pedido… mejor en marzo que en febrero.</div>'
m += '<div class="bub tool"><span class="pill butter"><span class="d"></span>Confirmación requerida</span>Crear pedido · marzo · 1 plaza</div>'
m += '<div class="typing"><i></i><i></i><i></i></div>'
m += '</div>'
m += '<div class="composer"><input placeholder="Escribe un mensaje…"><button class="btn">Enviar</button></div>'
m += '</div>'
# Columna de Detalles: contacto, Sentimiento (Análisis de IA) y Urgencia
m += '<div class="detailscard">'
m += '<div style="display:flex;align-items:center;gap:12px">'
m += '<span class="avc lilac">MC</span><div><div style="font-weight:600;font-size:13.5px">María Cano</div>'
m += '<div class="note">+34 600 11 22 33</div></div></div>'
m += '<div><span class="pill lime"><span class="d"></span>Contacto creado</span></div>'
m += '<div class="divider" style="margin:2px 0"></div>'
# Sentimiento
m += '<div><div class="dh"><span class="ic"><svg viewBox="0 0 256 256" fill="currentColor"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm64-88a8,8,0,0,1-8,8H128a8,8,0,0,1-8-8V72a8,8,0,0,1,16,0v48h48A8,8,0,0,1,192,128Z"/></svg></span>Análisis de IA</div>'
m += '<div style="display:flex;align-items:center;gap:8px;margin-top:12px">'
m += '<span class="section-label">Sentimiento</span>'
m += '<span class="pill lime" style="margin-left:auto"><span class="d"></span>Positivo</span></div>'
m += '<div class="sent-bar" style="margin-top:10px">'
m += '<i style="width:78%;background:var(--lime)"></i><i style="width:14%;background:var(--butter)"></i><i style="width:8%;background:var(--line-2)"></i></div>'
m += '<div style="display:flex;gap:12px;margin-top:8px;font-size:11px;color:var(--ink-3)">'
m += '<span><b style="color:var(--lime-ink)">78%</b> Positivo</span>'
m += '<span><b style="color:var(--butter-ink)">14%</b> Negativo</span>'
m += '<span><b style="color:var(--ink-2)">8%</b> Neutro</span></div></div>'
m += '<div class="divider" style="margin:2px 0"></div>'
# Urgencia
m += '<div><div class="dh"><span class="ic"><svg viewBox="0 0 256 256" fill="currentColor"><path d="M215.79,112l-88-88a8,8,0,0,0-11.32,0l-88,88a8,8,0,0,0,0,11.32l88,88a8,8,0,0,0,11.32,0l88-88A8,8,0,0,0,215.79,112ZM128,192,48,112l80-80,80,80Z"/></svg></span>Urgencia</div>'
m += '<div class="urgency-scale" style="margin-top:12px">'
m += '<div style="display:flex;align-items:center;gap:8px"><span class="pill butter"><span class="d"></span>Media</span>'
m += '<span class="note" style="margin-left:auto">espera visto bueno</span></div>'
m += '<div class="urgency-track"><i class="on-1"></i><i class="on-2"></i><i></i></div>'
m += '<div class="note">Lleva 2 min sin respuesta a una acción que requiere confirmación.</div></div></div>'
m += '<div class="divider" style="margin:2px 0"></div>'
# Detalles
m += '<div><div class="dh">Detalles</div>'
for k, v in [("Correo", "maria@correo.com"), ("Teléfono", "+34 600 11 22 33"), ("Plataforma", "WhatsApp"), ("Estado", "Activa")]:
    m += '<div class="kv" style="margin-top:8px"><span>' + k + '</span><b style="font-weight:600">' + v + '</b></div>'
m += '</div></div>'
m += '</div>'
open("mensajeria.html", "w").write(P.render("Conversaciones", "mensajeria", m))

# ═══════════════════════════════════════════════════════════════════
# 03 · CLIENTS — columnas reales: Cliente · Plataforma · Estado · Teléfono · Creado · Acciones
# Filtros: Todas las plataformas · Todos los estados. Estados: Activo · Nuevo · Inactivo · Archivado.
# ═══════════════════════════════════════════════════════════════════
c = topbar("clientes", seg([("all", "Todas las plataformas"), ("wa", "WhatsApp"), ("ig", "Instagram"), ("web", "Web")]))
c += '<div class="lead"><h1>Las personas del estudio</h1>'
c += '<div class="dek">Los clientes se crean automáticamente al responder mensajes. No se borran: se archivan.</div></div>'
c += '<div class="stack">'
c += '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">'
c += '<div class="search"><span style="color:var(--ink-3)">⌕</span><input placeholder="Buscar clientes…"></div>'
c += '<button class="btn btn-2">Todos los estados</button>'
c += '<button class="btn btn">Nuevo contacto</button></div>'
c += '<div class="card"><table class="tbl"><thead><tr><th>Cliente</th><th>Plataforma</th><th>Estado</th><th>Teléfono</th><th>Creado</th><th></th></tr></thead><tbody>'
rows = [("María Cano", "MC", "sky", "WhatsApp", "+34 600 11 22 33", "12 sep 2026", 'lime', "Activo", False),
        ("Tech Store", "TS", "lilac", "WhatsApp", "+34 611 44 55 66", "10 sep 2026", "sky", "Nuevo", False),
        ("Andrés Gutiérrez", "AG", "sky", "Instagram", "+34 622 77 88 99", "8 sep 2026", 'lime', "Activo", False),
        ("Laura Pérez", "LP", "", "Web", "Sin email", "1 sep 2026", "ghost", "Archivado", True)]
for nm, ini, avc, ch, phone, created, tone, st, off in rows:
    c += ('<tr><td><div style="display:flex;align-items:center;gap:10px"><span class="avc ' + avc + '">' + ini + '</span>'
          '<div><div class="nm' + (' off' if off else '') + '">' + nm + '</div>'
          '<div class="note">' + ("laura@correo.com" if off else "sin email") + '</div></div></div></td>'
          '<td><span style="font-size:12.5px;color:var(--ink-2)">' + ch + '</span></td>'
          '<td><span class="pill ' + tone + '"><span class="d"></span>' + st + '</span></td>'
          '<td class="num" style="font-size:12.5px;color:var(--ink-3)">' + phone + '</td>'
          '<td style="font-size:12.5px;color:var(--ink-3)">' + created + '</td>'
          '<td class="rit"><button class="btn-2 btn sm">Ver conversación</button></td></tr>')
c += '</tbody></table><div class="ft"><span>Mostrando 4 de 38 clientes</span><span style="margin-left:auto">Página 1 de 3 · ›</span></div></div>'
c += '<div class="note">Los clientes se crean automáticamente al responder mensajes. Los contactos guardados a mano nunca se duplican.</div>'
c += '</div>'
open("clientes.html", "w").write(P.render("Clientes", "clientes", c))

# ═══════════════════════════════════════════════════════════════════
# 04 · BRAIN — stats reales: Documentos totales · Vectores totales · Estado de sincronización
# Tabla: Nombre de la fuente · Tamaño/Páginas · Estado · Progreso · Última sincronización · Acciones
# Estados reales: Queued · Processing · Indexed · Failed. Etapas: En cola/Extrayendo/Fragmentando/Embeddings/Indexando
# ═══════════════════════════════════════════════════════════════════
r = topbar("cerebro", kpis([("61", "vectores totales", "sky"), ("4", "documentos", "lime")]))
r += '<div class="lead"><h1>Gestiona y entrena tu IA</h1>'
r += '<div class="dek">Gestiona y entrena tu IA con fuentes de conocimiento personalizadas. Sube PDF, TXT, CSV o imagen, o escribe texto manual.</div>'
r += '<div class="acts"><button class="btn-2 btn">Escribir texto</button><button class="btn btn">Añadir fuente</button></div></div>'
r += '<div class="stack">'
r += '<div class="grid g-3" style="grid-template-columns:repeat(3,1fr)">'
for t, v in [("Documentos totales", "4"), ("Vectores totales", "61"), ("Estado de sincronización", "Sincronizado")]:
    r += ('<div class="card pad"><div style="font-size:12px;font-weight:600;color:var(--ink-3)">' + t + '</div>'
          '<div class="metric" style="margin-top:12px;font-size:30px">' + v + '</div></div>')
r += '</div>'
r += '<div class="card"><div class="hd"><h2>Fuentes de conocimiento</h2><span class="sub">61 vectores indexados</span></div>'
r += '<table class="tbl"><thead><tr><th>Nombre de la fuente</th><th>Tamaño/Páginas</th><th>Estado</th><th>Progreso</th><th>Última sincronización</th><th></th></tr></thead><tbody>'
src = [("tarifas-septiembre.pdf", "PDF", "32 páginas", "Indexed", "lime", "Listo", 100, "21 sep 2026", "lime"),
       ("politica-devoluciones.txt", "TXT", "12 KB", "Indexed", "lime", "Listo", 100, "19 sep 2026", "lime"),
       ("catalogo-julio.pdf", "PDF", "64 páginas", "Processing", "butter", "Fragmentando", 48, "—", "butter"),
       ("precios-yq.csv", "CSV", "8 KB", "Failed", "danger", "Error", 0, "—", "danger")]
for nm, tipo, size, status, tone, stage, pct, sync, ptone in src:
    r += ('<tr><td class="nm">' + nm + '<div class="note">' + tipo + '</div></td>'
          '<td class="num" style="font-size:12.5px;color:var(--ink-3)">' + size + '</td>'
          '<td><span class="pill ' + tone + '"><span class="d"></span>' + status + '</span>'
          '<div class="note" style="margin-top:4px">' + stage + '</div></td>'
          '<td style="min-width:120px"><div class="bar"><i style="width:' + str(pct) + '%;background:var(--' + ptone + ')"></i></div>'
          '<div class="note" style="margin-top:4px">' + str(pct) + '%</div></td>'
          '<td style="font-size:12.5px;color:var(--ink-3)">' + sync + '</td>'
          '<td class="rit"><button class="btn-2 btn sm">Ver logs</button></td></tr>')
r += '</tbody></table></div>'
r += '<div class="note">Troceado semántico · 800 tokens con 100 de solape · re-rank: los 10 mejores se quedan en 3.</div>'
r += '</div>'
open("cerebro.html", "w").write(P.render("Brain", "cerebro", r))

# ═══════════════════════════════════════════════════════════════════
# 05 · SETTINGS — 4 pestañas reales: Agente IA · Información · Canales · Opciones
# Marca: Nombre del proyecto · Color de la marca · Logo. Canales: WhatsApp/Instagram/Web.
# ═══════════════════════════════════════════════════════════════════
j = topbar("ajustes", seg([("agent", "Agente IA"), ("info", "Información"), ("channels", "Canales"), ("options", "Opciones")]))
j += '<div class="lead"><h1>Configuración</h1>'
j += '<div class="dek">Gestiona agente, canales y configuración. La identidad del proyecto se aplica a toda la interfaz.</div></div>'
j += '<div class="stack" style="max-width:1000px">'
j += '<div class="card pad"><h2 style="font-family:var(--display);font-size:15.5px;font-weight:600">Identidad del proyecto</h2>'
j += '<div class="note" style="margin-top:4px">Color, nombre y logo que se aplican a toda la interfaz (sidebar, botones y acentos).</div>'
j += '<div class="grid g-side" style="grid-template-columns:1.4fr 1fr;gap:16px;margin-top:18px">'
j += '<div class="field"><label>Nombre del proyecto</label><input value="Estudio Mateo"></div>'
j += '<div class="field"><label>Color de la marca</label><div style="display:flex;align-items:center;gap:10px">'
j += '<span class="swatch" style="background:var(--lilac)"></span><input value="#E2C6FF" style="flex:1"></div>'
j += '<div class="hint">8 acentos sugeridos disponibles.</div></div>'
j += '</div>'
j += '<div style="display:flex;align-items:center;gap:14px;margin-top:18px">'
j += '<div class="avc lilac">E</div><div><div style="font-size:13px;font-weight:600">Logo</div>'
j += '<div class="note">PNG, JPG, SVG o WebP · máx. 150 KB</div></div>'
j += '<button class="btn-2 btn sm" style="margin-left:auto">Subir logo</button><button class="btn-ghost btn sm">Quitar</button></div>'
j += '<button class="btn" style="margin-top:18px">Guardar identidad</button></div>'
j += '<div class="card pad"><h2 style="font-family:var(--display);font-size:15.5px;font-weight:600">Canales de Comunicación</h2>'
j += '<div class="grid g-3" style="grid-template-columns:repeat(3,1fr);margin-top:16px">'
for nm, st, cls, sub in [("WhatsApp", "Habilitado", "lime", "+34 600 11 22 33"),
                          ("Instagram", "Habilitado", "lime", "@estudio.mateo"),
                          ("Web", "Deshabilitado", "butter", "finca-web · pendiente")]:
    j += ('<div style="border:1.5px solid var(--line);border-radius:var(--r-card);padding:18px">'
          '<div style="font-family:var(--display);font-weight:700;font-size:16px;letter-spacing:-.015em">' + nm + '</div>'
          '<div style="margin-top:10px"><span class="pill ' + cls + '"><span class="d"></span>' + st + '</span></div>'
          '<div class="note" style="margin-top:10px">' + sub + '</div></div>')
j += '</div><button class="btn" style="margin-top:18px">Guardar Canales</button></div>'
j += '<div class="card pad"><h2 style="font-family:var(--display);font-size:15.5px;font-weight:600">Personalidad del Bot</h2>'
j += '<div class="note" style="margin-top:4px">Configura cómo se comporta y responde el chatbot.</div>'
j += '<div class="grid g-side" style="grid-template-columns:1fr 1fr;gap:16px;margin-top:18px">'
j += '<div class="field"><label>Nombre *</label><input value="Martina"></div>'
j += '<div class="field"><label>Rol</label><select><option>Atención al cliente · Gestiona consultas</option><option>Vendedor · Persuade y cierra ventas</option></select></div>'
j += '<div class="field" style="grid-column:1/-1"><label>Rasgos de personalidad (máx. 3)</label><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:2px">'
for t, on in [("Cercano", True), ("Directo", True), ("Objetivo", True), ("Empático", False), ("Formal", False)]:
    j += '<span class="pill ' + ("lilac" if on else "ghost") + '">' + t + '</span>'
j += '</div></div>'
j += '<div class="field"><label>Uso de emojis</label><select><option>Medio 🙂</option><option>Bajo 😐</option></select></div>'
j += '<div class="field"><label>Idioma</label><select><option>Español 🇪🇸</option><option>Inglés 🇺🇸</option></select></div>'
j += '</div><button class="btn" style="margin-top:18px">Guardar Agente</button></div>'
j += '<div class="card pad"><h2 style="font-family:var(--display);font-size:15.5px;font-weight:600">Opciones</h2>'
j += '<div style="display:flex;align-items:center;gap:14px;margin-top:16px">'
j += '<label class="sw"><input type="checkbox" checked><span>Crear contacto automáticamente</span></label>'
j += '<span class="note" style="margin-left:auto">Al contestar el primer mensaje del cliente</span></div>'
j += '<button class="btn" style="margin-top:18px">Guardar</button></div>'
j += '</div>'
open("ajustes.html", "w").write(P.render("Configuración", "ajustes", j))

# ═══════════════════════════════════════════════════════════════════
# 06 · USERS — columnas reales: Usuario · Rol · Estado · Creado · Acciones
# Roles: Administrador · Soporte · Asistente
# ═══════════════════════════════════════════════════════════════════
u = topbar("usuarios", kpis([("1", "admin", "sky"), ("1", "soporte", "lilac"), ("1", "asistente", "lime")]))
u += '<div class="lead"><h1>Usuarios del Sistema</h1>'
u += '<div class="dek">Administra los usuarios que pueden acceder al panel (3 total).</div>'
u += '<div class="acts"><button class="btn btn">Crear Usuario</button></div></div>'
u += '<div class="stack">'
u += '<div class="grid g-3" style="grid-template-columns:repeat(3,1fr)">'
for role, desc, cls in [("Administrador", "Configura todo y borra conversaciones.", "sky"),
                         ("Soporte", "Atiende y toma el control de los hilos.", "lilac"),
                         ("Asistente", "Consulta y responde. No configura.", "lime")]:
    u += ('<div class="card pad"><span class="pill ' + cls + '">' + role + '</span>'
          '<div class="note" style="margin-top:12px">' + desc + '</div></div>')
u += '</div>'
u += '<div class="card"><div class="hd"><h2>Usuarios</h2><span class="sub">Buscar por nombre o email…</span></div>'
u += '<table class="tbl"><thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Creado</th><th></th></tr></thead><tbody>'
for nm, ini, avc, mail, role, tone, st, off in [
    ("Jorge Daza", "JD", "lilac", "jorge@estudiomateo.io", "Administrador", "sky", "Activo", False),
    ("Lucía Ferrer", "LF", "sky", "lucia@estudiomateo.io", "Soporte", "lilac", "Activo", False),
    ("Diego Roldán", "DR", "", "diego@estudiomateo.io", "Asistente", "lime", "Inactivo", True)]:
    u += ('<tr><td><div style="display:flex;align-items:center;gap:10px"><span class="avc sm ' + avc + '">' + ini + '</span>'
          '<div><div class="nm' + (' off' if off else '') + '">' + nm + '</div>'
          '<div class="note">' + mail + '</div></div></div></td>'
          '<td><span class="pill ' + tone + '">' + role + '</span></td>'
          '<td><span class="pill ' + ('lime' if not off else 'ghost') + '"><span class="d"></span>' + st + '</span></td>'
          '<td style="font-size:12.5px;color:var(--ink-3)">12 ago 2026</td>'
          '<td class="rit"><button class="btn-2 btn sm">Editar</button></td></tr>')
u += '</tbody></table></div></div>'
open("usuarios.html", "w").write(P.render("Usuarios", "usuarios", u))

# ═══════════════════════════════════════════════════════════════════
# 07 · PROFILE — Mis Proyectos · Información Personal · Cambiar Contraseña
# ═══════════════════════════════════════════════════════════════════
p = topbar("perfil")
p += '<div class="lead"><h1>Mi Perfil</h1><div class="dek">Gestiona tu información personal y contraseña.</div></div>'
p += '<div class="grid g-side" style="grid-template-columns:320px 1fr;align-items:start">'
p += '<div class="card pad" style="text-align:center">'
p += '<div style="width:84px;height:84px;border-radius:50%;background:var(--lilac);color:var(--lilac-ink);display:grid;place-items:center;font-family:var(--display);font-weight:700;font-size:30px;margin:6px auto 14px">JD</div>'
p += '<div style="font-family:var(--display);font-weight:700;font-size:20px;letter-spacing:-.02em">Jorge Daza</div>'
p += '<div class="note" style="margin-top:4px">jorge@estudiomateo.io</div>'
p += '<div style="display:flex;gap:8px;justify-content:center;margin-top:14px"><span class="pill lilac">Administrador</span></div>'
p += '<div class="divider" style="margin:18px 0"></div>'
p += '<div class="note" style="text-align:left">Mis Proyectos (2)</div>'
p += '<div style="display:flex;gap:8px;justify-content:center;margin-top:10px;flex-wrap:wrap"><span class="chip">📁 Estudio Mateo</span><span class="chip">📁 Finca Web</span></div></div>'
p += '<div class="card pad"><h2 style="font-family:var(--display);font-size:15.5px;font-weight:600">Información Personal</h2>'
p += '<div class="grid g-side" style="grid-template-columns:1fr 1fr;gap:16px;margin-top:18px">'
p += '<div class="field"><label>Nombre</label><input value="Jorge Daza"></div>'
p += '<div class="field"><label>Correo</label><input value="jorge@estudiomateo.io"></div>'
p += '</div><div class="divider" style="margin:20px 0"></div>'
p += '<h2 style="font-family:var(--display);font-size:15.5px;font-weight:600">Cambiar Contraseña</h2>'
p += '<div class="grid g-3" style="grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:18px">'
p += '<div class="field"><label>Contraseña actual</label><input type="password" value="no-importa"></div>'
p += '<div class="field"><label>Nueva contraseña</label><input type="password" value="no-importa"></div>'
p += '<div class="field"><label>Confirmar nueva contraseña</label><input type="password" value="no-importa"></div>'
p += '</div><div style="display:flex;margin-top:22px"><button class="btn" style="margin-left:auto">Guardar cambios</button></div></div></div>'
open("perfil.html", "w").write(P.render("Mi Perfil", "perfil", p))

# ═══════════════════════════════════════════════════════════════════
# 08 · DEV TESTS — Pruebas · Extraer texto (ruta oculta /dev/tests)
# ═══════════════════════════════════════════════════════════════════
t = topbar("pruebas", kpis([("3", "pruebas hoy", "sky")]))
t += '<div class="lead"><h1>Banco de pruebas</h1>'
t += '<div class="dek">Herramientas internas de diagnóstico. Lee un archivo y enseña el texto que saca. No guarda nada.</div></div>'
t += '<div class="stack" style="max-width:860px">'
t += '<div class="card pad"><h2 style="font-family:var(--display);font-size:15.5px;font-weight:600">Extraer texto</h2>'
t += '<div class="note" style="margin-top:4px">Sube un archivo para extraer texto mediante un modelo de tipo archivo/imagen.</div>'
t += '<div class="drop" style="margin-top:16px"><div style="font-size:30px">⇪</div>'
t += '<div style="font-family:var(--display);font-weight:600;font-size:15px;margin-top:8px">Arrastra un archivo aquí o selecciona uno</div>'
t += '<div class="note" style="margin-top:6px">PDF, TXT, CSV o imagen · hasta 20 MB</div></div>'
t += '<div class="field" style="margin-top:16px"><label>Modelo de lectura</label><input value="Gemini · visión (solo lectura)" disabled></div>'
t += '<button class="btn" style="margin-top:16px">Extraer texto</button></div>'
t += '<div class="card"><div class="hd"><h2>Últimas pruebas</h2><span class="sub">hoy</span></div><div style="padding:6px 12px 14px">'
for nm, res, cls in [("prueba-carnet.jpg", "214 caracteres · confianza 0.91 · 1,4 s", "lime"),
                     ("rotulo-lila.png", "No se encontró texto en el archivo.", "danger"),
                     ("catalogo-p14.pdf", "1.882 caracteres · confianza 0.88 · 3,1 s", "lime")]:
    t += ('<div style="display:flex;align-items:center;gap:12px;padding:11px 10px"><span class="pill ' + cls + '"><span class="d"></span>' + nm + '</span>'
          '<span class="note" style="flex:1">' + res + '</span></div>')
t += '</div></div></div>'
open("pruebas.html", "w").write(P.render("Pruebas", "pruebas", t))

# ═══════════════════════════════════════════════════════════════════
# 09 · LOGIN — solo inicio de sesión
# ═══════════════════════════════════════════════════════════════════
lg = ('<div style="min-height:100vh;display:grid;place-items:center;padding:30px;position:relative;z-index:1">'
      '<div style="width:min(460px,94vw)">'
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:22px">'
      '<div style="width:44px;height:44px;border-radius:16px;background:var(--ink);color:#fff;display:grid;place-items:center;font-family:var(--display);font-weight:700;font-size:20px">M</div>'
      '<div style="font-family:var(--display);font-weight:700;font-size:19px;letter-spacing:-.02em">Mitchbot</div></div>'
      '<div class="card pad" style="padding:34px 32px;border-radius:var(--r-big);box-shadow:var(--shadow-lift)">'
      '<h1 style="font-family:var(--display);font-weight:700;font-size:34px;letter-spacing:-.035em;line-height:1">Hola otra vez.<br>Entra al panel.</h1>'
      '<div class="note" style="margin:10px 0 24px">Inicia sesión en tu cuenta.</div>'
      '<div class="field"><label>Correo</label><input value="jorge@estudiomateo.io" placeholder="tu@email.com"></div>'
      '<div class="field" style="margin-top:14px"><label>Contraseña</label><input type="password" value="no-importa" placeholder="••••••••"></div>'
      '<button class="btn" style="width:100%;justify-content:center;padding:13px;margin-top:20px">Iniciar Sesión</button>'
      '<div style="display:flex;gap:8px;margin-top:20px;justify-content:center;flex-wrap:wrap">'
      '<span class="pill sky"><span class="d"></span>Sin tarjeta</span>'
      '<span class="pill lime"><span class="d"></span>Listo en minutos</span>'
      '<span class="pill lilac"><span class="d"></span>Tus datos, cifrados</span></div></div>'
      '<div class="note" style="text-align:center;margin-top:18px">Las cuentas se crean desde el equipo, no desde aquí.</div>'
      '</div></div>')
open("login.html", "w").write(shell(lg))

# ═══════════════════════════════════════════════════════════════════
# 10 · SETUP — onboarding 3 pasos
# ═══════════════════════════════════════════════════════════════════
ob = ('<div style="min-height:100vh;display:grid;place-items:center;padding:30px;position:relative;z-index:1">'
      '<div style="width:min(720px,94vw)">'
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">'
      '<div style="width:38px;height:38px;border-radius:14px;background:var(--ink);color:#fff;display:grid;place-items:center;font-family:var(--display);font-weight:700;font-size:17px">M</div>'
      '<div style="font-size:12.5px;font-weight:600;color:var(--ink-3)">Configura tu proyecto y agente · paso 2 de 3</div></div>'
      '<div style="display:flex;gap:8px;margin-bottom:20px">'
      '<div style="flex:1;height:8px;border-radius:var(--r-pill);background:var(--lilac)"></div>'
      '<div style="flex:1;height:8px;border-radius:var(--r-pill);background:var(--lilac)"></div>'
      '<div style="flex:1;height:8px;border-radius:var(--r-pill);background:var(--sunken)"></div></div>'
      '<div class="card pad" style="padding:30px 30px 24px;border-radius:var(--r-big);box-shadow:var(--shadow-lift)">'
      '<h1 style="font-family:var(--display);font-weight:700;font-size:30px;letter-spacing:-.035em;line-height:1">Dale carácter a tu agente</h1>'
      '<div class="note" style="margin:8px 0 22px">Configura la personalidad e inteligencia de tu bot.</div>'
      '<div class="grid" style="grid-template-columns:1fr 1fr;gap:16px">'
      '<div class="field"><label>Nombre del Agente *</label><input value="Martina" placeholder="Ej: Asistente de Ventas, Soporte Bot…"></div>'
      '<div class="field"><label>Rol del Bot</label><select><option>Atención al cliente</option><option>Vendedor</option><option>Soporte</option></select></div>'
      '<div class="field" style="grid-column:1/-1"><label>Mensajes automáticos</label>'
      '<label class="sw" style="margin-top:6px"><input type="checkbox" checked><span>Saludar siempre</span></label>'
      '<label class="sw" style="margin-top:8px"><input type="checkbox" checked><span>Despedir siempre</span></label></div>'
      '</div>'
      '<div style="display:flex;gap:10px;margin-top:26px;align-items:center">'
      '<a class="btn-ghost btn" href="setup.html">Anterior</a>'
      '<a class="btn btn" style="margin-left:auto" href="ajustes.html">Siguiente →</a></div>'
      '</div></div></div>')
open("setup.html", "w").write(shell(ob))

# ═══════════════════════════════════════════════════════════════════
# 11 · PUBLIC CHAT — cara del cliente final (TestChat)
# ═══════════════════════════════════════════════════════════════════
cp = ('<div style="min-height:100vh;display:grid;place-items:center;padding:30px;position:relative;z-index:1">'
      '<div class="threadcard" style="width:min(560px,96vw);height:min(720px,92vh);box-shadow:var(--shadow-lift)">'
      '<div class="th">'
      '<span class="av" style="background:var(--ink);color:#fff;border-radius:16px">EM</span>'
      '<div><div class="nm">Estudio Mateo</div><div class="st">Conversación activa — WhatsApp</div></div>'
      '<span class="pill lime" style="margin-left:auto"><span class="d"></span>En línea</span></div>'
      '<div class="thread">'
      '<div class="day">Hoy</div>'
      '<div class="bub in">¿El curso de julio tiene matrícula libre?</div>'
      '<div class="bub bot">¡Hola! Sí, quedan <b>dos plazas</b> de catorce. ¿Te paso los horarios?</div>'
      '<div class="bub in">Sí, porfa. ¿Y hay intensivo de mañana?</div>'
      '<div class="bub bot">Lo hay: martes y jueves de 9 a 11. ¿Te reservo una plaza en el intensivo?</div>'
      '<div class="typing"><i></i><i></i><i></i></div>'
      '</div>'
      '<div class="composer" style="border-radius:0;box-shadow:none;border-top:1.5px solid var(--line)">'
      '<input placeholder="Escribe un mensaje…"><button class="btn">Enviar</button></div>'
      '</div></div>')
open("chat-publico.html", "w").write(shell(cp))

# ═══════════════════════════════════════════════════════════════════
# 12 · ÍNDICE del prototipo
# ═══════════════════════════════════════════════════════════════════
hub_css = """
.hub{min-height:100vh;display:grid;place-items:center;padding:40px 20px;position:relative;z-index:1}
.hubin{width:min(980px,100%)}
.hub h1{font-family:var(--display);font-weight:700;font-size:clamp(38px,6vw,64px);letter-spacing:-.04em;line-height:.95}
.hub .dek{font-size:14px;color:var(--ink-2);margin:14px 0 28px;max-width:60ch;line-height:1.55}
.hgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}
.hcard{display:block;background:var(--surface);border-radius:var(--r-card);box-shadow:var(--shadow);padding:18px 20px;transition:transform .16s ease,box-shadow .16s ease}
.hcard:hover{transform:translateY(-3px);box-shadow:var(--shadow-lift)}
.hcard .n{font-size:11px;font-weight:700;color:var(--ink-3)}
.hcard .t{font-family:var(--display);font-weight:700;font-size:18px;letter-spacing:-.02em;margin:6px 0 5px}
.hcard .d{font-size:12.5px;color:var(--ink-2);line-height:1.5}
.hcard:nth-child(4n+1){box-shadow:var(--shadow),inset 0 0 0 2px var(--sky)}
.hcard:nth-child(4n+2){box-shadow:var(--shadow),inset 0 0 0 2px var(--lime)}
.hcard:nth-child(4n+3){box-shadow:var(--shadow),inset 0 0 0 2px var(--lilac)}
.hcard:nth-child(4n+4){box-shadow:var(--shadow),inset 0 0 0 2px var(--butter)}
"""
hub = ('<div class="hub"><div class="hubin">'
       '<div style="display:flex;align-items:center;gap:14px;margin-bottom:18px">'
       '<div style="width:52px;height:52px;border-radius:19px;background:var(--ink);color:#fff;display:grid;place-items:center;font-family:var(--display);font-weight:700;font-size:24px">M</div>'
       '<span class="pill lilac"><span class="d"></span>Aurora · sistema adoptado</span>'
       '<a class="pill ghost" href="../comparador.html" style="margin-left:auto">← Comparar todos los mundos</a></div>'
       '<h1>Aurora</h1>'
       '<div class="dek">El mundo pastel optimista: suelo cálido, tinta negra, tipografía display y una familia de pasteles que significa algo. '
       'Cada color tiene su papel —azul es Web, lima es el bot, lila es una persona, mantequilla es algo que espera—. '
       'Todas las etiquetas son las reales del producto; <b>los datos son sintéticos</b>. Nació de <b>orivo.webflow.io</b>.</div>'
       '<div class="hgrid">')
for f, n, t, dd in [("dashboard", "01", "Resumen del panel", "Métricas, volumen y distribución por canal"),
                    ("mensajeria", "02", "Conversaciones", "Bandeja de entrada, hilo y burbujas"),
                    ("clientes", "03", "Clientes", "Personas, plataforma, estado y acción"),
                    ("cerebro", "04", "Brain", "Fuentes, estados de indexación y vectores"),
                    ("ajustes", "05", "Configuración", "Identidad, canales, agente y opciones"),
                    ("usuarios", "06", "Usuarios", "Roles, estado y accesos"),
                    ("perfil", "07", "Mi Perfil", "Datos, proyectos y contraseña"),
                    ("login", "08", "Entrada", "Puerta del panel"),
                    ("setup", "09", "Alta", "Onboarding en 3 pasos"),
                    ("chat-publico", "10", "Chat público", "La cara del cliente final"),
                    ("pruebas", "11", "Pruebas", "Banco interno de lectura")]:
    hub += '<a class="hcard" href="%s.html"><div class="n">%s</div><div class="t">%s</div><div class="d">%s</div></a>' % (f, n, t, dd)
hub += '</div></div></div>'
open("index.html", "w").write(shell(hub).replace('<style>body{overflow-x:hidden}</style>', '<style>body{overflow-x:hidden}' + hub_css + '</style>'))

print("Aurora →", sorted([f for f in os.listdir(".") if f.endswith(".html")]))
