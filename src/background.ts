import { handleTabAction } from "./background/tab-actions.js";
import type { ExtensionMessage, ExtensionResponse } from "./shared/tab-action.js";
import { isTabAction } from "./shared/tab-action.js";

chrome.commands.onCommand.addListener((command: string) => {
  if (!isTabAction(command)) {
    console.warn(`Comando no reconocido: ${command}`);
    return;
  }

  void handleTabAction(command);
});

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender,
    sendResponse: (response: ExtensionResponse) => void
  ) => {
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