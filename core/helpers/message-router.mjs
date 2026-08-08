/**
 * Functions for forwarding messages from content scripts to other content script instances in the same tab
 */

const mouseGestureControllerSubjects = ["mouseGestureControllerPreparePreventDefault", "mouseGestureControllerNeglectPreventDefault"];
const mouseGestureViewSubjects = ["mouseGestureViewInitialize", "mouseGestureViewUpdateGestureTrace", "mouseGestureViewTerminate"];
const popupCommandViewSubjects = ["popupInitiation", "popupTermination"];

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // iframe > mouse-gesture-controller

  // check for iframe message subjects
  if (mouseGestureControllerSubjects.includes(message.subject)) {
    // forwards the message to all frames and catch potential error messages
    chrome.tabs.sendMessage(sender.tab.id, message).catch(() => void 0);
  }

  // iframe > mouse-gesture-view

  // check for iframe message subjects and the message source
  if (mouseGestureViewSubjects.includes(message.subject) && sender.frameId > 0) {
    // forwards the message to the main page containing all the data that was previously sent
    chrome.tabs.sendMessage(sender.tab.id, message, { frameId: 0 });
  }

  // iframe > popup-command-view

  // check for iframe message subjects
  if (popupCommandViewSubjects.includes(message.subject)) {
    // forwards the message to the main page containing all the data that was previously sent
    // also forward the promise responses
    return chrome.tabs.sendMessage(sender.tab.id, message, { frameId: 0 });
  }
});