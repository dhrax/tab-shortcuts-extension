import { initializeNavigation } from "./popup/navigation.js";
import { initializeActionsPanel } from "./popup/actions-panel.js";
import { initializeTabSearch } from "./popup/tab-search.js";
import { initializeSessions } from "./popup/sessions.js";
import { initializeLinkCopy } from "./popup/link-copy.js";
import { initializeSnippets } from "./popup/snippets.js";
import { setStatus } from "./popup/dom.js";

document.addEventListener("DOMContentLoaded", () => {
  initializeNavigation();

  void Promise.all([
    initializeActionsPanel(),
    initializeTabSearch(),
    initializeSessions(),
    initializeLinkCopy(),
    initializeSnippets()
  ]).catch((error: unknown) => {
    const message =
      error instanceof Error
        ? error.message
        : "Error initializing the panel";

    setStatus(message, "error");
  });
});
