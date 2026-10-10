"use strict";
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ChanakyaTaskEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const STORAGE_KEY = "chanakya.tasks.v1";
  const STATUSES = Object.freeze(["open", "in_progress", "blocked", "done"]);
  function cleanTitle(value) {
    if (typeof value !== "string") throw new TypeError("Task title must be text.");
    const title = value.replace(/\\s+/g, " ").trim();
    if (!title) throw new Error("Describe the work before creating a task.");
    if (title.length > 4000) throw new Error("Task description must be 4,000 characters or fewer.");
    return title;
  }
  function createTask(title, now) {
    const createdAt = (now instanceof Date ? now : new Date()).toISOString();
    return { id: "task_" + createdAt.replace(/[^0-9]/g, "") + "_" + Math.random().toString(36).slice(2, 8), title: cleanTitle(title), status: "open", createdAt, updatedAt: createdAt, evidence: [], note: "Captured locally. No external action has been performed." };
  }
  function validateTask(task) {
    if (!task || typeof task !== "object" || typeof task.id !== "string" || !task.id || typeof task.title !== "string" || !task.title.trim() || !STATUSES.includes(task.status)) throw new Error("Invalid task record.");
    return task;
  }
  function updateStatus(task, status, now) {
    validateTask(task);
    if (!STATUSES.includes(status)) throw new Error("Unsupported task status.");
    return { ...task, status, updatedAt: (now instanceof Date ? now : new Date()).toISOString() };
  }
  function load(storage) {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map(validateTask);
    } catch (_) { return []; }
  }
  function save(tasks, storage) {
    if (!Array.isArray(tasks)) throw new TypeError("Tasks must be an array.");
    tasks.forEach(validateTask);
    storage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return tasks;
  }
  function add(title, tasks, storage, now) {
    const task = createTask(title, now);
    const next = [task, ...tasks];
    save(next, storage);
    return { task, tasks: next };
  }
  function setStatus(id, status, tasks, storage, now) {
    const found = tasks.some(task => task.id === id);
    if (!found) throw new Error("Task not found.");
    const next = tasks.map(task => task.id === id ? updateStatus(task, status, now) : task);
    save(next, storage);
    return next;
  }
  return Object.freeze({ STORAGE_KEY, STATUSES, cleanTitle, createTask, validateTask, updateStatus, load, save, add, setStatus });
});
