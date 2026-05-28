import { getRequiredElement, createElement, setStatus, formatDate } from "./dom.js";
import {
  loadSavedSessions,
  saveSavedSessions,
  SavedSession
} from "../shared/storage.js";
import { getCurrentWindowTabs, isInternalUrl } from "../shared/tab-utils.js";

let sessionNameInput: HTMLInputElement;
let saveSessionButton: HTMLButtonElement;
let sessionsList: HTMLDivElement;

export function initializeSessions(): void {
  sessionNameInput = getRequiredElement<HTMLInputElement>("session-name-input");
  saveSessionButton = getRequiredElement<HTMLButtonElement>(
    "save-session-button"
  );
  sessionsList = getRequiredElement<HTMLDivElement>("sessions-list");

  saveSessionButton.addEventListener("click", () => {
    void handleSaveSession();
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

  const tabs = await getCurrentWindowTabs();
  const sessionTabs = tabs
    .filter((tab) => tab.url !== undefined && !isInternalUrl(tab.url))
    .map((tab) => ({
      title: tab.title ?? "Untitled",
      url: tab.url as string
    }));

  if (sessionTabs.length === 0) {
    setStatus("No valid tabs to save", "error");
    return;
  }

  const sessions = await loadSavedSessions();
  const newSession: SavedSession = {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    tabs: sessionTabs
  };

  await saveSavedSessions([newSession, ...sessions]);
  sessionNameInput.value = "";
  setStatus("Session saved", "success");
  void renderSessions();
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
    openButton.textContent = "Abrir";

    const deleteButton = createElement("button", "small-button danger", {
      "data-session-action": "delete",
      "data-session-id": session.id
    });
    deleteButton.textContent = "Eliminar";

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
