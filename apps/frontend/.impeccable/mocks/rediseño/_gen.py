#!/usr/bin/env python3
# Genera las vistas del prototipo muestra "Mesa de Exposición"
# Uso: python3 build-pages.py  (rewrites *.html salvo style.css, _shell.html, index.html)
import os

NAV = [("dashboard","01 · TABLERO"),("mensajeria","02 · MENSAJERÍA"),("clientes","03 · CLIENTES"),
       ("cerebro","04 · CEREBRO"),("agentes","05 · AGENTES"),("ajustes","06 · AJUSTES"),
       ("usuarios","07 · USUARIOS"),("perfil","08 · PERFIL"),("pruebas","09 · BANCO")]

def mklinks(nav):
    out = ""
    for file, label in NAV:
        on = ' class="on"' if file == nav else (" style='opacity:.5'" if file == "pruebas" else "")
        out += f'<a href="{file}.html"{on}>{label}</a>\n  '
    return out + '<a href="index.html" style="opacity:.45">← ÍNDICE DEL PROTOTIPO</a>\n'

class Page:
    def __init__(self):
        self._s = open("_shell.html").read()
    def render(self, titulo, sub, nav, body, css=""):
        return (self._s.replace("%%TITULO%%", titulo)
                       .replace("%%SUB%%", sub)
                       .replace("%%NAV%%", mklinks(nav))
                       .replace("%%CSS%%", css)
                       .replace("%%BODY%%", body))

def kpis(pairs):
    out = '<div class="marear">'
    for pair in pairs:
        v, l, c = (list(pair) + [None])[:3]
        col = f' style="color:{c}"' if c else ""
        out += f'<div class="kpi"><b{col}>{v}</b><span>{l}</span></div>'
    return out + "</div>"

K = kpis([("12","circuitos"),("3","con carga","var(--magenta)"),("94%","despacho bot"),("1m20s","resp. media")])
P = Page()

# ═══ DASHBOARD ═══
d = K + '<div class="bg-hatchband"></div><div style="padding:24px 26px;display:grid;gap:18px">'
d += '''<div style="display:flex;align-items:end;gap:16px">
  <div><div class="cond" style="color:var(--ink-soft)">EDICIÓN DEL DÍA</div>
  <div style="font-family:var(--cond);font-size:38px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;">Despacho · jueves 21</div></div>
  <div style="margin-left:auto;display:flex;gap:8px"><button class="btn">7 D</button><button class="btn fill">30 D</button><button class="btn">90 D</button></div></div>'''
for t, v, dl in [("Conversaciones","114","+12% s/ período"),("Atendidas por bot","94%","+3 pts"),
                 ("Tomadas por humano","17","−2 del período"),("Respuesta media","1m20s","−8 s")]:
    d += ('<div class="calco"><div class="ph"><h2>'+t+'</h2></div>'
          '<div style="padding:16px 18px"><b style="font-family:var(--mono);font-size:30px;font-weight:500">'+v+'</b>'
          '<div style="font-family:var(--mono);font-size:9px;color:var(--magenta);margin-top:6px">'+dl+'</div></div></div>')
d += '<div style="display:grid;grid-template-columns:2fr 1fr;gap:18px"><div class="calco"><div class="ph"><h2>Volumen</h2><span class="sub">DIARIA · 30 D</span></div><div style="padding:18px 20px;display:flex;gap:6px;align-items:end;height:190px">'
for h in [60,90,48,140,72,110,98,160,85,64,132,150,88,116,104,55,90,128,142,99,76,44]:
    fill = "background:var(--ink)" if h > 110 else "background:repeating-linear-gradient(45deg,var(--ink) 0 3px,transparent 3px 6px)"
    d += f'<div style="flex:1;height:{h}px;{fill};border-radius:1px"></div>'
d += '</div><div style="padding:0 20px 14px;display:flex;gap:16px"><span class="cond" style="color:var(--green)">● BOT</span><span class="cond" style="color:var(--magenta)">● HUMANO</span></div></div>'
d += '<div class="calco"><div class="ph"><h2>Canales</h2></div><div style="padding:16px 18px;display:flex;flex-direction:column;gap:12px">'
for ch, pct, w, fill in [("WHATSAPP","61%","61%","var(--ink)"),("WEB","23%","23%","repeating-linear-gradient(90deg,var(--ink) 0 3px,transparent 3px 6px)"),("INSTAGRAM","16%","16%","var(--magenta)")]:
    d += (f'<div><div style="display:flex;font-family:var(--mono);font-size:9.5px"><span>{ch}</span><span style="margin-left:auto">{pct}</span></div>'
          f'<div style="height:9px;background:var(--paper-lo);margin-top:5px"><div style="width:{w};height:100%;background:{fill}"></div></div></div>')
d += '''</div><div class="ph" style="border-top:2px solid var(--ink)"><h2>Sentimiento</h2></div>
<div style="padding:14px 18px;font-family:var(--mono);font-size:9.5px;display:flex;gap:14px">
<span>● 78% VERDE</span><span>● 14% QUEJA</span><span>○ 8% NEUTRO</span></div></div></div>'''
d += '''<div class="calco"><div class="ph"><h2>BANDEJA DE EVENTOS</h2><span class="sub">ÚLTIMAS 24 H</span></div>
<table class="tbl"><tbody>
<tr><td style="width:70px" class="mono">09:12</td><td><span class="sello g">bot</span> &nbsp;Cita confirmada · María Cano</td><td class="cond" style="text-align:right">WA</td></tr>
<tr><td class="mono">09:05</td><td><span class="sello m">humano</span> &nbsp;Laura Pérez despachada por el operador</td><td class="cond" style="text-align:right">WEB</td></tr>
<tr><td class="mono">08:44</td><td><span class="sello f">registro</span> &nbsp;Fuente «tarifas-sept.pdf» indexada · 42 trozos</td><td class="cond" style="text-align:right">RAG</td></tr>
<tr><td class="mono">08:30</td><td><span class="sello m">aviso</span> &nbsp;create_order espera confirmación · Tech Store <span class="cruz"></span></td><td class="cond" style="text-align:right">WA</td></tr>
</tbody></table></div></div>'''
open("dashboard.html","w").write(P.render("Tablero","MESA CENTRAL","dashboard",d))

# ═══ MENSAJERÍA ═══
mcss = """.work{display:grid;grid-template-columns:minmax(380px,42%) 1fr;min-height:calc(100vh - 74px)}
.queue{border-right:2px solid var(--ink);overflow-y:auto}
.qh{padding:11px 18px;font-family:var(--cond);font-size:11px;letter-spacing:.26em;text-transform:uppercase;color:var(--ink-soft);border-bottom:2px solid var(--ink);display:flex;gap:10px;align-items:center}
.qh .filt{margin-left:auto;font-family:var(--mono);font-size:8.5px}
.tw{display:grid;grid-template-rows:auto 1fr auto;min-height:0}
.th{padding:12px 18px;border-bottom:2px solid var(--ink);display:flex;align-items:center;gap:10px}
.thread{padding:16px 20px;overflow-y:auto;display:flex;flex-direction:column;gap:9px;background:linear-gradient(180deg,#FBF9F3,var(--paper))}
.aviso{font-family:var(--mono);font-size:8.5px;letter-spacing:.14em;color:var(--magenta);text-transform:uppercase;border:1px dashed var(--magenta);padding:7px 11px;background:rgba(193,58,124,.05)}"""
m = K + '<div class="bg-hatchband"></div><div class="work"><div class="queue"><div class="qh">COLA DE REGLETAS · POR CARGA <span class="filt">canal: todos ▾</span></div>'
m += '''<div class="regleta sel"><div><span class="dot m"></span></div><div><div style="display:flex;align-items:center;gap:8px"><span style="font-weight:600">María Cano</span><span class="carga"><b>+1⅓</b><span class="hatch" style="background:repeating-linear-gradient(90deg,var(--ink) 0 2px,transparent 2px 4px)"></span></span></div><div class="r2">WA · ÚLTIMO 2 MIN · 1 HERRAMIENTA SIN CONFIRMAR</div></div></div>'''
m += '''<div class="regleta"><div><span class="dot g"></span></div><div><div style="display:flex;align-items:center;gap:8px"><span style="font-weight:600">Jorge Rincón</span><span class="carga"><b>+0</b><span class="hatch l1"></span></span></div><div class="r2">IG · BOT EN LÍNEA · RESPUESTA EN BREVE</div></div></div>'''
m += '''<div class="regleta"><div><span class="dot k"></span></div><div><span style="font-weight:600" class="tag-strike">Laura Pérez</span><div class="r2">WEB · CERRADO 09:12</div></div></div>'''
m += '''<div class="regleta"><div><span class="dot m"></span></div><div><div style="display:flex;align-items:center;gap:8px"><span style="font-weight:600">Tech Store</span><span style="font-family:var(--mono);font-size:8px;color:var(--magenta);border:1px dashed var(--magenta);padding:2px 6px">CONFLICTO <span class="cruz"></span></span></div><div class="r2">DUELO DE ZONAS · PEDIDOS #1042 Y #1022 · CRUZ 90°</div></div></div>'''
m += '''<div class="regleta"><div><span class="dot g"></span></div><div><div style="display:flex;align-items:center;gap:8px"><span style="font-weight:600">Andrés Gutiérrez</span><span class="carga"><b>+⅔</b><span class="hatch l1"></span></span></div><div class="r2">WA · BOT RESPONDIENDO · CITA PENDIENTE</div></div></div>'''
m += '''</div><div class="tw">
<div class="th"><span style="font-weight:600;font-size:14px">María Cano</span><span class="cond" style="font-size:9px">REGLETA +1⅓ · PENDIENTE</span><button class="btn key" style="margin-left:auto"><i></i>TOMAR CONTROL</button><button class="btn">CERRAR</button></div>
<div class="thread">
<span class="nota">· TIRA 1043 · REGISTRO DE DESPACHO ·</span>
<div class="msg" style="align-self:flex-start;border:1px solid var(--hair);background:#FFF">Hola, ¿el curso de julio entra en el presupuesto que me dijeron?</div>
<div class="msg" style="align-self:flex-end;background:var(--ink);color:#F3EFE7">Sí María: 480.000 por persona, material incluido. ¿Te separo un cupo?</div>
<div class="aviso" style="align-self:flex-end">CREATE_ORDER ESPERA CONFIRMACIÓN · 1 PASO <span class="cruz"></span></div>
<div class="msg" style="align-self:flex-start;border:1px solid var(--hair);background:#FFF">Sí, me parece bien. Deja el pedido en febrero primero... mejor sigue en marzo.</div>
<span class="nota" style="color:var(--magenta)">· LA REGLETA SIGUE ABIERTA · DESPLEGAD CON LA LLAVE CUANDO DESPEJES ·</span>
</div>
<div class="tray"><input placeholder="Anotación de despacho..."><button class="btn fill">DESPACHAR</button><button class="btn">PLANTILLA</button></div>
</div></div>'''
open("mensajeria.html","w").write(P.render("Mensajería","MESA CENTRAL","mensajeria",m,mcss))

# ═══ CLIENTES ═══
cbody = K + '<div class="bg-hatchband"></div><div style="padding:24px 26px;display:grid;gap:16px">'
cbody += '''<div style="display:flex;gap:10px">
<input style="flex:1;background:#FFF;border:1.5px solid var(--ink);padding:10px 14px;font-family:var(--body);font-size:13px" placeholder="Buscar por nombre, email o teléfono...">
<button class="btn fill">CANAL ▾</button><button class="btn">ESTADO ▾</button><button class="btn">ETIQUETA ▾</button></div>'''
cbody += '''<div class="calco"><table class="tbl">
<thead><tr><th>ESTADO</th><th>NOMBRE</th><th>CANAL</th><th>ETIQUETAS</th><th>ÚLTIMO CONTACTO</th><th style="text-align:right">HILO</th></tr></thead><tbody>'''
rows = [('<span class="sello g">ACTIVA</span>',"María Cano","WA",'<span class="sello f">curso jul</span>',"Hoy 09:22"),
        ('<span class="sello m">NUEVA</span>',"Tech Store","WA",'<span class="sello f">pedido</span> <span class="sello m">conflicto <span class="cruz"></span></span>',"Hoy 08:30"),
        ('<span class="sello f">INACTIVA</span>',"Laura Pérez","WEB",'<span class="sello f">demo</span>',"Lun 09:12"),
        ('<span class="sello g">ACTIVA</span>',"Andrés Gutiérrez","WA",'<span class="sello f">cita v</span>',"Hoy 08:14")]
for st,nm,ca,et,fc in rows:
    strike = " class='tag-strike' style='font-weight:600'" if "INACTIVA" in st else " style='font-weight:600'"
    cbody += (f'<tr><td>{st}</td><td{strike}>{nm}</td><td class="mono">{ca}</td><td>{et}</td><td class="mono" style="font-size:10px">{fc}</td>'
              '<td style="text-align:right"><a class="btn" href="mensajeria.html">ABRIR HILO</a></td></tr>')
cbody += '''</tbody></table>
<div style="display:flex;padding:12px 16px;gap:8px;font-family:var(--mono);font-size:9px;color:var(--ink-soft)">
<span>4 DE 38 FICHAS · ARCHIVAR, NUNCA BORRAR</span><span style="margin-left:auto">PÁG 1 / 3 ‹ ›</span></div></div></div>'''
open("clientes.html","w").write(P.render("Clientes","EL PADRÓN","clientes",cbody))

# ═══ CEREBRO ═══
rbody = K + '<div class="bg-hatchband"></div><div style="padding:24px 26px;display:grid;gap:18px">'
rbody += '''<div style="display:flex;align-items:end;gap:14px"><div><div class="cond">ARCHIVO DE CONOCIMIENTO</div>
<div style="font-family:var(--cond);font-size:36px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Cerebro · 61 trozos</div></div>
<div style="margin-left:auto;display:flex;gap:10px"><button class="btn">ESCRIBIR TEXTO</button><button class="btn fill">SUBIR ARCHIVO</button></div></div>'''
rbody += '''<div class="calco">
<table class="tbl"><thead><tr><th>FUENTE</th><th>TIPO</th><th>ESTADO</th><th>TROZOS</th><th>OCR</th><th>ÍNDICE</th></tr></thead><tbody>
<tr><td style="font-weight:600">tarifas-sept.pdf</td><td class="mono">PDF · 32 pág</td><td><span class="sello g">INDEXADA</span></td><td class="mono rit" style="text-align:left">42</td><td class="mono" style="font-size:9px">VISION 0.94</td><td>Hoy 08:44</td></tr>
<tr><td style="font-weight:600">politica-devoluciones.txt</td><td class="mono">TXT</td><td><span class="sello g">INDEXADA</span></td><td class="mono" style="text-align:left">11</td><td class="mono" style="font-size:9px">—</td><td>Vie</td></tr>
<tr><td style="font-weight:600">catalogo-julio.pdf</td></tr case>'''.replace('<tr><td style="font-weight:600">catalogo-julio.pdf</td></tr case>','')
rbody += '''<tr><td style="font-weight:600">catalogo-julio.pdf</td><td class="mono">PDF · 64 pág</td><td><span class="sello m">PROCESANDO <span class="hatch l2" style="background:repeating-linear-gradient(45deg,var(--magenta) 0 3px,transparent 3px 6px)"></span></span></td><td class="mono">31/…</td><td class="mono" style="font-size:9px">VISION · p14/64</td><td>—</td></tr>
<tr><td style="font-weight:600">precios-yq.csv</td><td class="mono">CSV</td><td><span class="sello f">FALLADA</span></td><td class="mono" style="text-decoration:line-through">0</td><td class="mono" style="font-size:9px">FALLO CSV</td><td>—</td></tr>
</tbody></table>
<div style="padding:12px 16px;display:flex;gap:14px;font-family:var(--mono);font-size:9px;color:var(--ink-soft)">
<span>TROCEADO: SEMÁNTICO 800 TOK · SOLAPE 100</span><span>RE-RANK: TOP 10 → 3</span><span style="margin-left:auto;color:var(--magenta)">QDRANT · 33 ms · EF 64</span></div></div>
<div class="calco"><div class="ph"><h2>PRUEBA DE CONSULTA</h2><span class="sub">sin indexar</span></div>
<div style="padding:14px 18px;display:flex;gap:10px"><input style="flex:1;border:1.5px solid var(--ink);padding:10px 13px;font-family:var(--body);font-size:13px" placeholder="¿Cuánto cuesta la matrícula del curso de julio?">
<button class="btn fill">CONSULTAR</button></div>
<div style="padding:0 18px 16px;display:flex;flex-direction:column;gap:8px">
<div style="border:1px solid var(--hair);background:#FFF;padding:9px 12px;font-size:12px"><b class="mono" style="font-size:9px;color:var(--green)">MATCH 0.88 · tarifas-sept.pdf pág. 4</b><br>La matrícula del curso de julio es de $480.000 e incluye material didáctico y certificado.</div>
<div style="border:1px solid var(--hair);background:#FFF;padding:9px 12px;font-size:12px"><b class="mono" style="font-size:9px;color:var(--ink-soft)">MATCH 0.71 · politica-devoluciones.txt</b><br>El plazo de devolución es de 14 días naturales desde la compra.</div>
</div></div></div>'''
open("cerebro.html","w").write(P.render("Cerebro","ARCHIVO","cerebro",rbody))

# ═══ AGENTES ═══
abody = K + '<div class="bg-hatchband"></div><div style="padding:24px 26px;display:grid;gap:18px;max-width:900px">'
abody += '''<div class="calco"><div class="ph"><h2>Agente en custodia</h2><span class="sub">1 activo por proyecto</span></div>
<div style="padding:18px;display:grid;grid-template-columns:1fr 1fr;gap:22px">
<div>
<div class="fld"><label>Nombre del agente</label><input value="Martina"></div>
<div class="fld"><label>Rol</label><input value="Asistente de matrícula del taller"></div>
<div class="fld"><label>Idioma</label><select><option>Español</option><option>Inglés</option></select></div>
<div class="fld"><label>Tono</label><select><option>Cercano, técnico sin jerga</option></select></div>
</div><div>
<div class="fld"><label>Mensaje de bienvenida (el bot lo dice con lo suyo)</label><textarea rows="2">Aprende qué trae el operador... </textarea></div>
<div class="fld"><label>Fallback cuando no sabe</label><input value="Pasar el cordón al operador humano"></div>
<div class="fld"><label>Emojis</label><select><option>Pocos, con intención</option></select></div>
</div></div>
<div style="border-top:2px solid var(--ink);padding:12px 18px;display:flex;gap:10px;align-items:center">
<span class="cond">HERRAMIENTAS HABILITADAS</span>
<span class="sello g">create_appointment</span><span class="sello g">create_order</span><span class="sello f">get_tema FAQ</span><span class="sello f">transfer_to_human</span><span class="sello f">send_notification</span>
<button class="btn" style="margin-left:auto">GUARDAR PLANTILLA</button></div></div>
<div class="calco"><div class="ph"><h2>Modelos en servicio</h2><span class="sub">del entorno, solo lectura</span></div>
<div style="padding:14px 18px;font-family:var(--mono);font-size:10px;letter-spacing:.08em;display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
<span>CHAT<br><b>Qwen3 · 80B</b></span><span>EMBEDDINGS<br><b>text-emb-3-small</b></span><span>OCR<br><b>Gemini-3.8-Flash</b></span></div></div></div>'''
open("agentes.html","w").write(P.render("Agentes","PLANTILLA","agentes",abody))

# ═══ AJUSTES ═══
justs = K + '<div class="bg-hatchband"></div><div style="padding:24px 26px;display:grid;gap:18px;max-width:900px">'
justs += '''<div class="calco"><div class="ph"><h2>Canales del proyecto</h2></div>
<div style="padding:14px 18px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px">
<div style="border:1px solid var(--hair);padding:14px;display:flex;flex-direction:column;gap:8px"><b style="font-family:var(--cond);letter-spacing:.16em">WHATSAPP</b><span class="cond" style="color:var(--green)"?>● ENGANCHADO</span><span class="mono" style="font-size:9px;color:var(--ink-soft)">APABYardTURN, living</span></div>
<div style="border:1px solid var(--hair);padding:14px"><b style="font-family:var(--cond);letter-spacing:.16em">INSTAGRAM</b><br><span class="mono" style="font-size:9px;color:var(--ink-soft)">VÍA OPENROUTER? NO: META API</span></div>
<div style="border:1.5px dashed var(--magenta);padding:14px"><b style="font-family:var(--cond);letter-spacing:.16em">WEB</b><br><span class="mono" style="font-size:9px;color:var(--magenta)">WIDGET POR LIGAR · slug /mateo</span></div>
</div></div>'''
justs += '''<div class="calco"><div class="ph"><h2>Identidad de la mesa</h2><span class="sub">por proyecto · live</span></div>
<div style="padding:16px 18px;display:grid;grid-template-columns:auto 1fr;gap:18px;align-items:center">
<div style="width:52px;height:52px;background:var(--ink);color:#F3EFE7;border-radius:2px;display:grid;place-items:center;font-family:var(--cond);font-size:24px">EM</div>
<div><div class="fld" style="margin:0"><label>Color del proyecto (una sola variable en todo el sistema)</label>
<div style="display:flex;align-items:center;gap:10px"><span style="width:26px;height:26px;background:var(--magenta);border-radius:2px;display:inline-block"></span>
<input value="#C13A7C" style="width:110px;border:1.5px solid var(--ink);padding:8px 10px;font-family:var(--mono);font-size:11px;background:#FFF"></div></div>
<div class="cond" style="margin-top:6px">TOCA EL COLOR Y TODO EL SISTEMA SE RE-TINDE … pedida del cliente en su mesa</div></div></div></div>'''
justs += '''<div class="calco"><div class="ph"><h2>Opciones</h2></div>
<div style="padding:14px 18px;display:flex;flex-direction:column;gap:10px;font-size:13px">
<label style="display:flex;gap:10px"><input type="checkbox" checked> Crear contacto al contestar el primer mensaje</label>
<label style="display:flex;gap:10px"><input type="checkbox" checked> Modo auto_pilot por defecto</label>
<label style="display:flex;gap:10px"><input type="checkbox"> Mostrar errores del bot como mensajes en el hilo</label></div></div>'''
justs += '''<div class="calco" style="opacity:.75"><div class="ph"><h2>Identidad visual (fontanería)</h2><span class="sub">hijas del sistema global</span></div>
<div style="padding:14px 18px;font-family:var(--mono);font-size:9px;letter-spacing:.16em;color:var(--ink-soft)">EL RESTO DE TOKENS (TIPOGRAFÍA, PAPEL, HAIRLINES) SON DEL SISTEMA, NO DEL PROYECTO</div></div>'''
open("ajustes.html","w").write(P.render("Ajustes","ACOMETIDAS","ajustes",justs))

# ═══ USUARIOS ═══
ubody = K + '<div class="bg-hatchband"></div><div style="padding:24px 26px;display:grid;gap:16px">'
ubody += '''<div style="display:flex;gap:10px"><input style="flex:1;border:1.5px solid var(--ink);padding:10px 14px;background:#FFF;font-size:13px;font-family:var(--body)" placeholder="Buscar usuario...">
<button class="btn fill">+ NUEVO</button></div>
<div class="calco"><table class="tbl"><thead><tr><th>NOMBRE</th><th>EMAIL</th><th>ROL</th><th>ESTADO</th><th>PROYECTOS</th><th style="text-align:right">ACCIONES</th></tr></thead><tbody>
<tr><td style="font-weight:600">Jorge Daza</td><td class="mono" style="font-size:10px">jorge@estudiomateo.io</td><td><span class="sello invert">ADMIN</span></td><td><span class="sello g">ACTIVO</span></td><td class="mono" style="font-size:10px">2</td><td style="text-align:right"><button class="btn">EDITAR</button></td></tr>
<tr><td style="font-weight:600">Lucía Ferrer</td><td class="mono" style="font-size:10px">lucia@estudiomateo.io</td><td><span class="sello f">SUPPORT</span></td><td><span class="sello g">ACTIVO</span></td><td class="mono" style="font-size:10px">1</td><td style="text-align:right"><button class="btn">EDITAR</button></td></tr>
<tr><td style="font-weight:600" class="tag-strike">Diego Roldán</td><td class="mono tag-strike" style="font-size:10px">diego@…</td><td><span class="sello f">ASSISTANT</span></td><td><span class="sello k" style="border-color:var(--red);color:var(--red)">DESACT.</span></td><td class="mono" style="font-size:10px">1</td><td style="text-align:right"><button class="btn">EDITAR</button></td></tr>
</tbody></table></div></div>'''
open("usuarios.html","w").write(P.render("Usuarios","EL ROL","usuarios",ubody))

# ═══ PERFIL ═══
pbody = K + '<div class="bg-hatchband"></div><div style="padding:24px 26px;display:grid;gap:18px;max-width:760px">'
pbody += '''<div class="calco"><div class="ph"><h2>Ficha del operador</h2></div>
<div style="padding:18px;display:grid;grid-template-columns:64px 1fr;gap:18px;align-items:center">
<div style="width:64px;height:64px;background:var(--ink);color:#F3EFE7;display:grid;place-items:center;font-family:var(--cond);font-size:26px">JD</div>
<div><div style="font-family:var(--cond);font-size:22px;font-weight:600;letter-spacing:.06em">JORGE DAZA</div><div class="cond" style="color:var(--ink-soft)">ADMIN · 2 PROYECTOS · ESTUDIO MATEO</div></div></div>
<div style="border-top:2px solid var(--ink);padding:18px;display:grid;grid-template-columns:1fr 1fr;gap:16px">
<div class="fld"><label>Nombre</label><input value="Jorge Daza"></div>
<div class="fld"><label>Email</label><input value="jorge@estudiomateo.io"></div>
<div class="fld"><label>Contraseña</label><input type="password" value="does-not-matter"></div>
<div class="fld"><label>Idioma del panel</label><select><option>Español</option><option>Inglés</option></select></div>
</div><div style="border-top:2px solid var(--ink);padding:12px 18px;display:flex"><button class="btn key" style="margin-left:auto"><i></i>SALVAR FICHA</button></div></div></div>'''
open("perfil.html","w").write(P.render("Perfil","FICHA PERSONAL","perfil",pbody))

# ═══ LOGIN ═══
lbody = '''<div style="min-height:100vh;display:grid;place-items:center;background:var(--paper)">
<div style="width:min(420px,92vw);padding:34px 34px 30px;background:var(--paper-hi);border:1.5px solid var(--ink);box-shadow:6px 6px 0 var(--magenta)">
<div class="bg-hatchband" style="margin:-34px -34px 22px"></div>
<div style="font-family:var(--cond);font-size:30px;font-weight:600;letter-spacing:.1em;text-transform:uppercase">Entrada del operador</div>
<div class="cond" style="margin:6px 0 20px">PLACA 01 · MITCHBOT</div>
<div class="fld"><label>Correo</label><input value="jorge@estudiomateo.io"></div>
<div class="fld"><label>Contraseña</label><input type="password" value="dont-touch"></div>
<button class="btn fill" style="width:100%;padding:13px">ENTRAR CON LLAVE</button>
<div class="cond" style="margin-top:14px;text-align:center">EL TURNO EMPIEZA EN LA MESA, NO AQUÍ</div></div></div>'''
open("login.html","w").write(P.render("Login","ENTRADA","login",lbody).replace('<main>','<main style="margin:0">').split("<main>")[0] + lbody + "</body></html>")

# ═══ SETUP (onboarding 3 pasos) ═══
sbody = '''<div style="min-height:100vh;display:grid;place-items:center;background:var(--paper)">
<div style="width:min(680px,94vw)">
<div class="cond" style="margin-bottom:16px">PUESTA EN MESA · PASO 2 DE 3</div>
<div style="display:flex;gap:6px;margin-bottom:18px">
<div style="flex:1;height:5px;background:var(--ink)"></div><div style="flex:1;height:5px;background:var(--magenta)"></div><div style="flex:1;height:5px;background:var(--hair)"></div></div>
<div class="calco">
<div class="ph"><h2>El agente del negocio</h2><span class="sub">paso 2 · 3</span></div>
<div style="padding:18px;display:grid;grid-template-columns:1fr 1fr;gap:16px">
<div class="fld"><label>Su nombre</label><input value="Martina"></div>
<div class="fld"><label>Rol</label><input value="Atención de matrícula"></div>
<div class="fld" style="grid-column:1fr;grid-column:1 / -1"><label>Su forma (redacción)</label>
<input value="Cercana: como tu compi del gremio, técnica y sin jerga"></div>
<div class="fld"><label>Idioma</label><select><option>Español</option></select></div>
<div class="fld"><label>Emojis</label><select><option>Pocos, con intención</option></select></div></div>
<div style="border-top:2px solid var(--ink);padding:12px 18px;display:flex;gap:10px">
<button class="btn" style="margin-left:auto">VOLVER</button><a class="btn fill" href="dashboard.html">SIGUIENTE: CANALES →</a></div></div></div></div>'''
open("setup.html","w").write(sbody)

# ═══ CHAT PÚBLICO ═══
cssp = """.pub{min-height:100vh;padding:26px;display:grid;place-items:center;background:var(--paper)}
.pubh{width:min(560px,96vw);border:1.5px solid var(--ink);background:var(--paper-hi);display:grid;grid-template-rows:auto 1fr auto;height:min(700px,92vh)}
.pt.head{display:grid}"""
chat = '''<div class="pub">
<div class="pubh">
<div class="ph" style="padding:14px 18px;border-bottom:2px solid var(--ink)">
<div style="display:flex;align-items:center;gap:10px">
<div style="width:34px;height:34px;background:var(--ink);color:#F3EFE7;display:grid;place-items:center;font-family:var(--cond);font-size:18px">EM</div>
<div><b style="font-weight:600">Estudio Mateo</b><br><span class="cond">MARTINA · ATENDE LA MESA</span></div>
<span class="sello m" style="margin-left:auto">TIRA ABIERTA</span></div></div>
<div class="thread" style="padding:16px;display:flex;flex-direction:column;gap:9px;min-height:0">
<div class="msg" style="border:1px solid var(--hair);background:#FFF;align-self:flex-start">¿El curso de julio tiene matrícula libre?</div>
<div class="msg b" style="align-self:flex-end;background:var(--ink);color:#F3EFE7">¡Hola! Sí, quedan <b>dos cupos</b> de 14. ¿Te comparto los horarios?</div>
<div class="msg" style="border:1px solid var(--hair);background:#FFF;align-self:flex-start">Sí porfa, y ¿ hay intensivo de mañana?</div>
<div class="nota">· MARTINA ESTÁ CONTESTANDO · <span class="hatch l1"></span></div>
</div>
<div class="tray"><input placeholder="Escribe a Martina..."><button class="btn key"><i></i>SEND</button></div>
</div></div>'''
open("chat-publico.html","w").write(chat)

# ═══ PRUEBAS (/dev) ═══
t = K + '<div class="bg-hatchband"></div><div style="padding:24px 26px;display:grid;gap:16px;max-width:860px">'
t += '''<div class="calco"><div class="ph"><h2>BANCO DE PRUEBAS · EXTRACCIÓN</h2><span class="sub">inaccessible sin login · no indexa nada</span></div>
<div style="padding:16px 18px;display:grid;gap:12px">
<div class="fld"><label>Modelo con file (del entorno)</label><input value="Gemini · vision file · Bridgetown" disabled></div>
<div style="display:flex;gap:10px"><button class="btn fill">SUBIR FICHA DE PRUEBA</button><button class="btn">MONTAR URL</button></div>
<div style="border:1px dashed var(--hair);padding:12px 14px;font-family:var(--mono);font-size:10px;line-height:1.7">
ÚLTIMAS TIRADAS:<br>
· prueba-carnet.jpg · texto 214 car · confidence 0.91 · 1.4 s<br>
<span style="text-decoration:line-through">rotulo-lila.png · vacía · 0.00</span></div>
</div></div></div>'''
open("pruebas.html","w").write(P.render("Banco","BANCO INTERNO","pruebas",t))

print("Generated:", sorted(PAGES_PAGE_NAMES := list(
    [k for k in ["dashboard.html","mensajeria.html","clientes.html","cerebro.html","agentes.html","ajustes.html","usuarios.html","perfil.html","login.html","setup.html","chat-publico.html","pruebas.html"] if os.path.exists(k)])))
