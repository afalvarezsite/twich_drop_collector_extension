let dropPool = {};
chrome.storage.local.get(["exEnabled", "settings"]).then((val) => {
    if (val.exEnabled && val.exEnabled == true) {
        const isLow = !!(val.settings && val.settings.lowestQuality);
        try {
            window.sessionStorage.setItem("atd_lowestQuality", isLow ? "true" : "false");
        } catch (e) {}
        window.postMessage({
            autoTwitchDropsConfig: {
                lowestQuality: isLow
            }
        });

        window.addEventListener("message", (e) => {
            if (e.data.autoTwitchDrops) {
                if (e.data.autoTwitchDrops.type == "integ") {
                    console.log("Got Integ")
                    chrome.runtime.sendMessage(chrome.runtime.id, { type: "sendInteg", data: e.data.autoTwitchDrops.integrity })
                }
                if (e.data.autoTwitchDrops.type == "claim-points") {
                    console.log("Claimed Points");
                    chrome.runtime.sendMessage(chrome.runtime.id, { type: "claim-points", data: e.data.autoTwitchDrops })
                }
                if (e.data.autoTwitchDrops.type == "checkDrop") {
                    console.log("Claiming Drop");
                    chrome.runtime.sendMessage(chrome.runtime.id, { type: "claim-drop", data: e.data.autoTwitchDrops })
                }
                if (e.data.autoTwitchDrops.type == "points-earned") {
                    chrome.runtime.sendMessage(chrome.runtime.id, { type: "points-earned", data: e.data.autoTwitchDrops })
                }
                if (e.data.autoTwitchDrops.type == "minute-watched") {
                    chrome.runtime.sendMessage(chrome.runtime.id, { type: "minute-watched", data: e.data.autoTwitchDrops })
                }
            } else if (e.data.autoTwitchBrowserExtension) {
                if (e.data.autoTwitchBrowserExtension.integrity) {
                    console.log("Got Integ");
                    chrome.runtime.sendMessage(chrome.runtime.id, { type: "sendInteg", data: e.data.autoTwitchBrowserExtension.integrity });
                }
            }
        })

        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type == "setFavicon") {
                var fav1 = document.querySelector("link[rel~='icon'][sizes~='32x32']");
                fav1.href = chrome.runtime.getURL("/assets/img/twitch-logo-yellow-32.png")
                var fav2 = document.querySelector("link[rel~='icon'][sizes~='16x16']");
                fav2.href = chrome.runtime.getURL("/assets/img/twitch-logo-yellow-16.png")
                if (document.querySelector(".startDropsBtn") != null) {
                    document.getElementsByClassName("startDropsBtn")[0].remove();
                }
            }
        })

        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === "local" && changes.settings) {
                const isLowNow = !!changes.settings.newValue?.lowestQuality;
                try {
                    window.sessionStorage.setItem("atd_lowestQuality", isLowNow ? "true" : "false");
                } catch (e) {}
                window.postMessage({
                    autoTwitchDropsConfig: {
                        lowestQuality: isLowNow
                    }
                });
            }
        })

        injectScript("onPage.js")
    }
})

setTimeout(() => {
    try {
        const history = localStorage.getItem("searchSuggestionHistory");
        const session = localStorage.getItem("local_storage_app_session_id");
        const userId = history ? JSON.parse(history).id : undefined;
        const uuid = session ? JSON.parse(session) : undefined;
        chrome.runtime.sendMessage(chrome.runtime.id, { type: "clientInfo", data: { oauthToken: getCookieValue("auth-token"), userId: userId, deviceId: getCookieValue("unique_id"), uuid: uuid } })
    } catch (e) {}
}, 1000)

function getCookieValue(name) {
    const regex = new RegExp(`(^| )${name}=([^;]+)`)
    const match = document.cookie.match(regex)
    if (match) {
        return match[2]
    }
}

function injectScript(src) {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL(src);
    s.type = "module" // <-- Add this line for ESM module support
    s.onload = () => s.remove();
    (document.head || document.documentElement).append(s);
}