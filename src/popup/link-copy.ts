import { getRequiredElement, setStatus } from "./dom.js";
import { getCurrentTab, getCurrentWindowTabs, isInternalUrl } from "../shared/tab-utils.js";
import { loadSettings } from "../shared/storage.js";
import type { CopyFormat } from "../shared/storage.js";

let formatSelect: HTMLSelectElement;

export async function initializeLinkCopy(): Promise<void> {
  formatSelect = getRequiredElement<HTMLSelectElement>("copy-format-select");

  const settings = await loadSettings();
  formatSelect.value = settings.defaultCopyFormat;

  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>("[data-copy-action]")
  );

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.copyAction;

      if (!action) {
        setStatus("Copy action not found", "error");
        return;
      }

      void handleCopyAction(action);
    });
  });
}

function getCurrentFormat(): CopyFormat {
  return formatSelect.value as CopyFormat;
}

async function handleCopyAction(action: string): Promise<void> {
  try {
    setStatus("Copying to clipboard...");
    await copyLinks(action);
    setStatus("Text copied", "success");
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unable to copy";
    setStatus(errorMessage, "error");
  }
}

export async function copyLinks(
  action: string,
  formatOverride?: CopyFormat
): Promise<void> {
  const format = formatOverride ?? getCurrentFormat();

  switch (action) {
    case "current-tab":
      await copyCurrentTab(format);
      break;
    case "current-window":
      await copyCurrentWindowTabs(format);
      break;
    case "all-tabs":
      await copyAllTabs(format);
      break;
    case "current-domain":
      await copyCurrentDomainTabs(format);
      break;
    default:
      throw new Error("Invalid action");
  }
}

function formatEntries(entries: { title: string; url: string }[], format: CopyFormat): string {
  switch (format) {
    case "markdown":
      return entries
        .map((entry) => `- [${entry.title}](${entry.url})`)
        .join("\n");
    case "plain":
      return entries
        .map((entry) => `${entry.title} - ${entry.url}`)
        .join("\n");
    case "html":
      return entries
        .map(
          (entry) => `<a href="${entry.url}">${entry.title}</a>`
        )
        .join("\n");
    case "json":
      return JSON.stringify(entries, null, 2);
    default:
      return "";
  }
}

function normalizeTitle(title: string | undefined): string {
  return title?.trim() ? title : "Untitled";
}

function filterNonInternalTabs(tabs: chrome.tabs.Tab[]): chrome.tabs.Tab[] {
  return tabs.filter((tab) => tab.url !== undefined && !isInternalUrl(tab.url));
}

async function copyCurrentTab(format: CopyFormat): Promise<void> {
  const tab = await getCurrentTab();

  if (tab?.url === undefined || isInternalUrl(tab.url)) {
    throw new Error("Current tab has no valid URL to copy");
  }

  const entry = { title: normalizeTitle(tab.title), url: tab.url };
  const text = format === "json" ? JSON.stringify([entry], null, 2) : formatEntries([entry], format);

  await navigator.clipboard.writeText(text);
}

async function copyCurrentWindowTabs(format: CopyFormat): Promise<void> {
  const tabs = await getCurrentWindowTabs();
  const validTabs = filterNonInternalTabs(tabs);

  if (validTabs.length === 0) {
    throw new Error("No valid URLs in current window");
  }

  const entries = validTabs.map((tab) => ({
    title: normalizeTitle(tab.title),
    url: tab.url as string
  }));

  await navigator.clipboard.writeText(formatEntries(entries, format));
}

async function copyAllTabs(format: CopyFormat): Promise<void> {
  const tabs = await chrome.tabs.query({});
  const validTabs = filterNonInternalTabs(tabs);

  if (validTabs.length === 0) {
    throw new Error("No valid open tabs to copy");
  }

  const entries = validTabs.map((tab) => ({
    title: normalizeTitle(tab.title),
    url: tab.url as string
  }));

  await navigator.clipboard.writeText(formatEntries(entries, format));
}

async function copyCurrentDomainTabs(format: CopyFormat): Promise<void> {
  const currentTab = await getCurrentTab();

  if (!currentTab?.url || isInternalUrl(currentTab.url)) {
    throw new Error("Current tab has no valid domain");
  }

  const currentHostname = new URL(currentTab.url).hostname;
  const tabs = await getCurrentWindowTabs();
  const matchingTabs = filterNonInternalTabs(tabs).filter((tab) => {
    try {
      return new URL(tab.url as string).hostname === currentHostname;
    } catch {
      return false;
    }
  });

  if (matchingTabs.length === 0) {
    throw new Error("No tabs found for current domain");
  }

  const entries = matchingTabs.map((tab) => ({
    title: normalizeTitle(tab.title),
    url: tab.url as string
  }));

  await navigator.clipboard.writeText(formatEntries(entries, format));
}
