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

      void executeAction(action);
    });
  });
}

async function executeAction(action: TabAction): Promise<void> {
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
