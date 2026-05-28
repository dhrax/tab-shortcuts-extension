import type {
  ExtensionMessage,
  ExtensionResponse,
  TabAction
} from "./shared/tab-action.js";
import { isTabAction } from "./shared/tab-action.js";
import {
  formatTabUrl,
  getCurrentTab,
  getCurrentWindowTabs
} from "./shared/tab-utils.js";

const currentTabTitleElement = getRequiredElement("current-tab-title");
const currentTabUrlElement = getRequiredElement("current-tab-url");
const currentTabStatusElement = getRequiredElement("current-tab-status");
const currentTabMutedElement = getRequiredElement("current-tab-muted");

const totalTabsElement = getRequiredElement("total-tabs");
const mutedTabsElement = getRequiredElement("muted-tabs");
const audibleTabsElement = getRequiredElement("audible-tabs");

const statusElement = getRequiredElement("status");

function getRequiredElement(id: string): HTMLElement {
  const element = document.getElementById(id);

  if (element === null) {
    throw new Error(`No se ha encontrado el elemento con id: ${id}`);
  }

  return element;
}

function setStatus(
  message: string,
  type: "success" | "error" | "neutral" = "neutral"
): void {
  statusElement.textContent = message;
  statusElement.classList.remove("success", "error");

  if (type !== "neutral") {
    statusElement.classList.add(type);
  }
}

async function loadPanelData(): Promise<void> {
  const [currentTab, tabs] = await Promise.all([
    getCurrentTab(),
    getCurrentWindowTabs()
  ]);

  renderCurrentTab(currentTab);
  renderStats(tabs);
}

function renderCurrentTab(tab: chrome.tabs.Tab | undefined): void {
  if (tab === undefined) {
    currentTabTitleElement.textContent = "No se ha podido obtener la pestaña actual";
    currentTabUrlElement.textContent = "";
    currentTabStatusElement.textContent = "Sin datos";
    currentTabMutedElement.textContent = "Sin datos";
    return;
  }

  currentTabTitleElement.textContent = tab.title ?? "Sin título";
  currentTabUrlElement.textContent = formatTabUrl(tab.url);

  const statusLabels: string[] = [];

  if (tab.active) {
    statusLabels.push("Activa");
  }

  if (tab.pinned) {
    statusLabels.push("Fijada");
  }

  currentTabStatusElement.textContent =
    statusLabels.length > 0 ? statusLabels.join(" · ") : "No activa";

  const isMuted = tab.mutedInfo?.muted ?? false;
  const isAudible = tab.audible ?? false;

  if (isMuted) {
    currentTabMutedElement.textContent = "Muteada";
    return;
  }

  if (isAudible) {
    currentTabMutedElement.textContent = "Reproduciendo audio";
    return;
  }

  currentTabMutedElement.textContent = "Sin audio";
}

function renderStats(tabs: chrome.tabs.Tab[]): void {
  const totalTabs = tabs.length;
  const mutedTabs = tabs.filter((tab) => tab.mutedInfo?.muted === true).length;
  const audibleTabs = tabs.filter((tab) => tab.audible === true).length;

  totalTabsElement.textContent = totalTabs.toString();
  mutedTabsElement.textContent = mutedTabs.toString();
  audibleTabsElement.textContent = audibleTabs.toString();
}

function bindActionButtons(): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>("[data-action]");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;

      if (!isTabAction(action)) {
        setStatus("Acción no configurada", "error");
        return;
      }

      void executeAction(action);
    });
  });
}

async function executeAction(action: TabAction): Promise<void> {
  setButtonsDisabled(true);
  setStatus("Ejecutando acción...");

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

    await loadPanelData();
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Error ejecutando la acción";

    setStatus(errorMessage, "error");
  } finally {
    setButtonsDisabled(false);
  }
}

function setButtonsDisabled(disabled: boolean): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>("[data-action]");

  buttons.forEach((button) => {
    button.disabled = disabled;
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bindActionButtons();

  void loadPanelData().catch((error: unknown) => {
    const errorMessage =
      error instanceof Error ? error.message : "Error cargando el panel";

    setStatus(errorMessage, "error");
  });
});