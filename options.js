const DEFAULTS = {
    rejectConsent: true,
    doNotSellShare: true,
    blockThirdParty: true,
    removeTrackingParams: true,
    blockTrackers: true,
    doNotTrack: true,
    fingerprinting: true,
    blockNotifications: true,
    blockPopups: true,
    blockAutoplay: true,
    dismissMarketing: true,
    autoReaderMode: false,
    clearOnTabClose: false
};
const status = document.querySelector("#status");
const checkboxes = [...document.querySelectorAll("[data-pref]")];
const ruleList = document.querySelector("#rule-list");
const exceptionList = document.querySelector("#exception-list");

async function load() {
    const { preferences = {}, siteRules = {}, exceptions = [], activity = [] } = await browser.storage.local.get(["preferences", "siteRules", "exceptions", "activity"]);
    for (const checkbox of checkboxes) checkbox.checked = (preferences[checkbox.dataset.pref] ?? DEFAULTS[checkbox.dataset.pref]);
    renderRules(siteRules);
    renderExceptions(exceptions);
    const blocked = activity.filter((event) => event.reason.startsWith("blocked")).length;
    const attempted = activity.filter((event) => event.reason === "third-party").length;
    document.querySelector("#activity-summary").textContent = `${activity.length} events recorded; ${blocked} blocked and ${attempted} third-party resources observed.`;
    const activityList = document.querySelector("#activity-list");
    activityList.replaceChildren();
    for (const event of activity.slice(-100).reverse()) {
        const item = document.createElement("li");
        const action = event.type === "permission" ? `requested ${event.reason.replace("blocked ", "")}` : `loaded ${event.resource}`;
        item.textContent = `${new Date(event.time).toLocaleString()} - ${event.page} ${action} (${event.category || event.type})`;
        activityList.append(item);
    }
}

function renderExceptions(exceptions) {
    exceptionList.replaceChildren();
    for (const host of [...exceptions].sort()) {
        const item = document.createElement("li");
        item.textContent = host;
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "Remove";
        remove.addEventListener("click", async () => {
            const current = (await browser.storage.local.get("exceptions")).exceptions || [];
            const next = current.filter((entry) => entry !== host);
            await browser.storage.local.set({ exceptions: next });
            renderExceptions(next);
        });
        item.append(" ", remove);
        exceptionList.append(item);
    }
}

document.querySelector("#exception-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = document.querySelector("#exception-host");
    let host = input.value.trim().toLowerCase();
    try { host = new URL(host.includes("://") ? host : `https://${host}`).hostname; }
    catch { status.textContent = "Enter a valid domain."; return; }
    if (!host || !host.includes(".")) { status.textContent = "Enter a valid domain."; return; }
    const { exceptions = [] } = await browser.storage.local.get("exceptions");
    if (!exceptions.includes(host)) exceptions.push(host);
    await browser.storage.local.set({ exceptions });
    input.value = "";
    renderExceptions(exceptions);
    status.textContent = "Exception saved.";
});

function renderRules(siteRules) {
    ruleList.replaceChildren();
    for (const [host, action] of Object.entries(siteRules).sort(([a], [b]) => a.localeCompare(b))) {
        const item = document.createElement("li");
        const label = document.createElement("span");
        label.textContent = `${host}: ${action === "allow" ? "allowlisted" : "blocked as a tracker"}`;
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "Remove";
        remove.addEventListener("click", async () => {
            delete siteRules[host];
            await browser.storage.local.set({ siteRules });
            renderRules(siteRules);
        });
        item.append(label, remove);
        ruleList.append(item);
    }
}

for (const checkbox of checkboxes) {
    checkbox.addEventListener("change", async () => {
        const { preferences = {} } = await browser.storage.local.get("preferences");
        preferences[checkbox.dataset.pref] = checkbox.checked;
        await browser.storage.local.set({ preferences });
        status.textContent = "Setting saved.";
    });
}

document.querySelector("#rule-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = document.querySelector("#rule-host");
    let host = input.value.trim().toLowerCase();
    try { host = new URL(host.includes("://") ? host : `https://${host}`).hostname; }
    catch { status.textContent = "Enter a valid domain."; return; }
    if (!host || !host.includes(".")) { status.textContent = "Enter a valid domain."; return; }
    const { siteRules = {} } = await browser.storage.local.get("siteRules");
    siteRules[host] = document.querySelector("#rule-action").value;
    await browser.storage.local.set({ siteRules });
    input.value = "";
    renderRules(siteRules);
    status.textContent = "Site rule saved.";
});

document.querySelector("#export").addEventListener("click", async () => {
    await browser.runtime.sendMessage({ type: "export-activity" });
    status.textContent = "Activity export started.";
});

document.querySelector("#clear-log").addEventListener("click", async () => {
    await browser.runtime.sendMessage({ type: "clear-activity" });
    status.textContent = "Activity log cleared.";
    await load();
});

browser.storage.onChanged.addListener((changes) => {
    if (changes.activity) load();
});

load();
