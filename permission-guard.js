(() => {
    const fail = () => new DOMException("Permission request blocked by GuardMe", "NotAllowedError");
    const replaceMethod = (target, name, replacement) => {
        let owner = target;
        while (owner && !Object.prototype.hasOwnProperty.call(owner, name)) owner = Object.getPrototypeOf(owner);
        if (owner) Object.defineProperty(owner, name, { value: replacement, writable: true, configurable: true });
        else target[name] = replacement;
    };
    try {
        const geo = navigator.geolocation;
        if (geo) {
            for (const method of ["getCurrentPosition", "watchPosition"]) {
                replaceMethod(geo, method, (_success, error) => {
                    window.postMessage({ source: "cookie-consent-guard", type: "permission-blocked", permission: "location" }, "*");
                    if (typeof error === "function") queueMicrotask(() => error({ code: 1, message: "Location request blocked", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }));
                    return 0;
                });
            }
        }
    } catch {}
    try {
        if (navigator.mediaDevices?.getUserMedia) replaceMethod(navigator.mediaDevices, "getUserMedia", () => {
            window.postMessage({ source: "cookie-consent-guard", type: "permission-blocked", permission: "camera/microphone" }, "*");
            return Promise.reject(fail());
        });
    } catch {}
})();
