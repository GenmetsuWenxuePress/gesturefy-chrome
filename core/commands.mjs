import {
  isURL,
  isHTTPURL,
  isLegalURL,
  isDomainName,
  sanitizeFilename,
  dataURItoBlob,
  displayNotification
} from "/core/utils/commons.mjs";

async function getTabId (sender) {
  if (sender?.tab?.id) {
    return sender.tab.id;
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

async function readClipboard (sender) {
  try {
    const tabId = await getTabId(sender);
    if (!tabId) return null;
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => navigator.clipboard.readText()
    });
    return results[0]?.result ?? null;
  }
  catch (error) {
    return null;
  }
}

async function writeClipboard (sender, text) {
  try {
    const tabId = await getTabId(sender);
    if (!tabId) return false;
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (content) => navigator.clipboard.writeText(content),
      args: [text]
    });
    return true;
  }
  catch (error) {
    return false;
  }
}

/*
 * Commands
 * Every command fulfills its promise when its internal processes finish
 * The promise will be rejected on error
 * If the command could be successfully executed true will be returned
 * Else nothing will be returned
 * The execution can fail for insufficient conditions like a missing url or image
 */

// Removed DuplicateTab


export async function NewTab (sender, data) {
  let index;

  switch (this.getSetting("position")) {
    case "before":
      index = sender.tab.index;
    break;
    case "after":
      index = sender.tab.index + 1;
    break;
    case "start":
      index = 0;
    break;
    case "end":
      index = Number.MAX_SAFE_INTEGER;
    break;
    default:
      index = null;
    break;
  }

  await chrome.tabs.create({
    active: this.getSetting("focus"),
    index: index
  });
  // confirm success
  return true;
}


export async function CloseTab (sender, data) {
  // remove tab if not pinned or remove-pinned-tabs option is enabled
  if (this.getSetting("closePinned") || !sender.tab.pinned) {
    const tabs = await chrome.tabs.query({
      windowId: sender.tab.windowId,
      active: false,
    });

    // if there are other tabs to focus
    if (tabs.length > 0) {
      let nextTab = null;

      switch (this.getSetting("nextFocus")) {
        case "next":
          // get closest tab to the right (if not found it will return the closest tab to the left)
          nextTab = tabs.reduce((acc, cur) =>
            (acc.index <= sender.tab.index && cur.index > acc.index) || (cur.index > sender.tab.index && cur.index < acc.index) ? cur : acc
          );
        break;

        case "previous":
          // get closest tab to the left (if not found it will return the closest tab to the right)
          nextTab = tabs.reduce((acc, cur) =>
            (acc.index >= sender.tab.index && cur.index < acc.index) || (cur.index < sender.tab.index && cur.index > acc.index) ? cur : acc
          );
        break;

        case "recent":
          // get the previous tab
          nextTab = tabs.reduce((acc, cur) => acc.lastAccessed > cur.lastAccessed ? acc : cur);
        break;
      }

      if (nextTab) await chrome.tabs.update(nextTab.id, { active: true });
    }
    await chrome.tabs.remove(sender.tab.id);
    // confirm success
    return true;
  }
}


export async function UnloadTab (sender, data) {
  const tabs = await chrome.tabs.query({
    windowId: sender.tab.windowId,
    active: false,
  });

  // if there are other tabs to focus
  if (tabs.length > 0) {
    let nextTab = null;
    const nextFocusSetting = this.getSetting("nextFocus");

    switch (nextFocusSetting) {
      case "next":
      default:
        // get closest tab to the right (if not found it will return the closest tab to the left)
        // the active tab cannot be unloaded so we must choose an option how to move the focus manually
        nextTab = tabs.reduce((acc, cur) =>
          (acc.index <= sender.tab.index && cur.index > acc.index) || (cur.index > sender.tab.index && cur.index < acc.index) ? cur : acc
        );
      break;

      case "previous":
        // get closest tab to the left (if not found it will return the closest tab to the right)
        nextTab = tabs.reduce((acc, cur) =>
          (acc.index >= sender.tab.index && cur.index < acc.index) || (cur.index < sender.tab.index && cur.index > acc.index) ? cur : acc
        );
      break;

      case "recent":
        // get the previous tab
        nextTab = tabs.reduce((acc, cur) => acc.lastAccessed > cur.lastAccessed ? acc : cur);
      break;
    }

    if (nextTab) {
      await chrome.tabs.update(nextTab.id, { active: true });
      // Unload the tab after switching focus (cannot unload active tab)
      await chrome.tabs.discard(sender.tab.id);
      return true;
    }
  }
}


export async function CloseRightTabs (sender, data) {
  let tabs = await chrome.tabs.query({
    windowId: sender.tab.windowId,
    pinned: false,
  });

  // filter all tabs to the right
  tabs = tabs.filter((tab) => tab.index > sender.tab.index);

  if (tabs.length > 0) {
    // create array of tap ids
    const tabIds = tabs.map((tab) => tab.id);
    await chrome.tabs.remove(tabIds);
    // confirm success
    return true;
  }
}


export async function CloseLeftTabs (sender, data) {
  let tabs = await chrome.tabs.query({
    windowId: sender.tab.windowId,
    pinned: false,
  });

  // filter all tabs to the left
  tabs = tabs.filter((tab) => tab.index < sender.tab.index);

  if (tabs.length > 0) {
    // create array of tap ids
    const tabIds = tabs.map((tab) => tab.id);
    await chrome.tabs.remove(tabIds);
    // confirm success
    return true;
  }
}


export async function CloseOtherTabs (sender, data) {
  const tabs = await chrome.tabs.query({
    windowId: sender.tab.windowId,
    pinned: false,
    active: false,
  });

  if (tabs.length > 0) {
    // create array of tap ids
    const tabIds = tabs.map((tab) => tab.id);
    await chrome.tabs.remove(tabIds);
    // confirm success
    return true;
  }
}


export async function RestoreTab (sender, data) {
  let recentlyClosedSessions = await chrome.sessions.getRecentlyClosed();

  // exclude windows and tabs from different windows
  if (this.getSetting("currentWindowOnly")) {
    recentlyClosedSessions = recentlyClosedSessions.filter((session) => {
      return session.tab && session.tab.windowId === sender.tab.windowId;
    });
  }
  if (recentlyClosedSessions.length > 0) {
    const mostRecently = recentlyClosedSessions.reduce((prev, cur) => prev.lastModified > cur.lastModified ? prev : cur);
    const sessionId = mostRecently.tab ? mostRecently.tab.sessionId : mostRecently.window.sessionId;
    await chrome.sessions.restore(sessionId);
    // confirm success
    return true;
  }
}


export async function ReloadTab (sender, data) {
  await chrome.tabs.reload(sender.tab.id, { bypassCache: this.getSetting("cache") });
  // confirm success
  return true;
}


export async function StopLoading (sender, data) {
  // returns the ready state of each frame as an array
  const stopLoadingResults = await chrome.scripting.executeScript({
    target: { tabId: sender.tab.id, allFrames: true },
    func: () => {
      const rs = document.readyState;
      window.stop();
      return rs;
    }
  });

  // if at least one frame was not finished loading
  if (stopLoadingResults.some(r => r.result !== "complete")) {
    // confirm success
    return true;
  }
}


export async function ReloadFrame (sender, data) {
  if (sender.frameId) {
    await chrome.scripting.executeScript({
      target: { tabId: sender.tab.id, frameIds: [sender.frameId] },
      func: (cache) => window.location.reload(cache),
      args: [Boolean(this.getSetting("cache"))]
    });
    // confirm success
    return true;
  }
}


export async function ReloadAllTabs (sender, data) {
  const tabs = await chrome.tabs.query({
    windowId: sender.tab.windowId,
  });

  await Promise.all(tabs.map((tab) => {
    return chrome.tabs.reload(tab.id, { bypassCache: this.getSetting("cache") });
  }));
  // confirm success
  return true;
}


export async function ZoomIn (sender, data) {
  const zoomSetting = this.getSetting("step");
  // try to get single number
  const zoomStep = Number(zoomSetting);
  // array of default zoom levels
  let zoomLevels = [.3, .5, .67, .8, .9, 1, 1.1, 1.2, 1.33, 1.5, 1.7, 2, 2.4, 3];
  // maximal zoom level
  let maxZoom = 3, newZoom;

  // if no zoom step value exists and string contains comma, assume a list of zoom levels
  if (!zoomStep && zoomSetting && zoomSetting.includes(",")) {
    // get and override default zoom levels
    zoomLevels = zoomSetting.split(",").map(z => parseFloat(z)/100);
    // get and override max zoom boundary but cap it to 300%
    maxZoom = Math.min(Math.max(...zoomLevels), maxZoom);
  }

  const currentZoom = await chrome.tabs.getZoom(sender.tab.id);

  if (zoomStep) {
    newZoom = Math.min(maxZoom, currentZoom + zoomStep/100);
  }
  else {
    newZoom = zoomLevels.reduce((acc, cur) => cur > currentZoom && cur < acc ? cur : acc, maxZoom);
  }

  if (newZoom > currentZoom) {
    await chrome.tabs.setZoom(sender.tab.id, newZoom);
    // confirm success
    return true;
  }
}


export async function ZoomOut (sender, data) {
  const zoomSetting = this.getSetting("step");
  // try to get single number
  const zoomStep = Number(zoomSetting);
  // array of default zoom levels
  let zoomLevels = [3, 2.4, 2, 1.7, 1.5, 1.33, 1.2, 1.1, 1, .9, .8, .67, .5, .3];
  // minimal zoom level
  let minZoom = .3, newZoom;

  // if no zoom step value exists and string contains comma, assume a list of zoom levels
  if (!zoomStep && zoomSetting && zoomSetting.includes(",")) {
    // get and override default zoom levels
    zoomLevels = zoomSetting.split(",").map(z => parseFloat(z)/100);
    // get min zoom boundary but cap it to 30%
    minZoom = Math.max(Math.min(...zoomLevels), minZoom);
  }

  const currentZoom = await chrome.tabs.getZoom(sender.tab.id);

  if (zoomStep) {
    newZoom = Math.max(minZoom, currentZoom - zoomStep/100);
  }
  else {
    newZoom = zoomLevels.reduce((acc, cur) => cur < currentZoom && cur > acc ? cur : acc, minZoom);
  }

  if (newZoom < currentZoom) {
    await chrome.tabs.setZoom(sender.tab.id, newZoom);
    // confirm success
    return true;
  }
}


export async function ZoomReset (sender, data) {
  const [currentZoom, zoomSettings] = await Promise.all([
    chrome.tabs.getZoom(sender.tab.id),
    chrome.tabs.getZoomSettings(sender.tab.id)
  ]);

  if (currentZoom !== zoomSettings.defaultZoomFactor) {
    await chrome.tabs.setZoom(sender.tab.id, zoomSettings.defaultZoomFactor);
    // confirm success
    return true;
  }
}


export async function PageBack (sender, data) {
  await chrome.tabs.goBack(sender.tab.id);
  // confirm success
  return true;
}


export async function PageForth (sender, data) {
  await chrome.tabs.goForward(sender.tab.id);
  // confirm success
  return true;
}


// reverts the action if already pinned
export async function TogglePin (sender, data) {
  await chrome.tabs.update(sender.tab.id, { pinned: !sender.tab.pinned });
  // confirm success
  return true;
}


// reverts the action if already muted
export async function ToggleMute (sender, data) {
  await chrome.tabs.update(sender.tab.id, { muted: !sender.tab.mutedInfo.muted });
  // confirm success
  return true;
}


// reverts the action if already bookmarked
export async function ToggleBookmark (sender, data) {
  const bookmarks = await chrome.bookmarks.search({
    url: sender.tab.url
  });

  if (bookmarks.length > 0) {
    await chrome.bookmarks.remove(bookmarks[0].id);
  }
  else {
    await chrome.bookmarks.create({
      url: sender.tab.url,
      title: sender.tab.title
    });
    // confirm success
    return true;
  }
}


// Removed ToggleReaderMode


export async function ScrollTop (sender, data) {
  // returns true if there exists a scrollable element in the injected frame
  // which can be scrolled upwards else false
  let _res1 = await chrome.scripting.executeScript({
    target: { tabId: sender.tab.id, frameIds: [sender.frameId ?? 0] },
    func: (duration) => {
      const scrollableElement = window.getClosestElement(window.TARGET, window.isScrollableY);
      const canScrollUp = scrollableElement && scrollableElement.scrollTop > 0;
      if (canScrollUp) {
        window.scrollToY(0, duration, scrollableElement);
      }
      return [!!scrollableElement, canScrollUp];
    },
    args: [Number(this.getSetting("duration"))]
  });
  let [hasScrollableElement, canScrollUp] = _res1[0]?.result || [false, false];

  // if there was no scrollable element and the gesture was triggered from a frame
  // try scrolling the main scrollbar of the main frame
  if (!hasScrollableElement && sender.frameId !== 0) {
    let _res2 = await chrome.scripting.executeScript({
      target: { tabId: sender.tab.id, frameIds: [0] },
      func: (duration) => {
        const scrollableElement = document.scrollingElement;
        const canScrollUp = window.isScrollableY(scrollableElement) && scrollableElement.scrollTop > 0;
        if (canScrollUp) {
          window.scrollToY(0, duration, scrollableElement);
        }
        return canScrollUp;
      },
      args: [Number(this.getSetting("duration"))]
    });
    canScrollUp = _res2[0]?.result;
  }
  // confirm success/failure
  return canScrollUp;
}


export async function ScrollBottom (sender, data) {
  // returns true if there exists a scrollable element in the injected frame
  // which can be scrolled downwards else false
  let _res3 = await chrome.scripting.executeScript({
    target: { tabId: sender.tab.id, frameIds: [sender.frameId ?? 0] },
    func: (duration) => {
      const scrollableElement = window.getClosestElement(window.TARGET, window.isScrollableY);
      const canScrollDown = scrollableElement && scrollableElement.scrollTop < scrollableElement.scrollHeight - scrollableElement.clientHeight;
      if (canScrollDown) {
        window.scrollToY(scrollableElement.scrollHeight - scrollableElement.clientHeight, duration, scrollableElement);
      }
      return [!!scrollableElement, canScrollDown];
    },
    args: [Number(this.getSetting("duration"))]
  });
  let [hasScrollableElement, canScrollDown] = _res3[0]?.result || [false, false];

  // if there was no scrollable element and the gesture was triggered from a frame
  // try scrolling the main scrollbar of the main frame
  if (!hasScrollableElement && sender.frameId !== 0) {
    let _res4 = await chrome.scripting.executeScript({
      target: { tabId: sender.tab.id, frameIds: [0] },
      func: (duration) => {
        const scrollableElement = document.scrollingElement;
        const canScrollDown = window.isScrollableY(scrollableElement) && scrollableElement.scrollTop < scrollableElement.scrollHeight - scrollableElement.clientHeight;
        if (canScrollDown) {
          window.scrollToY(scrollableElement.scrollHeight - scrollableElement.clientHeight, duration, scrollableElement);
        }
        return canScrollDown;
      },
      args: [Number(this.getSetting("duration"))]
    });
    canScrollDown = _res4[0]?.result;
  }
  // confirm success/failure
  return canScrollDown;
}


export async function ScrollPageUp (sender, data) {
  const scrollRatio = Number(this.getSetting("scrollProportion")) / 100;

  // returns true if there exists a scrollable element in the injected frame
  // which can be scrolled upwards else false
  let _res1 = await chrome.scripting.executeScript({
    target: { tabId: sender.tab.id, frameIds: [sender.frameId ?? 0] },
    func: (scrollRatio, duration) => {
      const scrollableElement = window.getClosestElement(window.TARGET, window.isScrollableY);
      const canScrollUp = scrollableElement && scrollableElement.scrollTop > 0;
      if (canScrollUp) {
        window.scrollToY(scrollableElement.scrollTop - scrollableElement.clientHeight * scrollRatio, duration, scrollableElement);
      }
      return [!!scrollableElement, canScrollUp];
    },
    args: [scrollRatio, Number(this.getSetting("duration"))]
  });
  let [hasScrollableElement, canScrollUp] = _res1[0]?.result || [false, false];

  // if there was no scrollable element and the gesture was triggered from a frame
  // try scrolling the main scrollbar of the main frame
  if (!hasScrollableElement && sender.frameId !== 0) {
    let _res2 = await chrome.scripting.executeScript({
      target: { tabId: sender.tab.id, frameIds: [0] },
      func: (scrollRatio, duration) => {
        const scrollableElement = document.scrollingElement;
        const canScrollUp = window.isScrollableY(scrollableElement) && scrollableElement.scrollTop > 0;
        if (canScrollUp) {
          window.scrollToY(scrollableElement.scrollTop - scrollableElement.clientHeight * scrollRatio, duration, scrollableElement);
        }
        return canScrollUp;
      },
      args: [scrollRatio, Number(this.getSetting("duration"))]
    });
    canScrollUp = _res2[0]?.result;
  }
  // confirm success/failure
  return canScrollUp;
}


export async function ScrollPageDown (sender, data) {
  const scrollRatio = Number(this.getSetting("scrollProportion")) / 100;

  // returns true if there exists a scrollable element in the injected frame
  // which can be scrolled downwards else false
  let _res3 = await chrome.scripting.executeScript({
    target: { tabId: sender.tab.id, frameIds: [sender.frameId ?? 0] },
    func: (scrollRatio, duration) => {
      const scrollableElement = window.getClosestElement(window.TARGET, window.isScrollableY);
      const canScrollDown = scrollableElement && scrollableElement.scrollTop < scrollableElement.scrollHeight - scrollableElement.clientHeight;
      if (canScrollDown) {
        window.scrollToY(scrollableElement.scrollTop + scrollableElement.clientHeight * scrollRatio, duration, scrollableElement);
      }
      return [!!scrollableElement, canScrollDown];
    },
    args: [scrollRatio, Number(this.getSetting("duration"))]
  });
  let [hasScrollableElement, canScrollDown] = _res3[0]?.result || [false, false];

  // if there was no scrollable element and the gesture was triggered from a frame
  // try scrolling the main scrollbar of the main frame
  if (!hasScrollableElement && sender.frameId !== 0) {
    let _res4 = await chrome.scripting.executeScript({
      target: { tabId: sender.tab.id, frameIds: [0] },
      func: (scrollRatio, duration) => {
        const scrollableElement = document.scrollingElement;
        const canScrollDown = window.isScrollableY(scrollableElement) && scrollableElement.scrollTop < scrollableElement.scrollHeight - scrollableElement.clientHeight;
        if (canScrollDown) {
          window.scrollToY(scrollableElement.scrollTop + scrollableElement.clientHeight * scrollRatio, duration, scrollableElement);
        }
        return canScrollDown;
      },
      args: [scrollRatio, Number(this.getSetting("duration"))]
    });
    canScrollDown = _res4[0]?.result;
  }
  // confirm success/failure
  return canScrollDown;
}


export async function FocusRightTab (sender, data) {
  const queryInfo = {
    windowId: sender.tab.windowId,
    active: false,
  }

  if (this.getSetting("excludeDiscarded")) queryInfo.discarded = false;

  const tabs = await chrome.tabs.query(queryInfo);

  let nextTab;
  // if there is at least one tab to the right of the current
  if (tabs.some(cur => cur.index > sender.tab.index)) {
    // get closest tab to the right (if not found it will return the closest tab to the left)
    nextTab = tabs.reduce((acc, cur) =>
      (acc.index <= sender.tab.index && cur.index > acc.index) || (cur.index > sender.tab.index && cur.index < acc.index) ? cur : acc
    );
  }
  // get the most left tab if tab cycling is activated
  else if (this.getSetting("cycling") && tabs.length > 0) {
    nextTab = tabs.reduce((acc, cur) => acc.index < cur.index ? acc : cur);
  }
  // focus next tab if available
  if (nextTab) {
    await chrome.tabs.update(nextTab.id, { active: true });
    // confirm success
    return true;
  }
}


export async function FocusLeftTab (sender, data) {
  const queryInfo = {
    windowId: sender.tab.windowId,
    active: false,
  }

  if (this.getSetting("excludeDiscarded")) queryInfo.discarded = false;

  const tabs = await chrome.tabs.query(queryInfo);

  let nextTab;
  // if there is at least one tab to the left of the current
  if (tabs.some(cur => cur.index < sender.tab.index)) {
    // get closest tab to the left (if not found it will return the closest tab to the right)
    nextTab = tabs.reduce((acc, cur) =>
      (acc.index >= sender.tab.index && cur.index < acc.index) || (cur.index < sender.tab.index && cur.index > acc.index) ? cur : acc
    );
  }
  // else get most right tab if tab cycling is activated
  else if (this.getSetting("cycling") && tabs.length > 0) {
    nextTab = tabs.reduce((acc, cur) => acc.index > cur.index ? acc : cur);
  }
  // focus next tab if available
  if (nextTab) {
    await chrome.tabs.update(nextTab.id, { active: true });
    // confirm success
    return true;
  }
}

export async function FocusFirstTab (sender, data) {
  const queryInfo = {
    windowId: sender.tab.windowId,
    active: false,
  };

  if (!this.getSetting("includePinned")) queryInfo.pinned = false;

  const tabs = await chrome.tabs.query(queryInfo);

  // if there is at least one tab to the left of the current
  if (tabs.some(cur => cur.index < sender.tab.index)) {
    const firstTab = tabs.reduce((acc, cur) => acc.index < cur.index ? acc : cur);
    await chrome.tabs.update(firstTab.id, { active: true });
    // confirm success
    return true;
  }
}


export async function FocusLastTab (sender, data) {
  const tabs = await chrome.tabs.query({
    windowId: sender.tab.windowId,
    active: false,
  });

  // if there is at least one tab to the right of the current
  if (tabs.some(cur => cur.index > sender.tab.index)) {
    const lastTab = tabs.reduce((acc, cur) => acc.index > cur.index ? acc : cur);
    await chrome.tabs.update(lastTab.id, { active: true });
    // confirm success
    return true;
  }
}


export async function FocusPreviousSelectedTab (sender, data) {
  const tabs = await chrome.tabs.query({
    windowId: sender.tab.windowId,
    active: false,
  });

  if (tabs.length > 0) {
    const lastAccessedTab = tabs.reduce((acc, cur) => acc.lastAccessed > cur.lastAccessed ? acc : cur);
    await chrome.tabs.update(lastAccessedTab.id, { active: true });
    // confirm success
    return true;
  }
}


export async function MaximizeWindow (sender, data) {
  const window = await chrome.windows.get(sender.tab.windowId);
  if (window.state !== 'maximized') {
    await chrome.windows.update(sender.tab.windowId, {
      state: 'maximized'
    });
    // confirm success
    return true;
  }
}


export async function MinimizeWindow (sender, data) {
  await chrome.windows.update(sender.tab.windowId, {
    state: 'minimized'
  });
  // confirm success
  return true;
}


export async function ToggleWindowSize (sender, data) {
  const window = await chrome.windows.get(sender.tab.windowId);

  await chrome.windows.update(sender.tab.windowId, {
    state: window.state === 'maximized' ? 'normal' : 'maximized'
  });
  // confirm success
  return true;
}


// maximizes the window if it is already in full screen mode
export async function ToggleFullscreen (sender, data) {
  const window = await chrome.windows.get(sender.tab.windowId);

  await chrome.windows.update(sender.tab.windowId, {
    state: window.state === 'fullscreen' ? 'maximized' : 'fullscreen'
  });
  // confirm success
  return true;
}


// Activates full screen mode for the current window if it is not already in full screen mode
export async function EnterFullscreen (sender, data) {
  const window = await chrome.windows.get(sender.tab.windowId);
  if (window.state !== 'fullscreen') {
    await chrome.windows.update(sender.tab.windowId, {
      state: 'fullscreen'
    });
    // confirm success
    return true;
  }
}


export async function NewWindow (sender, data) {
  await chrome.windows.create({});
  // confirm success
  return true;
}


export async function NewPrivateWindow (sender, data) {
  try {
    await chrome.windows.create({
      incognito: true
    });
    // confirm success
    return true;
  }
  catch (error) {
    if (error.message === 'Extension does not have permission for incognito mode') displayNotification(
      chrome.i18n.getMessage('commandErrorNotificationTitle', chrome.i18n.getMessage("commandLabelNewPrivateWindow")),
      chrome.i18n.getMessage('commandErrorNotificationMessageMissingIncognitoPermissions'),
      "https://github.com/Robbendebiene/Gesturefy/wiki/Missing-incognito-permission"
    );
  }
}


export async function MoveTabToStart (sender, data) {
  // query pinned tabs if current tab is pinned or vice versa
  const tabs = await chrome.tabs.query({
    windowId: sender.tab.windowId,
    pinned: sender.tab.pinned,
  });

  const mostLeftTab = tabs.reduce((acc, cur) => cur.index < acc.index ? cur : acc);

  // if tab is not already at the start
  if (mostLeftTab.index !== sender.tab.index) {
    await chrome.tabs.move(sender.tab.id, {
      index: mostLeftTab.index
    });
    // confirm success
    return true;
  }
}


export async function MoveTabToEnd (sender, data) {
  // query pinned tabs if current tab is pinned or vice versa
  const tabs = await chrome.tabs.query({
    windowId: sender.tab.windowId,
    pinned: sender.tab.pinned,
  });

  const mostRightTab = tabs.reduce((acc, cur) => cur.index > acc.index ? cur : acc);

  // if tab is not already at the end
  if (mostRightTab.index !== sender.tab.index) {
    await chrome.tabs.move(sender.tab.id, {
      index: mostRightTab.index + 1
    });
    // confirm success
    return true;
  }
}


export async function MoveTabRight (sender, data) {
  // query pinned tabs if current tab is pinned or vice versa
  const tabs = await chrome.tabs.query({
    windowId: sender.tab.windowId,
    pinned: sender.tab.pinned,
  });
  tabs.sort((a, b) => a.index - b.index);

  const currentTabQueryIndex = tabs.findIndex((tab) => tab.index === sender.tab.index);
  // defines the shift (offset and direction) of the tab
  // fallback to 1 on 0 or empty setting
  const shift = Number(this.getSetting("shift")) || 1;
  let nextTabQueryIndex = currentTabQueryIndex + shift;
  if (this.getSetting("cycling")) {
    // wrap index
    nextTabQueryIndex = ((nextTabQueryIndex % tabs.length) + tabs.length) % tabs.length;
  }
  else {
    nextTabQueryIndex = Math.min(nextTabQueryIndex, tabs.length - 1);
  }
  if (nextTabQueryIndex !== currentTabQueryIndex) {
    await chrome.tabs.move(sender.tab.id, {
      index: tabs[nextTabQueryIndex].index,
    });
    // confirm success
    return true;
  }
}


export async function MoveTabLeft (sender, data) {
  // query pinned tabs if current tab is pinned or vice versa
  const tabs = await chrome.tabs.query({
    windowId: sender.tab.windowId,
    pinned: sender.tab.pinned,
  });
  tabs.sort((a, b) => a.index - b.index);

  const currentTabQueryIndex = tabs.findIndex((tab) => tab.index === sender.tab.index);
  // defines the shift (offset and direction) of the tab
    // fallback to 1 on 0 or empty setting
  const shift = -(Number(this.getSetting("shift")) || 1);
  let nextTabQueryIndex = currentTabQueryIndex + shift;
  if (this.getSetting("cycling")) {
    // wrap index
    nextTabQueryIndex = ((nextTabQueryIndex % tabs.length) + tabs.length) % tabs.length;
  }
  else {
    nextTabQueryIndex = Math.min(nextTabQueryIndex, tabs.length - 1);
  }
  if (nextTabQueryIndex !== currentTabQueryIndex) {
    await chrome.tabs.move(sender.tab.id, {
      index: tabs[nextTabQueryIndex].index,
    });
    // confirm success
    return true;
  }
}


export async function MoveTabToNewWindow (sender, data) {
  await chrome.windows.create({
    tabId: sender.tab.id
  });
  // confirm success
  return true;
}


export async function MoveRightTabsToNewWindow (sender, data) {
  const queryProperties = {
    windowId: sender.tab.windowId,
    pinned: false,
  };
  // exclude current tab if specified
  if (!this.getSetting("includeCurrent")) queryProperties.active = false;

  // query only unpinned tabs
  const tabs = await chrome.tabs.query(queryProperties);
  const rightTabs = tabs.filter((ele) => ele.index >= sender.tab.index);
  const rightTabIds = rightTabs.map((ele) => ele.id);

  // create new window with the first tab and move corresponding tabs to the new window
  if (rightTabIds.length > 0) {
    const windowProperties = {
      tabId: rightTabIds.shift()
    };

    if (!this.getSetting("focus")) windowProperties.state = "minimized";

    const window = await chrome.windows.create(windowProperties);
    await chrome.tabs.move(rightTabIds, {
      windowId: window.id,
      index: 1
    });
    // confirm success
    return true;
  }
}


export async function MoveLeftTabsToNewWindow (sender, data) {
  const queryProperties = {
    windowId: sender.tab.windowId,
    pinned: false,
  };
  // exclude current tab if specified
  if (!this.getSetting("includeCurrent")) queryProperties.active = false;

  // query only unpinned tabs
  const tabs = await chrome.tabs.query(queryProperties);
  const leftTabs = tabs.filter((ele) => ele.index <= sender.tab.index);
  const leftTabIds = leftTabs.map((ele) => ele.id);

  // create new window with the last tab and move corresponding tabs to the new window
  if (leftTabIds.length > 0) {
    const windowProperties = {
      tabId: leftTabIds.pop()
    };

    if (!this.getSetting("focus")) windowProperties.state = "minimized";

    const window = await chrome.windows.create(windowProperties);
    await chrome.tabs.move(leftTabIds, {
      windowId: window.id,
      index: 0
    });
    // confirm success
    return true;
  }
}


export async function CloseWindow (sender, data) {
  await chrome.windows.remove(sender.tab.windowId);
  // confirm success
  return true;
}


export async function ToRootURL (sender, data) {
  const url = new URL(sender.tab.url);

  if (url.pathname !== "/" || url.search || url.hash) {
    await chrome.tabs.update(sender.tab.id, { "url": url.origin });
    // confirm success
    return true;
  }
}


export async function URLLevelUp (sender, data) {
  const url = new URL(sender.tab.url);
  const newPath = url.pathname.replace(/\/([^/]+)\/?$/, '');

  if (newPath !== url.pathname) {
    await chrome.tabs.update(sender.tab.id, { "url": url.origin + newPath });
    // confirm success
    return true;
  }
}


export async function IncreaseURLNumber (sender, data) {
  const url = decodeURI(sender.tab.url);

  // get user defined regex or use regex that matches the last number occurrence
  // the regex matches number between or at the end of slashes (e.g. /23/)
  // and the values of query parameters (e.g. ?param=23)
  // therefore it should ignore numbers in the domain, port and hash
  // the regex is used on the whole url to give users with custom regex more control
  let matchNumber

  if (this.getSetting("regex")) {
    matchNumber = RegExp(this.getSetting("regex"));
  }
  else {
    // matches /<NUMBER>(/|?|#|END)
    const matchBetweenSlashes = /(?<=\/)(\d+)(?=[\/?#]|$)/;
    // matches (?|&)parameter=<NUMBER>(?|&|#|END)
    const matchQueryParameterValue = /(?<=[?&]\w+=)(\d+)(?=[?&#]|$)/;
    // combine regex patterns and use negative lookahead to match the last occurrence
    matchNumber = new RegExp(
      "((" + matchBetweenSlashes.source + ")|(" + matchQueryParameterValue.source + "))" +
      "(?!.*((" + matchBetweenSlashes.source + ")|(" + matchQueryParameterValue.source + ")))"
    );
  }

  // check if first match is a valid number and greater or equal to 0
  if (Number(url.match(matchNumber)?.[0]) >= 0) {
    const newURL = url.replace(matchNumber, (match) => {
      const incrementedNumber = Number(match) + 1;
      // keep the same string/number length as the matched number by adding leading zeros
      return incrementedNumber.toString().padStart(match.length, 0);
    });

    await chrome.tabs.update(sender.tab.id, { "url": newURL });
    // confirm success
    return true;
  }
}


export async function DecreaseURLNumber (sender, data) {
  const url = decodeURI(sender.tab.url);

  // get user defined regex or use regex that matches the last number occurrence
  // the regex matches number between or at the end of slashes (e.g. /23/)
  // and the values of query parameters (e.g. ?param=23)
  // therefore it should ignore numbers in the domain, port and hash
  // the regex is used on the whole url to give users with custom regex more control
  let matchNumber

  if (this.getSetting("regex")) {
    matchNumber = RegExp(this.getSetting("regex"));
  }
  else {
    // matches /<NUMBER>(/|?|#|END)
    const matchBetweenSlashes = /(?<=\/)(\d+)(?=[\/?#]|$)/;
    // matches (?|&)parameter=<NUMBER>(?|&|#|END)
    const matchQueryParameterValue = /(?<=[?&]\w+=)(\d+)(?=[?&#]|$)/;
    // combine regex patterns and use negative lookahead to match the last occurrence
    matchNumber = new RegExp(
      "((" + matchBetweenSlashes.source + ")|(" + matchQueryParameterValue.source + "))" +
      "(?!.*((" + matchBetweenSlashes.source + ")|(" + matchQueryParameterValue.source + ")))"
    );
  }

  // check if first match is a valid number and greater than 0
  if (Number(url.match(matchNumber)?.[0]) > 0) {
    const newURL = url.replace(matchNumber, (match) => {
      const decrementedNumber = Number(match) - 1;
      // keep the same string/number length as the matched number by adding leading zeros
      return decrementedNumber.toString().padStart(match.length, 0);
    });

    await chrome.tabs.update(sender.tab.id, { "url": newURL });
    // confirm success
    return true;
  }
}


export async function OpenImageInNewTab (sender, data) {
  if (data.target.nodeName.toLowerCase() === "img" && data.target.src) {
    let index;

    switch (this.getSetting("position")) {
      case "before":
        index = sender.tab.index;
      break;
      case "after":
        index = sender.tab.index + 1;
      break;
      case "start":
        index = 0;
      break;
      case "end":
        index = Number.MAX_SAFE_INTEGER;
      break;
      default:
        index = null;
      break;
    }

    await chrome.tabs.create({
      url: data.target.src,
      active: this.getSetting("focus"),
      index: index,
      openerTabId: sender.tab.id
    });
    // confirm success
    return true;
  }
}


export async function OpenLinkInNewTab (sender, data) {
  let url = null;
  // only allow http/https urls to open from text selection to better mimic Firefox's behaviour
  if (isHTTPURL(data.selection.text)) url = data.selection.text;
  // if selected text matches the format of a domain name add the missing protocol
  else if (isDomainName(data.selection.text)) url = "http://" + data.selection.text.trim();
  // check if the provided url can be opened by webextensions (is not privileged)
  else if (data.link && isLegalURL(data.link.href)) url = data.link.href;

  if (url || this.getSetting("emptyTab")) {
    let index;

    switch (this.getSetting("position")) {
      case "before":
        index = sender.tab.index;
      break;
      case "after":
        index = sender.tab.index + 1;
      break;
      case "start":
        index = 0;
      break;
      case "end":
        index = Number.MAX_SAFE_INTEGER;
      break;
      default:
        // default behaviour - insert new tabs as adjacent children
        // depends on chrome.tabs.insertRelatedAfterCurrent and chrome.tabs.insertAfterCurrent
        index = null;
      break;
    }

    // open new tab
    await chrome.tabs.create({
      url: url,
      active: this.getSetting("focus"),
      index: index,
      openerTabId: sender.tab.id
    });
    // confirm success
    return true;
  }
}


export async function OpenLinkInNewWindow (sender, data) {
  let url = null;
  // only allow http/https urls to open from text selection to better mimic Firefox's behaviour
  if (isHTTPURL(data.selection.text)) url = data.selection.text;
  // if selected text matches the format of a domain name add the missing protocol
  else if (isDomainName(data.selection.text)) url = "http://" + data.selection.text.trim();
  // check if the provided url can be opened by webextensions (is not privileged)
  else if (data.link && isLegalURL(data.link.href)) url = data.link.href;

  if (url || this.getSetting("emptyWindow")) {
    await chrome.windows.create({
      url: url
    });
    // confirm success
    return true;
  }
}


export async function OpenLinkInNewPrivateWindow (sender, data) {
  let url = null;
  // only allow http/https urls to open from text selection to better mimic Firefox's behaviour
  if (isHTTPURL(data.selection.text)) url = data.selection.text;
  // if selected text matches the format of a domain name add the missing protocol
  else if (isDomainName(data.selection.text)) url = "http://" + data.selection.text.trim();
  // check if the provided url can be opened by webextensions (is not privileged)
  else if (data.link && isLegalURL(data.link.href)) url = data.link.href;

  if (url || this.getSetting("emptyWindow")) {
    try {
      await chrome.windows.create({
        url: url,
        incognito: true
      });
      // confirm success
      return true;
    }
    catch (error) {
      if (error.message === 'Extension does not have permission for incognito mode') displayNotification(
        chrome.i18n.getMessage('commandErrorNotificationTitle', chrome.i18n.getMessage("commandLabelNewPrivateWindow")),
        chrome.i18n.getMessage('commandErrorNotificationMessageMissingIncognitoPermissions'),
        "https://github.com/Robbendebiene/Gesturefy/wiki/Missing-incognito-permission"
      );
    }
  }
}


export async function LinkToNewBookmark (sender, data) {
  let url = null, title = null;
  // only allow http/https urls to open from text selection to better mimic Firefox's behaviour
  if (isHTTPURL(data.selection.text)) url = data.selection.text;
  // if selected text matches the format of a domain name add the missing protocol
  else if (isDomainName(data.selection.text)) url = "http://" + data.selection.text.trim();
  else if (data.link && data.link.href) {
    url = data.link.href;
    title = data.link.title || data.link.textContent || data.target.title || null;
  }

  if (url) {
    await chrome.bookmarks.create({
      url: url,
      title: title || new URL(url).hostname
    });
    // confirm success
    return true;
  }
}


export async function SearchTextSelection (sender, data) {
  if (data.selection.text.trim() === "" && this.getSetting("openEmptySearch") === false) {
    return;
  }

  // either use specified search engine url or default search engine
  let searchEngineURL = this.getSetting("searchEngineURL");
  if (searchEngineURL) {
    // if contains placeholder replace it
    if (searchEngineURL.includes("%s")) {
      searchEngineURL = searchEngineURL.replace("%s", encodeURIComponent(data.selection.text));
    }
    // else append to url
    else {
      searchEngineURL = searchEngineURL + encodeURIComponent(data.selection.text);
    }
    await chrome.tabs.update(sender.tab.id, {
      url: searchEngineURL
    });
  }
  else {
    await chrome.search.query({
      text: data.selection.text,
      tabId: sender.tab.id
    });
  }
  // confirm success
  return true;
}


export async function SearchTextSelectionInNewTab (sender, data) {
  if (data.selection.text.trim() === "" && this.getSetting("openEmptySearch") === false) {
    return;
  }

  // use about:blank to prevent the display of the new tab page
  const tabProperties = {
    active: this.getSetting("focus"),
    openerTabId: sender.tab.id,
    url: "about:blank"
  };

  // define tab position
  switch (this.getSetting("position")) {
    case "before":
      tabProperties.index = sender.tab.index;
    break;
    case "after":
      tabProperties.index = sender.tab.index + 1;
    break;
    case "start":
      tabProperties.index = 0;
    break;
    case "end":
      tabProperties.index = Number.MAX_SAFE_INTEGER;
    break;
  }

  // either use specified search engine url or default search engine
  const searchEngineURL = this.getSetting("searchEngineURL");
  if (searchEngineURL) {
    // if contains placeholder replace it
    if (searchEngineURL.includes("%s")) {
      tabProperties.url = searchEngineURL.replace("%s", encodeURIComponent(data.selection.text));
    }
    // else append to url
    else {
      tabProperties.url = searchEngineURL + encodeURIComponent(data.selection.text);
    }
    await chrome.tabs.create(tabProperties);
  }
  else {
    const tab = await chrome.tabs.create(tabProperties);
    await chrome.search.query({
      text: data.selection.text,
      tabId: tab.id
    });
  }
  // confirm success
  return true;
}


export async function SearchClipboard (sender, data) {
  const clipboardText = await readClipboard(sender);

  if (clipboardText === null || (clipboardText.trim() === "" && this.getSetting("openEmptySearch") === false)) {
    return;
  }

  // either use specified search engine url or default search engine
  let searchEngineURL = this.getSetting("searchEngineURL");
  if (searchEngineURL) {
    // if contains placeholder replace it
    if (searchEngineURL.includes("%s")) {
      searchEngineURL = searchEngineURL.replace("%s", encodeURIComponent(clipboardText));
    }
    // else append to url
    else {
      searchEngineURL = searchEngineURL + encodeURIComponent(clipboardText);
    }
    await chrome.tabs.update(sender.tab.id, {
      url: searchEngineURL
    });
  }
  else {
    await chrome.search.query({
      text: clipboardText,
      tabId: sender.tab.id
    });
  }
  // confirm success
  return true;
}


export async function SearchClipboardInNewTab (sender, data) {
  const clipboardText = await readClipboard(sender);

  if (clipboardText === null || (clipboardText.trim() === "" && this.getSetting("openEmptySearch") === false)) {
    return;
  }

  // use about:blank to prevent the display of the new tab page
  const tabProperties = {
    active: this.getSetting("focus"),
    openerTabId: sender.tab.id,
    url: "about:blank"
  };

  // define tab position
  switch (this.getSetting("position")) {
    case "before":
      tabProperties.index = sender.tab.index;
    break;
    case "after":
      tabProperties.index = sender.tab.index + 1;
    break;
    case "start":
      tabProperties.index = 0;
    break;
    case "end":
      tabProperties.index = Number.MAX_SAFE_INTEGER;
    break;
  }

  // either use specified search engine url or default search engine
  const searchEngineURL = this.getSetting("searchEngineURL");
  if (searchEngineURL) {
    // if contains placeholder replace it
    if (searchEngineURL.includes("%s")) {
      tabProperties.url = searchEngineURL.replace("%s", encodeURIComponent(clipboardText));
    }
    // else append to url
    else {
      tabProperties.url = searchEngineURL + encodeURIComponent(clipboardText);
    }
    await chrome.tabs.create(tabProperties);
  }
  else {
    const tab = await chrome.tabs.create(tabProperties);
    await chrome.search.query({
      text: clipboardText,
      tabId: tab.id
    });
  }
  // confirm success
  return true;
}


export async function OpenCustomURLInNewTab (sender, data) {
  let index;

  switch (this.getSetting("position")) {
    case "before":
      index = sender.tab.index;
    break;
    case "after":
      index = sender.tab.index + 1;
    break;
    case "start":
      index = 0;
    break;
    case "end":
      index = Number.MAX_SAFE_INTEGER;
    break;
    default:
      index = null;
    break;
  }

  try {
    await chrome.tabs.create({
      url: this.getSetting("url"),
      active: this.getSetting("focus"),
      index: index,
    });
    // confirm success
    return true;
  }
  catch (error) {
    // create error notification and open corresponding wiki page on click
    displayNotification(
      chrome.i18n.getMessage('commandErrorNotificationTitle', chrome.i18n.getMessage("commandLabelOpenCustomURLInNewTab")),
      chrome.i18n.getMessage('commandErrorNotificationMessageIllegalURL'),
      "https://github.com/Robbendebiene/Gesturefy/wiki/Illegal-URL"
    );
  }
}


export async function OpenCustomURL (sender, data) {
  try {
    await chrome.tabs.update(sender.tab.id, {
      url: this.getSetting("url")
    });
    // confirm success
    return true;
  }
  catch (error) {
    // create error notification and open corresponding wiki page on click
    displayNotification(
      chrome.i18n.getMessage('commandErrorNotificationTitle', chrome.i18n.getMessage("commandLabelOpenCustomURL")),
      chrome.i18n.getMessage('commandErrorNotificationMessageIllegalURL'),
      "https://github.com/Robbendebiene/Gesturefy/wiki/Illegal-URL"
    );
  };
}


export async function OpenCustomURLInNewWindow (sender, data) {
  try {
    await chrome.windows.create({
      url: this.getSetting("url")
    });
    // confirm success
    return true;
  }
  catch (error) {
    // create error notification and open corresponding wiki page on click
    displayNotification(
      chrome.i18n.getMessage('commandErrorNotificationTitle', chrome.i18n.getMessage("commandLabelOpenCustomURL")),
      chrome.i18n.getMessage('commandErrorNotificationMessageIllegalURL'),
      "https://github.com/Robbendebiene/Gesturefy/wiki/Illegal-URL"
    );
  };
}


export async function OpenCustomURLInNewPrivateWindow (sender, data) {
  try {
    await chrome.windows.create({
      url: this.getSetting("url"),
      incognito: true
    });
    // confirm success
    return true;
  }
  catch (error) {
    // create error notifications and open corresponding wiki page on click
    if (error.message === 'Extension does not have permission for incognito mode') displayNotification(
      chrome.i18n.getMessage('commandErrorNotificationTitle', chrome.i18n.getMessage("commandLabelNewPrivateWindow")),
      chrome.i18n.getMessage('commandErrorNotificationMessageMissingIncognitoPermissions'),
      "https://github.com/Robbendebiene/Gesturefy/wiki/Missing-incognito-permission"
    );
    else displayNotification(
      chrome.i18n.getMessage('commandErrorNotificationTitle', chrome.i18n.getMessage("commandLabelOpenCustomURL")),
      chrome.i18n.getMessage('commandErrorNotificationMessageIllegalURL'),
      "https://github.com/Robbendebiene/Gesturefy/wiki/Illegal-URL"
    );
  };
}


export async function OpenHomepage (sender, data) {
  let homepageURL = "chrome://newtab/";
  // try adding protocol on invalid url
  if (!isURL(homepageURL)) homepageURL = 'http://' + homepageURL;

  try {
    if (sender.tab.pinned) {
      await chrome.tabs.create({
        url: homepageURL,
        active: true,
      });
    }
    else {
      await chrome.tabs.update(sender.tab.id, {
        url: homepageURL
      });
    }
    // confirm success
    return true;
  }
  catch (error) {
    // create error notification and open corresponding wiki page on click
    displayNotification(
      chrome.i18n.getMessage('commandErrorNotificationTitle', chrome.i18n.getMessage("commandLabelOpenHomepage")),
      chrome.i18n.getMessage('commandErrorNotificationMessageIllegalURL'),
      "https://github.com/Robbendebiene/Gesturefy/wiki/Illegal-URL"
    );
  }
}


export async function OpenLink (sender, data) {
  let url = null;
  // only allow http/https urls to open from text selection to better mimic Firefox's behaviour
  if (isHTTPURL(data.selection.text)) url = data.selection.text;
  // if selected text matches the format of a domain name add the missing protocol
  else if (isDomainName(data.selection.text)) url = "http://" + data.selection.text.trim();
  // check if the provided url can be opened by webextensions (is not privileged)
  else if (data.link && isLegalURL(data.link.href)) url = data.link.href;

  if (url) {
    if (sender.tab.pinned) {
      const tabs = await chrome.tabs.query({
        windowId: sender.tab.windowId,
        pinned: false,
      });

      // get the lowest index excluding pinned tabs
      let mostLeftTabIndex = 0;
      if (tabs.length > 0) mostLeftTabIndex = tabs.reduce((min, cur) => min.index < cur.index ? min : cur).index;

      await chrome.tabs.create({
        url: url,
        active: true,
        index: mostLeftTabIndex,
        openerTabId: sender.tab.id
      });
    }
    else await chrome.tabs.update(sender.tab.id, {
      url: url
    });
    // confirm success
    return true;
  }
}


export async function ViewImage (sender, data) {
  if (data.target.nodeName.toLowerCase() === "img" && data.target.src) {
    if (sender.tab.pinned) {
      const tabs = await chrome.tabs.query({
        windowId: sender.tab.windowId,
        pinned: false,
      });

      // get the lowest index excluding pinned tabs
      let mostLeftTabIndex = 0;
      if (tabs.length > 0) mostLeftTabIndex = tabs.reduce((min, cur) => min.index < cur.index ? min : cur).index;

      await chrome.tabs.create({
        url: data.target.src,
        active: true,
        index: mostLeftTabIndex,
        openerTabId: sender.tab.id
      });
    }
    else await chrome.tabs.update(sender.tab.id, {
      url: data.target.src
    });
    // confirm success
    return true;
  }
}


export async function OpenURLFromClipboard (sender, data) {
  const clipboardText = await readClipboard(sender);
  if (clipboardText === null) return;

  let url = null;
  // check if the provided url can be opened by webextensions (is not privileged)
  if (isLegalURL(clipboardText)) url = clipboardText;
  // if clipboard text matches the format of a domain name add the missing protocol
  else if (isDomainName(clipboardText)) url = "http://" + clipboardText.trim();

  if (url) {
    await chrome.tabs.update(sender.tab.id, {
      url: url
    });
    // confirm success
    return true;
  }
}


export async function OpenURLFromClipboardInNewTab (sender, data) {
  const clipboardText = await readClipboard(sender);
  if (clipboardText === null) return;

  let url = null;
  // check if the provided url can be opened by webextensions (is not privileged)
  if (isLegalURL(clipboardText)) url = clipboardText;
  // if clipboard text matches the format of a domain name add the missing protocol
  else if (isDomainName(clipboardText)) url = "http://" + clipboardText.trim();

  if (url) {
    let index;

    switch (this.getSetting("position")) {
      case "before":
        index = sender.tab.index;
      break;
      case "after":
        index = sender.tab.index + 1;
      break;
      case "start":
        index = 0;
      break;
      case "end":
        index = Number.MAX_SAFE_INTEGER;
      break;
      default:
        index = null;
      break;
    }

    await chrome.tabs.create({
      url: url,
      active: this.getSetting("focus"),
      index: index
    });
    // confirm success
    return true;
  }
}


export async function OpenURLFromClipboardInNewWindow (sender, data) {
  const clipboardText = await readClipboard(sender);
  if (clipboardText === null) return;

  let url = null;
  // check if the provided url can be opened by webextensions (is not privileged)
  if (isLegalURL(clipboardText)) url = clipboardText;
  // if clipboard text matches the format of a domain name add the missing protocol
  else if (isDomainName(clipboardText)) url = "http://" + clipboardText.trim();

  if (url || this.getSetting("emptyWindow")) {
    await chrome.windows.create({
      url: url
    });
    // confirm success
    return true;
  }
}


export async function OpenURLFromClipboardInNewPrivateWindow (sender, data) {
  const clipboardText = await readClipboard(sender);
  if (clipboardText === null) return;

  let url = null;
  // check if the provided url can be opened by webextensions (is not privileged)
  if (isLegalURL(clipboardText)) url = clipboardText;
  // if clipboard text matches the format of a domain name add the missing protocol
  else if (isDomainName(clipboardText)) url = "http://" + clipboardText.trim();

  if (url || this.getSetting("emptyWindow")) {
    try {
      await chrome.windows.create({
        url: url,
        incognito: true
      });
      // confirm success
      return true;
    }
    catch (error) {
      if (error.message === 'Extension does not have permission for incognito mode') displayNotification(
        chrome.i18n.getMessage('commandErrorNotificationTitle', chrome.i18n.getMessage("commandLabelNewPrivateWindow")),
        chrome.i18n.getMessage('commandErrorNotificationMessageMissingIncognitoPermissions'),
        "https://github.com/Robbendebiene/Gesturefy/wiki/Missing-incognito-permission"
      );
    }
  }
}


export async function PasteClipboard (sender, data) {
  try {
    const tabId = await getTabId(sender);
    if (!tabId) return;
    await chrome.scripting.executeScript({
      target: { tabId, frameIds: [sender.frameId ?? 0] },
      func: () => document.execCommand("paste")
    });
    // confirm success
    return true;
  }
  catch (error) {
    return;
  }
}


export async function InsertCustomText (sender, data) {
  const text = this.getSetting('text');

  const _res2 = await chrome.scripting.executeScript({
    target: { tabId: sender.tab.id, frameIds: [sender.frameId ?? 0] },
    func: (insertionText) => {
      const target = window.TARGET;
      if (Number.isInteger(target.selectionStart) && !target.disabled && !target.readOnly) {
        target.setRangeText(insertionText, target.selectionStart, target.selectionEnd, 'end');
        target.focus();
        return true;
      }
      else if (target.isContentEditable) {
        const range = window.getSelection().getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(insertionText));
        range.collapse();
        target.focus();
        return true;
      }
      return false;
    },
    args: [text]
  });
  const result = _res2[0]?.result;
  // confirm success
  return result;
}


// Removed SaveTabAsPDF


export async function PrintTab (sender, data) {
  await chrome.scripting.executeScript({
    target: { tabId: sender.tab.id },
    func: () => window.print()
  });
  // confirm success
  return true;
}


// Removed OpenPrintPreview


export async function SaveScreenshot (sender, data) {
  let screenshotURL = await chrome.tabs.captureVisibleTab();
  // convert data uri to blob
  screenshotURL = URL.createObjectURL(dataURItoBlob(screenshotURL));

  const downloadId = await chrome.downloads.download({
    url: screenshotURL,
    // remove special file name characters
    filename: sanitizeFilename(sender.tab.title) + '.png',
    saveAs: true
  });

  // catch error and free the blob for gc
  if (chrome.runtime.lastError) URL.revokeObjectURL(screenshotURL);
  else chrome.downloads.onChanged.addListener(function clearURL(downloadDelta) {
    if (downloadId === downloadDelta.id && downloadDelta.state.current === "complete") {
      URL.revokeObjectURL(screenshotURL);
      chrome.downloads.onChanged.removeListener(clearURL);
    }
  });
  // confirm success
  return true;
}

export async function CopyTabURL (sender, data) {
  let url = sender?.tab?.url;
  if (!url) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    url = tab?.url;
  }
  if (url) {
    const success = await writeClipboard(sender, url);
    if (success) {
      // confirm success
      return true;
    }
  }
}


export async function CopyLinkURL (sender, data) {
  let url = null;
  // only allow http/https urls to open from text selection to better mimic Firefox's behaviour
  if (isHTTPURL(data.selection.text)) url = data.selection.text;
  else if (data.link && data.link.href) url = data.link.href;

  if (url) {
    const success = await writeClipboard(sender, url);
    if (success) {
      // confirm success
      return true;
    }
  }
}


export async function CopyImageURL (sender, data) {
  if (data.target.nodeName.toLowerCase() === "img" && data.target.src) {
    const success = await writeClipboard(sender, data.target.src);
    if (success) {
      // confirm success
      return true;
    }
  }
}


export async function CopyTextSelection (sender, data) {
  if (data.selection.text) {
    const success = await writeClipboard(sender, data.selection.text);
    if (success) {
      // confirm success
      return true;
    }
  }
}


// Removed CopyImage


export async function SaveImage (sender, data) {
  if (data.target.nodeName.toLowerCase() === "img" && data.target.src && isURL(data.target.src)) {
    const queryOptions = {
      saveAs: this.getSetting("promptDialog"),
      // download in incognito window if currently in incognito mode
      incognito: sender.tab.incognito
    };

    const imageURLObject = new URL(data.target.src);
    // if data url create blob
    if (imageURLObject.protocol === "data:") {
      queryOptions.url = URL.createObjectURL(dataURItoBlob(data.target.src));
      // get file extension from mime type
      const fileExtension =  data.target.src.split("data:image/").pop().split(";")[0];
      // construct file name
      queryOptions.filename = data.target.alt || data.target.title || "image";
      // remove special characters and add file extension
      queryOptions.filename = sanitizeFilename(queryOptions.filename) + "." + fileExtension;
    }
    // otherwise use normal url
    else queryOptions.url = data.target.src;

    // add referer header, because some websites modify the image if the referer is missing
    // get referrer from content script
    const _res3 = await chrome.scripting.executeScript({
      target: { tabId: sender.tab.id, frameIds: [sender.frameId ?? 0] },
      func: () => ({ referrer: document.referrer, url: window.location.href })
    });
    const documentValues = _res3[0]?.result;

    // if the image is embedded in a website use the url of that website as the referer
    if (data.target.src !== documentValues.url) {
      // emulate no-referrer-when-downgrade
      // The origin, path, and querystring of the URL are sent as a referrer when the protocol security level stays the same (HTTP→HTTP, HTTPS→HTTPS)
      // or improves (HTTP→HTTPS), but isn't sent to less secure destinations (HTTPS→HTTP).
      if (!(new URL(documentValues.url).protocol === "https:" && imageURLObject.protocol === "http:")) {
        queryOptions.headers = [ { name: "Referer", value: documentValues.url.split("#")[0] } ];
      }
    }
    // if the image is not embedded, but a referrer is set use the referrer
    else if (documentValues.referrer) {
      queryOptions.headers = [ { name: "Referer", value: documentValues.referrer } ];
    }

    // download image
    const downloadId = await chrome.downloads.download(queryOptions);

    // if data url then assume a blob file was created and clear its url
    if (imageURLObject.protocol === "data:") {
      // catch error and free the blob for gc
      if (chrome.runtime.lastError) URL.revokeObjectURL(queryOptions.url);
      else chrome.downloads.onChanged.addListener(function clearURL(downloadDelta) {
        if (downloadId === downloadDelta.id && downloadDelta.state.current === "complete") {
          URL.revokeObjectURL(queryOptions.url);
          chrome.downloads.onChanged.removeListener(clearURL);
        }
      });
    }
    // confirm success
    return true;
  }
}


export async function SaveMedia (sender, data) {
  const nodeName = data.target.nodeName?.toLowerCase();
  const mediaSrc = data.target.currentSrc ?? data.target.src;

  if ((nodeName === "video" || nodeName === "audio") && mediaSrc && isURL(mediaSrc)) {
    const queryOptions = {
      saveAs: this.getSetting("promptDialog"),
      // download in incognito window if currently in incognito mode
      incognito: sender.tab.incognito
    };

    const mediaURLObject = new URL(mediaSrc);
    // if data url create blob
    if (mediaURLObject.protocol === "data:") {
      queryOptions.url = URL.createObjectURL(dataURItoBlob(mediaSrc));
      // get file extension from mime type
      const mimeType = mediaSrc.split("data:").pop().split(";")[0];
      const fileExtension = mimeType.includes("/") ? mimeType.split("/").pop() : mimeType;
      // construct file name
      queryOptions.filename = data.target.alt || data.target.title || nodeName;
      // remove special characters and add file extension
      queryOptions.filename = sanitizeFilename(queryOptions.filename) + "." + fileExtension;
    }
    // otherwise use normal url
    else queryOptions.url = mediaSrc;

    // add referer header, because some websites modify the media if the referer is missing
    // get referrer from content script
    const _res3 = await chrome.scripting.executeScript({
      target: { tabId: sender.tab.id, frameIds: [sender.frameId ?? 0] },
      func: () => ({ referrer: document.referrer, url: window.location.href })
    });
    const documentValues = _res3[0]?.result;

    if (documentValues) {
      // if the media is embedded in a website use the url of that website as the referer
      if (mediaSrc !== documentValues.url) {
        // emulate no-referrer-when-downgrade
        // The origin, path, and querystring of the URL are sent as a referrer when the protocol security level stays the same (HTTP→HTTP, HTTPS→HTTPS)
        // or improves (HTTP→HTTPS), but isn't sent to less secure destinations (HTTPS→HTTP).
        if (!(new URL(documentValues.url).protocol === "https:" && mediaURLObject.protocol === "http:")) {
          queryOptions.headers = [ { name: "Referer", value: documentValues.url.split("#")[0] } ];
        }
      }
      // if the media is not embedded, but a referrer is set use the referrer
      else if (documentValues.referrer) {
        queryOptions.headers = [ { name: "Referer", value: documentValues.referrer } ];
      }
    }

    // download media
    const downloadId = await chrome.downloads.download(queryOptions);

    // if data url then assume a blob file was created and clear its url
    if (mediaURLObject.protocol === "data:") {
      // catch error and free the blob for gc
      if (chrome.runtime.lastError) URL.revokeObjectURL(queryOptions.url);
      else chrome.downloads.onChanged.addListener(function clearURL(downloadDelta) {
        if (downloadId === downloadDelta.id && downloadDelta.state.current === "complete") {
          URL.revokeObjectURL(queryOptions.url);
          chrome.downloads.onChanged.removeListener(clearURL);
        }
      });
    }
    // confirm success
    return true;
  }
}


export async function SaveLink (sender, data) {
  let url = null;
  // only allow http/https urls to open from text selection to better mimic Firefox's behaviour
  if (isHTTPURL(data.selection.text)) url = data.selection.text;
  // if selected text matches the format of a domain name add the missing protocol
  else if (isDomainName(data.selection.text)) url = "http://" + data.selection.text.trim();
  else if (data.link && data.link.href) url = data.link.href;

  if (url) {
    await chrome.downloads.download({
      url: url,
      saveAs: this.getSetting("promptDialog")
    });
    // confirm success
    return true;
  }
}


export async function ViewPageSourceCode (sender, data) {
  await chrome.tabs.create({
    active: true,
    index: sender.tab.index + 1,
    url: "view-source:" + sender.tab.url
  });
  // confirm success
  return true;
}


export async function OpenAddonSettings (sender, data) {
  await chrome.runtime.openOptionsPage();
  // confirm success
  return true;
}


export async function PopupAllTabs (sender, data) {
  const queryInfo = {
    windowId: sender.tab.windowId,
  };

  if (this.getSetting("excludeDiscarded")) queryInfo.discarded = false;

  const tabs = await chrome.tabs.query(queryInfo);

  // sort tabs if defined
  switch (this.getSetting("order")) {
    case "lastAccessedAsc":
      tabs.sort((a, b) => b.lastAccessed - a.lastAccessed);
    break;
    case "lastAccessedDesc":
      tabs.sort((a, b) => a.lastAccessed - b.lastAccessed);
    break;
    case "alphabeticalAsc":
      tabs.sort((a, b) => a.title.localeCompare(b.title));
    break;
    case "alphabeticalDesc":
      tabs.sort((a, b) => -a.title.localeCompare(b.title));
    break;
  }

  // exit function if user has no visible tabs
  if (tabs.length === 0) return;

  // map tabs to popup data structure
  const dataset = tabs.map((tab) => ({
    id: tab.id,
    label: tab.title,
    icon: tab.favIconUrl || null
  }));

  // request popup creation and wait for response
  const popupCreatedSuccessfully = await chrome.tabs.sendMessage(sender.tab.id, {
    subject: "popupRequest",
    data: {
      mousePositionX: data.mouse.endpoint.x,
      mousePositionY: data.mouse.endpoint.y
    },
  }, { frameId: 0 });

  // if popup creation failed exit this command function
  if (!popupCreatedSuccessfully) return;

  const channel = chrome.tabs.connect(sender.tab.id, {
    name: "PopupConnection"
  });

  channel.postMessage(dataset);

  channel.onMessage.addListener((message) => {
    chrome.tabs.update(Number(message.id), {active: true});
    // immediately disconnect the channel since keeping the popup open doesn't make sense
    channel.disconnect();
  });
  // confirm success
  return true;
}


export async function PopupRecentlyClosedTabs (sender, data) {
  let recentlyClosedSessions = await chrome.sessions.getRecentlyClosed({});
  // filter windows
  recentlyClosedSessions = recentlyClosedSessions.filter((element) => "tab" in element)

  // exit function if user has no recently closed tabs
  if (recentlyClosedSessions.length === 0) return;

  // map sessions to popup data structure
  const dataset = recentlyClosedSessions.map((element) => ({
    id: element.tab.sessionId,
    label: element.tab.title,
    icon: element.tab.favIconUrl || null
  }));

  // request popup creation and wait for response
  const popupCreatedSuccessfully = await chrome.tabs.sendMessage(sender.tab.id, {
    subject: "popupRequest",
    data: {
      mousePositionX: data.mouse.endpoint.x,
      mousePositionY: data.mouse.endpoint.y
    },
  }, { frameId: 0 });

  // if popup creation failed exit this command function
  if (!popupCreatedSuccessfully) return;

  const channel = chrome.tabs.connect(sender.tab.id, {
    name: "PopupConnection"
  });

  channel.postMessage(dataset);

  channel.onMessage.addListener((message) => {
    chrome.sessions.restore(message.id);
    // immediately disconnect the channel since keeping the popup open doesn't make sense
    // restored tab is always focused, probably because it is restored at its original tab index
    channel.disconnect();
  });
  // confirm success
  return true;
}


// Removed PopupSearchEngines


export async function PopupCustomCommandList (sender, data) {
  // get ref to Command class constructor
  const Command = this.constructor;
  // create Command objects
  const commands = this.getSetting("commands").map((commandObject) => {
    return new Command(commandObject);
  });
  // map commands to popup data structure
  const dataset = commands.map((command, index) => ({
    id: index,
    label: command.toString(),
    icon: null
  }));

  // request popup creation and wait for response
  const popupCreatedSuccessfully = await chrome.tabs.sendMessage(sender.tab.id, {
    subject: "popupRequest",
    data: {
      mousePositionX: data.mouse.endpoint.x,
      mousePositionY: data.mouse.endpoint.y
    },
  }, { frameId: 0 });

  // if popup creation failed exit this command function
  if (!popupCreatedSuccessfully) return;

  const channel = chrome.tabs.connect(sender.tab.id, {
    name: "PopupConnection"
  });

  channel.postMessage(dataset);

  channel.onMessage.addListener(async (message) => {
    const command = commands[message.id];
    const returnValue = await command.execute(sender, data);
    // close popup/channel if command succeeded
    if (returnValue === true) {
      channel.disconnect();
    }
  });
  // confirm success
  return true;
}


export async function RunMultiPurposeCommand (sender, data) {
  // get ref to Command class constructor
  const Command = this.constructor;

  let returnValue;
  for (const commandObject of this.getSetting("commands")) {
    const command = new Command(commandObject);
    returnValue = await command.execute(sender, data);
    // leave loop if command succeeded
    if (returnValue === true) break;
  }
  // return last value of command
  return returnValue
}


export async function SendMessageToOtherAddon (sender, data) {
  let message = this.getSetting("message");

  if (this.getSetting("parseJSON")) {
    // parse message to json object if serializable
    try {
      message = JSON.parse(this.getSetting("message"));
    }
    catch(error) {
      displayNotification(
        chrome.i18n.getMessage('commandErrorNotificationTitle', chrome.i18n.getMessage("commandLabelSendMessageToOtherAddon")),
        chrome.i18n.getMessage('commandErrorNotificationMessageNotSerializeable'),
        "https://github.com/Robbendebiene/Gesturefy/wiki/Send-message-to-other-addon#error-not-serializeable"
      );
      console.log(error);
      return;
    }
  }
  try {
    await chrome.runtime.sendMessage(this.getSetting("extensionId"), message, {});
    // confirm success
    return true;
  }
  catch (error) {
    if (error.message === 'Could not establish connection. Receiving end does not exist.') displayNotification(
      chrome.i18n.getMessage('commandErrorNotificationTitle', chrome.i18n.getMessage("commandLabelSendMessageToOtherAddon")),
      chrome.i18n.getMessage('commandErrorNotificationMessageMissingRecipient'),
      "https://github.com/Robbendebiene/Gesturefy/wiki/Send-message-to-other-addon#error-missing-recipient"
    );
  };
}


export async function ExecuteUserScript (sender, data) {
  const messageOptions = {};

  switch (this.getSetting("targetFrame")) {
    case "allFrames": break;

    case "topFrame":
      messageOptions.frameId = 0;
    break;

    case "sourceFrame":
    default:
      messageOptions.frameId = sender.frameId || 0;
    break;
  }

  // sends a message to the user script controller
  const isSuccessful = await chrome.tabs.sendMessage(
    sender.tab.id,
    {
      subject: "executeUserScript",
      data: this.getSetting("userScript"),
      tabId: sender.tab.id,
      frameId: messageOptions.frameId,
      clientX: data?.mouse?.endpoint?.x,
      clientY: data?.mouse?.endpoint?.y
    },
    messageOptions
  );
  // confirm success
  return isSuccessful;
}


export async function ClearBrowsingData (sender, data) {
  await chrome.browsingData.remove({}, {
    "cache": this.getSetting("cache"),
    "cookies": this.getSetting("cookies"),
    "downloads": this.getSetting("downloads"),
    "formData": this.getSetting("formData"),
    "history": this.getSetting("history"),
    "indexedDB": this.getSetting("indexedDB"),
    "localStorage": this.getSetting("localStorage"),
    "passwords": this.getSetting("passwords"),
    "pluginData": this.getSetting("pluginData"),
    "serviceWorkers": this.getSetting("serviceWorkers")
  });
  // confirm success
  return true;
}
