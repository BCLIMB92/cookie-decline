const status = document.querySelector("#status");
const siteRule = document.querySelector("#site-rule");
const siteLabel = document.querySelector("#site-label");

async function activeHostname() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    try {
        return new URL(tab.url).hostname.toLowerCase();
    } catch {
        return "";
    }
}

async function loadRules() {
    const hostname = await activeHostname();
    siteLabel.textContent = hostname ? `Settings for ${hostname}` : "Site settings are unavailable on this page.";
    const isWebPage = /^https?:$/.test(await activeProtocol());
    siteRule.disabled = !hostname || !isWebPage;
    document.querySelector("#temporary-allow").disabled = !isWebPage;
    document.querySelector("#reader-mode").disabled = !isWebPage;
    const { siteRules = {} } = await browser.storage.local.get("siteRules");
    const inherited = Object.entries(siteRules)
        .filter(([host]) => hostname === host || hostname.endsWith(`.${host}`))
        .sort(([a], [b]) => b.length - a.length)[0]?.[1];
    siteRule.value = hostname ? (siteRules[hostname] || inherited || "default") : "default";
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    const counts = tab?.id == null ? { blocked: 0, thirdParty: 0 } : await browser.runtime.sendMessage({ type: "get-tab-stats", tabId: tab.id });
    document.querySelector("#tracker-count").textContent = `${counts.blocked} trackers blocked; ${counts.thirdParty} third-party resources observed${counts.thirdParty >= 30 ? " (high third-party resource count)" : ""}.`;
}

async function activeProtocol() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    try { return new URL(tab.url).protocol; } catch { return ""; }
}

siteRule.addEventListener("change", async () => {
    const hostname = await activeHostname();
    if (!hostname) return;
    const { siteRules = {} } = await browser.storage.local.get("siteRules");
    if (siteRule.value === "default") delete siteRules[hostname];
    else siteRules[hostname] = siteRule.value;
    await browser.storage.local.set({ siteRules });
    status.textContent = "Site rule saved. Reload the page for it to take effect.";
    await loadRules();
});

document.querySelector("#temporary-allow").addEventListener("click", async () => {
    const hostname = await activeHostname();
    if (!hostname) return;
    await browser.runtime.sendMessage({ type: "temporary-allow", host: hostname });
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id != null) await browser.tabs.reload(tab.id);
    status.textContent = `${hostname} allowed for 30 minutes on future page loads.`;
});

document.querySelector("#reader-mode").addEventListener("click", async () => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    const result = await browser.runtime.sendMessage({ type: "toggle-reader-mode", tabId: tab?.id });
    status.textContent = result?.ok ? "Reader mode opened." : "Reader mode is unavailable for this page.";
});

document.querySelector("#settings").addEventListener("click", () => browser.runtime.openOptionsPage());

loadRules();
