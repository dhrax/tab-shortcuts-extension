import { initializeNavigation } from "./popup/navigation.js";
import { initializeActionsPanel } from "./popup/actions-panel.js";
import { initializeTabSearch } from "./popup/tab-search.js";
import { initializeSessions } from "./popup/sessions.js";
import { initializeWorkspaces } from "./popup/workspaces.js";
import { initializeDomainRules } from "./popup/domain-rules.js";
import { initializeLinkCopy } from "./popup/link-copy.js";
import { initializeSnippets } from "./popup/snippets.js";
import { initializeHistory } from "./popup/history.js";
import { initializeCommandPalette } from "./popup/command-palette.js";
import { setStatus } from "./popup/dom.js";

function initializeOptionsButton(): void {
  const optionsButton = document.getElementById("open-options-button");

  if (!optionsButton) {
    return;
  }

  optionsButton.addEventListener("click", () => {
    if (typeof chrome.runtime.openOptionsPage === "function") {
      chrome.runtime.openOptionsPage();
    } else {
      window.open("options.html", "_blank");
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initializeNavigation();
  initializeOptionsButton();

  void Promise.all([
    initializeCommandPalette(),
    initializeActionsPanel(),
    initializeTabSearch(),
    initializeSessions(),
    initializeWorkspaces(),
    initializeDomainRules(),
    initializeLinkCopy(),
    initializeSnippets(),
    initializeHistory()
  ]).catch((error: unknown) => {
    const message =
      error instanceof Error
        ? error.message
        : "Error initializing the panel";

    setStatus(message, "error");
  });
});
