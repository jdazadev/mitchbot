#!/usr/bin/env python3
# Genera las vistas del prototipo «Bóveda» (mundo cool premium)
import os

NAV = [("dashboard","Resumen"),("mensajeria","Conversaciones"),("clientes","Clientes"),
       ("cerebro","Conocimiento"),("agentes","Agente"),("ajustes","Ajustes"),
       ("usuarios","Equipo"),("perfil","Perfil"),("pruebas","Pruebas")]

def nav_links(actual):
    out = ""
    for f, label in NAV:
        cls = ' class="nv on"' if f == actual else (' class="nv quiet"' if f == "pruebas" else ' class="nv"')
        out += '<a href="%s.html"%s>%s</a>\n  ' % (f, cls, label)
    return out

def kpis(items):
    out = '<div class="kpis">'
    for v, l, cls in items:
        out += '<div class="kpi %s"><b>%s</b><span>%s</span></div>' % (cls, v, l)
    return out + '</div>'

class Page:
    def __init__(self):
        self._s = open("_shell.html").read()
    def render(self, titulo, nav, body, css=""):
        return (self._s.replace("%%TITULO%%", titulo)
                       .replace("%%NAV%%", nav_links(nav))
                       .replace("%%CSS%%", css)
                       .replace("%%BODY%%", body))

def shell(body, css=""):
    return ('<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>Mitchbot · Bóveda</title>'
            '<link rel="preconnect" href="https://fonts.googleapis.com">'
            '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
            '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,500;0,600;1,500;1,600&display=swap" rel="stylesheet">'
            '<link rel="stylesheet" href="style.css"><style>body{overflow-x:hidden}' + css + '</style></head>'
            '<body>' + body + '</body></html>')

P = Page()

# ═══ RESUMEN ═══
d = kpis([("12","en custodia",""),("3","piden tu firma","violet"),("94%","las cierra el bot",""),("1m20s","respuesta media","")])
d += '<div class="lead"><h1>La jornada <em>de hoy</em></h1>'
d += '<div class="dek">Todo lo que entró por WhatsApp, Instagram y la web. El bot sostiene el ritmo; tú decides lo que importa.</div>'
d += '<div class="acts"><button class="btn-2 btn">Últimos 7 días</button><button class="btn">30 días</button><button class="btn-2 btn">90 días</button></div></div>'
d += '<div class="stack">'
d += '<div class="grid" style="grid-template-columns:repeat(4,1fr)">'
for t, v, unit, dl, up in [("Conversaciones","114","","+12% sobre el período",True),
                           ("Las cierra el bot","94","%","+3 puntos",True),
                           ("Tomadas por personas","17","","−2 del período",False),
                           ("Respuesta media","1m20","s","8 segundos menos",True)]:
    d += ('<div class="card pad"><div class="label">'+t+'</div>'
          '<div class="metric" style="margin-top:14px">'+v+'<em>'+unit+'</em></div>'
          '<div class="delta ' + ('up' if up else 'down') + '">'+dl+'</div></div>')
d += '</div>'
d += '<div class="grid" style="grid-template-columns:1.7fr 1fr;align-items:start">'
d += '<div class="stack">'
d += '<div class="card pad" style="position:relative;overflow:hidden">'
d += '<div class="glow" style="width:32rem;height:22rem;left:-6rem;bottom:-14rem"></div>'
d += '<div style="display:flex;align-items:center;gap:12px;position:relative">'
d += '<h2 style="font-family:var(--display);font-weight:700;font-size:15.5px;letter-spacing:-.02em">Volumen de mensajes</h2>'
d += '<span class="pill ink" style="margin-left:auto"><span class="d" style="background:var(--ink)"></span>El bot</span>'
d += '<span class="pill violet"><span class="d"></span>Una persona</span></div>'
d += '<div class="cols" style="height:180px;margin-top:26px;position:relative">'
for h, hum in [(60,18),(92,26),(48,10),(140,40),(72,20),(110,32),(98,24),(160,52),(85,22),(64,14),(132,38),(150,44),(88,20),(116,30),(104,26),(55,12),(90,24),(128,36),(142,42),(99,28),(76,18),(44,10)]:
    d += ('<i style="height:%dpx;background:linear-gradient(180deg,var(--violet) 0 %d%%,var(--ink) %d%% 100%%)"></i>'
          % (h, round(hum*100.0/h), round(hum*100.0/h)))
d += '</div><div class="note" style="margin-top:16px;position:relative">Cada barra es un día. El tramo violeta es la parte que tuvo que tomar una persona.</div></div>'
d += '<div class="card"><div class="hd"><h2>Registro de la jornada</h2><span class="sub">hoy</span></div>'
d += '<div style="padding:8px 14px 16px">'
for hh, txt, cls, ch in [("09:12","El bot confirmó la cita de María Cano","ok","WhatsApp"),
                          ("09:05","Laura Pérez pasó a manos de una persona","violet","Web"),
                          ("08:44","«tarifas-septiembre.pdf» quedó en el índice · 42 trozos","ink","Conocimiento"),
                          ("08:30","El pedido #1042 de Tech Store espera tu firma","warn","WhatsApp")]:
    d += ('<div style="display:flex;align-items:center;gap:13px;padding:12px 10px;border-radius:16px">'
          '<span class="pill '+cls+'"><span class="d"></span>'+ch+'</span>'
          '<span style="flex:1;font-size:13.5px">'+txt+'</span>'
          '<span class="num" style="font-size:12.5px;color:var(--ink-3)">'+hh+'</span></div>')
d += '</div></div>'
d += '</div>'
d += '<div class="stack">'
d += '<div class="card pad"><h2 style="font-family:var(--display);font-weight:700;font-size:15.5px;letter-spacing:-.02em">De dónde llegan</h2>'
for ch, pct, col in [("WhatsApp",61,"var(--violet)"),("Web",23,"var(--ink)"),("Instagram",16,"var(--line-2)")]:
    d += ('<div style="margin-top:17px"><div style="display:flex;font-size:13px;font-weight:600"><span>'+ch+'</span>'
          '<span class="num" style="margin-left:auto;color:var(--ink-3)">'+str(pct)+'%</span></div>'
          '<div class="bar" style="margin-top:8px"><i style="width:'+str(pct)+'%;background:'+col+'"></i></div></div>')
d += '</div>'
d += '<div class="card pad"><h2 style="font-family:var(--display);font-weight:700;font-size:15.5px;letter-spacing:-.02em">Cómo se sienten</h2>'
for lab, pct, col in [("Satisfechos",78,"var(--ok)"),("Con queja",14,"var(--warn)"),("Neutros",8,"var(--line-2)")]:
    d += ('<div style="margin-top:17px"><div style="display:flex;font-size:13px"><span>'+lab+'</span>'
          '<span class="num" style="margin-left:auto;color:var(--ink-3)">'+str(pct)+'%</span></div>'
          '<div class="bar" style="margin-top:8px"><i style="width:'+str(pct)+'%;background:'+col+'"></i></div></div>')
d += '<div class="card pad band" style="position:relative;overflow:hidden;background:linear-gradient(125deg,#1B1035,#3A1E7A)">'
d += '<div class="glow" style="width:24rem;height:16rem;right:-7rem;top:-8rem;background:radial-gradient(closest-side,rgba(102,56,237,.75),transparent 70%)"></div>'
d += '<div style="position:relative"><div style="font-family:var(--display);font-weight:800;font-size:16.5px;letter-spacing:-.02em;color:#fff">Esperan tu firma</div>'
d += '<div class="note" style="color:rgba(255,255,255,.66);margin-top:5px">Dos cosas del bot quieren tu visto bueno.</div>'
d += '<div style="margin-top:16px;display:flex;flex-direction:column;gap:10px">'
for t in ["Pedido #1042 · Tech Store","Cita del jueves · Andrés Gutiérrez"]:
    d += ('<div style="display:flex;align-items:center;gap:11px;color:#fff;font-size:13px">'
          '<span class="pill" style="background:rgba(255,255,255,.15);color:#fff">→</span>'+t+'</div>')
d += '</div><button class="btn-2 btn" style="margin-top:18px;width:100%;background:transparent;color:#fff;border-color:rgba(255,255,255,.3)">Revisar firmas</button></div></div>'
d += '</div></div></div>'
open("dashboard.html","w").write(P.render("Resumen","dashboard",d))

# ═══ CONVERSACIONES ═══
mcss = """.work{display:grid;grid-template-columns:minmax(370px,38%) 1fr;gap:16px;align-items:start;height:calc(100vh - 200px);min-height:540px}
.qcard,.tcard{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--shadow);height:100%;overflow:hidden}
.qcard{display:flex;flex-direction:column}
.tcard{display:grid;grid-template-rows:auto 1fr auto}
.qh{display:flex;align-items:center;gap:10px;padding:18px 20px 8px}
.qh h2{font-family:var(--display);font-weight:700;font-size:15.5px;letter-spacing:-.02em}
.qh .filt{font-size:12px;color:var(--ink-3);margin-left:auto}
.th{display:flex;align-items:center;gap:13px;padding:17px 22px;border-bottom:1px solid var(--line)}
.th .av{width:44px;height:44px;border-radius:15px;background:var(--violet);color:#fff;display:grid;place-items:center;font-weight:700;font-size:14px}
.th .nm{font-family:var(--display);font-weight:700;font-size:16.5px;letter-spacing:-.02em}
.th .st{font-size:12px;color:var(--ink-3);margin-top:3px}
.th .acts{margin-left:auto;display:flex;gap:9px}
.thread{scrollbar-width:thin}"""
m = kpis([("12","en custodia",""),("3","piden tu firma","violet")])
m += '<div class="work"><div class="qcard"><div class="qh"><h2>Conversaciones</h2><span class="filt">por urgencia</span></div>'
m += '<div class="queue">'
m += ('<div class="row sel"><span class="av violet">MC</span><div>'
      '<div class="nm">María Cano <span class="pill warn"><span class="d"></span>espera firma</span></div>'
      '<div class="ms">«Deja el pedido en marzo, mejor.»</div></div>'
      '<div class="meta"><span class="t">2 min</span><span class="badge">2</span></div></div>')
m += ('<div class="row"><span class="av ink">JR</span><div>'
      '<div class="nm">Jorge Rincón <span class="pill ok"><span class="d"></span>el bot responde</span></div>'
      '<div class="ms">El bot está redactando la respuesta…</div></div>'
      '<div class="meta"><span class="t">5 min</span></div></div>')
m += ('<div class="row"><span class="av">TS</span><div>'
      '<div class="nm">Tech Store <span class="pill danger"><span class="d"></span>conflicto</span></div>'
      '<div class="ms">Dos pedidos piden el mismo cupo de stock.</div></div>'
      '<div class="meta"><span class="t">14 min</span><span class="badge">1</span></div></div>')
m += ('<div class="row"><span class="av">AG</span><div>'
      '<div class="nm">Andrés Gutiérrez <span class="pill ok"><span class="d"></span>cita en curso</span></div>'
      '<div class="ms">El bot agenda para el jueves.</div></div>'
      '<div class="meta"><span class="t">22 min</span></div></div>')
m += ('<div class="row off"><span class="av">LP</span><div>'
      '<div class="nm">Laura Pérez</div><div class="ms">Cerrada hoy a las 09:12 · quedó conforme.</div></div>'
      '<div class="meta"><span class="t">ayer</span></div></div>')
m += '</div></div>'
m += '<div class="tcard"><div class="th"><span class="av">MC</span><div>'
m += '<div class="nm">María Cano</div><div class="st">WhatsApp · el bot está al habla · hace 2 min</div></div>'
m += '<div class="acts"><button class="btn">Tomar el control</button>'
m += '<button class="btn-2 btn">Guardar contacto</button></div></div>'
m += '<div class="thread">'
m += '<div class="day">Hoy</div>'
m += '<div class="bub in">Hola, ¿el curso de julio entra en el presupuesto que me dijeron?</div>'
m += '<div class="bub bot">¡Hola María! Sí: son <b>480.000 por persona</b> y el material va incluido. ¿Te separo un cupo?</div>'
m += '<div class="bub in">Me parece bien. Deja el pedido… mejor en marzo que en febrero.</div>'
m += '<div class="bub tool"><span class="pill solid">Firma pendiente</span>Crear pedido · marzo · 1 plaza</div>'
m += '</div>'
m += '<div class="composer" style="margin:0 18px 18px"><input placeholder="Escribe como Jorge…"><button class="btn">Enviar</button></div>'
m += '</div></div>'
open("mensajeria.html","w").write(P.render("Conversaciones","mensajeria",m,mcss))

# ═══ CLIENTES ═══
c = kpis([("38","en cartera",""),("4","nuevos esta semana","violet")])
c += '<div class="lead"><h1>La cartera <em>del estudio</em></h1>'
c += '<div class="dek">Cada persona que escribe entra sola en la cartera. No se borra: se archiva.</div></div>'
c += '<div class="stack">'
c += '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">'
c += '<div class="search"><span style="color:var(--ink-3)">⌕</span><input placeholder="Busca por nombre, correo o teléfono…"></div>'
c += '<button class="btn-2 btn">WhatsApp</button><button class="btn-2 btn">Instagram</button><button class="btn-2 btn">Web</button>'
c += '<button class="btn">Nuevo contacto</button></div>'
c += '<div class="card"><table class="tbl"><thead><tr><th>Persona</th><th>Canal</th><th>Etiquetas</th><th>Última vez</th><th>Estado</th><th></th></tr></thead><tbody>'
rows = [("María Cano","MC","violet","WhatsApp",['<span class="chip">curso julio</span>'],"Hoy, 09:22",'<span class="pill ok"><span class="d"></span>Activa</span>',False),
        ("Tech Store","TS","","WhatsApp",['<span class="chip">pedidos</span>','<span class="chip" style="background:var(--danger-soft);color:var(--danger)">revisar</span>'],"Hoy, 08:30",'<span class="pill warn"><span class="d"></span>Nueva</span>',False),
        ("Andrés Gutiérrez","AG","ink","WhatsApp",['<span class="chip">cita jueves</span>'],"Hoy, 08:14",'<span class="pill ok"><span class="d"></span>Activa</span>',False),
        ("Laura Pérez","LP","","Web",['<span class="chip">demo</span>'],"Lunes, 09:12",'<span class="pill ink">Archivada</span>',True)]
for nm, ini, avc, ch, tags, last, st, off in rows:
    c += ('<tr><td><div style="display:flex;align-items:center;gap:12px"><span class="avc '+avc+'">'+ini+'</span>'
          '<span class="nm'+(' off' if off else '')+'">'+nm+'</span></div></td>'
          '<td style="color:var(--ink-2);font-size:12.5px">'+ch+'</td>'
          '<td>'+' '.join(tags)+'</td>'
          '<td style="font-size:12.5px;color:var(--ink-3)">'+last+'</td><td>'+st+'</td>'
          '<td class="rit"><a class="btn-2 btn sm" href="mensajeria.html">Abrir hilo</a></td></tr>')
c += '</tbody></table><div class="ft"><span>4 de 38 contactos</span><span style="margin-left:auto">Página 1 de 3 · ›</span></div></div>'
c += '<div class="card pad band" style="position:relative;overflow:hidden;display:flex;align-items:center;gap:22px;background:linear-gradient(120deg,#1B1035,#3A1E7A)">'
c += '<div class="glow" style="width:26rem;height:18rem;right:-6rem;top:-9rem;background:radial-gradient(closest-side,rgba(102,56,237,.7),transparent 70%)"></div>'
c += '<div style="position:relative"><div style="font-family:var(--display);font-weight:800;font-size:20px;letter-spacing:-.02em;color:#fff">La cartera se llena sola</div>'
c += '<div class="note" style="color:rgba(255,255,255,.7);margin-top:7px;max-width:60ch">El bot guarda el contacto al primer mensaje. Puedes desactivarlo en Ajustes › Opciones; los contactos guardados a mano nunca se duplican.</div></div>'
c += '<button class="btn-2 btn" style="margin-left:auto;position:relative;background:transparent;color:#fff;border-color:rgba(255,255,255,.28)">Revisar ajuste</button></div>'
c += '</div>'
open("clientes.html","w").write(P.render("Clientes","clientes",c))

# ═══ CONOCIMIENTO ═══
r = kpis([("61","trozos en el índice",""),("4","fuentes","violet"),("33 ms","consulta media","")])
r += '<div class="lead"><h1>Lo que el bot <em>ya domina</em></h1>'
r += '<div class="dek">Precios, políticas y catálogos. El bot los lee, los trocea y responde con ellos.</div>'
r += '<div class="acts"><button class="btn-2 btn">Escribir texto</button><button class="btn">Subir archivo</button></div></div>'
r += '<div class="stack">'
r += '<div class="card pad band" style="position:relative;overflow:hidden;display:flex;gap:22px;align-items:center;flex-wrap:wrap">'
r += '<div class="glow" style="width:30rem;height:20rem;right:-8rem;bottom:-12rem"></div>'
r += '<div style="width:56px;height:56px;border-radius:20px;background:var(--violet-soft);color:var(--violet);display:grid;place-items:center;font-size:26px;position:relative">＋</div>'
r += '<div style="flex:1;min-width:280px;position:relative"><div style="font-family:var(--display);font-weight:800;font-size:19px;letter-spacing:-.025em">Arrastra un PDF, TXT, CSV o una foto</div>'
r += '<div class="note" style="margin-top:5px">Si es un escaneo, el bot le hace OCR antes de leerlo. Suele tardar un par de minutos.</div></div>'
r += '<button class="btn" style="position:relative">Elegir archivo</button></div>'
r += '<div class="card"><div class="hd"><h2>Fuentes del proyecto</h2><span class="sub">61 trozos indexados</span></div>'
r += '<table class="tbl"><thead><tr><th>Fuente</th><th>Tipo</th><th>Trozos</th><th>Lectura</th><th>Estado</th><th>Actualizada</th></tr></thead><tbody>'
for a,b,cc,dd,ee,ff in [("tarifas-septiembre.pdf","PDF · 32 páginas","42",'<span style="color:var(--ok);font-weight:600">OCR 0.94</span>','<span class="pill ok"><span class="d"></span>Lista</span>',"Hoy, 08:44"),
       ("politica-devoluciones.txt","Texto plano","11",'<span style="color:var(--ink-3)">—</span>','<span class="pill ok"><span class="d"></span>Lista</span>',"Viernes"),
       ("catalogo-julio.pdf","PDF · 64 páginas","31 de 64",'<span style="color:var(--warn);font-weight:600">Leyendo pág. 14</span>','<span class="pill warn"><span class="d"></span>Trabajando…</span>',"—"),
       ("precios-yq.csv","Hoja de cálculo","—",'<span style="color:var(--danger)">Formato inesperado</span>','<span class="pill danger"><span class="d"></span>Falló</span>',"—")]:
    r += '<tr><td class="nm">'+a+'</td><td style="color:var(--ink-3)">'+b+'</td><td class="num">'+cc+'</td><td style="font-size:12.5px">'+dd+'</td><td>'+ee+'</td><td style="color:var(--ink-3);font-size:12.5px">'+ff+'</td></tr>'
r += '</tbody></table><div class="ft"><span>Troceado semántico · 800 tokens con 100 de solape</span><span style="margin-left:auto">Re-clasificado: de 10 candidatos quedan 3</span></div></div>'
r += '<div class="card pad"><h2 style="font-family:var(--display);font-weight:700;font-size:15.5px;letter-spacing:-.02em">Consultar el índice</h2>'
r += '<div class="note" style="margin-top:5px">No guarda nada: solo te enseña qué leería el bot.</div>'
r += '<div style="display:flex;gap:12px;margin-top:16px"><input style="flex:1;background:var(--canvas);border:1px solid var(--line-2);border-radius:var(--r-pill);padding:13px 20px;font-family:var(--body);font-size:13.5px" placeholder="¿Cuánto cuesta la matrícula del curso de julio?">'
r += '<button class="btn">Consultar</button></div>'
r += '<div class="stack" style="margin-top:18px;gap:11px">'
r += '<div style="background:var(--canvas);border:1px solid var(--line);border-radius:var(--r-field);padding:15px 17px"><div style="font-size:12px;font-weight:700;color:var(--violet)">Coincide 0.88 · tarifas-septiembre.pdf, pág. 4</div><div style="margin-top:7px;font-size:13px">La matrícula del curso de julio es de 480.000 e incluye material didáctico y certificado.</div></div>'
r += '<div style="background:var(--canvas);border:1px solid var(--line);border-radius:var(--r-field);padding:15px 17px"><div style="font-size:12px;font-weight:700;color:var(--ink-3)">Coincide 0.71 · politica-devoluciones.txt</div><div style="margin-top:7px;font-size:13px">El plazo de devolución es de 14 días naturales desde la compra.</div></div>'
r += '</div></div></div>'
open("cerebro.html","w").write(P.render("Conocimiento","cerebro",r))

# ═══ AGENTE ═══
a = kpis([("Martina","en activo","violet"),("8","herramientas","")])
a += '<div class="lead"><h1>Su carácter <em>y sus llaves</em></h1>'
a += '<div class="dek">Un solo agente por proyecto. Aquí decides cómo habla y qué puede resolver sin ti.</div></div>'
a += '<div class="grid" style="grid-template-columns:1.3fr 1fr;align-items:start">'
a += '<div class="card pad"><div style="display:flex;align-items:center;gap:16px">'
a += '<div style="width:58px;height:58px;border-radius:20px;background:var(--violet);color:#fff;display:grid;place-items:center;font-family:var(--display);font-weight:800;font-size:21px">M</div>'
a += '<div><div style="font-family:var(--display);font-weight:800;font-size:20px;letter-spacing:-.025em">Martina</div>'
a += '<div class="note">Asistente de matrícula · en activo</div></div>'
a += '<span class="pill ok" style="margin-left:auto"><span class="d"></span>En activo</span></div>'
a += '<div class="divider" style="margin:22px 0"></div>'
a += '<div class="grid" style="grid-template-columns:1fr 1fr;gap:16px">'
a += '<div class="field"><label>Su nombre</label><input value="Martina"></div>'
a += '<div class="field"><label>Su papel</label><input value="Atención de matrícula"></div>'
a += '<div class="field" style="grid-column:1/-1"><label>Cómo escribe</label><textarea rows="2">Cercana y clara: como una compañera del gremio. Técnica, sin jerga y sin rodeos.</textarea></div>'
a += '<div class="field"><label>Idioma</label><select><option>Español</option><option>Inglés</option></select></div>'
a += '<div class="field"><label>Emojis</label><select><option>Pocos, con intención</option><option>Ninguno</option></select></div>'
a += '<div class="field" style="grid-column:1/-1"><label>Qué dice cuando no sabe</label><input value="Le paso el hilo a una persona del estudio."></div>'
a += '</div></div>'
a += '<div class="stack">'
a += '<div class="card pad"><h2 style="font-family:var(--display);font-weight:700;font-size:15.5px;letter-spacing:-.02em">Lo que puede resolver sola</h2>'
a += '<div class="note" style="margin-top:5px">Desactiva lo que prefieras que consulte contigo.</div><div style="display:flex;flex-wrap:wrap;gap:9px;margin-top:16px">'
for t, on in [("create_appointment",True),("create_order",True),("get_product_info",True),("get_business_hours",True),("get_service_availability",True),("transfer_to_human",True),("send_notification",False),("get_faq_answer",True)]:
    a += '<span class="pill '+("solid" if on else "ink")+'"><span class="d"></span>'+t+'</span>'
a += '</div></div>'
a += '<div class="card pad" style="box-shadow:none;background:var(--canvas)"><h2 style="font-family:var(--display);font-weight:700;font-size:15.5px;letter-spacing:-.02em">Modelos en servicio</h2>'
a += '<div class="note" style="margin-top:5px">Los elige el servidor. Aquí solo se leen.</div>'
for k,v in [("Conversación","Qwen3 · 80B"),("Memoria vectorial","text-embedding-3-small"),("Lectura de imágenes","Gemini 3.8 Flash")]:
    a += '<div class="kv" style="margin-top:9px"><span>'+k+'</span><b style="font-weight:600">'+v+'</b></div>'
a += '<div class="note" style="margin-top:13px">Cambiar el modelo de memoria obliga a reindexar el conocimiento.</div></div>'
a += '<button class="btn" style="width:100%;padding:14px">Guardar el agente</button>'
a += '</div></div>'
open("agentes.html","w").write(P.render("Agente","agentes",a))

# ═══ AJUSTES ═══
j = kpis([("3","canales",""),("2","conectados","violet")])
j += '<div class="lead"><h1>Los ajustes <em>del estudio</em></h1>'
j += '<div class="dek">Canales, trato y la identidad con la que se presenta tu marca.</div></div>'
j += '<div class="stack" style="max-width:1020px">'
j += '<div class="card pad"><h2 style="font-family:var(--display);font-weight:700;font-size:15.5px;letter-spacing:-.02em">Canales</h2>'
j += '<div class="grid" style="grid-template-columns:repeat(3,1fr);margin-top:18px">'
for nm, st, cls, sub in [("WhatsApp","Conectado","ok","+34 600 11 22 33"),
                          ("Instagram","Conectado","ok","@estudio.mateo"),
                          ("Web","Sin conectar","warn","finca-web · pendiente")]:
    j += ('<div style="border:1px solid var(--line);border-radius:var(--r-card);padding:20px">'
          '<div style="font-family:var(--display);font-weight:800;font-size:17px;letter-spacing:-.02em">'+nm+'</div>'
          '<div style="margin-top:12px"><span class="pill '+cls+'"><span class="d"></span>'+st+'</span></div>'
          '<div class="note" style="margin-top:11px">'+sub+'</div></div>')
j += '</div></div>'
j += '<div class="card pad band" style="position:relative;overflow:hidden">'
j += '<div class="glow" style="width:34rem;height:22rem;right:-10rem;top:-12rem"></div>'
j += '<div style="display:flex;gap:22px;align-items:center;flex-wrap:wrap;position:relative">'
j += '<div style="width:62px;height:62px;border-radius:20px;background:var(--ink);color:#fff;display:grid;place-items:center;font-family:var(--display);font-weight:800;font-size:23px">EM</div>'
j += '<div style="flex:1;min-width:250px"><div style="font-family:var(--display);font-weight:800;font-size:19px;letter-spacing:-.025em">Identidad de la marca</div>'
j += '<div class="note" style="margin-top:5px">Un solo color manda en toda la app. El nombre y el logo también son del proyecto.</div></div>'
j += '<div style="display:flex;align-items:center;gap:11px"><span class="swatch" style="background:var(--violet)"></span>'
j += '<input value="#6638ED" style="width:126px;border:1px solid var(--line-2);border-radius:var(--r-field);padding:12px 15px;font-size:13.5px">'
j += '<button class="btn-2 btn">Aplicar</button></div></div></div>'
j += '<div class="card pad"><h2 style="font-family:var(--display);font-weight:700;font-size:15.5px;letter-spacing:-.02em">Cómo trata a la gente</h2>'
j += '<div class="stack" style="margin-top:18px;gap:16px">'
for lab, on, hint in [("Crear el contacto al primer mensaje",True,"Así no se pierde nadie."),
                       ("Que el bot responda solo por defecto",True,"Puedes tomar el control cuando quieras."),
                       ("Enseñar los errores del bot en el hilo",False,"Útil al probar, ruidoso en producción."),
                       ("Avisar al equipo cuando alguien pida una persona",True,"Llega al centro de notificaciones.")]:
    j += ('<div style="display:flex;align-items:center;gap:16px"><label class="sw"><input type="checkbox" %s><span>%s</span></label>'
          '<span class="note" style="margin-left:auto">%s</span></div>' % ("checked" if on else "", lab, hint))
j += '</div></div>'
j += '<div class="card pad" style="box-shadow:none;background:var(--canvas)"><div style="display:flex;gap:14px;align-items:center">'
j += '<span class="pill violet">Sistema</span><div class="note">La tipografía, el papel y las líneas son del sistema, no del proyecto. Solo el color, el nombre y el logo cambian contigo.</div></div></div>'
j += '</div>'
open("ajustes.html","w").write(P.render("Ajustes","ajustes",j))

# ═══ EQUIPO ═══
u = kpis([("1","administrador","violet"),("1","soporte",""),("1","asistente","")])
u += '<div class="lead"><h1>Quién tiene <em>la llave</em></h1>'
u += '<div class="dek">Tres papeles: administra, atiende o solo consulta. El primero que entra es administrador.</div>'
u += '<div class="acts"><button class="btn">Invitar a alguien</button></div></div>'
u += '<div class="stack">'
u += '<div class="grid" style="grid-template-columns:repeat(3,1fr)">'
for role, desc, cls in [("Administrador","Configura todo y elimina conversaciones.","violet"),
                         ("Soporte","Atiende y toma el control de los hilos.","ink"),
                         ("Asistente","Consulta y responde. No configura.","ink")]:
    u += ('<div class="card pad"><span class="pill '+cls+'">'+role+'</span>'
          '<div class="note" style="margin-top:13px">'+desc+'</div></div>')
u += '</div>'
u += '<div class="card"><table class="tbl"><thead><tr><th>Persona</th><th>Correo</th><th>Papel</th><th>Proyectos</th><th>Estado</th><th></th></tr></thead><tbody>'
for nm, ini, avc, mail, role, rc, n, st, off in [
    ("Jorge Daza","JD","violet","jorge@estudiomateo.io","Administrador","violet","2",'<span class="pill ok"><span class="d"></span>Activo</span>',False),
    ("Lucía Ferrer","LF","","lucia@estudiomateo.io","Soporte","ink","1",'<span class="pill ok"><span class="d"></span>Activo</span>',False),
    ("Diego Roldán","DR","","diego@estudiomateo.io","Asistente","ink","1",'<span class="pill ink">Desactivado</span>',True)]:
    u += ('<tr><td><div style="display:flex;align-items:center;gap:12px"><span class="avc sm '+avc+'">'+ini+'</span>'
          '<span class="nm'+(' off' if off else '')+'">'+nm+'</span></div></td>'
          '<td style="color:var(--ink-3);font-size:12.5px">'+mail+'</td>'
          '<td><span class="pill '+rc+'">'+role+'</span></td><td class="num">'+n+'</td><td>'+st+'</td>'
          '<td class="rit"><button class="btn-2 btn sm">Editar</button></td></tr>')
u += '</tbody></table></div></div>'
open("usuarios.html","w").write(P.render("Equipo","usuarios",u))

# ═══ PERFIL ═══
p = kpis([("JD","administrador","violet"),("2","proyectos","")])
p += '<div class="lead"><h1>Tu <em>ficha</em></h1><div class="dek">Tus datos y cómo quieres ver el panel.</div></div>'
p += '<div class="grid" style="grid-template-columns:330px 1fr;align-items:start">'
p += '<div class="card pad" style="text-align:center">'
p += '<div style="width:88px;height:88px;border-radius:50%;background:var(--violet);color:#fff;display:grid;place-items:center;font-family:var(--display);font-weight:800;font-size:31px;margin:6px auto 16px;box-shadow:0 20px 40px -18px var(--violet)">JD</div>'
p += '<div style="font-family:var(--display);font-weight:800;font-size:21px;letter-spacing:-.025em">Jorge Daza</div>'
p += '<div class="note" style="margin-top:5px">jorge@estudiomateo.io</div>'
p += '<div style="display:flex;gap:9px;justify-content:center;margin-top:16px"><span class="pill violet">Administrador</span><span class="pill ink">2 proyectos</span></div>'
p += '<div class="divider" style="margin:20px 0"></div>'
p += '<div class="note">Entraste por última vez hoy a las 08:58 desde Madrid.</div></div>'
p += '<div class="card pad"><h2 style="font-family:var(--display);font-weight:700;font-size:15.5px;letter-spacing:-.02em">Datos</h2>'
p += '<div class="grid" style="grid-template-columns:1fr 1fr;gap:16px;margin-top:20px">'
p += '<div class="field"><label>Nombre</label><input value="Jorge Daza"></div>'
p += '<div class="field"><label>Correo</label><input value="jorge@estudiomateo.io"></div>'
p += '<div class="field"><label>Contraseña</label><input type="password" value="no-importa"></div>'
p += '<div class="field"><label>Idioma del panel</label><select><option>Español</option><option>Inglés</option></select></div>'
p += '</div><div class="divider" style="margin:22px 0"></div>'
p += '<div style="display:flex;gap:16px;align-items:center"><label class="sw"><input type="checkbox" checked><span>Avisarme de los hilos sin atender</span></label>'
p += '<button class="btn" style="margin-left:auto">Guardar cambios</button></div></div></div>'
open("perfil.html","w").write(P.render("Perfil","perfil",p))

# ═══ PRUEBAS ═══
t = kpis([("3","pruebas hoy","violet")])
t += '<div class="lead"><h1>Banco <em>de pruebas</em></h1>'
t += '<div class="dek">Solo para el equipo: lee un archivo y enseña el texto que saca. No guarda nada.</div></div>'
t += '<div class="stack" style="max-width:880px">'
t += '<div class="card pad"><h2 style="font-family:var(--display);font-weight:700;font-size:15.5px;letter-spacing:-.02em">Extraer texto de un archivo</h2>'
t += '<div class="note" style="margin-top:5px">Sirve para comprobar el OCR antes de subirlo al conocimiento.</div>'
t += '<div style="border:2px dashed var(--line-2);border-radius:var(--r-card);padding:38px;text-align:center;margin-top:18px;background:var(--canvas)">'
t += '<div style="font-size:32px;color:var(--violet)">⇪</div><div style="font-family:var(--display);font-weight:700;font-size:15.5px;margin-top:10px">Suelta aquí un JPG, PNG, PDF o TXT</div>'
t += '<div class="note" style="margin-top:7px">Hasta 20 MB</div></div>'
t += '<div class="field" style="margin-top:18px"><label>Modelo de lectura</label><input value="Gemini 3.8 Flash · visión" disabled></div>'
t += '<button class="btn" style="margin-top:10px">Extraer texto</button></div>'
t += '<div class="card"><div class="hd"><h2>Últimas pruebas</h2><span class="sub">hoy</span></div><div style="padding:8px 14px 16px">'
for nm, res, cls in [("prueba-carnet.jpg","214 caracteres · confianza 0.91 · 1,4 s","ok"),
                      ("rotulo-lila.png","No se encontró texto · confianza 0.00","danger"),
                      ("catalogo-p14.pdf","1.882 caracteres · confianza 0.88 · 3,1 s","ok")]:
    t += ('<div style="display:flex;align-items:center;gap:13px;padding:12px 10px"><span class="pill '+cls+'"><span class="d"></span>'+nm+'</span>'
          '<span class="note" style="flex:1">'+res+'</span></div>')
t += '</div></div></div>'
open("pruebas.html","w").write(P.render("Pruebas","pruebas",t))

# ═══ LOGIN ═══
lg_css = ""
lg = ('<div style="min-height:100vh;display:grid;place-items:center;padding:30px;position:relative;z-index:1">'
      '<div style="width:min(470px,94vw);position:relative">'
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;justify-content:center">'
      '<div style="width:46px;height:46px;border-radius:16px;background:var(--violet);color:#fff;display:grid;place-items:center;font-weight:800;font-size:20px">M</div>'
      '<div style="font-weight:800;font-size:20px;letter-spacing:-.025em">Mitch<span style="font-family:var(--serif);font-style:italic;font-weight:600;color:var(--violet)">bot</span></div></div>'
      '<div class="card" style="padding:38px 34px;border-radius:var(--r-big);box-shadow:var(--shadow-lift)">'
      '<h1 style="font-family:var(--display);font-weight:800;font-size:36px;letter-spacing:-.04em;line-height:1.02">Bienvenido de nuevo a la <em style="font-family:var(--serif);font-style:italic;font-weight:600;color:var(--violet)">bóveda</em>.</h1>'
      '<div class="note" style="margin:12px 0 26px">Tu turno empieza donde lo dejaste.</div>'
      '<div class="field"><label>Correo</label><input value="jorge@estudiomateo.io"></div>'
      '<div class="field" style="margin-top:15px"><label>Contraseña</label><input type="password" value="no-importa"></div>'
      '<button class="btn" style="width:100%;padding:14px;margin-top:22px">Entrar</button>'
      '<div style="display:flex;gap:9px;margin-top:22px;justify-content:center;flex-wrap:wrap">'
      '<span class="pill ink">Sin tarjeta</span>'
      '<span class="pill ink">Listo en minutos</span>'
      '<span class="pill ink">Tus datos, cifrados</span></div>'
      '</div>'
      '<div class="note" style="text-align:center;margin-top:20px">Las cuentas se crean desde el equipo, no desde aquí.</div>'
      '</div></div>')
open("login.html","w").write(shell(lg))

# ═══ ONBOARDING ═══
ob = ('<div style="min-height:100vh;display:grid;place-items:center;padding:30px;position:relative;z-index:1">'
      '<div style="width:min(740px,94vw)">'
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:22px;justify-content:center">'
      '<div style="width:40px;height:40px;border-radius:14px;background:var(--violet);color:#fff;display:grid;place-items:center;font-weight:800;font-size:17px">M</div>'
      '<div style="font-size:12.5px;font-weight:600;color:var(--ink-3)">Vamos a montar tu estudio · paso 2 de 3</div></div>'
      '<div style="display:flex;gap:9px;margin-bottom:22px">'
      '<div style="flex:1;height:8px;border-radius:var(--r-pill);background:var(--violet)"></div>'
      '<div style="flex:1;height:8px;border-radius:var(--r-pill);background:var(--violet)"></div>'
      '<div style="flex:1;height:8px;border-radius:var(--r-pill);background:var(--sunken)"></div></div>'
      '<div class="card" style="padding:34px 32px 28px;border-radius:var(--r-big);box-shadow:var(--shadow-lift)">'
      '<h1 style="font-family:var(--display);font-weight:800;font-size:32px;letter-spacing:-.04em;line-height:1.03">Dale carácter a <em style="font-family:var(--serif);font-style:italic;font-weight:600;color:var(--violet)">tu agente</em></h1>'
      '<div class="note" style="margin:10px 0 24px">Con esto ya puede contestar. Podrás afinarlo cuando quieras.</div>'
      '<div class="grid" style="grid-template-columns:1fr 1fr;gap:16px">'
      '<div class="field"><label>Su nombre</label><input value="Martina"></div>'
      '<div class="field"><label>Su papel</label><input value="Atención de matrícula"></div>'
      '<div class="field" style="grid-column:1/-1"><label>Mensaje de bienvenida</label><input value="¡Hola! Soy Martina, del Estudio Mateo. ¿En qué te ayudo?"></div>'
      '<div class="field"><label>Idioma</label><select><option>Español</option><option>Inglés</option></select></div>'
      '<div class="field"><label>Emojis</label><select><option>Pocos, con intención</option></select></div></div>'
      '<div style="display:flex;gap:12px;margin-top:28px;align-items:center">'
      '<a class="btn-ghost btn" href="setup.html">Volver</a>'
      '<a class="btn" style="margin-left:auto" href="ajustes.html">Siguiente: canales →</a></div>'
      '</div></div></div>')
open("setup.html","w").write(shell(ob))

# ═══ CHAT PÚBLICO ═══
cp_css = ".thread::-webkit-scrollbar{width:8px}.thread::-webkit-scrollbar-thumb{background:var(--line-2);border-radius:8px}"
cp = ('<div style="min-height:100vh;display:grid;place-items:center;padding:30px;position:relative;z-index:1">'
      '<div class="hero-win" style="width:min(570px,96vw);height:min(730px,92vh);display:grid;grid-template-rows:auto 1fr auto">'
      '<div class="th" style="border-bottom:1px solid var(--line);padding:18px 22px">'
      '<span style="width:44px;height:44px;border-radius:15px;background:var(--ink);color:#fff;display:grid;place-items:center;font-weight:700;font-size:14px">EM</span>'
      '<div><div style="font-family:var(--display);font-weight:700;font-size:16.5px;letter-spacing:-.02em">Estudio Mateo</div>'
      '<div class="note">Con Martina, su asistente</div></div>'
      '<span class="pill ok" style="margin-left:auto"><span class="d"></span>En línea</span></div>'
      '<div class="thread">'
      '<div class="day">Hoy</div>'
      '<div class="bub in">¿El curso de julio tiene matrícula libre?</div>'
      '<div class="bub bot">¡Hola! Sí, quedan <b>dos plazas</b> de catorce. ¿Te paso los horarios?</div>'
      '<div class="bub in">Sí, porfa. ¿Y hay intensivo de mañana?</div>'
      '<div class="bub bot">Lo hay: martes y jueves de 9 a 11. ¿Te reservo una plaza en el intensivo?</div>'
      '<div class="note" style="text-align:center;margin-top:8px">Martina está escribiendo…</div>'
      '</div>'
      '<div class="composer" style="margin:0 18px 18px">'
      '<input placeholder="Escribe a Martina…"><button class="btn">Enviar</button></div>'
      '</div></div>')
open("chat-publico.html","w").write(shell(cp, cp_css))

# ═══ ÍNDICE ═══
hub_css = """
.hub{min-height:100vh;display:grid;place-items:center;padding:130px 30px 60px;position:relative;z-index:1}
.hubin{width:min(1000px,100%)}
.hub h1{font-family:var(--display);font-weight:800;font-size:clamp(40px,6.4vw,68px);letter-spacing:-.045em;line-height:.98}
.hub h1 em{font-family:var(--serif);font-style:italic;font-weight:600;color:var(--violet)}
.hub .dek{font-size:14.5px;color:var(--ink-2);margin:16px 0 30px;max-width:62ch;line-height:1.6}
.hgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(236px,1fr));gap:14px}
.hcard{display:block;background:var(--surface);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--shadow);padding:20px 22px;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}
.hcard:hover{transform:translateY(-3px);box-shadow:var(--shadow-lift);border-color:var(--violet)}
.hcard .n{font-size:11px;font-weight:800;color:var(--violet)}
.hcard .t{font-family:var(--display);font-weight:700;font-size:18px;letter-spacing:-.025em;margin:7px 0 6px}
.hcard .d{font-size:12.5px;color:var(--ink-2);line-height:1.5}
"""
hub = ('<div class="hub"><div class="hubin">'
       '<div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">'
       '<div style="width:54px;height:54px;border-radius:19px;background:var(--violet);color:#fff;display:grid;place-items:center;font-weight:800;font-size:24px">M</div>'
       '<span class="pill violet">Mundo 2 de 2 nuevos</span>'
       '<a class="pill ink" href="../comparador.html" style="margin-left:auto">← Comparar todos los mundos</a></div>'
       '<h1>Bóveda</h1>'
       '<div class="dek">El mundo cool premium: blanco frío, azul noche y un único violeta que manda. La rejilla fina cruza el fondo, la navegación flota en una cápsula y la serif itálica aparece justo donde quieres que se detenga la mirada. Nació de <b>per-ment.webflow.io</b>.</div>'
       '<div class="hgrid">')
for f, n, t, d in [("dashboard","01","Resumen","Métricas, volumen y registro de la jornada"),
                   ("mensajeria","02","Conversaciones","La superficie firma: cola, hilo y cápsulas"),
                   ("clientes","03","Clientes","La cartera, etiquetas y canales"),
                   ("cerebro","04","Conocimiento","Fuentes, OCR y consulta del índice"),
                   ("agentes","05","Agente","Carácter, herramientas y modelos"),
                   ("ajustes","06","Ajustes","Canales, marca y trato"),
                   ("usuarios","07","Equipo","Papeles y llaves"),
                   ("perfil","08","Perfil","Tu ficha"),
                   ("login","09","Entrada","Puerta de la bóveda"),
                   ("setup","10","Alta","Montar el estudio en 3 pasos"),
                   ("chat-publico","11","Chat público","La cara del cliente final"),
                   ("pruebas","12","Pruebas","Banco interno de lectura")]:
    hub += ('<a class="hcard" href="%s.html"><div class="n">%s</div><div class="t">%s</div><div class="d">%s</div></a>' % (f, n, t, d))
hub += '</div></div></div>'
open("index.html","w").write(shell(hub, hub_css))

print("Bóveda →", sorted([f for f in os.listdir(".") if f.endswith(".html")]))
