import { loadTabActivity, saveTabActivity } from "../shared/storage.js";

async function markTabActive(tabId: number, timestamp: number = Date.now()): Promise<void> {
  const activity = await loadTabActivity();
  activity[tabId.toString()] = timestamp;
  await saveTabActivity(activity);
}

async function removeTabActivity(tabId: number): Promise<void> {
  const activity = await loadTabActivity();
  delete activity[tabId.toString()];
  await saveTabActivity(activity);
}

async function seedExistingTabs(): Promise<void> {
  const tabs = await chrome.tabs.query({});
  const activity = await loadTabActivity();
  const now = Date.now();
  let changed = false;

  tabs.forEach((tab) => {
    if (tab.id === undefined) {
      return;
    }

    const key = tab.id.toString();

    if (activity[key] === undefined || tab.active) {
      activity[key] = now;
      changed = true;
    }
  });

  if (changed) {
    await saveTabActivity(activity);
  }
}

export function initializeTabActivityTracking(): void {
  void seedExistingTabs();

  chrome.tabs.onActivated.addListener((activeInfo) => {
    void markTabActive(activeInfo.tabId);
  });

  chrome.tabs.onUpdated.addListener((tabId, _changeInfo, tab) => {
    if (tab.active) {
      void markTabActive(tabId);
    }
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    void removeTabActivity(tabId);
  });
}
