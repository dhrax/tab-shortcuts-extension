import { createElement, getRequiredElement, setStatus, formatDate } from "./dom.js";
import { loadTabNotes, saveTabNotes } from "../shared/storage.js";
import type { TabNote, TabNoteTargetType } from "../shared/storage.js";
import { formatTabUrl, getCurrentTab } from "../shared/tab-utils.js";

let noteScopeSelect: HTMLSelectElement;
let noteContentInput: HTMLTextAreaElement;
let saveNoteButton: HTMLButtonElement;
let cancelEditButton: HTMLButtonElement;
let notesList: HTMLElement;
let notesContext: HTMLElement;
let editingNoteId: string | null = null;

function ensureElements(): void {
  if (noteScopeSelect) {
    return;
  }

  noteScopeSelect = getRequiredElement<HTMLSelectElement>("note-scope-select");
  noteContentInput = getRequiredElement<HTMLTextAreaElement>(
    "note-content-input"
  );
  saveNoteButton = getRequiredElement<HTMLButtonElement>("save-note-button");
  cancelEditButton = getRequiredElement<HTMLButtonElement>(
    "cancel-note-edit-button"
  );
  notesList = getRequiredElement<HTMLElement>("tab-notes-list");
  notesContext = getRequiredElement<HTMLElement>("notes-context");
}

export async function initializeNotes(): Promise<void> {
  ensureElements();

  saveNoteButton.addEventListener("click", () => {
    void saveCurrentNote();
  });

  cancelEditButton.addEventListener("click", () => {
    resetForm();
  });

  notesList.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const button = target.closest("button[data-note-action]") as
      | HTMLButtonElement
      | null;

    if (button === null) {
      return;
    }

    const noteId = button.dataset.noteId;
    const action = button.dataset.noteAction;

    if (!noteId || !action) {
      return;
    }

    if (action === "edit") {
      void editNote(noteId);
    } else if (action === "delete") {
      void deleteNote(noteId);
    }
  });

  await renderNotes();
}

async function saveCurrentNote(): Promise<void> {
  const content = noteContentInput.value.trim();

  if (content === "") {
    setStatus("Enter a note", "error");
    return;
  }

  try {
    const target = await getCurrentNoteTarget(getSelectedTargetType());
    const notes = await loadTabNotes();
    const now = new Date().toISOString();

    if (editingNoteId !== null) {
      const updatedNotes = notes.map((note) =>
        note.id === editingNoteId
          ? {
              ...note,
              targetType: target.targetType,
              target: target.target,
              content,
              updatedAt: now
            }
          : note
      );

      await saveTabNotes(updatedNotes);
      setStatus("Note updated", "success");
    } else {
      const note: TabNote = {
        id: crypto.randomUUID(),
        targetType: target.targetType,
        target: target.target,
        content,
        createdAt: now,
        updatedAt: now
      };

      await saveTabNotes([note, ...notes]);
      setStatus("Note saved", "success");
    }

    resetForm();
    await renderNotes();
  } catch (error: unknown) {
    setStatus(
      error instanceof Error ? error.message : "Unable to save note",
      "error"
    );
  }
}

async function renderNotes(): Promise<void> {
  ensureElements();

  const currentTab = await getCurrentTab();
  notesList.innerHTML = "";

  if (currentTab?.url === undefined) {
    notesContext.textContent = "No current tab URL";
    renderEmpty("No notes for this tab");
    return;
  }

  notesContext.textContent = formatTabUrl(currentTab.url);

  const notes = await loadTabNotes();
  const relatedNotes = notes.filter((note) => isNoteRelatedToTab(note, currentTab.url as string));

  if (relatedNotes.length === 0) {
    renderEmpty("No notes for this tab");
    return;
  }

  relatedNotes.forEach((note) => {
    const item = createElement("div", "note-item");
    const header = createElement("div", "note-item-header");
    const title = createElement("div", "note-item-title");
    const meta = createElement("div", "note-item-meta");
    const content = createElement("div", "note-item-content");
    const actions = createElement("div", "note-item-actions");

    title.textContent = note.targetType === "domain" ? "Domain note" : "URL note";
    meta.textContent = `${note.target} - ${formatDate(note.updatedAt)}`;
    content.textContent = note.content;

    const editButton = createElement("button", "small-button", {
      "data-note-action": "edit",
      "data-note-id": note.id
    });
    editButton.textContent = "Edit";

    const deleteButton = createElement("button", "small-button danger", {
      "data-note-action": "delete",
      "data-note-id": note.id
    });
    deleteButton.textContent = "Delete";

    actions.append(editButton, deleteButton);
    header.append(title, meta);
    item.append(header, content, actions);
    notesList.appendChild(item);
  });
}

function renderEmpty(message: string): void {
  const empty = createElement("div", "empty-message");
  empty.textContent = message;
  notesList.appendChild(empty);
}

async function editNote(noteId: string): Promise<void> {
  const notes = await loadTabNotes();
  const note = notes.find((item) => item.id === noteId);

  if (note === undefined) {
    setStatus("Note not found", "error");
    await renderNotes();
    return;
  }

  editingNoteId = note.id;
  noteScopeSelect.value = note.targetType;
  noteContentInput.value = note.content;
  saveNoteButton.textContent = "Update note";
  cancelEditButton.classList.remove("hidden");
  noteContentInput.focus();
}

async function deleteNote(noteId: string): Promise<void> {
  const notes = await loadTabNotes();
  await saveTabNotes(notes.filter((note) => note.id !== noteId));

  if (editingNoteId === noteId) {
    resetForm();
  }

  setStatus("Note deleted", "success");
  await renderNotes();
}

function resetForm(): void {
  editingNoteId = null;
  noteContentInput.value = "";
  noteScopeSelect.value = "url";
  saveNoteButton.textContent = "Save note";
  cancelEditButton.classList.add("hidden");
}

function getSelectedTargetType(): TabNoteTargetType {
  return noteScopeSelect.value === "domain" ? "domain" : "url";
}

async function getCurrentNoteTarget(
  targetType: TabNoteTargetType
): Promise<{ targetType: TabNoteTargetType; target: string }> {
  const currentTab = await getCurrentTab();

  if (currentTab?.url === undefined) {
    throw new Error("Current tab has no URL");
  }

  if (targetType === "url") {
    return {
      targetType,
      target: currentTab.url
    };
  }

  try {
    return {
      targetType,
      target: new URL(currentTab.url).hostname
    };
  } catch {
    throw new Error("Current tab has no valid domain");
  }
}

function isNoteRelatedToTab(note: TabNote, url: string): boolean {
  if (note.targetType === "url") {
    return note.target === url;
  }

  try {
    return new URL(url).hostname === note.target;
  } catch {
    return false;
  }
}
