const TRACKING_PARAMETER = /^(utm_.+|fbclid|gclid)$/i;
const TRACKER_HOSTS = [
    "doubleclick.net", "googlesyndication.com", "google-analytics.com", "googletagmanager.com",
    "connect.facebook.net", "facebook.net", "scorecardresearch.com", "hotjar.com",
    "clarity.ms", "segment.io", "segment.com", "amplitude.com", "mixpanel.com",
    "adsrvr.org", "adnxs.com", "criteo.com", "quantserve.com", "taboola.com", "outbrain.com"
];
const tabStats = new Map();
const temporaryAllow = new Map();
const tabHosts = new Map();
const readerCheckedTabs = new Map();
const MAX_ACTIVITY = 2000;
const EXCESSIVE_RESOURCE_LIMIT = 30;
let cachedSiteRules = {};
let cachedExceptions = [];
let cachedPreferences = {};
let pendingActivity = [];
let flushScheduled = false;
let activityWrite = Promise.resolve();

function hostMatches(host, ruleHost) {
    return host === ruleHost || host.endsWith(`.${ruleHost}`);
}

function isKnownTracker(host) {
    return TRACKER_HOSTS.some((tracker) => hostMatches(host, tracker));
}

function isClassifiedTracker(details) {
    return (details.urlClassification?.thirdParty || []).some((type) =>
        /^(tracking|tracking_|fingerprinting|fingerprinting_|emailtracking|emailtracking_|cryptomining|cryptomining_)/.test(type)
    );
}

function cleanTrackingParameters(rawUrl) {
    let url;
    try {
        url = new URL(rawUrl);
    } catch {
        return null;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    let changed = false;
    for (const key of [...url.searchParams.keys()]) {
        if (TRACKING_PARAMETER.test(key)) {
            url.searchParams.delete(key);
            changed = true;
        }
    }
    return changed ? url.href : null;
}

function getProtectionState(host) {
    if (cachedExceptions.some((exception) => hostMatches(host, exception))) return { action: "allow", preferences: { ...cachedPreferences, blockTrackers: false, removeTrackingParams: false }, siteRules: {} };
    const rule = Object.entries(cachedSiteRules)
        .filter(([ruleHost]) => hostMatches(host, ruleHost))
        .sort(([left], [right]) => right.length - left.length)[0];
    const expires = temporaryAllow.get(host);
    if (expires && expires > Date.now()) return { action: "allow", preferences: cachedPreferences, siteRules: cachedSiteRules };
    temporaryAllow.delete(host);
    return { action: rule?.[1] || "default", preferences: cachedPreferences, siteRules: cachedSiteRules };
}

function queueActivity(event) {
    pendingActivity.push(event);
    if (!flushScheduled) {
        flushScheduled = true;
        setTimeout(flushActivity, 700);
    }
}

function flushActivity() {
    flushScheduled = false;
    if (!pendingActivity.length) return activityWrite;
    const batch = pendingActivity.splice(0);
    activityWrite = activityWrite.then(async () => {
        const { activity = [] } = await browser.storage.local.get("activity");
        await browser.storage.local.set({ activity: [...activity, ...batch].slice(-MAX_ACTIVITY) });
    }).catch((error) => console.warn("Could not store privacy activity:", error));
    return activityWrite;
}

function recordActivity(details, reason) {
    const requestHost = new URL(details.url).hostname.toLowerCase();
    let pageHost = "unknown";
    try { pageHost = new URL(details.originUrl || details.initiator || details.documentUrl).hostname.toLowerCase(); } catch {}
    const event = {
        time: new Date().toISOString(),
        page: pageHost,
        resource: requestHost,
        type: details.type,
        category: isKnownTracker(requestHost) || isClassifiedTracker(details) ? "known tracker" : "third-party resource",
        reason
    };
    if (details.tabId >= 0) {
        const stats = tabStats.get(details.tabId) || { blocked: 0, thirdParty: 0 };
        stats.blocked += reason.startsWith("blocked") ? 1 : 0;
        stats.thirdParty += reason === "third-party" ? 1 : 0;
        tabStats.set(details.tabId, stats);
        browser.action.setBadgeBackgroundColor({ tabId: details.tabId, color: "#b42318" });
        browser.action.setBadgeText({ tabId: details.tabId, text: stats.blocked ? String(stats.blocked) : "" });
            browser.action.setTitle({ tabId: details.tabId, title: `GuardMe: ${stats.blocked} trackers blocked${stats.thirdParty >= EXCESSIVE_RESOURCE_LIMIT ? `; ${stats.thirdParty} third-party resources` : ""}` });
    }
    queueActivity(event);
}

browser.webRequest.onBeforeRequest.addListener((details) => {
    let request;
    try { request = new URL(details.url); } catch { return {}; }
    let pageHost = "";
    try { pageHost = new URL(details.originUrl || details.initiator || details.documentUrl || details.url).hostname.toLowerCase(); } catch {}
    const requestHost = request.hostname.toLowerCase();
    const state = getProtectionState(details.type === "main_frame" ? requestHost : pageHost);
    if (details.type === "main_frame") {
        if (state.action === "allow" || state.preferences.removeTrackingParams === false) return {};
        const redirectUrl = cleanTrackingParameters(details.url);
        return redirectUrl ? { redirectUrl } : {};
    }
    const requestRule = Object.entries(state.siteRules)
        .filter(([ruleHost]) => hostMatches(requestHost, ruleHost))
        .sort(([left], [right]) => right.length - left.length)[0]?.[1];
    const isThirdParty = details.thirdParty ?? Boolean(pageHost && requestHost !== pageHost && !hostMatches(pageHost, requestHost) && !hostMatches(requestHost, pageHost));
    if (isThirdParty && requestRule === "block") {
        recordActivity(details, "blocked-by-site-rule");
        return { cancel: true };
    }
    if (isThirdParty && requestRule !== "allow" && details.type === "script" && state.preferences.blockTrackers !== false && (isKnownTracker(requestHost) || isClassifiedTracker(details)) && state.action !== "allow") {
        recordActivity(details, "blocked");
        return { cancel: true };
    }
    if (isThirdParty) {
        recordActivity(details, "third-party");
    }
    return {};
}, { urls: ["<all_urls>"] }, ["blocking"]);

browser.webRequest.onBeforeSendHeaders.addListener((details) => {
    const requestHeaders = details.requestHeaders || [];
    if (cachedPreferences.doNotTrack === false) return { requestHeaders };
    const dnt = requestHeaders.find((header) => header.name.toLowerCase() === "dnt");
    if (dnt) dnt.value = "1";
    else requestHeaders.push({ name: "DNT", value: "1" });
    return { requestHeaders };
}, { urls: ["<all_urls>"] }, ["blocking", "requestHeaders"]);

async function applyBrowserPreferences() {
    const { preferences = {} } = await browser.storage.local.get("preferences");
    const setOrClear = async (setting, enabled, value) => {
        if (!setting) return;
        try {
            if (enabled) await setting.set({ value });
            else await setting.clear();
        } catch (error) { console.warn("Privacy setting unavailable:", error); }
    };
    if (browser.privacy?.websites?.cookieConfig) {
        await setOrClear(browser.privacy.websites.cookieConfig, preferences.blockThirdParty !== false, { behavior: "reject_trackers_and_partition_foreign" });
    }
    if (browser.privacy?.websites?.resistFingerprinting) {
        await setOrClear(browser.privacy.websites.resistFingerprinting, preferences.fingerprinting !== false, true);
    }
    if (browser.privacy?.websites?.trackingProtectionMode) {
        await setOrClear(browser.privacy.websites.trackingProtectionMode, preferences.blockTrackers !== false, "always");
    }
    if (browser.browserSettings?.webNotificationsDisabled) {
        await setOrClear(browser.browserSettings.webNotificationsDisabled, preferences.blockNotifications !== false, true);
    }
    if (browser.browserSettings?.allowPopupsForUserEvents) {
        await setOrClear(browser.browserSettings.allowPopupsForUserEvents, preferences.blockPopups !== false, false);
    }
    try {
        await browser.runtime.sendMessage({ type: "preferences-updated", preferences });
    } catch {}
}

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    try {
        const currentUrl = new URL(tab.url);
        const host = /^https?:$/.test(currentUrl.protocol) ? currentUrl.hostname : "";
        if (host) tabHosts.set(tabId, host);
        if (changeInfo.status === "loading") {
            tabStats.set(tabId, { blocked: 0, thirdParty: 0 });
            browser.action.setBadgeText({ tabId, text: "" });
            browser.action.setTitle({ tabId, title: "GuardMe" });
        }
        if (changeInfo.status === "complete" && host) {
            if (readerCheckedTabs.get(tabId) !== tab.url && /^https?:$/.test(new URL(tab.url).protocol)) {
                readerCheckedTabs.set(tabId, tab.url);
                browser.storage.local.get("preferences").then(({ preferences = {} }) => {
                    if (preferences.autoReaderMode === true) browser.tabs.toggleReaderMode(tabId).catch(() => {});
                });
            }
        }
    } catch {}
});

browser.tabs.onRemoved.addListener(async (tabId) => {
    tabStats.delete(tabId);
    readerCheckedTabs.delete(tabId);
    const host = tabHosts.get(tabId);
    tabHosts.delete(tabId);
    const { preferences = {} } = await browser.storage.local.get("preferences");
    if (!preferences.clearOnTabClose) return;
    try {
        if (host) await browser.browsingData.remove({ hostnames: [host] }, {
            cookies: true, localStorage: true, indexedDB: true, serviceWorkers: true
        });
    } catch (error) {
        console.warn("Could not clear closed tab data:", error);
    }
});

browser.runtime.onMessage.addListener(async (message, sender) => {
    if (message.type === "temporary-allow" && message.host) {
        temporaryAllow.set(message.host.toLowerCase(), Date.now() + 30 * 60 * 1000);
        return { ok: true };
    }
    if (message.type === "is-site-allowed" && message.host) {
        const host = message.host.toLowerCase();
        const { siteRules = {} } = await browser.storage.local.get("siteRules");
        const allowlisted = Object.entries(siteRules).some(([ruleHost, rule]) => rule === "allow" && hostMatches(host, ruleHost));
        return { allowed: allowlisted || (temporaryAllow.get(host) || 0) > Date.now() };
    }
    if (message.type === "permission-blocked") {
        let page = "unknown";
        try { page = new URL(sender.url).hostname; } catch {}
        const event = { time: new Date().toISOString(), page, resource: page, type: "permission", reason: `blocked ${message.permission} request` };
        queueActivity(event);
        return { ok: true };
    }
    if (message.type === "get-tab-stats") return tabStats.get(message.tabId) || { blocked: 0, thirdParty: 0 };
    if (message.type === "toggle-reader-mode" && Number.isInteger(message.tabId)) {
        try { await browser.tabs.toggleReaderMode(message.tabId); return { ok: true }; } catch { return { ok: false }; }
    }
    if (message.type === "export-activity") {
        await flushActivity();
        const { activity = [] } = await browser.storage.local.get("activity");
        const file = new Blob([JSON.stringify(activity, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(file);
        await browser.downloads.download({ url, filename: "cookie-guard-activity.json", saveAs: true });
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        return { ok: true };
    }
    if (message.type === "clear-activity") {
        pendingActivity = [];
        await activityWrite;
        await browser.storage.local.set({ activity: [] });
        return { ok: true };
    }
    return undefined;
});

browser.storage.onChanged.addListener((changes) => {
    if (changes.preferences) {
        cachedPreferences = changes.preferences.newValue || {};
        applyBrowserPreferences();
    }
    if (changes.siteRules) cachedSiteRules = changes.siteRules.newValue || {};
    if (changes.exceptions) cachedExceptions = changes.exceptions.newValue || [];
});

browser.storage.local.get(["preferences", "siteRules", "exceptions"]).then(({ preferences = {}, siteRules = {}, exceptions = [] }) => {
    cachedPreferences = preferences;
    cachedSiteRules = siteRules;
    cachedExceptions = exceptions;
}).catch(() => {});

browser.runtime.onInstalled.addListener(async () => {
    const { preferences } = await browser.storage.local.get("preferences");
    if (!preferences) await browser.storage.local.set({ preferences: {} });
    await applyBrowserPreferences();
});

applyBrowserPreferences();
browser.tabs.query({}).then((tabs) => {
    for (const tab of tabs) {
        try {
            const url = new URL(tab.url);
            if (tab.id != null && /^https?:$/.test(url.protocol)) tabHosts.set(tab.id, url.hostname);
        } catch {}
    }
}).catch(() => {});
