import { ContentLoaded, Config } from "/views/options/main.mjs";
import { renderGestures } from "/views/options/gestures.mjs";

ContentLoaded.then(main);

/**
 * main function
 * run code that depends on async resources
 **/
function main () {
  const presetApplyButton = document.getElementById("presetApplyButton");
  if (presetApplyButton) {
    presetApplyButton.onclick = onApplyPreset;
  }
}

/**
 * Handles preset apply button click
 * Reads selected preset, saves to Gestures config, re-renders gestures list, and provides user feedback
 **/
async function onApplyPreset () {
  const presetSelect = document.getElementById("presetSelect");
  if (!presetSelect) return;

  const selectedPresetKey = presetSelect.value;
  const presets = Config.get("GesturePresets");

  if (presets && presets[selectedPresetKey]) {
    await Config.set("Gestures", presets[selectedPresetKey]);

    // Re-render gesture list UI
    renderGestures();

    // User feedback
    const button = document.getElementById("presetApplyButton");
    if (button) {
      const originalText = button.textContent;
      button.textContent = "✓";
      button.disabled = true;
      setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
      }, 1200);
    }
  }
}
