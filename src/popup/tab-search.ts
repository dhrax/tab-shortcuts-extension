import { getRequiredElement, createElement, setStatus } from "./dom.js";
import { formatTabUrl } from "../shared/tab-utils.js";
import { refreshPanelData } from "./actions-panel.js";

let searchInput: HTMLInputElement;
let resultsContainer: HTMLDivElement;

export function initializeTabSearch(): void {
  searchInput = getRequiredElement<HTMLInputElement>("tab-search-input");
  resultsContainer = getRequiredElement<HTMLDivElement>("tab-search-results");

  searchInput.addEventListener("input", () => {
    void renderSearchResults();
  });

  resultsContainer.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const button = target.closest("button[data-search-action]") as
      | HTMLButtonElement
      | null;

    if (button === null) {
      return;
    }

    const tabIdValue = button.dataset.tabId;
    const action = button.dataset.searchAction;

    if (!tabIdValue || !action) {
      return;
    }

    const tabId = Number(tabIdValue);

    void handleSearchAction(action, tabId);
  });

  void renderSearchResults();
}

async function queryAllTabs(): Promise<chrome.tabs.Tab[]> {
  return chrome.tabs.query({});
}

async function renderSearchResults(): Promise<void> {
  const query = searchInput.value.trim().toLowerCase();
  const tabs = await queryAllTabs();

  const visibleTabs = tabs.filter((tab) => {
    if (query === "") {
      return true;
    }

    const title = tab.title ?? "";
    const url = tab.url ?? "";

    return title.toLowerCase().includes(query) || url.toLowerCase().includes(query);
  });

  resultsContainer.innerHTML = "";

  if (visibleTabs.length === 0) {
    const emptyMessage = createElement("div", "empty-message");
    emptyMessage.textContent = "No tabs found";
    resultsContainer.appendChild(emptyMessage);
    return;
  }

  visibleTabs.forEach((tab) => {
    if (tab.id === undefined) {
      return;
    }

    const card = createElement("div", "search-item");
    const info = createElement("div", "search-item-info");
    const title = createElement("div", "search-item-title");
    const url = createElement("div", "search-item-url");
    const actions = createElement("div", "search-item-actions");

    title.textContent = tab.title ?? "Untitled";
    url.textContent = formatTabUrl(tab.url);

    const goButton = createElement("button", "small-button", {
      "data-search-action": "goto",
      "data-tab-id": tab.id.toString()
    });
    goButton.textContent = "Ir";

    const muteButton = createElement("button", "small-button", {
      "data-search-action": "toggle-mute",
      "data-tab-id": tab.id.toString()
    });
    muteButton.textContent = tab.mutedInfo?.muted ? "Unmute" : "Mute";

    const pinButton = createElement("button", "small-button", {
      "data-search-action": "toggle-pin",
      "data-tab-id": tab.id.toString()
    });
    pinButton.textContent = tab.pinned ? "Unpin" : "Pin";

    const closeButton = createElement("button", "small-button danger", {
      "data-search-action": "close",
      "data-tab-id": tab.id.toString()
    });
    closeButton.textContent = "Cerrar";

    info.appendChild(title);
    info.appendChild(url);
    actions.append(goButton, muteButton, pinButton, closeButton);
    card.append(info, actions);
    resultsContainer.appendChild(card);
  });
}

async function handleSearchAction(
  action: string,
  tabId: number
): Promise<void> {
  try {
    setStatus("Executing action...");

    switch (action) {
      case "goto":
        await goToTab(tabId);
        setStatus("Tab activated", "success");
        break;

      case "toggle-mute":
        await toggleMuteTab(tabId);
        setStatus("Mute state changed", "success");
        break;

      case "toggle-pin":
        await togglePinTab(tabId);
        setStatus("Pin state changed", "success");
        break;

      case "close":
        await closeTab(tabId);
        setStatus("Tab closed", "success");
        break;

      default:
        setStatus("Action not recognized", "error");
        return;
    }

    await renderSearchResults();
    await refreshPanelData();
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Error modifying the tab";
    setStatus(errorMessage, "error");
  }
}

async function goToTab(tabId: number): Promise<void> {
  const tab = await chrome.tabs.get(tabId);

  if (tab.windowId !== undefined) {
    await chrome.windows.update(tab.windowId, { focused: true });
  }

  await chrome.tabs.update(tabId, { active: true });
}

async function toggleMuteTab(tabId: number): Promise<void> {
  const tab = await chrome.tabs.get(tabId);

  await chrome.tabs.update(tabId, {
    muted: !(tab.mutedInfo?.muted ?? false)
  });
}

async function togglePinTab(tabId: number): Promise<void> {
  const tab = await chrome.tabs.get(tabId);

  await chrome.tabs.update(tabId, {
    pinned: !(tab.pinned ?? false)
  });
}

async function closeTab(tabId: number): Promise<void> {
  await chrome.tabs.remove(tabId);
}
