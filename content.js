const REJECT_WORDS = /^(reject( all)?|decline( all)?|deny( all)?|no thanks|no,? thanks|only necessary|necessary only|essential only|allow necessary only|refuse all|do not accept|do not sell( or share)?( my)?( personal)?( information| data)?|your privacy choices|refuză tot|refuza tot|respinge tot|拒绝全部|alle ablehnen|tout refuser|rechazar todo|rejeitar tudo)$/i;
const SETTINGS_WORDS = /^(manage preferences|manage cookies|cookie settings|privacy settings|customize|customise|preferences|settings|more options|options|show choices|change settings|your privacy choices)$/i;
const SAVE_WORDS = /^(save preferences|save settings|save choices|confirm choices|confirm selection|accept selected|allow selected|save and close|apply|done|finish|close|continue)$/i;
const NEXT_WORDS = /^(next|continue|save and continue|confirm and continue)$/i;
const CONSENT_HINTS = /(cookie|consent|privacy|gdpr|onetrust|cookiebot|didomi|quantcast|usercentrics|trustarc|confidențial|consimțăm|date personale)/i;
const OPTIONAL_HINTS = /(analytics|analytic|statistics|statistic|marketing|advertis|personal(i|is)ation|targeting|social|performance|measurement|functional|preferences|optional)/i;
const REQUIRED_HINTS = /(necessary|essential|required|strictly required|security|fraud prevention)/i;
let preferences = {};
let temporarilyAllowed = false;
let excepted = false;

function hostMatches(host, ruleHost) {
    return host === ruleHost || host.endsWith(`.${ruleHost}`);
}

window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.source !== "cookie-consent-guard" || event.data?.type !== "permission-blocked") return;
    browser.runtime.sendMessage({ type: "permission-blocked", permission: event.data.permission }).catch(() => {});
});

function enabled(name) {
    return preferences[name] !== false && !temporarilyAllowed;
}

function isConsentContainer(element) {
    let current = element;
    for (let depth = 0; current && depth < 5; depth += 1) {
        const identity = `${current.id || ""} ${current.className || ""} ${current.getAttribute?.("aria-label") || ""}`;
        const context = `${identity} ${current.innerText || ""}`;
        if (CONSENT_HINTS.test(context)) return true;
        current = current.parentElement;
    }
    return false;
}

function rejectCookies() {
    const candidates = document.querySelectorAll(
        'button, [role="button"], input[type="button"], a, label'
    );

    for (const candidate of candidates) {
        const label = (candidate.innerText || candidate.value || candidate.getAttribute("aria-label") || "")
            .replace(/\s+/g, " ")
            .trim();

        const isSellShareChoice = /do not sell|do not share|opt out of sale/i.test(label);
        const enabledChoice = isSellShareChoice ? enabled("doNotSellShare") : enabled("rejectConsent");
        if (REJECT_WORDS.test(label) && enabledChoice && isConsentContainer(candidate)) {
            candidate.click();
            hideConsentUi(candidate);
            return true;
        }
    }

    for (const candidate of candidates) {
        const label = (candidate.innerText || candidate.value || candidate.getAttribute("aria-label") || "")
            .replace(/\s+/g, " ").trim();
        if ((enabled("rejectConsent") || enabled("doNotSellShare")) && SETTINGS_WORDS.test(label) && isConsentContainer(candidate)) {
            candidate.click();
            setTimeout(() => {
                for (const input of document.querySelectorAll('input[type="checkbox"], input[type="radio"], [role="switch"], [role="checkbox"]')) {
                    const parentText = input.closest("label, li, [role='group'], section, fieldset, div")?.innerText || "";
                    const text = `${input.getAttribute("aria-label") || ""} ${parentText}`;
                    const optional = enabled("rejectConsent") && OPTIONAL_HINTS.test(text);
                    const saleOptOut = enabled("doNotSellShare") && /(do not sell|do not share|sale or sharing|sell or share)/i.test(text);
                    const isChecked = input.checked || input.getAttribute("aria-checked") === "true";
                    if (((optional && isChecked) || (saleOptOut && !isChecked)) && !REQUIRED_HINTS.test(text)) {
                        input.click();
                    }
                }
                for (const save of document.querySelectorAll('button, [role="button"], input[type="button"], a')) {
                    const saveLabel = (save.innerText || save.value || save.getAttribute("aria-label") || "")
                        .replace(/\s+/g, " ").trim();
                    if (SAVE_WORDS.test(saveLabel) && isConsentContainer(save)) {
                        save.click();
                        hideConsentUi(save);
                        break;
                    }
                }
                for (const next of document.querySelectorAll('button, [role="button"], input[type="button"], a')) {
                    const nextLabel = (next.innerText || next.value || next.getAttribute("aria-label") || "")
                        .replace(/\s+/g, " ").trim();
                    if (NEXT_WORDS.test(nextLabel) && isConsentContainer(next)) next.click();
                }
            }, 200);
            return true;
        }
    }

    return false;
}

function dismissMarketingPopup() {
    if (!enabled("dismissMarketing")) return;
    for (const field of document.querySelectorAll('input[type="email"], input[placeholder*="email" i]')) {
        let container = field.parentElement;
        for (let depth = 0; container && depth < 6 && !/(newsletter|subscribe|marketing|updates|offers)/i.test(container.innerText || ""); depth += 1) {
            container = container.parentElement;
        }
        if (!container) continue;
        for (const control of container.querySelectorAll('button, [role="button"], a')) {
            const label = (control.innerText || control.getAttribute("aria-label") || control.title || "").replace(/\s+/g, " ").trim();
            if (/^(no thanks|not now|maybe later|close|×|✕)$/i.test(label)) {
                control.click();
                hideConsentUi(control);
                return;
            }
        }
    }
}

function stopAutoplay() {
    if (!enabled("blockAutoplay")) return;
    for (const media of document.querySelectorAll("video[autoplay], audio[autoplay]")) {
        media.autoplay = false;
        media.pause();
        media.removeAttribute("autoplay");
    }
}

document.addEventListener("play", (event) => {
    const media = event.target;
    if (!enabled("blockAutoplay") || !(media instanceof HTMLMediaElement)) return;
    if (!navigator.userActivation?.isActive) media.pause();
}, true);

function runPageProtections() {
    if (excepted) return;
    rejectCookies();
    dismissMarketingPopup();
    stopAutoplay();
}

function hideConsentUi(clickedControl) {
    let container = clickedControl.parentElement;
    for (let depth = 0; container && depth < 6; depth += 1) {
        if (container.querySelector?.('button, [role="button"]')) {
            container.style.setProperty("display", "none", "important");
            return;
        }
        container = container.parentElement;
    }
}

browser.storage.local.get(["preferences", "exceptions"]).then(({ preferences: saved = {}, exceptions = [] }) => {
    preferences = saved;
    excepted = exceptions.some((host) => hostMatches(location.hostname.toLowerCase(), host));
    return browser.runtime.sendMessage({ type: "is-site-allowed", host: location.hostname }).catch(() => ({ allowed: false }));
}).then((state) => {
    temporarilyAllowed = Boolean(state?.allowed);
    const observer = new MutationObserver(runPageProtections);
    const start = () => {
        runPageProtections();
        if (document.body) observer.observe(document.body, { childList: true, subtree: true });
    };
    if (document.body) start();
    else window.addEventListener("DOMContentLoaded", start, { once: true });
}).catch(() => {});
