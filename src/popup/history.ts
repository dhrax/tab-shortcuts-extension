import { getRequiredElement, createElement, setStatus, formatDate } from "./dom.js";
import { getUndoHistory, performUndo, clearUndoHistory } from "../shared/undo-client.js";

let historyList: HTMLElement;
let undoButton: HTMLButtonElement;
let clearButton: HTMLButtonElement;

function ensureElements(): void {
  if (historyList) {
    return;
  }

  historyList = getRequiredElement<HTMLElement>("undo-history-list");
  undoButton = getRequiredElement<HTMLButtonElement>("undo-button");
  clearButton = getRequiredElement<HTMLButtonElement>("clear-history-button");
}

export async function initializeHistory(): Promise<void> {
  ensureElements();

  undoButton.addEventListener("click", () => {
    void performUndoAction();
  });

  clearButton.addEventListener("click", () => {
    void clearHistoryAction();
  });

  await renderHistory();
}

async function renderHistory(): Promise<void> {
  ensureElements();

  try {
    const history = await getUndoHistory();
    historyList.innerHTML = "";

    if (history.length === 0) {
      const empty = createElement("div", "empty-message");
      empty.textContent = "No actions to undo";
      historyList.appendChild(empty);
      undoButton.disabled = true;
      clearButton.disabled = true;
      return;
    }

    undoButton.disabled = false;
    clearButton.disabled = false;

    history.slice(0, 5).forEach((entry) => {
      const item = createElement("div", "history-item");

      const header = createElement("div", "history-item-header");
      const action = createElement("div", "history-item-action");
      action.textContent = `${formatActionLabel(entry.action)} (${entry.tabs.length})`;

      const timestamp = createElement("div", "history-item-time");
      timestamp.textContent = formatDate(entry.timestamp);

      header.appendChild(action);
      header.appendChild(timestamp);

      item.appendChild(header);
      historyList.appendChild(item);
    });
  } catch (error: unknown) {
    console.error("Failed to load undo history:", error);
  }
}

async function performUndoAction(): Promise<void> {
  try {
    const result = await performUndo();
    setStatus(result, "success");
    await renderHistory();
  } catch (error: unknown) {
    setStatus(
      error instanceof Error ? error.message : "Unable to undo",
      "error"
    );
  }
}

async function clearHistoryAction(): Promise<void> {
  try {
    await clearUndoHistory();
    await renderHistory();
    setStatus("History cleared", "success");
  } catch (error: unknown) {
    setStatus(
      error instanceof Error ? error.message : "Unable to clear history",
      "error"
    );
  }
}

export async function refreshHistory(): Promise<void> {
  await renderHistory();
}

function formatActionLabel(action: string): string {
  switch (action) {
    case "close-duplicate-tabs":
      return "Closed duplicate tabs";
    case "close-tabs-to-left":
      return "Closed tabs to the left";
    case "close-tabs-to-right":
      return "Closed tabs to the right";
    case "close-other-tabs":
      return "Closed other tabs";
    case "close-selected-tabs":
      return "Closed selected tabs";
    default:
      return action;
  }
}
