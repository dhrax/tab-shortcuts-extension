import { getRequiredElement, createElement, setStatus, formatDate } from "./dom.js";
import {
  loadSavedSessions,
  saveSavedSessions,
  loadSnippets,
  saveSnippets,
  validateImportedData,
  mergeImportedSessions,
  mergeImportedSnippets,
  loadSettings
} from "../shared/storage.js";
import type { SavedSession } from "../shared/storage.js";
import { getCurrentWindowTabs, isInternalUrl } from "../shared/tab-utils.js";
import { refreshSnippets } from "./snippets.js";

let sessionNameInput: HTMLInputElement;
let saveSessionButton: HTMLButtonElement;
let exportDataButton: HTMLButtonElement;
let importDataInput: HTMLInputElement;
let sessionsList: HTMLDivElement;

export function initializeSessions(): void {
  sessionNameInput = getRequiredElement<HTMLInputElement>("session-name-input");
  saveSessionButton = getRequiredElement<HTMLButtonElement>(
    "save-session-button"
  );
  exportDataButton = getRequiredElement<HTMLButtonElement>(
    "export-data-button"
  );
  importDataInput = getRequiredElement<HTMLInputElement>(
    "import-data-input"
  );
  sessionsList = getRequiredElement<HTMLDivElement>("sessions-list");

  saveSessionButton.addEventListener("click", () => {
    void handleSaveSession();
  });

  exportDataButton.addEventListener("click", () => {
    void handleExportData();
  });

  importDataInput.addEventListener("change", () => {
    void handleImportData();
  });

  sessionsList.addEventListener("click", handleSessionClick);

  void renderSessions();
}

async function handleSaveSession(): Promise<void> {
  const name = sessionNameInput.value.trim();

  if (name === "") {
    setStatus("Enter a session name", "error");
    return;
  }

  try {
    const message = await saveCurrentWindowSession(name);
    sessionNameInput.value = "";
    setStatus(message, "success");
    void renderSessions();
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unable to save session";
    setStatus(message, "error");
  }
}

export async function saveCurrentWindowSession(name?: string): Promise<string> {
  const sessionName = await getSessionName(name);
  const tabs = await getCurrentWindowTabs();
  const sessionTabs = tabs
    .filter((tab) => tab.url !== undefined && !isInternalUrl(tab.url))
    .map((tab) => ({
      title: tab.title ?? "Untitled",
      url: tab.url as string
    }));

  if (sessionTabs.length === 0) {
    throw new Error("No valid tabs to save");
  }

  const sessions = await loadSavedSessions();
  const newSession: SavedSession = {
    id: crypto.randomUUID(),
    name: sessionName,
    createdAt: new Date().toISOString(),
    tabs: sessionTabs
  };

  await saveSavedSessions([newSession, ...sessions]);
  await renderSessions();

  return "Session saved";
}

async function getSessionName(name: string | undefined): Promise<string> {
  const trimmedName = name?.trim();

  if (trimmedName) {
    return trimmedName;
  }

  const settings = await loadSettings();
  const timestamp = new Date()
    .toISOString()
    .replace("T", " ")
    .slice(0, 16);

  return `${settings.defaultSessionNamePrefix} ${timestamp}`;
}

async function handleExportData(): Promise<void> {
  const sessions = await loadSavedSessions();
  const snippets = await loadSnippets();
  const payload = JSON.stringify({ sessions, snippets }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "tab-shortcuts-data.json";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  setStatus("Data exported", "success");
}

async function handleImportData(): Promise<void> {
  const files = importDataInput.files;

  if (!files || files.length === 0) {
    return;
  }

  const file = files[0];

  try {
    const text = await file.text();
    const imported = JSON.parse(text);

    if (!validateImportedData(imported)) {
      throw new Error("Invalid import file format");
    }

    const existingSessions = await loadSavedSessions();
    const existingSnippets = await loadSnippets();

    const mergedSessions = mergeImportedSessions(
      existingSessions,
      imported.sessions ?? []
    );
    const mergedSnippets = mergeImportedSnippets(
      existingSnippets,
      imported.snippets ?? []
    );

    await saveSavedSessions(mergedSessions);
    await saveSnippets(mergedSnippets);

    importDataInput.value = "";
    setStatus("Data imported", "success");
    void renderSessions();
    await refreshSnippets();
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unable to import data";
    setStatus(message, "error");
  }
}

async function renderSessions(): Promise<void> {
  const sessions = await loadSavedSessions();
  sessionsList.innerHTML = "";

  if (sessions.length === 0) {
    const emptyMessage = createElement("div", "empty-message");
    emptyMessage.textContent = "No saved sessions";
    sessionsList.appendChild(emptyMessage);
    return;
  }

  sessions.forEach((session) => {
    const card = createElement("div", "session-item");
    const header = createElement("div", "session-item-header");
    const title = createElement("div", "session-item-title");
    const meta = createElement("div", "session-item-meta");
    const actions = createElement("div", "session-item-actions");

    title.textContent = session.name;
    meta.textContent = `${session.tabs.length} tabs · ${formatDate(
      session.createdAt
    )}`;

    const openButton = createElement("button", "small-button", {
      "data-session-action": "open",
      "data-session-id": session.id
    });
    openButton.textContent = "Open";

    const deleteButton = createElement("button", "small-button danger", {
      "data-session-action": "delete",
      "data-session-id": session.id
    });
    deleteButton.textContent = "Delete";

    actions.append(openButton, deleteButton);
    header.append(title, meta);
    card.append(header, actions);
    sessionsList.appendChild(card);
  });
}

async function handleSessionClick(event: MouseEvent): Promise<void> {
  const target = event.target as HTMLElement;
  const button = target.closest("button[data-session-action]") as
    | HTMLButtonElement
    | null;

  if (button === null) {
    return;
  }

  const action = button.dataset.sessionAction;
  const sessionId = button.dataset.sessionId;

  if (!action || !sessionId) {
    return;
  }

  if (action === "open") {
    await openSession(sessionId);
  } else if (action === "delete") {
    await deleteSession(sessionId);
  }
}

async function openSession(sessionId: string): Promise<void> {
  const sessions = await loadSavedSessions();
  const session = sessions.find((item) => item.id === sessionId);

  if (!session || session.tabs.length === 0) {
    setStatus("Session not found or has no tabs", "error");
    return;
  }

  const urls = session.tabs.map((tab) => tab.url);

  await chrome.windows.create({ url: urls });
  setStatus("Session opened in new window", "success");
}

async function deleteSession(sessionId: string): Promise<void> {
  const sessions = await loadSavedSessions();
  const filtered = sessions.filter((item) => item.id !== sessionId);

  await saveSavedSessions(filtered);
  setStatus("Session deleted", "success");
  void renderSessions();
}
