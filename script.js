const sourceInput = document.querySelector("#sourceInput");
const formattedOutput = document.querySelector("#formattedOutput");
const preset = document.querySelector("#preset");
const delimiter = document.querySelector("#delimiter");
const customDelimiter = document.querySelector("#customDelimiter");
const quoteStyle = document.querySelector("#quoteStyle");
const prefix = document.querySelector("#prefix");
const suffix = document.querySelector("#suffix");
const inputSeparator = document.querySelector("#inputSeparator");
const customInputSeparator = document.querySelector("#customInputSeparator");
const trimValues = document.querySelector("#trimValues");
const removeBlanks = document.querySelector("#removeBlanks");
const removeDuplicates = document.querySelector("#removeDuplicates");
const sortValues = document.querySelector("#sortValues");
const openButton = document.querySelector("#openButton");
const fileInput = document.querySelector("#fileInput");
const copyButton = document.querySelector("#copyButton");
const saveButton = document.querySelector("#saveButton");
const clearButton = document.querySelector("#clearButton");
const status = document.querySelector("#status");
const stats = document.querySelector("#stats");
const inputCount = document.querySelector("#inputCount");
const outputCount = document.querySelector("#outputCount");
const releaseStamp = document.querySelector("#releaseStamp");
const workspaceStatus = document.querySelector("#workspaceStatus");

const appRelease = "20261118-0943";
const MAX_INPUT_BYTES = 10_000_000;
const workspaceStorageKey = "delim-lizard.workspace.v1";
const textSettings = [preset, delimiter, customDelimiter, quoteStyle, prefix, suffix, inputSeparator, customInputSeparator];
const cleanupSettings = [trimValues, removeBlanks, removeDuplicates, sortValues];
let workspaceSaveTimer = null;

const presets = {
  sql: { delimiter: ",", quoteStyle: "single", prefix: "IN (", suffix: ")" },
  csv: { delimiter: ",", quoteStyle: "double", prefix: "", suffix: "" },
  javascript: { delimiter: ",", quoteStyle: "double", prefix: "[", suffix: "]" },
  query: { delimiter: ",", quoteStyle: "none", prefix: "", suffix: "" }
};

const delimiterValues = {
  "\t": "\t",
  "\n": "\n"
};

const separatorValues = {
  line: /\r?\n/,
  comma: ",",
  semicolon: ";",
  tab: "\t",
  pipe: "|"
};

sourceInput.addEventListener("input", rebuildWorkspace);
[delimiter, customDelimiter, quoteStyle, prefix, suffix, ...cleanupSettings]
  .forEach((control) => control.addEventListener("input", handleOutputControl));
inputSeparator.addEventListener("change", rebuildWorkspace);
customInputSeparator.addEventListener("input", rebuildWorkspace);
preset.addEventListener("change", applyPreset);
openButton.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", openSelectedFile);
copyButton.addEventListener("click", copyOutput);
saveButton.addEventListener("click", saveOutput);
clearButton.addEventListener("click", clearEditors);
window.addEventListener("pagehide", flushWorkspaceSave);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) flushWorkspaceSave();
});

renderReleaseStamp();
applyPresetValue("sql");
removeDuplicates.checked = true;
restoreWorkspace();
buildOutput();

function restoreWorkspace() {
  let workspace;
  try {
    const raw = localStorage.getItem(workspaceStorageKey);
    if (raw === null) return;
    workspace = JSON.parse(raw);
    if (typeof workspace?.input !== "string" || !workspace.settings || typeof workspace.settings !== "object") {
      throw new Error("Invalid workspace");
    }
  } catch {
    setWorkspaceStatus("Could not restore the saved workspace.");
    return;
  }

  sourceInput.value = workspace.input;
  for (const control of textSettings) {
    const value = workspace.settings[control.id];
    if (typeof value !== "string") continue;
    if (control instanceof HTMLSelectElement && !Array.from(control.options).some((option) => option.value === value)) continue;
    control.value = value;
  }
  for (const control of cleanupSettings) {
    const value = workspace.settings[control.id];
    if (typeof value === "boolean") control.checked = value;
  }
  setWorkspaceStatus("Workspace saved in this browser.");
}

function rebuildWorkspace() {
  buildOutput();
  clearTimeout(workspaceSaveTimer);
  workspaceSaveTimer = setTimeout(saveWorkspace, 250);
}

function saveWorkspace() {
  clearTimeout(workspaceSaveTimer);
  workspaceSaveTimer = null;
  const settings = Object.fromEntries([
    ...textSettings.map((control) => [control.id, control.value]),
    ...cleanupSettings.map((control) => [control.id, control.checked])
  ]);
  try {
    localStorage.setItem(workspaceStorageKey, JSON.stringify({ input: sourceInput.value, settings }));
    setWorkspaceStatus("Workspace saved in this browser.");
  } catch {
    setWorkspaceStatus("Workspace changes could not be saved.");
  }
}

function flushWorkspaceSave() {
  if (workspaceSaveTimer !== null) saveWorkspace();
}

function setWorkspaceStatus(message) {
  if (workspaceStatus.textContent !== message) workspaceStatus.textContent = message;
}

function buildOutput() {
  customDelimiter.classList.toggle("hidden", delimiter.value !== "custom");
  customInputSeparator.classList.toggle("hidden", inputSeparator.value !== "custom");
  if (getTextSize(sourceInput.value) > MAX_INPUT_BYTES) {
    formattedOutput.value = "";
    setStatus("Input exceeds the 10 MB limit.", "error");
    updateCounts({ originalCount: 0, values: [], duplicateCount: 0, blankCount: 0 });
    return;
  }

  const result = prepareValues(sourceInput.value);
  formattedOutput.value = result.values.length
    ? `${prefix.value}${result.values.map(formatValue).join(getDelimiter())}${suffix.value}`
    : "";
  updateCounts(result);

  const changes = [];
  if (result.duplicateCount) {
    changes.push(`${formatNumber(result.duplicateCount)} duplicate${result.duplicateCount === 1 ? "" : "s"} removed`);
  }
  if (result.blankCount) {
    changes.push(`${formatNumber(result.blankCount)} blank${result.blankCount === 1 ? "" : "s"} removed`);
  }

  if (!sourceInput.value) {
    setStatus("Ready", "idle");
  } else if (!result.values.length) {
    setStatus("No values to format", "error");
  } else {
    setStatus(changes.length ? changes.join("; ") : "Output updated", "valid");
  }
}

function prepareValues(input) {
  let values = input ? splitInput(input) : [];
  const originalCount = values.length;

  if (trimValues.checked) {
    values = values.map((value) => value.trim());
  }

  let blankCount = 0;
  if (removeBlanks.checked) {
    const before = values.length;
    values = values.filter((value) => value.length > 0);
    blankCount = before - values.length;
  }

  let duplicateCount = 0;
  if (removeDuplicates.checked) {
    const seen = new Set();
    values = values.filter((value) => {
      if (seen.has(value)) {
        duplicateCount += 1;
        return false;
      }
      seen.add(value);
      return true;
    });
  }

  if (sortValues.checked) {
    values = [...values].sort((left, right) => left.localeCompare(right, undefined, {
      numeric: true,
      sensitivity: "base"
    }));
  }

  return { originalCount, values, duplicateCount, blankCount };
}

function splitInput(input) {
  const selected = inputSeparator.value;
  if (selected === "custom") {
    return customInputSeparator.value ? input.split(customInputSeparator.value) : [input];
  }
  if (selected !== "auto") {
    return input.split(separatorValues[selected]);
  }

  if (/\r?\n/.test(input)) {
    return input.split(/\r?\n/);
  }

  const candidates = ["\t", ",", ";", "|"];
  const detected = candidates.find((candidate) => input.includes(candidate));
  return detected ? input.split(detected) : [input];
}

function formatValue(value) {
  if (preset.value === "javascript") {
    return JSON.stringify(value);
  }
  if (preset.value === "query") {
    return encodeURIComponent(value);
  }

  switch (quoteStyle.value) {
    case "single":
      return `'${value.replace(/'/g, "''")}'`;
    case "double":
      return `"${value.replace(/"/g, '""')}"`;
    case "brackets":
      return `[${value}]`;
    default:
      return value;
  }
}

function getDelimiter() {
  if (delimiter.value === "custom") {
    return customDelimiter.value;
  }
  return delimiterValues[delimiter.value] ?? delimiter.value;
}

function handleOutputControl() {
  preset.value = "custom";
  rebuildWorkspace();
}

function applyPreset() {
  if (preset.value !== "custom") applyPresetValue(preset.value);
  rebuildWorkspace();
}

function applyPresetValue(name) {
  const values = presets[name];
  if (!values) {
    return;
  }
  delimiter.value = values.delimiter;
  quoteStyle.value = values.quoteStyle;
  prefix.value = values.prefix;
  suffix.value = values.suffix;
  preset.value = name;
}

async function openSelectedFile() {
  const [file] = fileInput.files;
  fileInput.value = "";
  if (!file) {
    return;
  }
  if (file.size > MAX_INPUT_BYTES) {
    setStatus(`${file.name} exceeds the 10 MB limit.`, "error");
    return;
  }

  try {
    sourceInput.value = await file.text();
    if (/\.csv$/i.test(file.name)) {
      inputSeparator.value = "comma";
    } else if (/\.tsv$/i.test(file.name)) {
      inputSeparator.value = "tab";
    }
    buildOutput();
    saveWorkspace();
    setStatus(`Opened ${file.name}`, "valid");
  } catch {
    setStatus("Could not open file", "error");
  }
}

async function copyOutput() {
  if (!formattedOutput.value) {
    setStatus("Nothing to copy", "error");
    return;
  }
  try {
    await navigator.clipboard.writeText(formattedOutput.value);
  } catch {
    formattedOutput.select();
    document.execCommand("copy");
  }
  setStatus("Copied output", "valid");
}

function saveOutput() {
  if (!formattedOutput.value) {
    setStatus("Nothing to save", "error");
    return;
  }
  const blob = new Blob([formattedOutput.value], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `delim-lizard-${appRelease}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setStatus("Saved output file", "valid");
}

function clearEditors() {
  sourceInput.value = "";
  buildOutput();
  saveWorkspace();
  sourceInput.focus();
}

function updateCounts(result) {
  inputCount.textContent = `${formatNumber(result.originalCount)} ${result.originalCount === 1 ? "value" : "values"}`;
  outputCount.textContent = `${formatNumber(formattedOutput.value.length)} ${formattedOutput.value.length === 1 ? "char" : "chars"}`;
  stats.textContent = `${formatNumber(result.values.length)} ${result.values.length === 1 ? "value" : "values"} in output`;
}

function setStatus(message, type) {
  status.textContent = message;
  status.className = `status-pill status-${type}`;
}

function getTextSize(value) {
  return new Blob([value]).size;
}

function formatNumber(value) {
  return value.toLocaleString();
}

function renderReleaseStamp() {
  releaseStamp.textContent = `Version: ${appRelease}`;
}
