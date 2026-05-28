import { getRequiredElement, setStatus } from "./dom.js";
import { getCurrentTab, getCurrentWindowTabs, isInternalUrl } from "../shared/tab-utils.js";

export function initializeLinkCopy(): void {
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

async function handleCopyAction(action: string): Promise<void> {
  try {
    setStatus("Copiando al portapapeles...");

    switch (action) {
      case "current-url-plain":
        await copyCurrentTabUrl(false);
        break;
      case "current-url-markdown":
        await copyCurrentTabUrl(true);
        break;
      case "window-urls-plain":
        await copyWindowUrls(false);
        break;
      case "window-urls-markdown":
        await copyWindowUrls(true);
        break;
      default:
        setStatus("Invalid action", "error");
        return;
    }

    setStatus("Text copied", "success");
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unable to copy";
    setStatus(errorMessage, "error");
  }
}

async function copyCurrentTabUrl(markdown: boolean): Promise<void> {
  const tab = await getCurrentTab();

  if (tab?.url === undefined) {
    throw new Error("Current tab not found");
  }

  const text = markdown
    ? `[${tab.title ?? "Untitled"}](${tab.url})`
    : tab.url;

  await navigator.clipboard.writeText(text);
}

async function copyWindowUrls(markdown: boolean): Promise<void> {
  const tabs = await getCurrentWindowTabs();
  const validTabs = tabs.filter(
    (tab) => tab.url !== undefined && !isInternalUrl(tab.url)
  );

  if (validTabs.length === 0) {
    throw new Error("No valid URLs in current window");
  }

  const text = validTabs
    .map((tab) =>
      markdown
        ? `- [${tab.title ?? "Untitled"}](${tab.url})`
        : tab.url
    )
    .join("\n");

  await navigator.clipboard.writeText(text);
}
