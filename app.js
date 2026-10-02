const form = document.querySelector("#download-form");
const urlInput = document.querySelector("#video-url");
const rights = document.querySelector("#rights-confirm");
const submitButton = document.querySelector("#resolve-btn");
const statusBox = document.querySelector("#status");
const resultBox = document.querySelector("#result");
document.querySelector("#year").textContent = new Date().getFullYear();

function setStatus(message, kind = "") {
  statusBox.textContent = message;
  statusBox.className = `status ${kind}`.trim();
  statusBox.hidden = false;
}
function clearResult() {
  resultBox.replaceChildren();
  resultBox.hidden = true;
}
function addText(parent, tag, text, className) {
  const el = document.createElement(tag);
  el.textContent = text;
  if (className) el.className = className;
  parent.append(el);
  return el;
}
function renderResult(data) {
  resultBox.replaceChildren();
  resultBox.hidden = false;
  const top = document.createElement("div");
  top.className = "result-top";
  if (data.thumbnail) {
    const img = document.createElement("img");
    img.className = "thumbnail";
    img.src = data.thumbnail;
    img.alt = "Video thumbnail";
    img.referrerPolicy = "no-referrer";
    top.append(img);
  }
  const details = document.createElement("div");
  details.style.minWidth = "0";
  addText(details, "div", data.title || "Video ready", "result-title");
  addText(details, "div", data.platform || "Video", "result-subtitle");
  top.append(details);
  resultBox.append(top);

  const list = document.createElement("div");
  list.className = "format-list";
  for (const format of (data.formats || [])) {
    const row = document.createElement("div");
    row.className = "format-row";
    addText(row, "span", `${format.quality || "Available quality"} · ${(format.ext || "mp4").toUpperCase()}`);
    const link = document.createElement("a");
    link.className = "download-link";
    link.href = format.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Download";
    link.setAttribute("aria-label", `Download ${format.quality || "video"}`);
    row.append(link);
    list.append(row);
  }
  resultBox.append(list);
  if (data.note) addText(resultBox, "p", data.note, "result-note");
}

document.querySelector("#paste-btn").addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      urlInput.value = text.trim();
      urlInput.focus();
    } else {
      setStatus("Your clipboard is empty.", "error");
    }
  } catch {
    setStatus("Clipboard access was blocked. Paste the link into the field manually.", "error");
    urlInput.focus();
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearResult();
  if (!rights.checked) {
    setStatus("Please confirm you have permission to download this video.", "error");
    return;
  }
  let parsed;
  try { parsed = new URL(urlInput.value.trim()); }
  catch { setStatus("Enter a valid video URL.", "error"); return; }
  if (!["https:", "http:"].includes(parsed.protocol)) {
    setStatus("Only HTTP and HTTPS links are supported.", "error");
    return;
  }

  submitButton.disabled = true;
  submitButton.querySelector(".btn-text").textContent = "Checking link…";
  setStatus("Checking the link and available download options…");
  try {
    const response = await fetch("/api/resolve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: parsed.href, rightsConfirmed: true })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(data.error || "We couldn't process this link. Please check it and try again.", "error");
      if (data.note) addText(statusBox, "div", data.note);
      if (data.originalUrl) {
        const open = document.createElement("a");
        open.href = data.originalUrl;
        open.target = "_blank";
        open.rel = "noopener noreferrer";
        open.textContent = "Open original post";
        open.style.cssText = "display:inline-block;margin-top:10px;color:#a99aff";
        statusBox.append(document.createElement("br"), open);
      }
      return;
    }
    setStatus("Video link processed. Choose an available format below.", "success");
    renderResult(data);
  } catch {
    setStatus("Could not reach the server. Check your connection and try again.", "error");
  } finally {
    submitButton.disabled = false;
    submitButton.querySelector(".btn-text").textContent = "Find video";
  }
});