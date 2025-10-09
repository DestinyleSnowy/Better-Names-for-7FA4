// background.js (MV3 service worker)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "gm:notify") {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: msg.title || "Better Names",
      message: msg.text || ""
    }, id => sendResponse({ ok: true, id }));
    return true; // keep port open
  }

  if (msg?.type === "gm:xhr") {
    const { url, method = "GET", headers = {}, data, responseType } = msg;
    fetch(url, { method, headers, body: data, credentials: "include" })
      .then(async (res) => {
        let body;
        if (responseType === "json") body = await res.json();
        else if (responseType === "arraybuffer") body = await res.arrayBuffer();
        else body = await res.text();
        sendResponse({
          ok: true,
          status: res.status,
          headers: Object.fromEntries(res.headers.entries()),
          body
        });
      })
      .catch(err => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
});
