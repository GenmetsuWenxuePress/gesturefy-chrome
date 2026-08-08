/**
 * User Script Controller (Chrome MV3)
 * Helper to safely execute custom user scripts in the page context.
 **/

// Register message listener for executeUserScript requests from background/extension
chrome.runtime.onMessage.addListener(handleMessage);

// Register window message listener for API bridge calls from MAIN world injected scripts
window.addEventListener("message", handleAPIBridgeMessage);

/**
 * Handles user script execution messages from the user script command
 **/
function handleMessage(message, sender, sendResponse) {
  if (message.subject === "executeUserScript") {
    executeUserScript(message, sender)
      .then((success) => sendResponse(success))
      .catch(() => sendResponse(false));
    return true;
  }
}

/**
 * Handles API call requests sent via window.postMessage from injected user scripts in MAIN world.
 **/
async function handleAPIBridgeMessage(event) {
  if (
    event.source !== window ||
    !event.data ||
    event.data.type !== "executeUserScriptAPICall"
  ) {
    return;
  }

  const { id, nameSpace, functionName, parameter } = event.data;
  if (!id || !nameSpace || !functionName) return;

  try {
    const result = await chrome.runtime.sendMessage({
      subject: "backgroundScriptAPICall",
      data: {
        nameSpace,
        functionName,
        parameter
      }
    });
    window.postMessage(
      {
        type: "executeUserScriptAPIResponse",
        id,
        result
      },
      "*"
    );
  } catch (error) {
    window.postMessage(
      {
        type: "executeUserScriptAPIResponse",
        id,
        error: error?.message || String(error)
      },
      "*"
    );
  }
}

/**
 * Injects user script into target tab/frame's MAIN world via chrome.scripting.executeScript.
 **/
async function executeUserScript(message, sender) {
  try {
    const userScriptCode = message.data;
    if (typeof userScriptCode !== "string") {
      return false;
    }

    const clientX = message.clientX ?? message.x ?? message.endpoint?.x;
    const clientY = message.clientY ?? message.y ?? message.endpoint?.y;

    let tabId = message.tabId ?? sender?.tab?.id;
    let frameId = message.frameId;

    if (!tabId || frameId === undefined || frameId === null) {
      try {
        const contextInfo = await chrome.runtime.sendMessage({ subject: "getExtensionContextInfo" });
        if (contextInfo) {
          if (!tabId) tabId = contextInfo.tabId;
          if (frameId === undefined || frameId === null) frameId = contextInfo.frameId;
        }
      } catch (e) {}
    }

    if (!tabId) return false;

    frameId = frameId ?? 0;

    const target = {
      tabId,
      frameIds: [frameId]
    };

    const options = {
      target,
      world: "MAIN",
      func: runUserScriptInMainWorld,
      args: [userScriptCode, clientX, clientY]
    };

    let results;
    if (typeof chrome.scripting?.executeScript === "function") {
      results = await chrome.scripting.executeScript(options);
    } else {
      results = await chrome.runtime.sendMessage({
        subject: "backgroundScriptAPICall",
        data: {
          nameSpace: "scripting",
          functionName: "executeScript",
          parameter: [options]
        }
      });
    }

    if (Array.isArray(results) && results.length > 0) {
      return results[0]?.result !== false;
    }
    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Executed inside the MAIN world (page context).
 * Self-contained function serialized by chrome.scripting.executeScript.
 **/
async function runUserScriptInMainWorld(userScriptCode, clientX, clientY) {
  let TARGET = null;
  if (typeof clientX === "number" && typeof clientY === "number") {
    try {
      TARGET = document.elementFromPoint(clientX, clientY);
    } catch (e) {
      TARGET = null;
    }
  }

  function apiCall(nameSpace, functionName, parameter) {
    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      function handleResponse(event) {
        if (
          event.source === window &&
          event.data &&
          event.data.type === "executeUserScriptAPIResponse" &&
          event.data.id === id
        ) {
          window.removeEventListener("message", handleResponse);
          if (event.data.error) {
            reject(new Error(event.data.error));
          } else {
            resolve(event.data.result);
          }
        }
      }
      window.addEventListener("message", handleResponse);
      window.postMessage(
        {
          type: "executeUserScriptAPICall",
          id,
          nameSpace,
          functionName,
          parameter
        },
        "*"
      );
    });
  }

  const API = {
    tabs: {
      query: (...args) => apiCall("tabs", "query", args),
      create: (...args) => apiCall("tabs", "create", args),
      remove: (...args) => apiCall("tabs", "remove", args),
      update: (...args) => apiCall("tabs", "update", args),
      duplicate: (...args) => apiCall("tabs", "duplicate", args),
      goBack: (...args) => apiCall("tabs", "goBack", args),
      goForward: (...args) => apiCall("tabs", "goForward", args),
      move: (...args) => apiCall("tabs", "move", args)
    },
    windows: {
      get: (...args) => apiCall("windows", "get", args),
      getCurrent: (...args) => apiCall("windows", "getCurrent", args),
      create: (...args) => apiCall("windows", "create", args),
      remove: (...args) => apiCall("windows", "remove", args),
      update: (...args) => apiCall("windows", "update", args)
    }
  };

  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const executeUserScript = new AsyncFunction("TARGET", "API", userScriptCode);
    const result = await executeUserScript(TARGET, API);
    return result !== false;
  } catch (error) {
    return false;
  }
}

export default handleMessage;