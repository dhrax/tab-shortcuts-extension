import { getRequiredElement, createElement, setStatus, formatDate } from "./dom.js";
import {
  ensureDefaultSnippets,
  loadSnippets,
  saveSnippets,
  Snippet
} from "../shared/storage.js";

let titleInput: HTMLInputElement;
let contentInput: HTMLTextAreaElement;
let addSnippetButton: HTMLButtonElement;
let snippetsList: HTMLDivElement;

const defaultSnippets: Snippet[] = [
  {
    id: crypto.randomUUID(),
    title: "Morning routine",
    content: "- Check email\n- Plan priorities\n- Start main task",
    createdAt: new Date().toISOString()
  },
  {
    id: crypto.randomUUID(),
    title: "Quick message",
    content: "Hi, just letting you know I'm already working on it.",
    createdAt: new Date().toISOString()
  }
];

export function initializeSnippets(): void {
  titleInput = getRequiredElement<HTMLInputElement>("snippet-title-input");
  contentInput = getRequiredElement<HTMLTextAreaElement>(
    "snippet-content-input"
  );
  addSnippetButton = getRequiredElement<HTMLButtonElement>(
    "add-snippet-button"
  );
  snippetsList = getRequiredElement<HTMLDivElement>("snippets-list");

  addSnippetButton.addEventListener("click", () => {
    void handleCreateSnippet();
  });

  snippetsList.addEventListener("click", handleSnippetClick);

  void initializeDefaultSnippets();
}

async function initializeDefaultSnippets(): Promise<void> {
  await ensureDefaultSnippets(defaultSnippets);
  await refreshSnippets();
}

async function handleCreateSnippet(): Promise<void> {
  const title = titleInput.value.trim();
  const content = contentInput.value.trim();

  if (title === "" || content === "") {
    setStatus("Add a title and content for the snippet", "error");
    return;
  }

  const snippets = await loadSnippets();
  const newSnippet: Snippet = {
    id: crypto.randomUUID(),
    title,
    content,
    createdAt: new Date().toISOString()
  };

  await saveSnippets([newSnippet, ...snippets]);
  titleInput.value = "";
  contentInput.value = "";
  setStatus("Snippet saved", "success");
  await refreshSnippets();
}

async function refreshSnippets(): Promise<void> {
  const snippets = await loadSnippets();
  snippetsList.innerHTML = "";

  if (snippets.length === 0) {
    const emptyMessage = createElement("div", "empty-message");
    emptyMessage.textContent = "No saved snippets";
    snippetsList.appendChild(emptyMessage);
    return;
  }

  snippets.forEach((snippet) => {
    const card = createElement("div", "snippet-item");
    const header = createElement("div", "snippet-item-header");
    const title = createElement("div", "snippet-item-title");
    const meta = createElement("div", "snippet-item-meta");
    const content = createElement("div", "snippet-item-content");
    const actions = createElement("div", "snippet-item-actions");

    title.textContent = snippet.title;
    meta.textContent = formatDate(snippet.createdAt);
    content.textContent = snippet.content;

    const copyButton = createElement("button", "small-button", {
      "data-snippet-action": "copy",
      "data-snippet-id": snippet.id
    });
    copyButton.textContent = "Copiar";

    const deleteButton = createElement("button", "small-button danger", {
      "data-snippet-action": "delete",
      "data-snippet-id": snippet.id
    });
    deleteButton.textContent = "Eliminar";

    actions.append(copyButton, deleteButton);
    header.append(title, meta);
    card.append(header, content, actions);
    snippetsList.appendChild(card);
  });
}

async function handleSnippetClick(event: MouseEvent): Promise<void> {
  const target = event.target as HTMLElement;
  const button = target.closest("button[data-snippet-action]") as
    | HTMLButtonElement
    | null;

  if (button === null) {
    return;
  }

  const action = button.dataset.snippetAction;
  const snippetId = button.dataset.snippetId;

  if (!action || !snippetId) {
    return;
  }

  if (action === "copy") {
    await copySnippet(snippetId);
  } else if (action === "delete") {
    await removeSnippet(snippetId);
  }
}

async function copySnippet(snippetId: string): Promise<void> {
  const snippets = await loadSnippets();
  const snippet = snippets.find((item) => item.id === snippetId);

  if (!snippet) {
    setStatus("Snippet not found", "error");
    return;
  }

  await navigator.clipboard.writeText(snippet.content);
  setStatus("Snippet copied", "success");
}

async function removeSnippet(snippetId: string): Promise<void> {
  const snippets = await loadSnippets();
  const filtered = snippets.filter((item) => item.id !== snippetId);
  await saveSnippets(filtered);
  setStatus("Snippet deleted", "success");
  await refreshSnippets();
}
