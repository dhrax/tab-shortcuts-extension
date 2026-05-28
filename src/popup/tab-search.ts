import { getRequiredElement, createElement, setStatus } from "./dom.js";
import { formatTabUrl } from "../shared/tab-utils.js";
import { refreshPanelData } from "./actions-panel.js";
import { recordClosedTabs } from "../shared/undo-history.js";
import { refreshHistory } from "./history.js";

let searchInput: HTMLInputElement;
let resultsContainer: HTMLDivElement;
let closeSelectedButton: HTMLButtonElement;
let muteSelectedButton: HTMLButtonElement;
let unmuteSelectedButton: HTMLButtonElement;
let pinSelectedButton: HTMLButtonElement;
let moveSelectedButton: HTMLButtonElement;
let selectedCountElement: HTMLElement;

const selectedTabIds = new Set<number>();

export function initializeTabSearch(): void {
  searchInput = getRequiredElement<HTMLInputElement>("tab-search-input");
  resultsContainer = getRequiredElement<HTMLDivElement>("tab-search-results");
  closeSelectedButton = getRequiredElement<HTMLButtonElement>(
    "close-selected-button"
  );
  muteSelectedButton = getRequiredElement<HTMLButtonElement>(
    "mute-selected-button"
  );
  unmuteSelectedButton = getRequiredElement<HTMLButtonElement>(
    "unmute-selected-button"
  );
  pinSelectedButton = getRequiredElement<HTMLButtonElement>(
    "pin-selected-button"
  );
  moveSelectedButton = getRequiredElement<HTMLButtonElement>(
    "move-selected-button"
  );
  selectedCountElement = getRequiredElement<HTMLElement>(
    "selected-count"
  );

  searchInput.addEventListener("input", () => {
    void renderSearchResults();
  });

  closeSelectedButton.addEventListener("click", () => {
    void handleBulkClose();
  });

  muteSelectedButton.addEventListener("click", () => {
    void handleBulkMute(true);
  });

  unmuteSelectedButton.addEventListener("click", () => {
    void handleBulkMute(false);
  });

  pinSelectedButton.addEventListener("click", () => {
    void handleBulkPin();
  });

  moveSelectedButton.addEventListener("click", () => {
    void handleBulkMoveToNewWindow();
  });

  resultsContainer.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const checkbox = target.closest("input[data-search-checkbox]") as
      | HTMLInputElement
      | null;

    if (checkbox !== null) {
      updateSelection(checkbox);
      return;
    }

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
    updateSelectedCount();
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
    const checkboxWrapper = createElement("label", "search-item-checkbox");
    const checkbox = createElement("input", "") as HTMLInputElement;

    checkbox.type = "checkbox";
    checkbox.dataset.searchCheckbox = "true";
    checkbox.dataset.tabId = tab.id.toString();
    checkbox.checked = selectedTabIds.has(tab.id);

    checkboxWrapper.appendChild(checkbox);
    checkboxWrapper.appendChild(createElement("span", "checkbox-label"));

    title.textContent = tab.title ?? "Untitled";
    url.textContent = formatTabUrl(tab.url);

    const goButton = createElement("button", "small-button", {
      "data-search-action": "goto",
      "data-tab-id": tab.id.toString()
    });
    goButton.textContent = "Go";

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
    info.appendChild(checkboxWrapper);
    card.append(info, actions);
    resultsContainer.appendChild(card);
  });

  updateSelectedCount();
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
        await refreshHistory();
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

function updateSelection(checkbox: HTMLInputElement): void {
  const tabIdValue = checkbox.dataset.tabId;

  if (!tabIdValue) {
    return;
  }

  const tabId = Number(tabIdValue);

  if (checkbox.checked) {
    selectedTabIds.add(tabId);
  } else {
    selectedTabIds.delete(tabId);
  }

  updateSelectedCount();
}

function updateSelectedCount(): void {
  selectedCountElement.textContent = `${selectedTabIds.size} selected`;
}

async function handleBulkClose(): Promise<void> {
  const tabIds = Array.from(selectedTabIds);
  if (tabIds.length === 0) {
    setStatus("No tabs selected", "error");
    return;
  }

  const tabs = await getTabsById(tabIds);
  if (tabs.length === 0) {
    setStatus("Selected tabs are no longer available", "error");
    selectedTabIds.clear();
    await renderSearchResults();
    return;
  }

  await recordClosedTabs("close-selected-tabs", tabs);
  await chrome.tabs.remove(tabs.map((tab) => tab.id as number));
  setStatus("Selected tabs closed", "success");
  selectedTabIds.clear();
  await renderSearchResults();
  await refreshPanelData();
  await refreshHistory();
}

async function handleBulkMute(mute: boolean): Promise<void> {
  const tabIds = Array.from(selectedTabIds);

  if (tabIds.length === 0) {
    setStatus("No tabs selected", "error");
    return;
  }

  for (const tabId of tabIds) {
    const tab = await chrome.tabs.get(tabId);
    await chrome.tabs.update(tabId, {
      muted: mute ? true : false
    });
  }

  setStatus(mute ? "Selected tabs muted" : "Selected tabs unmuted", "success");
  await renderSearchResults();
  await refreshPanelData();
}

async function handleBulkPin(): Promise<void> {
  const tabIds = Array.from(selectedTabIds);

  if (tabIds.length === 0) {
    setStatus("No tabs selected", "error");
    return;
  }

  for (const tabId of tabIds) {
    const tab = await chrome.tabs.get(tabId);
    await chrome.tabs.update(tabId, { pinned: true });
  }

  setStatus("Selected tabs pinned", "success");
  await renderSearchResults();
  await refreshPanelData();
}

async function handleBulkMoveToNewWindow(): Promise<void> {
  const tabIds = Array.from(selectedTabIds);

  if (tabIds.length === 0) {
    setStatus("No tabs selected", "error");
    return;
  }

  const newWindow = await chrome.windows.create({ tabId: tabIds[0], focused: true });
  if (tabIds.length > 1 && newWindow.id !== undefined) {
    await chrome.tabs.move(tabIds.slice(1), {
      windowId: newWindow.id,
      index: -1
    });
  }

  setStatus("Selected tabs moved to new window", "success");
  selectedTabIds.clear();
  await renderSearchResults();
  await refreshPanelData();
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
  const tabs = await getTabsById([tabId]);
  await recordClosedTabs("close-selected-tabs", tabs);
  await chrome.tabs.remove(tabId);
}

async function getTabsById(tabIds: number[]): Promise<chrome.tabs.Tab[]> {
  const tabs = await Promise.all(
    tabIds.map(async (tabId) => {
      try {
        return await chrome.tabs.get(tabId);
      } catch {
        return undefined;
      }
    })
  );

  return tabs.filter((tab): tab is chrome.tabs.Tab => tab !== undefined);
}
