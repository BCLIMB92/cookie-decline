const REJECT_WORDS = /^(reject( all)?|decline( all)?|deny( all)?|no thanks|no,? thanks|only necessary|necessary only|essential only|allow necessary only|refuse all|do not accept|do not sell|do not sell or share|拒绝全部|alle ablehnen|tout refuser|rechazar todo|rejeitar tudo)$/i;
const SETTINGS_WORDS = /^(manage preferences|manage cookies|cookie settings|privacy settings|customize|customise|preferences|settings|more options|options|show choices|change settings|your privacy choices)$/i;
const SAVE_WORDS = /^(save preferences|save settings|save choices|confirm choices|confirm selection|accept selected|allow selected|save and close|apply|done|finish|close|continue|submit)$/i;
const NEXT_WORDS = /^(next|continue|save and continue|confirm and continue)$/i;
const CONSENT_HINTS = /(cookie|consent|privacy|gdpr|onetrust|cookiebot|didomi|quantcast|usercentrics|trustarc)/i;
const OPTIONAL_HINTS = /(analytics|analytic|statistics|statistic|marketing|advertis|personal(i|is)ation|targeting|social|performance|measurement|functional|preferences|optional|sale|share)/i;
const REQUIRED_HINTS = /(necessary|essential|required|strictly required|security|fraud prevention)/i;

function isConsentContainer(element) {
    let current = element;
    for (let depth = 0; current && depth < 5; depth += 1) {
        const identity = `${current.id || ""} ${current.className || ""} ${current.getAttribute?.("aria-label") || ""}`;
        if (CONSENT_HINTS.test(identity)) return true;
        current = current.parentElement;
    }
    return false;
}

function rejectCookies() {
    const candidates = document.querySelectorAll(
        'button, [role="button"], input[type="button"], input[type="submit"], a'
    );

    for (const candidate of candidates) {
        const label = (candidate.innerText || candidate.value || candidate.getAttribute("aria-label") || "")
            .replace(/\s+/g, " ")
            .trim();

        if (REJECT_WORDS.test(label) && isConsentContainer(candidate)) {
            candidate.click();
            hideConsentUi(candidate);
            return true;
        }
    }

    for (const candidate of candidates) {
        const label = (candidate.innerText || candidate.value || candidate.getAttribute("aria-label") || "")
            .replace(/\s+/g, " ").trim();
        if (SETTINGS_WORDS.test(label) && isConsentContainer(candidate)) {
            candidate.click();
            setTimeout(() => {
                for (const input of document.querySelectorAll('input[type="checkbox"], input[type="radio"], [role="switch"], [role="checkbox"]')) {
                    const parentText = input.closest("label, li, [role='group'], section, fieldset, div")?.innerText || "";
                    const text = `${input.getAttribute("aria-label") || ""} ${parentText}`;
                    if ((input.checked || input.getAttribute("aria-checked") === "true") && OPTIONAL_HINTS.test(text) && !REQUIRED_HINTS.test(text)) {
                        input.click();
                    }
                }
                for (const save of document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"], a')) {
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

const observer = new MutationObserver(() => rejectCookies());

if (document.body) {
    rejectCookies();
    observer.observe(document.body, { childList: true, subtree: true });
} else {
    window.addEventListener("DOMContentLoaded", () => {
        rejectCookies();
        observer.observe(document.body, { childList: true, subtree: true });
    }, { once: true });
}
