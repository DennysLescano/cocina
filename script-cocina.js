// ✅ MÓDULO COMPLETO PARA COCINA
// (Lee pedidos y pedidosOnline, muestra comentarios, totales y controla urgencia)

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
  update,
  get
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

// 🔧 Configuración Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAYXlV5SEgWfbRtacAEjec2Ve8x6hJtNBA",
  authDomain: "proyecto-restaurante-60eb0.firebaseapp.com",
  databaseURL: "https://proyecto-restaurante-60eb0-default-rtdb.firebaseio.com",
  projectId: "proyecto-restaurante-60eb0",
  storageBucket: "proyecto-restaurante-60eb0.appspot.com",
  messagingSenderId: "459872565031",
  appId: "1:459872565031:web:1633ecd0beb3c98a7c5b02"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// ⚙️ Parámetros de funcionalidad
const UMBRAL_URGENCIA_MIN = 1;
const SONIDO_RUTA = "noti.mp3";
const DESTACAR_NUEVO_MS = 5000;

// 📌 Elementos del DOM
const loginSection = document.getElementById("loginSection");
const cocinaSection = document.getElementById("cocinaSection");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const listaPedidos = document.getElementById("listaPedidos");

ensureTopControls();

const activarSonidoBtn = document.getElementById("activarSonidoBtn");

// 🔔 Sonido
let sonidoActivo = false;
let audioPedido = null;

// ✅ FUNCIÓN DE NOTIFICACIONES TOAST PERSONALIZADAS
function showToast(mensaje, tipo = "info") {
  const contenedor = document.getElementById("toastContainer");
  if (!contenedor) return;

  const toast = document.createElement("div");
  toast.className = `toast ${tipo}`;
  toast.textContent = mensaje;
  contenedor.appendChild(toast);

  // Mostrar
  setTimeout(() => toast.classList.add("show"), 100);

  // Ocultar y eliminar
  setTimeout(() => {
    toast.style.animation = "fadeOut 0.5s forwards";
    setTimeout(() => toast.remove(), 500);
  }, 4000);
}

function showConfirmToast(mensaje, onConfirm) {
  const overlay = document.createElement("div");
  overlay.className = "confirm-toast-overlay";

  overlay.innerHTML = `
    <div class="confirm-toast">
      <div class="confirm-toast-message">${mensaje}</div>
      <div class="confirm-toast-actions">
        <button class="toast-btn cancel">Cancelar</button>
        <button class="toast-btn confirm">Confirmar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const btnCancel = overlay.querySelector(".cancel");
  const btnConfirm = overlay.querySelector(".confirm");

  btnCancel.onclick = () => overlay.remove();
  btnConfirm.onclick = () => {
    overlay.remove();
    onConfirm();
  };

  // Cerrar tocando fondo
  overlay.addEventListener("click", e => {
    if (e.target === overlay) overlay.remove();
  });
}



// 🔘 Botón para activar sonido
activarSonidoBtn?.addEventListener("click", async () => {
  try {
    if (!audioPedido) audioPedido = new Audio(SONIDO_RUTA);
    sonidoActivo = true;
    activarSonidoBtn.textContent = "🔊 Sonido activado";
    activarSonidoBtn.disabled = true;

    await audioPedido.play().catch(() => {});
    if (!audioPedido.paused) {
      audioPedido.pause();
      audioPedido.currentTime = 0;
    }
    showToast("🔊 Notificaciones sonoras activadas", "info");
  } catch (e) {
    sonidoActivo = true;
    activarSonidoBtn.textContent = "🔊 Sonido activado (beep)";
    activarSonidoBtn.disabled = true;
    showToast("🔔 Notificaciones activadas (modo básico)", "info");
  }
});

function reproducirSonidoNuevoPedido() {
  if (!sonidoActivo) return;
  if (audioPedido) {
    audioPedido.currentTime = 0;
    audioPedido.play().catch(() => beepFallback());
  } else beepFallback();
}

function beepFallback() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "triangle";
    osc.frequency.value = 750;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
    osc.start();
    setTimeout(() => {
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
      setTimeout(() => {
        osc.stop();
        ctx.close();
      }, 220);
    }, 200);
  } catch (e) {
    console.warn("Beep fallback no disponible:", e);
  }
}

// 🧩 Utilidades
function getTimestampPedido(pedido) {
  return (
    pedido?.timestamp ??
    pedido?.creadoEn ??
    pedido?.createdAt ??
    pedido?.fechaCreacion ??
    pedido?.fecha ??
    pedido?.ts ??
    0
  );
}

function minutosTranscurridos(ts) {
  return ts ? (Date.now() - ts) / 60000 : 0;
}

function esUrgentePorItems(items) {
  if (!items || items.length === 0) return false;

  return items.some(item => {
    if (!item.creadoEn) return false;
    const mins = (Date.now() - item.creadoEn) / 60000;
    return mins >= UMBRAL_URGENCIA_MIN;
  });
}


// ✅ Combina pedidos locales y online
function combinarPedidos(pedidosLocal, pedidosOnline) {
  const todos = {};
  if (pedidosLocal)
    Object.entries(pedidosLocal).forEach(([mesa, pedido]) => (todos[`M${mesa}`] = pedido));
  if (pedidosOnline)
    Object.entries(pedidosOnline).forEach(([id, pedido]) => (todos[`O-${id}`] = pedido));
  return todos;
}

/// 🖼️ Render de pedidos (COCINA)
function renderizarPedidos(pedidos) {
  listaPedidos.innerHTML = "";

  const arreglo = Object.keys(pedidos)
    .map(key => ({
      id: key,
      pedido: pedidos[key],
      ts: getTimestampPedido(pedidos[key])
    }))
    .sort((a, b) => (a.ts || 0) - (b.ts || 0));

  const firmaActual = {};

  arreglo.forEach(({ id, pedido }) => {

    // 🔹 SOLO PLATOS y SOLO SI FALTAN PREPARAR
    const itemsPendientes = (pedido.items || [])
      .map((item, index) => ({ ...item, index }))
      .filter(item =>
        item.categoria === "plato" &&
        (item.cantidadLista || 0) < (item.cantidad || 1)
      );

    if (itemsPendientes.length === 0) return;

    const contenedor = document.createElement("div");
    contenedor.classList.add("mesa");
    contenedor.dataset.id = id;
    // Timestamp ahora basado en el item pendiente más antiguo
const tsMasAntiguo = itemsPendientes
  .map(i => i.creadoEn || 0)
  .filter(Boolean)
  .sort((a, b) => a - b)[0] || 0;

contenedor.dataset.timestamp = tsMasAntiguo;


    const esOnline = id.startsWith("O-");
    const fecha = getTimestampPedido(pedido)
      ? new Date(getTimestampPedido(pedido)).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

    const titulo = document.createElement("h3");
    titulo.textContent = esOnline
      ? `💻 Pedido Online • ${fecha}`
      : `🍽️ Mesa ${pedido.mesa || "—"} • ${pedido.mesero || "—"} • ${fecha}`;
    titulo.style.color = esOnline ? "#00b7ff" : "#333";
    contenedor.appendChild(titulo);

    const ul = document.createElement("ul");
    ul.classList.add("lista-platos");

    itemsPendientes.forEach(item => {
      const li = document.createElement("li");
      li.classList.add("pedido-item");

      const check = document.createElement("input");
      check.type = "checkbox";
      check.dataset.id = id;
      check.dataset.index = item.index;

      check.onchange = e => {
        const pid = e.target.dataset.id;
        const idx = parseInt(e.target.dataset.index);

        if (!productosSeleccionados[pid]) {
          productosSeleccionados[pid] = [];
        }

        if (e.target.checked) {
          if (!productosSeleccionados[pid].includes(idx)) {
            productosSeleccionados[pid].push(idx);
          }
        } else {
          productosSeleccionados[pid] =
            productosSeleccionados[pid].filter(x => x !== idx);
        }
      };

      const cantidadTotal = item.cantidad || 1;
      const cantidadLista = item.cantidadLista || 0;
      const faltan = cantidadTotal - cantidadLista;

      const comentario =
        item.comentario && item.comentario.trim() !== ""
          ? ` 📝 ${item.comentario}`
          : "";

      const texto = document.createElement("span");
      texto.textContent =
        `${item.nombre} (${cantidadLista}/${cantidadTotal})` +
        ` → faltan ${faltan}` +
        comentario;

      li.appendChild(check);
      li.appendChild(texto);
      ul.appendChild(li);
    });

    contenedor.appendChild(ul);

    const totalTxt = document.createElement("p");
    totalTxt.innerHTML = `<b>Total:</b> S/ ${(pedido.total || 0).toFixed(2)}`;
    contenedor.appendChild(totalTxt);

    const boton = document.createElement("button");
    boton.textContent = "Marcar como listo";
    boton.classList.add("btn-listo");
    boton.onclick = () => marcarListo(id, pedido);
    contenedor.appendChild(boton);


const botonTodo = document.createElement("button");
botonTodo.textContent = "Marcar todo listo";
botonTodo.classList.add("btn-listo-todo");
botonTodo.onclick = () => marcarTodoListo(id);
contenedor.appendChild(botonTodo);

   if (esUrgentePorItems(itemsPendientes)) {
  contenedor.classList.add("urgente");
}


    listaPedidos.appendChild(contenedor);

    // 🔔 Notificación de nuevos platos
    firmaActual[id] = itemsPendientes.length;
    const antes = firmaAnterior[id] ?? 0;

    if (!primeraCarga && firmaActual[id] > antes) {
      contenedor.classList.add("nuevo");
      reproducirSonidoNuevoPedido();
      showToast(
        `🆕 Nuevo plato (${esOnline ? "Online" : "Mesa"})`,
        "info"
      );
      setTimeout(
        () => contenedor.classList.remove("nuevo"),
        DESTACAR_NUEVO_MS
      );
    }
  });

  firmaAnterior = firmaActual;
  primeraCarga = false;
}

// 🔁 Escucha ambas tablas
function mostrarPedidosUnificados() {
  const refLocal = ref(db, "pedidos");
  const refOnline = ref(db, "pedidosOnline");

  let datosLocales = {};
  let datosOnline = {};

  const render = () => {
    const combinados = combinarPedidos(datosLocales, datosOnline);
    if (Object.keys(combinados).length === 0) {
      listaPedidos.innerHTML = "<p>No hay pedidos pendientes.</p>";
      firmaAnterior = {};
      return;
    }
    renderizarPedidos(combinados);
  };

  onValue(refLocal, (snap) => {
    datosLocales = snap.val() || {};
    render();
  });

  onValue(refOnline, (snap) => {
    datosOnline = snap.val() || {};
    render();
  });
}


function obtenerIdRealPedido(id) {
  if (id.startsWith("O-")) {
    return id.replace("O-", "");
  }
  if (id.startsWith("M")) {
    return id.replace("M", "");
  }
  return id;
}

async function marcarListo(id) {
  const seleccionados = productosSeleccionados[id] || [];

  if (seleccionados.length === 0) {
    showToast("⚠️ No hay productos seleccionados.", "info");
    return;
  }

showConfirmToast(
  `¿Marcar ${seleccionados.length} producto(s) como listo(s)?`,
  async () => {
    try {
      const esOnline = id.startsWith("O-");
      const pathBase = esOnline ? "pedidosOnline" : "pedidos";
      const realId = obtenerIdRealPedido(id);

      const refPedido = ref(db, `${pathBase}/${realId}`);
      const snapshot = await get(refPedido);

      if (!snapshot.exists()) {
        showToast("❌ Pedido no encontrado", "error");
        return;
      }

      const datos = snapshot.val();
      const items = datos.items || [];

      seleccionados.forEach(index => {
        const item = items[index];
        if (!item) return;

        const total = item.cantidad || 1;
        const lista = item.cantidadLista || 0;
        if (lista < total) item.cantidadLista = lista + 1;
      });

      await update(refPedido, {
        items,
        actualizadoPor: "cocina",
        actualizadoEn: Date.now()
      });

      delete productosSeleccionados[id];

      showToast("✅ Productos marcados como listos", "success");

    } catch (err) {
      console.error(err);
      showToast("❌ Error al actualizar productos", "error");
    }
  }
);
}

async function marcarTodoListo(id) {
  const seleccionados = productosSeleccionados[id] || [];

  if (seleccionados.length === 0) {
    showToast("⚠️ No hay productos seleccionados.", "info");
    return;
  }

 showConfirmToast(
  `¿Marcar ${seleccionados.length} productos como completamente listos?`,
  async () => {
    try {
      const esOnline = id.startsWith("O-");
      const pathBase = esOnline ? "pedidosOnline" : "pedidos";
      const realId = obtenerIdRealPedido(id);

      const refPedido = ref(db, `${pathBase}/${realId}`);
      const snapshot = await get(refPedido);

      if (!snapshot.exists()) {
        showToast("❌ Pedido no encontrado", "error");
        return;
      }

      const datos = snapshot.val();
      const items = datos.items || [];

      seleccionados.forEach(index => {
        const item = items[index];
        if (!item) return;
        if (item.categoria === "plato") {
          item.cantidadLista = item.cantidad || 1;
        }
      });

      await update(refPedido, {
        items,
        actualizadoPor: "cocina",
        actualizadoEn: Date.now()
      });

      delete productosSeleccionados[id];

      showToast("✅ Productos seleccionados marcados como listos", "success");

    } catch (err) {
      console.error(err);
      showToast("❌ Error al marcar productos", "error");
    }
  }
);

}



// ⏱️ Refrescar urgencia
setInterval(() => {
  const now = Date.now();

  document.querySelectorAll(".mesa").forEach((card) => {
    const ts = parseInt(card.dataset.timestamp || "0", 10);
    if (!ts) {
      card.classList.remove("urgente");
      return;
    }

    const mins = (now - ts) / 60000;

    if (mins >= UMBRAL_URGENCIA_MIN) {
      card.classList.add("urgente");
    } else {
      card.classList.remove("urgente");
    }
  });
}, 30000);

// -------------------- LOADER --------------------
function mostrarLoader(texto = "Cargando...") {
  const loader = document.getElementById("loaderOverlay");
  const textoLoader = document.getElementById("loaderTexto");

  if (loader) loader.style.display = "flex";
  if (textoLoader) textoLoader.textContent = texto;
}

function ocultarLoader() {
  const loader = document.getElementById("loaderOverlay");
  if (loader) loader.style.display = "none";
}

// -------------------- UI --------------------
function actualizarUI(user) {
  if (user) {
    loginSection.style.display = "none";
    cocinaSection.style.display = "block";
    mostrarPedidosUnificados();
  } else {
    loginSection.style.display = "block";
    cocinaSection.style.display = "none";
    listaPedidos.innerHTML = "";
    primeraCarga = true;
    firmaAnterior = {};
  }
}

// -------------------- AUTH STATE --------------------
onAuthStateChanged(auth, (user) => {
  if (user) {
    mostrarLoader("Validando acceso...");

    const rolRef = ref(db, "roles/" + user.uid);

    get(rolRef)
      .then((snapshot) => {
        if (snapshot.exists()) {
          if (snapshot.val() === "cocina") {
            actualizarUI(user);
            showToast("👨‍🍳 Bienvenido al panel de cocina", "success");
          } else {
            showToast("🚫 Acceso denegado: No tienes el rol de cocina.", "error");
            signOut(auth);
          }
        } else {
          showToast("❌ No se encontró tu rol.", "error");
          signOut(auth);
        }
      })
      .catch((error) => {
        console.error(error);
        showToast("❌ Error al validar usuario", "error");
      })
      .finally(() => {
        ocultarLoader();
      });

  } else {
    actualizarUI(null);
  }
});

// -------------------- LOGIN --------------------
loginBtn.addEventListener("click", () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showToast("⚠️ Ingresa correo y contraseña.", "error");
    return;
  }

  mostrarLoader("Iniciando sesión...");
  loginBtn.disabled = true;

  signInWithEmailAndPassword(auth, email, password)
    .then(() => {
      showToast("✅ Sesión iniciada correctamente", "success");
      emailInput.value = "";
      passwordInput.value = "";
    })
    .catch((error) => {
      console.error(error);
      showToast("❌ Credenciales incorrectas", "error");
    })
    .finally(() => {
      ocultarLoader();
      loginBtn.disabled = false;
    });
});

// -------------------- LOGOUT --------------------
logoutBtn.addEventListener("click", () => {
  mostrarLoader("Cerrando sesión...");

  signOut(auth)
    .then(() => {
      showToast("✅ Sesión cerrada", "success");
    })
    .catch((error) => {
      console.error(error);
      showToast("❌ Error al cerrar sesión", "error");
    })
    .finally(() => {
      ocultarLoader();
    });
});
// 🧱 Crea botón de sonido
function ensureTopControls() {
  if (!document.getElementById("activarSonidoBtn")) {
    const barra = document.createElement("div");
    barra.id = "topControls";
    barra.style.display = "flex";
    barra.style.gap = "10px";
    barra.style.margin = "10px 0";

    const btn = document.createElement("button");
    btn.id = "activarSonidoBtn";
    btn.textContent = "🔕 Activar sonido";
    btn.style.padding = "8px 12px";
    btn.style.fontWeight = "600";

    barra.appendChild(btn);
    if (cocinaSection) cocinaSection.prepend(barra);
    else document.body.prepend(barra);
  }
}

const productosSeleccionados = {};
let firmaAnterior = {};
let primeraCarga = true;


