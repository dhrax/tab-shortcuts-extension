export async function getCurrentTab(): Promise<chrome.tabs.Tab | undefined> {
  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  return tabs[0];
}

export async function getCurrentWindowTabs(): Promise<chrome.tabs.Tab[]> {
  return chrome.tabs.query({
    currentWindow: true
  });
}

export function isInternalUrl(url: string): boolean {
  return (
    url.startsWith("chrome://") ||
    url.startsWith("brave://") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:")
  );
}

export function formatTabUrl(url: string | undefined): string {
  if (url === undefined || url.trim() === "") {
    return "URL no disponible";
  }

  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.protocol === "chrome:" || parsedUrl.protocol === "brave:") {
      return url;
    }

    return parsedUrl.hostname + parsedUrl.pathname;
  } catch {
    return url;
  }
}

export function getExistingTabIds(tabs: chrome.tabs.Tab[]): number[] {
  return tabs
    .map((tab) => tab.id)
    .filter((id): id is number => id !== undefined);
}