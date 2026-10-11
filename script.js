
const CONFIG = {
  nombre: 'El Comal Dorado',
  // Número de WhatsApp con código de país y sin signos ni espacios. Ejemplo: '50370001234'
  // Si lo dejas vacío, WhatsApp pedirá elegir a quién enviar el mensaje.
  whatsapp: '',
  moneda: '$',
  zonaHoraria: 'America/El_Salvador',
  // Horario por día: 0 = domingo ... 6 = sábado. Formato [apertura, cierre] en 24 h. null = cerrado.
  horario: {
    0: ['14:00', '21:00'],
    1: null,
    2: ['16:00', '21:30'],
    3: ['16:00', '21:30'],
    4: ['16:00', '21:30'],
    5: ['15:00', '23:00'],
    6: ['15:00', '23:00']
  },
  segundosCarrusel: 5.5
};

/* 2. UTILIDADES ------------------------------------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const dinero = (n) => CONFIG.moneda + n.toFixed(2);
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const aMinutos = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const aTexto12h = (min) => {
  const h = Math.floor(min / 60), m = min % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return h12 + ':' + String(m).padStart(2, '0') + ' ' + (h >= 12 ? 'pm' : 'am');
};
const waBase = () => 'https://wa.me/' + (CONFIG.whatsapp || '');

/* 3. MENÚ MÓVIL ------------------------------------------- */
(function initMenu() {
  const btn = $('#menuBtn'), nav = $('#nav');
  btn.addEventListener('click', () => {
    const abierto = nav.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(abierto));
  });
  nav.addEventListener('click', (e) => {
    if (e.target.closest('a')) { nav.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
  });
})();

/* 4. HORARIOS --------------------------------------------- */
(function initHorarios() {
  // Hora actual en la zona horaria del negocio
  function ahora() {
    const mapa = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    try {
      const partes = new Intl.DateTimeFormat('en-US', {
        timeZone: CONFIG.zonaHoraria, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23'
      }).formatToParts(new Date());
      const o = {};
      partes.forEach((p) => { o[p.type] = p.value; });
      return { dia: mapa[o.weekday], min: (parseInt(o.hour, 10) % 24) * 60 + parseInt(o.minute, 10) };
    } catch (e) {
      const d = new Date();
      return { dia: d.getDay(), min: d.getHours() * 60 + d.getMinutes() };
    }
  }

  const t = ahora();

  // Tabla de horarios (de lunes a domingo)
  const cuerpo = $('#hoursBody');
  [1, 2, 3, 4, 5, 6, 0].forEach((d) => {
    const h = CONFIG.horario[d];
    const tr = document.createElement('tr');
    if (d === t.dia) tr.className = 'today';
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = DIAS[d].charAt(0).toUpperCase() + DIAS[d].slice(1);
    const td = document.createElement('td');
    if (h) { td.textContent = aTexto12h(aMinutos(h[0])) + ' – ' + aTexto12h(aMinutos(h[1])); }
    else { td.textContent = 'Cerrado'; td.className = 'off'; }
    tr.append(th, td);
    cuerpo.append(tr);
  });

  // Letrero "Abierto ahora / Cerrado"
  const caja = $('#status'), texto = $('#statusText');
  const hoy = CONFIG.horario[t.dia];
  if (hoy && t.min >= aMinutos(hoy[0]) && t.min < aMinutos(hoy[1])) {
    caja.className = 'status open';
    texto.textContent = 'Abierto ahora · cerramos a las ' + aTexto12h(aMinutos(hoy[1]));
    return;
  }
  let msg = '';
  for (let k = 0; k < 8; k++) {
    const d = (t.dia + k) % 7, h = CONFIG.horario[d];
    if (h && (k > 0 || t.min < aMinutos(h[0]))) {
      const cuando = k === 0 ? 'hoy' : (k === 1 ? 'mañana' : 'el ' + DIAS[d]);
      msg = 'abrimos ' + cuando + ' a las ' + aTexto12h(aMinutos(h[0]));
      break;
    }
  }
  caja.className = 'status closed';
  texto.textContent = 'Cerrado ahora · ' + msg;
})();

/* 5. CARRUSEL --------------------------------------------- */
(function initCarrusel() {
  const raiz = $('#carousel'), pista = $('#track'), vista = $('.viewport', raiz);
  const slides = Array.from(pista.children);
  const puntos = $('#dots');
  const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let actual = 0, timer = null, pausadoPorUsuario = reducido, pausadoTemporal = false;

  // Puntos de navegación
  const botonesPunto = slides.map((_, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', 'Ir a la diapositiva ' + (i + 1));
    b.addEventListener('click', () => { ir(i); reiniciar(); });
    puntos.append(b);
    return b;
  });

  // Botón pausar / reanudar (necesario para accesibilidad)
  const pp = document.createElement('button');
  pp.type = 'button';
  pp.className = 'pp';
  puntos.append(pp);
  function textoPP() { pp.textContent = pausadoUsuarioTxt(); }
  function pausadoUsuarioTxt() { return pausadoPorUsuario ? 'Reanudar' : 'Pausar'; }
  pp.addEventListener('click', () => { pausadoPorUsuario = !pausadoPorUsuario; textoPP(); reiniciar(); });
  textoPP();

  function ir(n) {
    actual = (n + slides.length) % slides.length;
    pista.style.transform = 'translateX(-' + actual * 100 + '%)';
    slides.forEach((s, k) => { s.inert = k !== actual; });
    botonesPunto.forEach((b, k) => { b.setAttribute('aria-current', String(k === actual)); });
  }
  function avanzar() { ir(actual + 1); }
  function detener() { clearInterval(timer); timer = null; }
  function iniciar() {
    detener();
    if (pausadoPorUsuario || pausadoTemporal || document.hidden) return;
    timer = setInterval(avanzar, CONFIG.segundosCarrusel * 1000);
  }
  function reiniciar() { iniciar(); }

  $('#prev').addEventListener('click', () => { ir(actual - 1); reiniciar(); });
  $('#next').addEventListener('click', () => { ir(actual + 1); reiniciar(); });

  // Pausa mientras el mouse o el teclado están sobre el carrusel
  raiz.addEventListener('mouseenter', () => { pausadoTemporal = true; iniciar(); });
  raiz.addEventListener('mouseleave', () => { pausadoTemporal = false; iniciar(); });
  raiz.addEventListener('focusin', () => { pausadoTemporal = true; iniciar(); });
  raiz.addEventListener('focusout', () => { pausadoTemporal = false; iniciar(); });
  document.addEventListener('visibilitychange', iniciar);

  // Flechas del teclado
  raiz.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { ir(actual - 1); reiniciar(); }
    if (e.key === 'ArrowRight') { ir(actual + 1); reiniciar(); }
  });

  // Deslizar con el dedo
  let x0 = null;
  vista.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
  vista.addEventListener('pointerup', (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 50) { ir(dx < 0 ? actual + 1 : actual - 1); reiniciar(); }
  });
  vista.addEventListener('pointercancel', () => { x0 = null; });

  ir(0);
  iniciar();
})();

/* 6. FILTROS ---------------------------------------------- */
(function initFiltros() {
  const chips = $$('.chip', $('#filters'));
  const tarjetas = $$('.card', $('#cards'));
  const vacio = $('#empty');
  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const f = chip.dataset.filter;
      chips.forEach((c) => {
        const activo = c === chip;
        c.classList.toggle('is-active', activo);
        c.setAttribute('aria-pressed', String(activo));
      });
      let visibles = 0;
      tarjetas.forEach((t) => {
        const ok = f === 'todas' || t.dataset.tags.split(' ').includes(f);
        t.hidden = !ok;
        if (ok) visibles++;
      });
      vacio.hidden = visibles > 0;
    });
  });
})();

/* 7. PEDIDO (CARRITO) ------------------------------------- */
(function initPedido() {
  const KEY = 'comal-dorado-pedido';
  const drawer = $('#drawer'), scrim = $('#scrim');
  const lista = $('#lines'), vacio = $('#drawerEmpty');
  const totalEl = $('#total'), contador = $('#cartCount');
  const enviar = $('#sendWa'), toast = $('#toast');
  let pedido = {};   // { id: { id, nombre, precio, cant } }
  let toastTimer = null;

  // Guardado en el navegador (si no está disponible, el pedido funciona igual)
  function cargar() {
    try { pedido = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { pedido = {}; }
  }
  function guardar() {
    try { localStorage.setItem(KEY, JSON.stringify(pedido)); } catch (e) { /* sin almacenamiento */ }
  }

  function mostrarToast(texto) {
    toast.textContent = texto;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
  }

  function dibujar() {
    const items = Object.values(pedido);
    const cantidad = items.reduce((s, i) => s + i.cant, 0);
    const total = items.reduce((s, i) => s + i.cant * i.precio, 0);

    lista.textContent = '';
    items.forEach((i) => {
      const li = document.createElement('li');
      li.className = 'line';
      const nombre = document.createElement('span');
      nombre.className = 'ln';
      nombre.textContent = i.nombre;
      const sub = document.createElement('span');
      sub.className = 'lp';
      sub.textContent = dinero(i.cant * i.precio);
      const qty = document.createElement('div');
      qty.className = 'qty';
      const menos = document.createElement('button');
      menos.type = 'button'; menos.textContent = '−';
      menos.dataset.act = 'menos'; menos.dataset.id = i.id;
      menos.setAttribute('aria-label', 'Quitar una ' + i.nombre);
      const n = document.createElement('span');
      n.textContent = i.cant;
      const mas = document.createElement('button');
      mas.type = 'button'; mas.textContent = '+';
      mas.dataset.act = 'mas'; mas.dataset.id = i.id;
      mas.setAttribute('aria-label', 'Agregar una ' + i.nombre);
      qty.append(menos, n, mas);
      li.append(nombre, sub, qty);
      lista.append(li);
    });

    vacio.hidden = items.length > 0;
    totalEl.textContent = dinero(total);
    contador.textContent = cantidad;
    contador.hidden = cantidad === 0;

    // Enlace de WhatsApp con el resumen del pedido
    if (items.length === 0) {
      enviar.href = waBase();
      enviar.setAttribute('aria-disabled', 'true');
    } else {
      const lineas = items.map((i) => '- ' + i.cant + ' x ' + i.nombre + ' (' + dinero(i.cant * i.precio) + ')');
      const texto = 'Hola, quiero hacer este pedido en ' + CONFIG.nombre + ':\n' + lineas.join('\n') + '\nTotal: ' + dinero(total);
      enviar.href = waBase() + '?text=' + encodeURIComponent(texto);
      enviar.setAttribute('aria-disabled', 'false');
    }
  }

  function agregar(id, nombre, precio) {
    if (!pedido[id]) pedido[id] = { id, nombre, precio, cant: 0 };
    pedido[id].cant += 1;
    guardar(); dibujar();
  }
  function cambiar(id, delta) {
    if (!pedido[id]) return;
    pedido[id].cant += delta;
    if (pedido[id].cant <= 0) delete pedido[id];
    guardar(); dibujar();
  }

  // Botones "Agregar" de las tarjetas
  $('#cards').addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-add');
    if (!btn) return;
    const card = btn.closest('.card');
    agregar(card.dataset.id, card.dataset.name, parseFloat(card.dataset.price));
    mostrarToast('Agregado: ' + card.dataset.name);
    btn.classList.add('added');
    btn.textContent = 'Agregada';
    setTimeout(() => { btn.classList.remove('added'); btn.textContent = 'Agregar'; }, 1200);
  });

  // + y − dentro del panel
  lista.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    cambiar(b.dataset.id, b.dataset.act === 'mas' ? 1 : -1);
  });

  $('#clearCart').addEventListener('click', () => { pedido = {}; guardar(); dibujar(); });

  // Abrir y cerrar el panel
  const abrirBtn = $('#cartOpen'), cerrarBtn = $('#cartClose');
  function abrir() {
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    scrim.hidden = false;
    document.body.style.overflow = 'hidden';
    cerrarBtn.focus();
  }
  function cerrar() {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    scrim.hidden = true;
    document.body.style.overflow = '';
    abrirBtn.focus();
  }
  abrirBtn.addEventListener('click', abrir);
  cerrarBtn.addEventListener('click', cerrar);
  scrim.addEventListener('click', cerrar);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawer.classList.contains('open')) cerrar(); });
  enviar.addEventListener('click', (e) => { if (enviar.getAttribute('aria-disabled') === 'true') e.preventDefault(); });

  // Enlace de WhatsApp del pie de página
  $('#waLink').href = waBase();

  cargar();
  dibujar();
})();

/* 8. EXTRAS ------------------------------------------------ */
(function initExtras() {
  $('#year').textContent = new Date().getFullYear();

  const btn = $('#copyPhone'), tel = $('#phone');
  btn.addEventListener('click', () => {
    const fin = (ok) => {
      btn.textContent = ok ? 'Copiado' : 'Selecciona el número';
      setTimeout(() => { btn.textContent = 'Copiar'; }, 2000);
    };
    const seleccionar = () => {
      try {
        const r = document.createRange();
        r.selectNodeContents(tel);
        const s = window.getSelection();
        s.removeAllRanges(); s.addRange(r);
      } catch (e) { /* nada */ }
      fin(false);
    };
    try {
      navigator.clipboard.writeText(tel.textContent).then(() => fin(true), seleccionar);
    } catch (e) { seleccionar(); }
  });
})();
