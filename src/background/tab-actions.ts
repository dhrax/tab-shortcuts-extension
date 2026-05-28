import type { TabAction } from "../shared/tab-action.js";
import {
  getCurrentTab,
  getCurrentWindowTabs,
  getExistingTabIds,
  isInternalUrl
} from "../shared/tab-utils.js";

async function duplicateCurrentTab(): Promise<void> {
  const tab = await getCurrentTab();

  if (tab?.id === undefined) {
    return;
  }

  await chrome.tabs.duplicate(tab.id);
}

async function toggleMuteCurrentTab(): Promise<void> {
  const tab = await getCurrentTab();

  if (tab?.id === undefined) {
    return;
  }

  const isMuted = tab.mutedInfo?.muted ?? false;

  await chrome.tabs.update(tab.id, {
    muted: !isMuted
  });
}

async function muteOtherTabs(): Promise<void> {
  const currentTab = await getCurrentTab();

  if (currentTab?.id === undefined) {
    return;
  }

  const tabs = await getCurrentWindowTabs();

  for (const tab of tabs) {
    if (tab.id === undefined) {
      continue;
    }

    await chrome.tabs.update(tab.id, {
      muted: tab.id !== currentTab.id
    });
  }
}

async function closeDuplicateTabs(): Promise<void> {
  const tabs = await getCurrentWindowTabs();

  const seenUrls = new Set<string>();
  const duplicateTabIds: number[] = [];

  for (const tab of tabs) {
    if (tab.id === undefined || tab.url === undefined) {
      continue;
    }

    if (tab.pinned || isInternalUrl(tab.url)) {
      continue;
    }

    if (seenUrls.has(tab.url)) {
      duplicateTabIds.push(tab.id);
    } else {
      seenUrls.add(tab.url);
    }
  }

  await closeTabsById(duplicateTabIds);
}

async function closeTabsToLeft(): Promise<void> {
  const currentTab = await getCurrentTab();

  if (currentTab?.id === undefined) {
    return;
  }

  const tabs = await getCurrentWindowTabs();

  const tabIdsToClose = tabs
    .filter((tab) => tab.id !== undefined)
    .filter((tab) => !tab.pinned)
    .filter((tab) => tab.index < currentTab.index)
    .map((tab) => tab.id as number);

  await closeTabsById(tabIdsToClose);
}

async function closeTabsToRight(): Promise<void> {
  const currentTab = await getCurrentTab();

  if (currentTab?.id === undefined) {
    return;
  }

  const tabs = await getCurrentWindowTabs();

  const tabIdsToClose = tabs
    .filter((tab) => tab.id !== undefined)
    .filter((tab) => !tab.pinned)
    .filter((tab) => tab.index > currentTab.index)
    .map((tab) => tab.id as number);

  await closeTabsById(tabIdsToClose);
}

async function closeOtherTabs(): Promise<void> {
  const currentTab = await getCurrentTab();

  if (currentTab?.id === undefined) {
    return;
  }

  const tabs = await getCurrentWindowTabs();

  const tabIdsToClose = tabs
    .filter((tab) => tab.id !== undefined)
    .filter((tab) => tab.id !== currentTab.id)
    .filter((tab) => !tab.pinned)
    .map((tab) => tab.id as number);

  await closeTabsById(tabIdsToClose);
}

async function closeTabsById(tabIds: number[]): Promise<void> {
  if (tabIds.length === 0) {
    return;
  }

  await chrome.tabs.remove(tabIds);
}

async function togglePinCurrentTab(): Promise<void> {
  const tab = await getCurrentTab();

  if (tab?.id === undefined) {
    return;
  }

  const isPinned = tab.pinned ?? false;

  await chrome.tabs.update(tab.id, {
    pinned: !isPinned
  });
}

export async function handleTabAction(action: TabAction): Promise<string> {
  switch (action) {
    case "duplicate-current-tab":
      await duplicateCurrentTab();
      return "Tab duplicated";

    case "toggle-mute-current-tab":
      await toggleMuteCurrentTab();
      return "Mute state changed";

    case "mute-other-tabs":
      await muteOtherTabs();
      return "Other tabs muted";

    case "close-duplicate-tabs":
      await closeDuplicateTabs();
      return "Duplicate tabs closed";

    case "close-tabs-to-left":
      await closeTabsToLeft();
      return "Tabs to the left closed";

    case "close-tabs-to-right":
      await closeTabsToRight();
      return "Tabs to the right closed";

    case "close-other-tabs":
      await closeOtherTabs();
      return "Other tabs closed";

    case "toggle-pin-current-tab":
      await togglePinCurrentTab();
      return "Pin state changed";
  }
}