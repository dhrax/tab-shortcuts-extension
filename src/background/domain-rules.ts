import { loadDomainRules } from "../shared/storage.js";
import { isInternalUrl } from "../shared/tab-utils.js";

async function getTab(tabId: number): Promise<chrome.tabs.Tab | undefined> {
  return new Promise((resolve, reject) => {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
if (chrome.runtime.lastError.message?.includes("No tab with id")) {
          resolve(undefined);
          return;
        }

        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(tab);
    });
  });
}

async function queryTabs(queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> {
  return new Promise((resolve, reject) => {
    chrome.tabs.query(queryInfo, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(tabs);
    });
  });
}

async function updateTab(
  tabId: number,
  updateProperties: chrome.tabs.UpdateProperties
): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.tabs.update(tabId, updateProperties, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve();
    });
  });
}

function getTabHostname(url: string | undefined): string | null {
  if (url === undefined || isInternalUrl(url)) {
    return null;
  }

  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

async function applyRulesToTab(tabId: number): Promise<void> {
  try {
    const tab = await getTab(tabId);

    if (!tab?.id || !tab.url || tab.status !== "complete") {
      return;
    }

    if (isInternalUrl(tab.url)) {
      return;
    }

    const hostname = getTabHostname(tab.url);

    if (hostname === null || tab.windowId === undefined) {
      return;
    }

    const rules = await loadDomainRules();
    const enabledRules = rules.filter((rule) => rule.enabled && rule.hostname === hostname);

    if (enabledRules.length === 0) {
      return;
    }

    for (const rule of enabledRules) {
      switch (rule.action) {
        case "mute":
          if (!tab.mutedInfo?.muted) {
            await updateTab(tab.id, { muted: true });
          }
          break;
        case "pin":
          if (!tab.pinned) {
            await updateTab(tab.id, { pinned: true });
          }
          break;
        case "group":
          await groupDomainTabs(tab, hostname);
          break;
      }
    }
  } catch (error: unknown) {
    console.error("Failed to apply domain rules:", error);
  }
}

async function groupDomainTabs(tab: chrome.tabs.Tab, hostname: string): Promise<void> {
  if (tab.windowId === undefined) {
    return;
  }

  try {
    const windowTabs = await queryTabs({ windowId: tab.windowId });
    const matchingIds = windowTabs
      .filter((candidate) =>
        candidate.id !== undefined &&
        candidate.url !== undefined &&
        !isInternalUrl(candidate.url) &&
        getTabHostname(candidate.url) === hostname
      )
      .map((candidate) => candidate.id as number);

    if (matchingIds.length < 2) {
      return;
    }

    chrome.tabs.group({ tabIds: matchingIds }, () => {
      if (chrome.runtime.lastError) {
        console.error("Failed to group tabs by domain:", chrome.runtime.lastError.message);
      }
    });
  } catch (error: unknown) {
    console.error("Failed to query tabs for domain grouping:", error);
  }
}

export function initializeDomainRuleListeners(): void {
  chrome.tabs.onCreated.addListener((tab) => {
    if (tab.id !== undefined && tab.status === "complete") {
      void applyRulesToTab(tab.id);
    }
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === "complete") {
      void applyRulesToTab(tabId);
    }
  });
}
