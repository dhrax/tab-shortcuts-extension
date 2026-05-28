import { createElement, getRequiredElement, setStatus, formatDate } from "./dom.js";
import {
  loadCleanupSettings,
  loadSavedSessions,
  loadTabActivity,
  saveCleanupSettings,
  saveSavedSessions
} from "../shared/storage.js";
import type { CleanupSettings, SavedSession } from "../shared/storage.js";
import { isInternalUrl } from "../shared/tab-utils.js";
import { recordClosedTabs } from "../shared/undo-history.js";
import { refreshHistory } from "./history.js";

let thresholdInput: HTMLInputElement;
let includePinnedInput: HTMLInputElement;
let refreshButton: HTMLButtonElement;
let closeButton: HTMLButtonElement;
let cleanupList: HTMLElement;
let cleanupSummary: HTMLElement;
let cleanupOffer: HTMLElement;
let cleanupSessionNameInput: HTMLInputElement;
let saveAndCloseButton: HTMLButtonElement;
let closeOnlyButton: HTMLButtonElement;
let cancelCleanupButton: HTMLButtonElement;
let pendingInactiveTabs: chrome.tabs.Tab[] = [];

function ensureElements(): void {
  if (thresholdInput) {
    return;
  }

  thresholdInput = getRequiredElement<HTMLInputElement>(
    "inactive-threshold-input"
  );
  includePinnedInput = getRequiredElement<HTMLInputElement>(
    "include-pinned-cleanup-input"
  );
  refreshButton = getRequiredElement<HTMLButtonElement>(
    "refresh-cleanup-button"
  );
  closeButton = getRequiredElement<HTMLButtonElement>(
    "close-inactive-button"
  );
  cleanupList = getRequiredElement<HTMLElement>("cleanup-list");
  cleanupSummary = getRequiredElement<HTMLElement>("cleanup-summary");
  cleanupOffer = getRequiredElement<HTMLElement>("cleanup-save-offer");
  cleanupSessionNameInput = getRequiredElement<HTMLInputElement>(
    "cleanup-session-name-input"
  );
  saveAndCloseButton = getRequiredElement<HTMLButtonElement>(
    "save-close-inactive-button"
  );
  closeOnlyButton = getRequiredElement<HTMLButtonElement>(
    "close-without-saving-button"
  );
  cancelCleanupButton = getRequiredElement<HTMLButtonElement>(
    "cancel-cleanup-button"
  );
}

export async function initializeCleanup(): Promise<void> {
  ensureElements();

  const settings = await loadCleanupSettings();
  thresholdInput.value = settings.inactiveThresholdHours.toString();
  includePinnedInput.checked = settings.includePinnedTabs;

  thresholdInput.addEventListener("change", () => {
    void saveSettingsAndRender();
  });

  includePinnedInput.addEventListener("change", () => {
    void saveSettingsAndRender();
  });

  refreshButton.addEventListener("click", () => {
    void renderCleanup();
  });

  closeButton.addEventListener("click", () => {
    void showCloseOffer();
  });

  saveAndCloseButton.addEventListener("click", () => {
    void closeInactiveTabs(true);
  });

  closeOnlyButton.addEventListener("click", () => {
    void closeInactiveTabs(false);
  });

  cancelCleanupButton.addEventListener("click", () => {
    hideCloseOffer();
  });

  await renderCleanup();
}

async function saveSettingsAndRender(): Promise<void> {
  await saveCleanupSettings(getSettingsFromForm());
  hideCloseOffer();
  await renderCleanup();
}

async function renderCleanup(): Promise<void> {
  ensureElements();

  const inactiveTabs = await getInactiveTabs();
  cleanupList.innerHTML = "";
  pendingInactiveTabs = [];
  closeButton.disabled = inactiveTabs.length === 0;

  const thresholdHours = getThresholdHours();
  cleanupSummary.textContent = `${inactiveTabs.length} tabs inactive for more than ${thresholdHours} hour${thresholdHours === 1 ? "" : "s"}`;

  if (inactiveTabs.length === 0) {
    const empty = createElement("div", "empty-message");
    empty.textContent = "No inactive tabs found";
    cleanupList.appendChild(empty);
    return;
  }

  inactiveTabs.forEach(({ tab, lastActiveAt }) => {
    const item = createElement("div", "cleanup-item");
    const header = createElement("div", "cleanup-item-header");
    const title = createElement("div", "cleanup-item-title");
    const meta = createElement("div", "cleanup-item-meta");
    const url = createElement("div", "cleanup-item-url");

    title.textContent = tab.title ?? "Untitled";
    meta.textContent = `Last active ${formatDate(new Date(lastActiveAt).toISOString())}`;
    url.textContent = tab.url ?? "URL unavailable";

    header.append(title, meta);
    item.append(header, url);
    cleanupList.appendChild(item);
  });
}

async function showCloseOffer(): Promise<void> {
  const inactiveTabs = await getInactiveTabs();

  if (inactiveTabs.length === 0) {
    setStatus("No inactive tabs to close", "error");
    await renderCleanup();
    return;
  }

  pendingInactiveTabs = inactiveTabs.map((entry) => entry.tab);
  cleanupSessionNameInput.value = getDefaultCleanupSessionName();
  cleanupOffer.classList.remove("hidden");
}

function hideCloseOffer(): void {
  pendingInactiveTabs = [];
  cleanupOffer.classList.add("hidden");
}

async function closeInactiveTabs(saveFirst: boolean): Promise<void> {
  const tabs = pendingInactiveTabs.length > 0
    ? pendingInactiveTabs
    : (await getInactiveTabs()).map((entry) => entry.tab);
  const tabsToClose = tabs.filter((tab) => tab.id !== undefined);

  if (tabsToClose.length === 0) {
    setStatus("No inactive tabs to close", "error");
    hideCloseOffer();
    await renderCleanup();
    return;
  }

  try {
    if (saveFirst) {
      await saveTabsAsSession(tabsToClose, cleanupSessionNameInput.value);
    }

    await recordClosedTabs("close-inactive-tabs", tabsToClose);
    await chrome.tabs.remove(tabsToClose.map((tab) => tab.id as number));

    setStatus(
      saveFirst ? "Inactive tabs saved and closed" : "Inactive tabs closed",
      "success"
    );
    hideCloseOffer();
    await renderCleanup();
    await refreshHistory();
  } catch (error: unknown) {
    setStatus(
      error instanceof Error ? error.message : "Unable to close inactive tabs",
      "error"
    );
  }
}

async function getInactiveTabs(): Promise<Array<{ tab: chrome.tabs.Tab; lastActiveAt: number }>> {
  const [tabs, activity] = await Promise.all([
    chrome.tabs.query({}),
    loadTabActivity()
  ]);
  const settings = getSettingsFromForm();
  const thresholdMs = settings.inactiveThresholdHours * 60 * 60 * 1000;
  const cutoff = Date.now() - thresholdMs;

  return tabs
    .filter((tab) => tab.id !== undefined)
    .filter((tab) => settings.includePinnedTabs || !tab.pinned)
    .map((tab) => ({
      tab,
      lastActiveAt: activity[(tab.id as number).toString()] ?? Date.now()
    }))
    .filter((entry) => entry.lastActiveAt < cutoff)
    .sort((a, b) => a.lastActiveAt - b.lastActiveAt);
}

function getSettingsFromForm(): CleanupSettings {
  return {
    inactiveThresholdHours: getThresholdHours(),
    includePinnedTabs: includePinnedInput.checked
  };
}

function getThresholdHours(): number {
  const value = Number(thresholdInput.value);

  if (!Number.isFinite(value) || value < 1) {
    return 1;
  }

  return Math.round(value);
}

function getDefaultCleanupSessionName(): string {
  const timestamp = new Date()
    .toISOString()
    .replace("T", " ")
    .slice(0, 16);

  return `Inactive tabs ${timestamp}`;
}

async function saveTabsAsSession(
  tabs: chrome.tabs.Tab[],
  name: string
): Promise<void> {
  const sessionTabs = tabs
    .filter((tab) => tab.url !== undefined && !isInternalUrl(tab.url))
    .map((tab) => ({
      title: tab.title ?? "Untitled",
      url: tab.url as string
    }));

  if (sessionTabs.length === 0) {
    throw new Error("No valid inactive tabs to save");
  }

  const sessionName = name.trim() || getDefaultCleanupSessionName();
  const sessions = await loadSavedSessions();
  const newSession: SavedSession = {
    id: crypto.randomUUID(),
    name: sessionName,
    createdAt: new Date().toISOString(),
    tabs: sessionTabs
  };

  await saveSavedSessions([newSession, ...sessions]);
}
