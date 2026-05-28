import type {
  ExtensionMessage,
  ExtensionResponse,
  TabAction
} from "../shared/tab-action.js";
import { isTabAction } from "../shared/tab-action.js";
import {
  formatTabUrl,
  getCurrentTab,
  getCurrentWindowTabs
} from "../shared/tab-utils.js";
import { getRequiredElement, setStatus } from "./dom.js";

let currentTabTitleElement: HTMLElement;
let currentTabUrlElement: HTMLElement;
let currentTabStatusElement: HTMLElement;
let currentTabMutedElement: HTMLElement;
let totalTabsElement: HTMLElement;
let mutedTabsElement: HTMLElement;
let audibleTabsElement: HTMLElement;
let actionConfirmationPanel: HTMLElement;
let actionConfirmText: HTMLElement;
let confirmActionButton: HTMLButtonElement;
let cancelActionButton: HTMLButtonElement;
let pendingConfirmationAction: TabAction | null = null;

const confirmActions = new Set<TabAction>([
  "close-duplicate-tabs",
  "close-tabs-to-left",
  "close-tabs-to-right",
  "close-other-tabs"
]);

function ensureElements(): void {
  if (currentTabTitleElement) {
    return;
  }

  currentTabTitleElement = getRequiredElement<HTMLElement>(
    "current-tab-title"
  );
  currentTabUrlElement = getRequiredElement<HTMLElement>("current-tab-url");
  currentTabStatusElement = getRequiredElement<HTMLElement>(
    "current-tab-status"
  );
  currentTabMutedElement = getRequiredElement<HTMLElement>(
    "current-tab-muted"
  );
  totalTabsElement = getRequiredElement<HTMLElement>("total-tabs");
  mutedTabsElement = getRequiredElement<HTMLElement>("muted-tabs");
  audibleTabsElement = getRequiredElement<HTMLElement>("audible-tabs");
  actionConfirmationPanel = getRequiredElement<HTMLElement>(
    "action-confirmation"
  );
  actionConfirmText = getRequiredElement<HTMLElement>(
    "action-confirm-text"
  );
  confirmActionButton = getRequiredElement<HTMLButtonElement>(
    "confirm-action-button"
  );
  cancelActionButton = getRequiredElement<HTMLButtonElement>(
    "cancel-action-button"
  );
}

export async function initializeActionsPanel(): Promise<void> {
  ensureElements();
  bindActionButtons();
  await refreshPanelData();
}

export async function refreshPanelData(): Promise<void> {
  ensureElements();

  const [currentTab, tabs] = await Promise.all([
    getCurrentTab(),
    getCurrentWindowTabs()
  ]);

  renderCurrentTab(currentTab);
  renderStats(tabs);
}

function bindActionButtons(): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>(
    "[data-tab-action]"
  );

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.tabAction;

      if (!isTabAction(action)) {
        setStatus("Action not configured", "error");
        return;
      }

      void handleActionClick(action);
    });
  });

  confirmActionButton.addEventListener("click", () => {
    void handleConfirm();
  });

  cancelActionButton.addEventListener("click", () => {
    hideConfirmation();
  });
}

function handleActionClick(action: TabAction): void {
  if (confirmActions.has(action)) {
    if (pendingConfirmationAction === action) {
      return;
    }

    showConfirmation(action);
    return;
  }

  void executeAction(action);
}

async function handleConfirm(): Promise<void> {
  if (pendingConfirmationAction === null) {
    return;
  }

  const actionToExecute = pendingConfirmationAction;
  hideConfirmation();
  await executeAction(actionToExecute);
}

function showConfirmation(action: TabAction): void {
  pendingConfirmationAction = action;
  actionConfirmText.textContent = `Confirm ${getConfirmationLabel(
    action
  )}?`;
  actionConfirmationPanel.classList.remove("hidden");
  setStatus("Please confirm before proceeding", "neutral");
}

function hideConfirmation(): void {
  pendingConfirmationAction = null;
  actionConfirmationPanel.classList.add("hidden");
  actionConfirmText.textContent = "";
}

function getConfirmationLabel(action: TabAction): string {
  switch (action) {
    case "close-duplicate-tabs":
      return "closing duplicate tabs";
    case "close-tabs-to-left":
      return "closing tabs to the left";
    case "close-tabs-to-right":
      return "closing tabs to the right";
    case "close-other-tabs":
      return "closing other tabs";
    default:
      return "this action";
  }
}

async function executeAction(action: TabAction): Promise<void> {
  hideConfirmation();
  setButtonsDisabled(true);
  setStatus("Executing action...");

  const message: ExtensionMessage = {
    action
  };

  try {
    const response = await chrome.runtime.sendMessage<
      ExtensionMessage,
      ExtensionResponse
    >(message);

    if (response.success) {
      setStatus(response.message, "success");
    } else {
      setStatus(response.message, "error");
    }

    await refreshPanelData();
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Error executing action";

    setStatus(errorMessage, "error");
  } finally {
    setButtonsDisabled(false);
  }
}

function setButtonsDisabled(disabled: boolean): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>(
    "[data-tab-action]"
  );

  buttons.forEach((button) => {
    button.disabled = disabled;
  });
}

function renderCurrentTab(tab: chrome.tabs.Tab | undefined): void {
  if (tab === undefined) {
    currentTabTitleElement.textContent =
      "Unable to retrieve current tab";
    currentTabUrlElement.textContent = "";
    currentTabStatusElement.textContent = "No data";
    currentTabMutedElement.textContent = "No data";
    return;
  }

  currentTabTitleElement.textContent = tab.title ?? "Untitled";
  currentTabUrlElement.textContent = formatTabUrl(tab.url);

  const statusLabels: string[] = [];

  if (tab.active) {
    statusLabels.push("Active");
  }

  if (tab.pinned) {
    statusLabels.push("Pinned");
  }

  currentTabStatusElement.textContent =
    statusLabels.length > 0 ? statusLabels.join(" · ") : "No activa";

  const isMuted = tab.mutedInfo?.muted ?? false;
  const isAudible = tab.audible ?? false;

  if (isMuted) {
    currentTabMutedElement.textContent = "Muted";
    return;
  }

  if (isAudible) {
    currentTabMutedElement.textContent = "Playing audio";
    return;
  }

  currentTabMutedElement.textContent = "No audio";
}

function renderStats(tabs: chrome.tabs.Tab[]): void {
  totalTabsElement.textContent = tabs.length.toString();
  mutedTabsElement.textContent =
    tabs.filter((tab) => tab.mutedInfo?.muted === true).length.toString();
  audibleTabsElement.textContent =
    tabs.filter((tab) => tab.audible === true).length.toString();
}
