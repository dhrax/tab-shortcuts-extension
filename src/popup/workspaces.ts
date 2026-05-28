import { getRequiredElement, createElement, setStatus, formatDate } from "./dom.js";
import { loadWorkspaces, saveWorkspaces, Workspace } from "../shared/storage.js";
import { getCurrentTab, getCurrentWindowTabs } from "../shared/tab-utils.js";

let workspaceNameInput: HTMLInputElement;
let workspaceUrlInput: HTMLInputElement;
let addWorkspaceButton: HTMLButtonElement;
let workspacesList: HTMLDivElement;
let editingWorkspaceId: string | null = null;

export function initializeWorkspaces(): void {
  workspaceNameInput = getRequiredElement<HTMLInputElement>("workspace-name-input");
  workspaceUrlInput = getRequiredElement<HTMLInputElement>("workspace-url-input");
  addWorkspaceButton = getRequiredElement<HTMLButtonElement>("add-workspace-button");
  workspacesList = getRequiredElement<HTMLDivElement>("workspaces-list");

  addWorkspaceButton.addEventListener("click", () => {
    void handleAddWorkspace();
  });

  workspacesList.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const button = target.closest("button[data-workspace-action]") as
      | HTMLButtonElement
      | null;

    if (!button) {
      return;
    }

    const action = button.dataset.workspaceAction;
    const workspaceId = button.dataset.workspaceId;

    if (!action || !workspaceId) {
      return;
    }

    void handleWorkspaceAction(action, workspaceId);
  });

  void renderWorkspaces();
}

async function handleAddWorkspace(): Promise<void> {
  const name = workspaceNameInput.value.trim();
  const url = workspaceUrlInput.value.trim();

  if (name === "" || url === "") {
    setStatus("Enter workspace name and URL", "error");
    return;
  }

  const normalizedUrl = normalizeUrl(url);

  if (normalizedUrl === null) {
    setStatus("Enter a valid URL", "error");
    return;
  }

  const workspaces = await loadWorkspaces();
  const newWorkspace: Workspace = {
    id: crypto.randomUUID(),
    name,
    urls: [normalizedUrl],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await saveWorkspaces([newWorkspace, ...workspaces]);
  workspaceNameInput.value = "";
  workspaceUrlInput.value = "";
  setStatus("Workspace created", "success");
  await renderWorkspaces();
}

function normalizeUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    return parsed.href;
  } catch {
    try {
      const parsed = new URL(`https://${value}`);
      return parsed.href;
    } catch {
      return null;
    }
  }
}

async function handleWorkspaceAction(action: string, workspaceId: string): Promise<void> {
  switch (action) {
    case "open":
      await openWorkspace(workspaceId);
      break;
    case "edit":
      startEditWorkspace(workspaceId);
      break;
    case "delete":
      await deleteWorkspace(workspaceId);
      break;
    case "add-current-tab":
      await addCurrentTabToWorkspace(workspaceId);
      break;
    case "add-window-tabs":
      await addWindowTabsToWorkspace(workspaceId);
      break;
    case "save-edit":
      await saveWorkspaceEdit(workspaceId);
      break;
    case "cancel-edit":
      editingWorkspaceId = null;
      await renderWorkspaces();
      break;
    default:
      break;
  }
}

async function openWorkspace(workspaceId: string): Promise<void> {
  const workspaces = await loadWorkspaces();
  const workspace = workspaces.find((item) => item.id === workspaceId);

  if (!workspace || workspace.urls.length === 0) {
    setStatus("Workspace not found or empty", "error");
    return;
  }

  await chrome.windows.create({ url: workspace.urls });
  setStatus("Workspace opened in new window", "success");
}

async function deleteWorkspace(workspaceId: string): Promise<void> {
  const workspaces = await loadWorkspaces();
  const filtered = workspaces.filter((item) => item.id !== workspaceId);

  await saveWorkspaces(filtered);
  setStatus("Workspace deleted", "success");
  await renderWorkspaces();
}

async function addCurrentTabToWorkspace(workspaceId: string): Promise<void> {
  const currentTab = await getCurrentTab();

  if (!currentTab?.url) {
    setStatus("Current tab has no URL", "error");
    return;
  }

  const normalizedUrl = normalizeUrl(currentTab.url);

  if (normalizedUrl === null) {
    setStatus("Unable to add current tab URL", "error");
    return;
  }

  const workspaces = await loadWorkspaces();
  const workspace = workspaces.find((item) => item.id === workspaceId);

  if (!workspace) {
    setStatus("Workspace not found", "error");
    return;
  }

  workspace.urls = Array.from(new Set([...workspace.urls, normalizedUrl]));
  workspace.updatedAt = new Date().toISOString();

  await saveWorkspaces(workspaces);
  setStatus("Current tab added to workspace", "success");
  await renderWorkspaces();
}

async function addWindowTabsToWorkspace(workspaceId: string): Promise<void> {
  const tabs = await getCurrentWindowTabs();
  const urls = tabs
    .map((tab) => tab.url)
    .filter((url): url is string => typeof url === "string")
    .map(normalizeUrl)
    .filter((url): url is string => url !== null);

  if (urls.length === 0) {
    setStatus("No valid window tabs to add", "error");
    return;
  }

  const workspaces = await loadWorkspaces();
  const workspace = workspaces.find((item) => item.id === workspaceId);

  if (!workspace) {
    setStatus("Workspace not found", "error");
    return;
  }

  workspace.urls = Array.from(new Set([...workspace.urls, ...urls]));
  workspace.updatedAt = new Date().toISOString();

  await saveWorkspaces(workspaces);
  setStatus("Window tabs added to workspace", "success");
  await renderWorkspaces();
}

async function startEditWorkspace(workspaceId: string): Promise<void> {
  editingWorkspaceId = workspaceId;
  await renderWorkspaces();
}

async function saveWorkspaceEdit(workspaceId: string): Promise<void> {
  const nameInput = document.getElementById(
    `workspace-edit-name-${workspaceId}`
  ) as HTMLInputElement | null;
  const urlsInput = document.getElementById(
    `workspace-edit-urls-${workspaceId}`
  ) as HTMLTextAreaElement | null;

  if (!nameInput || !urlsInput) {
    setStatus("Workspace edit form not found", "error");
    return;
  }

  const name = nameInput.value.trim();
  const rawUrls = urlsInput.value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (name === "" || rawUrls.length === 0) {
    setStatus("Workspace requires a name and at least one URL", "error");
    return;
  }

  const urls = rawUrls
    .map(normalizeUrl)
    .filter((url): url is string => url !== null);

  if (urls.length !== rawUrls.length) {
    setStatus("One or more workspace URLs are invalid", "error");
    return;
  }

  const workspaces = await loadWorkspaces();
  const workspace = workspaces.find((item) => item.id === workspaceId);

  if (!workspace) {
    setStatus("Workspace not found", "error");
    return;
  }

  workspace.name = name;
  workspace.urls = Array.from(new Set(urls));
  workspace.updatedAt = new Date().toISOString();

  await saveWorkspaces(workspaces);
  editingWorkspaceId = null;
  setStatus("Workspace updated", "success");
  await renderWorkspaces();
}

async function renderWorkspaces(): Promise<void> {
  const workspaces = await loadWorkspaces();
  workspacesList.innerHTML = "";

  if (workspaces.length === 0) {
    const emptyMessage = createElement("div", "empty-message");
    emptyMessage.textContent = "No saved workspaces";
    workspacesList.appendChild(emptyMessage);
    return;
  }

  workspaces.forEach((workspace) => {
    const card = createElement("div", "session-item");
    const header = createElement("div", "session-item-header");
    const title = createElement("div", "session-item-title");
    const meta = createElement("div", "session-item-meta");
    const actions = createElement("div", "session-item-actions");

    if (editingWorkspaceId === workspace.id) {
      const nameEdit = createElement("input", "") as HTMLInputElement;
      nameEdit.id = `workspace-edit-name-${workspace.id}`;
      nameEdit.value = workspace.name;
      nameEdit.placeholder = "Workspace name";
      nameEdit.style.width = "100%";

      const urlsEdit = createElement("textarea", "") as HTMLTextAreaElement;
      urlsEdit.id = `workspace-edit-urls-${workspace.id}`;
      urlsEdit.value = workspace.urls.join("\n");
      urlsEdit.placeholder = "One URL per line";
      urlsEdit.style.width = "100%";
      urlsEdit.style.minHeight = "80px";

      const saveButton = createElement("button", "small-button", {
        "data-workspace-action": "save-edit",
        "data-workspace-id": workspace.id
      });
      saveButton.textContent = "Save";

      const cancelButton = createElement("button", "small-button", {
        "data-workspace-action": "cancel-edit",
        "data-workspace-id": workspace.id
      });
      cancelButton.textContent = "Cancel";

      card.append(nameEdit, urlsEdit, saveButton, cancelButton);
      workspacesList.appendChild(card);
      return;
    }

    title.textContent = workspace.name;
    meta.textContent = `${workspace.urls.length} URLs · ${formatDate(
      workspace.updatedAt
    )}`;

    const openButton = createElement("button", "small-button", {
      "data-workspace-action": "open",
      "data-workspace-id": workspace.id
    });
    openButton.textContent = "Open";

    const addCurrentButton = createElement("button", "small-button", {
      "data-workspace-action": "add-current-tab",
      "data-workspace-id": workspace.id
    });
    addCurrentButton.textContent = "Add current tab";

    const addWindowButton = createElement("button", "small-button", {
      "data-workspace-action": "add-window-tabs",
      "data-workspace-id": workspace.id
    });
    addWindowButton.textContent = "Add window tabs";

    const editButton = createElement("button", "small-button", {
      "data-workspace-action": "edit",
      "data-workspace-id": workspace.id
    });
    editButton.textContent = "Edit";

    const deleteButton = createElement("button", "small-button danger", {
      "data-workspace-action": "delete",
      "data-workspace-id": workspace.id
    });
    deleteButton.textContent = "Delete";

    actions.append(openButton, addCurrentButton, addWindowButton, editButton, deleteButton);
    header.append(title, meta);
    card.append(header, actions);
    workspacesList.appendChild(card);
  });
}
