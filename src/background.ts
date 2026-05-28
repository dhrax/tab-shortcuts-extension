import { handleTabAction } from "./background/tab-actions.js";
import { initializeDomainRuleListeners } from "./background/domain-rules.js";
import { performUndo, getUndoHistory, clearUndoHistory } from "./background/undo.js";
import type { ExtensionMessage, ExtensionResponse } from "./shared/tab-action.js";
import { isTabAction } from "./shared/tab-action.js";

type UndoMessageType =
  | "get-undo-history"
  | "perform-undo"
  | "clear-undo-history";

interface UndoMessage {
  type: UndoMessageType;
}

function isUndoMessage(message: unknown): message is UndoMessage {
  if (typeof message !== "object" || message === null) {
    return false;
  }

  const { type } = message as { type?: unknown };

  return (
    type === "get-undo-history" ||
    type === "perform-undo" ||
    type === "clear-undo-history"
  );
}

chrome.commands.onCommand.addListener((command: string) => {
  if (!isTabAction(command)) {
    console.warn(`Comando no reconocido: ${command}`);
    return;
  }

  void handleTabAction(command);
});

initializeDomainRuleListeners();

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage | UndoMessage,
    _sender,
    sendResponse: (response: ExtensionResponse | object) => void
  ) => {
    if (isUndoMessage(message)) {
      void handleUndoMessage(message)
        .then(sendResponse)
        .catch((error: unknown) => {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : "Undo failed"
          });
        });

      return true;
    }

    if (!isTabAction(message.action)) {
      sendResponse({
        success: false,
        message: "Action not recognized"
      });

      return false;
    }

    void handleTabAction(message.action)
      .then((resultMessage) => {
        sendResponse({
          success: true,
          message: resultMessage
        });
      })
      .catch((error: unknown) => {
        const errorMessage =
          error instanceof Error ? error.message : "Error desconocido";

        sendResponse({
          success: false,
          message: errorMessage
        });
      });

    return true;
  }
);

async function handleUndoMessage(message: UndoMessage): Promise<object> {
  switch (message.type) {
    case "get-undo-history":
      return {
        success: true,
        history: await getUndoHistory()
      };

    case "perform-undo":
      return {
        success: true,
        message: await performUndo()
      };

    case "clear-undo-history":
      await clearUndoHistory();
      return {
        success: true
      };
  }
}
