let lastDblClickTime = 0;

document.addEventListener("dblclick", (event) => {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  if (target && target.closest("input, textarea, select, button, a, iframe, video, audio, [contenteditable]")) {
    return;
  }

  const now = Date.now();
  if (now - lastDblClickTime < 300) {
    return;
  }
  lastDblClickTime = now;

  chrome.runtime.sendMessage({ subject: "getConfigValue", key: "Settings.Gesture.doubleClickCloseTab" })
    .then((response) => {
      if (response && response.value === true) {
        chrome.runtime.sendMessage({ subject: "closeTabByDoubleClick" });
      }
    })
    .catch(() => {});
});
