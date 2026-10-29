
"use strict";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const TASKS_KEY = "mi-laboratorio-tareas-v1";
const COUNTER_KEY = "mi-laboratorio-contador-v1";

let tasks = loadTasks();
let counter = loadCounter();
let toastTimeout = null;
let confirmAction = null;
let lastFocusedElement = null;

// ========================================
// ALMACENAMIENTO LOCAL
// ========================================

function loadTasks() {
  try {
    const saved = localStorage.getItem(TASKS_KEY);
    if (!saved) return [];

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(task => task && typeof task.text === "string")
      .map(task => ({
        id: String(task.id ?? createId()),
        text: task.text.slice(0, 160),
        completed: Boolean(task.completed)
      }));
  } catch (error) {
    console.error("Error al cargar tareas:", error);
    return [];
  }
}

function loadCounter() {
  try {
    const saved = localStorage.getItem(COUNTER_KEY);
    if (saved === null) return 0;

    const value = Number(saved);
    return Number.isSafeInteger(value) ? value : 0;
  } catch (error) {
    console.error("Error al cargar el contador:", error);
    return 0;
  }
}

function saveTasks() {
  try {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
    return true;
  } catch (error) {
    console.error("Error al guardar tareas:", error);
    showToast("No se pudieron guardar los cambios.");
    return false;
  }
}

function saveCounter() {
  try {
    localStorage.setItem(COUNTER_KEY, String(counter));
    return true;
  } catch (error) {
    console.error("Error al guardar el contador:", error);
    showToast("No se pudo guardar el contador.");
    return false;
  }
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return Date.now() + "-" + Math.random().toString(36).slice(2);
}

// ========================================
// AVISOS
// ========================================

function showToast(message) {
  const toast = $("#toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  window.clearTimeout(toastTimeout);

  toastTimeout = window.setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

// ========================================
// NAVEGACIÓN
// ========================================

function navigateTo(screenId) {
  const target = $("#" + screenId);

  if (!target || !target.classList.contains("screen")) {
    return;
  }

  $$(".screen").forEach(screen => {
    screen.classList.toggle("active", screen.id === screenId);
  });

  $$(".nav-item").forEach(button => {
    const active = button.dataset.screen === screenId;

    button.classList.toggle("active", active);

    if (active) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function initNavigation() {
  $$("[data-screen]").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      navigateTo(button.dataset.screen);
    });
  });
}

// ========================================
// INICIO: TAREAS PENDIENTES
// ========================================

function renderHomePending() {
  const container = $("#home-pending-list");
  if (!container) return;

  container.replaceChildren();

  const pending = tasks.filter(task => !task.completed);
  const visibleTasks = pending.slice(0, 3);

  if (visibleTasks.length === 0) {
    const empty = document.createElement("div");
    empty.className = "home-pending-empty";

    const icon = document.createElement("span");
    icon.className = "empty-state-icon";
    icon.textContent = tasks.length > 0 ? "✓" : "✦";

    const message = document.createElement("div");
    message.textContent = tasks.length > 0
      ? "¡Excelente! No tenés tareas pendientes."
      : "Todavía no agregaste tareas. Cuando lo hagas, aparecerán acá.";

    empty.append(icon, message);
    container.append(empty);
    return;
  }

  visibleTasks.forEach(task => {
    const row = document.createElement("div");
    row.className = "home-pending-item";

    const marker = document.createElement("span");
    marker.className = "home-pending-marker";
    marker.setAttribute("aria-hidden", "true");

    const text = document.createElement("span");
    text.className = "home-pending-text";
    text.textContent = task.text;

    row.append(marker, text);
    container.append(row);
  });

  if (pending.length > visibleTasks.length) {
    const more = document.createElement("p");
    more.className = "home-pending-more";
    more.textContent =
      `Y ${pending.length - visibleTasks.length} tarea(s) pendiente(s) más.`;

    container.append(more);
  }
}

// ========================================
// ESTADÍSTICAS Y PROGRESO
// ========================================

function updateStatistics() {
  const total = tasks.length;
  const done = tasks.filter(task => task.completed).length;
  const pending = total - done;

  const percentage = total === 0
    ? 0
    : Math.round((done / total) * 100);

  $("#home-total").textContent = String(total);
  $("#home-done").textContent = String(done);
  $("#home-pending").textContent = String(pending);

  $("#task-total-stat").textContent = String(total);
  $("#task-done-stat").textContent = String(done);
  $("#task-pending-stat").textContent = String(pending);

  $("#task-progress-label").textContent = percentage + "%";
  $("#task-progress-bar").style.width = percentage + "%";

  // Línea corregida: sintaxis válida.
  $("#task-progress").setAttribute(
    "aria-valuenow",
    String(percentage)
  );

  $("#task-summary").textContent =
    total === 1 ? "1 tarea" : `${total} tareas`;

  let progressMessage = "Todavía no hay tareas. ¡Empezá cuando quieras!";

  if (total > 0 && done === 0) {
    progressMessage = "Ya empezaste. ¡A completar la primera!";
  } else if (pending > 0) {
    progressMessage = `Completaste ${done} de ${total}. ¡Seguí así!`;
  } else if (total > 0) {
    progressMessage = "¡Excelente! Completaste todas tus tareas.";
  }

  $("#task-progress-message").textContent = progressMessage;

  renderHomePending();
}

// ========================================
// LISTA DE TAREAS
// ========================================

function renderTasks() {
  const container = $("#task-list");
  container.replaceChildren();

  if (tasks.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";

    const icon = document.createElement("span");
    icon.className = "empty-state-icon";
    icon.textContent = "✦";

    const title = document.createElement("strong");
    title.textContent = "Tu lista está vacía";

    const description = document.createElement("p");
    description.textContent =
      "Agregá una tarea arriba para empezar a organizarte.";

    description.style.margin = "7px 0 0";
    description.style.fontSize = "12px";

    empty.append(icon, title, description);
    container.append(empty);
  } else {
    tasks.forEach(task => {
      const card = document.createElement("article");

      card.className =
        "task-card" + (task.completed ? " completed" : "");

      card.dataset.taskId = task.id;

      const check = document.createElement("button");
      check.type = "button";
      check.className =
        "task-check" + (task.completed ? " checked" : "");

      check.setAttribute(
        "aria-label",
        task.completed ? "Marcar como pendiente" : "Marcar como completada"
      );

      check.setAttribute("aria-pressed", String(task.completed));
      check.textContent = task.completed ? "✓" : "";

      check.addEventListener("click", () => {
        toggleTask(task.id);
      });

      const content = document.createElement("div");
      content.className = "task-content";

      const text = document.createElement("div");
      text.className = "task-text";
      text.textContent = task.text;

      const actions = document.createElement("div");
      actions.className = "task-actions";

      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "task-action";
      editButton.textContent = "Editar";

      editButton.addEventListener("click", () => {
        beginEdit(task.id, content);
      });

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "task-action delete";
      deleteButton.textContent = "Eliminar";

      deleteButton.addEventListener("click", () => {
        openConfirmation({
          title: "¿Eliminar esta tarea?",
          message: "La tarea se eliminará de tu lista.",
          confirmText: "Eliminar",
          action: () => deleteTask(task.id)
        });
      });

      actions.append(editButton, deleteButton);
      content.append(text, actions);
      card.append(check, content);
      container.append(card);
    });
  }

  updateStatistics();
}

function addTask(text) {
  const cleanText = text.trim();

  if (!cleanText) {
    showToast("Escribí una tarea antes de agregarla.");
    return;
  }

  if (cleanText.length > 160) {
    showToast("La tarea no puede superar los 160 caracteres.");
    return;
  }

  const newTask = {
    id: createId(),
    text: cleanText,
    completed: false
  };

  tasks.unshift(newTask);

  if (saveTasks()) {
    renderTasks();
    showToast("Tarea agregada.");
  } else {
    tasks = tasks.filter(task => task.id !== newTask.id);
    renderTasks();
  }
}

function toggleTask(id) {
  const task = tasks.find(item => item.id === id);
  if (!task) return;

  const previous = task.completed;
  task.completed = !task.completed;

  if (saveTasks()) {
    renderTasks();
    showToast(task.completed
      ? "Tarea completada."
      : "Tarea pendiente.");
  } else {
    task.completed = previous;
    renderTasks();
  }
}

function beginEdit(id, content) {
  const task = tasks.find(item => item.id === id);
  if (!task) return;

  content.replaceChildren();

  const input = document.createElement("input");
  input.type = "text";
  input.className = "task-edit-input";
  input.maxLength = 160;
  input.value = task.text;
  input.setAttribute("aria-label", "Editar tarea");

  const actions = document.createElement("div");
  actions.className = "task-actions";

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.className = "task-action";
  saveButton.textContent = "Guardar";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "task-action";
  cancelButton.textContent = "Cancelar";

  const save = () => {
    const newText = input.value.trim();

    if (!newText) {
      showToast("La tarea no puede quedar vacía.");
      input.focus();
      return;
    }

    if (newText.length > 160) {
      showToast("La tarea no puede superar los 160 caracteres.");
      input.focus();
      return;
    }

    const previous = task.text;
    task.text = newText;

    if (saveTasks()) {
      renderTasks();
      showToast("Tarea actualizada.");
    } else {
      task.text = previous;
      renderTasks();
    }
  };

  saveButton.addEventListener("click", save);
  cancelButton.addEventListener("click", renderTasks);

  input.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      save();
    }

    if (event.key === "Escape") {
      renderTasks();
    }
  });

  actions.append(saveButton, cancelButton);
  content.append(input, actions);

  input.focus();
  input.select();
}

function deleteTask(id) {
  const index = tasks.findIndex(task => task.id === id);
  if (index === -1) return;

  const removedTask = tasks[index];
  tasks.splice(index, 1);

  if (saveTasks()) {
    renderTasks();
    showToast("Tarea eliminada.");
  } else {
    tasks.splice(index, 0, removedTask);
    renderTasks();
  }
}

function clearAllTasks() {
  if (tasks.length === 0) {
    showToast("No hay tareas para borrar.");
    return;
  }

  const previousTasks = tasks;
  tasks = [];

  if (saveTasks()) {
    renderTasks();
    showToast("Se borraron todas las tareas.");
  } else {
    tasks = previousTasks;
    renderTasks();
  }
}

// ========================================
// FORMULARIO Y BORRADO DE TAREAS
// ========================================

function initTaskForm() {
  $("#task-form").addEventListener("submit", event => {
    event.preventDefault();

    const input = $("#task-input");
    const value = input.value;

    if (!value.trim()) {
      showToast("Escribí una tarea antes de agregarla.");
      input.focus();
      return;
    }

    addTask(value);
    input.value = "";
    input.focus();
  });

  const clearButtons = [
    $("#clear-tasks-button"),
    $("#settings-clear-tasks")
  ];

  clearButtons.forEach(button => {
    button.addEventListener("click", () => {
      if (tasks.length === 0) {
        showToast("No hay tareas para borrar.");
        return;
      }

      openConfirmation({
        title: "¿Borrar todas las tareas?",
        message: "Se eliminarán todas las tareas guardadas. Esta acción no se puede deshacer.",
        confirmText: "Borrar todo",
        action: clearAllTasks
      });
    });
  });
}

// ========================================
// CONTADOR
// ========================================

function setCounter(value) {
  if (!Number.isSafeInteger(value)) {
    showToast("El contador llegó a su límite.");
    return;
  }

  const previous = counter;
  counter = value;

  if (!saveCounter()) {
    counter = previous;
  }

  $("#counter-value").textContent = String(counter);
}

function resetCounter() {
  setCounter(0);
  showToast("Contador reiniciado.");
}

function initCounter() {
  $("#counter-value").textContent = String(counter);

  $("#counter-plus").addEventListener("click", () => {
    setCounter(counter + 1);
  });

  $("#counter-minus").addEventListener("click", () => {
    setCounter(counter - 1);
  });

  $("#counter-reset").addEventListener("click", () => {
    if (counter === 0) {
      showToast("El contador ya está en cero.");
      return;
    }

    openConfirmation({
      title: "¿Reiniciar el contador?",
      message: "El valor actual volverá a cero.",
      confirmText: "Reiniciar",
      action: resetCounter
    });
  });

  $("#settings-reset-counter").addEventListener("click", () => {
    if (counter === 0) {
      showToast("El contador ya está en cero.");
      return;
    }

    openConfirmation({
      title: "¿Reiniciar el contador?",
      message: "El valor guardado volverá a cero.",
      confirmText: "Reiniciar",
      action: resetCounter
    });
  });
}

// ========================================
// PRUEBA DE JAVASCRIPT
// ========================================

function initJavaScriptTest() {
  $("#js-test-button").addEventListener("click", () => {
    const result = $("#js-test-result");

    try {
      const sum = [1, 2, 3].reduce((total, value) => total + value, 0);

      if (sum !== 6 || typeof localStorage === "undefined") {
        throw new Error("La comprobación no se completó.");
      }

      result.textContent = "✓ JavaScript funciona correctamente.";
      result.classList.add("success");

      showToast("Prueba completada correctamente.");
    } catch (error) {
      result.textContent = "No se pudo completar la prueba.";
      result.classList.remove("success");

      showToast("La prueba encontró un problema.");
      console.error(error);
    }
  });
}

// ========================================
// MODAL DE CONFIRMACIÓN
// ========================================

function openConfirmation({
  title,
  message,
  confirmText = "Confirmar",
  action
}) {
  const modal = $("#confirm-modal");

  lastFocusedElement = document.activeElement;
  confirmAction = action;

  $("#modal-title").textContent = title;
  $("#modal-message").textContent = message;
  $("#modal-confirm").textContent = confirmText;

  modal.hidden = false;
  $("#modal-cancel").focus();
}

function closeConfirmation() {
  $("#confirm-modal").hidden = true;
  confirmAction = null;

  if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
    lastFocusedElement.focus();
  }
}

function confirmCurrentAction() {
  const action = confirmAction;
  closeConfirmation();

  if (typeof action === "function") {
    action();
  }
}

function initModal() {
  $("#modal-cancel").addEventListener("click", closeConfirmation);
  $("#modal-confirm").addEventListener("click", confirmCurrentAction);

  $("#confirm-modal").addEventListener("click", event => {
    if (event.target === $("#confirm-modal")) {
      closeConfirmation();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !$("#confirm-modal").hidden) {
      closeConfirmation();
    }
  });
}

// ========================================
// INICIO DE LA APLICACIÓN
// ========================================

function initApp() {
  initNavigation();
  initTaskForm();
  initCounter();
  initJavaScriptTest();
  initModal();

  renderTasks();
  $("#counter-value").textContent = String(counter);

  console.log("Mi Laboratorio v1.0 iniciado correctamente.");
}

document.addEventListener("DOMContentLoaded", initApp);
