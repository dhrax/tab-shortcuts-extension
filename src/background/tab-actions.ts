import type { TabAction } from "../shared/tab-action.js";
import {
  getCurrentTab,
  getCurrentWindowTabs,
  getExistingTabIds,
  isInternalUrl
} from "../shared/tab-utils.js";
import { loadSettings } from "../shared/storage.js";

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
  const settings = await loadSettings();
  const tabs = await getCurrentWindowTabs();

  const seenUrls = new Set<string>();
  const duplicateTabIds: number[] = [];

  for (const tab of tabs) {
    if (tab.id === undefined || tab.url === undefined) {
      continue;
    }

    if (shouldSkipTabForClose(tab, settings.ignorePinnedTabs) || isInternalUrl(tab.url)) {
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
  const settings = await loadSettings();
  const currentTab = await getCurrentTab();

  if (currentTab?.id === undefined) {
    return;
  }

  const tabs = await getCurrentWindowTabs();

  const tabIdsToClose = tabs
    .filter((tab) => tab.id !== undefined)
    .filter((tab) => !shouldSkipTabForClose(tab, settings.ignorePinnedTabs))
    .filter((tab) => tab.index < currentTab.index)
    .map((tab) => tab.id as number);

  await closeTabsById(tabIdsToClose);
}

async function closeTabsToRight(): Promise<void> {
  const settings = await loadSettings();
  const currentTab = await getCurrentTab();

  if (currentTab?.id === undefined) {
    return;
  }

  const tabs = await getCurrentWindowTabs();

  const tabIdsToClose = tabs
    .filter((tab) => tab.id !== undefined)
    .filter((tab) => !shouldSkipTabForClose(tab, settings.ignorePinnedTabs))
    .filter((tab) => tab.index > currentTab.index)
    .map((tab) => tab.id as number);

  await closeTabsById(tabIdsToClose);
}

async function closeOtherTabs(): Promise<void> {
  const settings = await loadSettings();
  const currentTab = await getCurrentTab();

  if (currentTab?.id === undefined) {
    return;
  }

  const tabs = await getCurrentWindowTabs();

  const tabIdsToClose = tabs
    .filter((tab) => tab.id !== undefined)
    .filter((tab) => tab.id !== currentTab.id)
    .filter((tab) => !shouldSkipTabForClose(tab, settings.ignorePinnedTabs))
    .map((tab) => tab.id as number);

  await closeTabsById(tabIdsToClose);
}

function shouldSkipTabForClose(tab: chrome.tabs.Tab, ignorePinnedTabs: boolean): boolean {
  if (tab.id === undefined || tab.url === undefined) {
    return true;
  }

  if (ignorePinnedTabs && tab.pinned) {
    return true;
  }

  return false;
}

function getTabHostname(url: string | undefined): string | null {
  if (url === undefined || isInternalUrl(url)) {
    return null;
  }

  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname;
  } catch {
    return null;
  }
}

async function groupTabsByDomain(): Promise<void> {
  const tabs = await getCurrentWindowTabs();
  const groups = new Map<string, number[]>();

  for (const tab of tabs) {
    if (tab.id === undefined || tab.pinned || tab.url === undefined) {
      continue;
    }

    const hostname = getTabHostname(tab.url);

    if (hostname === null) {
      continue;
    }

    const entries = groups.get(hostname) ?? [];
    entries.push(tab.id);
    groups.set(hostname, entries);
  }

  for (const tabIds of groups.values()) {
    if (tabIds.length < 2) {
      continue;
    }

    await chrome.tabs.group({ tabIds });
  }
}

async function sortTabsByDomain(): Promise<void> {
  const tabs = await getCurrentWindowTabs();
  const pinnedTabs = tabs.filter((tab) => tab.pinned && tab.id !== undefined);
  const nonPinnedTabs = tabs.filter((tab) => !tab.pinned && tab.id !== undefined);

  const sortedNonPinned = [...nonPinnedTabs].sort((a, b) => {
    const hostnameA = getTabHostname(a.url);
    const hostnameB = getTabHostname(b.url);
    const internalA = hostnameA === null;
    const internalB = hostnameB === null;

    if (internalA !== internalB) {
      return internalA ? 1 : -1;
    }

    if (hostnameA !== hostnameB) {
      return hostnameA && hostnameB
        ? hostnameA.localeCompare(hostnameB, undefined, {
            sensitivity: "base"
          })
        : 0;
    }

    return (a.title ?? "").localeCompare(b.title ?? "", undefined, {
      sensitivity: "base"
    });
  });

  const tabIds = sortedNonPinned.map((tab) => tab.id as number);

  if (tabIds.length === 0) {
    return;
  }

  const pinnedCount = pinnedTabs.length;
  await chrome.tabs.move(tabIds, { index: pinnedCount });
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

    case "group-tabs-by-domain":
      await groupTabsByDomain();
      return "Tabs grouped by domain";

    case "sort-tabs-by-domain":
      await sortTabsByDomain();
      return "Tabs sorted by domain";

    case "toggle-pin-current-tab":
      await togglePinCurrentTab();
      return "Pin state changed";
  }
}