if (!window._originalFetch) {
    window._originalFetch = window._originalFetch || fetch;
    window.fetch = new Proxy(fetch, {
        apply: async (f, s, r) => {
            //F = Function (fetch)
            //S = Source from which is called
            //R = Request = [url, {headers, method, body}]
            // console.log("R")
            let spadeCheck = undefined
            if (r.length == 2)
                spadeCheck = JSON.parse(r[1].body !== undefined ? r[1].body : "{}")
            if (isObject(spadeCheck) && spadeCheck.query !== undefined && spadeCheck.variables !== undefined) {
                let baseDecoded = await decodeGzipBase64(spadeCheck.variables.input.data)
                if (baseDecoded.some(dat => dat.event == "minute-watched")) {
                    window.postMessage({
                        autoTwitchDrops: {
                            type: "minute-watched",
                            spade: spadeCheck,
                            dataDecoded: baseDecoded
                        }
                    })
                } else {
                    const req = f.apply(s, r)
                    return req.then(res => {
                        return res;
                    })
                }
            } else {
                const req = f.apply(s, r);
                return req.then(res => {
                    // console.log(res)
                    if (res.url == "https://gql.twitch.tv/integrity") {
                        res.clone().json().then(data => {
                            console.log(data);
                            window.postMessage({
                                autoTwitchDrops: {
                                    type: "integ",
                                    integrity: data
                                }
                            })
                        })
                    }
                    if (res.url == "https://gql.twitch.tv/gql") {
                        res.clone().json().then(data => {
                            // console.log("Request Data");
                            // console.log(r);
                            // console.log("Return Data");
                            // console.log(data);
                            try {
                                if (Array.isArray(data)) {
                                    data.some(dat => {
                                        if (dat.extensions.operationName == "DropCurrentSessionContext") {
                                            console.log(dat);
                                            if (dat.data.currentUser.dropCurrentSession.game != null) {
                                                return window.postMessage({
                                                    autoTwitchDrops: {
                                                        type: "checkDrop",
                                                        game: dat.data.currentUser.dropCurrentSession.game.displayName
                                                    }
                                                })
                                            }
                                        }
                                    })
                                }
                            } catch (err) {
                                console.log(err);
                            }
                        })
                    }
                    return res;
                })
            }
        }
    })
    window._originalWebSocket = window._originalWebSocket || WebSocket;
    window.WebSocket = new Proxy(_originalWebSocket, {
        construct: (sock, sockurl) => {
            const socket = new sock(...sockurl);
            socket.addEventListener("message", res => {
                try {
                    console.log(res);
                    if (res.origin === "wss://hermes.twitch.tv") {
                        // console.log("Socket Message")
                        // console.log(res);
                        let data = JSON.parse(res.data);
                        // console.log(data);
                        if (data.type == "notification" && data.notification.type == "pubsub") {
                            let mes = JSON.parse(data.notification.pubsub);
                            // console.log(mes);
                            if (mes.type == "points-earned") {
                                if (mes.data.point_gain.reason_code == "WATCH") {
                                    window.postMessage({
                                        autoTwitchDrops: {
                                            type: "points-earned",
                                            points: mes.data.point_gain.total_points
                                        }
                                    })
                                }
                            }
                            if (mes.type == "claim-available") {
                                console.log("Claim sent")
                                window.postMessage({
                                    autoTwitchDrops: {
                                        type: "claim-points",
                                        claimID: mes.data.claim.id,
                                        channelID: mes.data.claim.channel_id
                                    }
                                })
                            }
                            if (mes.type == "drop-claim") {
                                window.postMessage({
                                    autoTwitchDrops: {
                                        type: "claim-drop"
                                    }
                                })
                            }
                            if (mes.type == "drop-progress") {
                                if (mes.data.current_progress_min == mes.data.required_progress_min) {
                                    window.postMessage({
                                        autoTwitchDrops: {
                                            type: "checkDrop"
                                        }
                                    })
                                }
                            }
                        }
                    } else if (res.target.url === "wss://pubsub-edge.twitch.tv/v1") {
                        let data = JSON.parse(res.data);
                        if (data.type !== "MESSAGE")
                            return;
                        // console.log(data);
                        if (data.data.topic.match(/^user-drop-events/)) {
                            console.log(data.data);
                            let mes = JSON.parse(data.data.message);
                            if (mes.type == "drop-claim") {
                                console.log("Got Drop")
                                window.postMessage({
                                    autoTwitchDrops: {
                                        type: "claim-drop"
                                    }
                                })
                            }
                            if (mes.type == "drop-progress") {
                                if (mes.data.current_progress_min == mes.data.required_progress_min) {
                                    window.postMessage({
                                        autoTwitchDrops: {
                                            type: "checkDrop"
                                        }
                                    })
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.log(err);
                }
            })
            return socket;
        }
    })
} else {
    console.log("Already created! Not going to inject")
}

async function decodeGzipBase64(base64String) {
    // 1. Convert the Base64 string into a binary string
    const binaryString = atob(base64String);

    // 2. Convert the binary string into a Uint8Array
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    // 3. Decompress the bytes using DecompressionStream
    const stream = new Response(bytes).body.pipeThrough(new DecompressionStream("gzip"));

    // 4. Convert the decompressed stream back into text
    const response = new Response(stream);
    const text = await response.text();

    return JSON.parse(text);
}

const isObject = (val) => typeof val === 'object' && val !== null && !Array.isArray(val);

// --- Automatic Lowest Quality Controller ---
let lowestQualityActive = false;
let qualityIntervalId = null;
let lastUiAttemptTime = 0;

try {
    lowestQualityActive = window.sessionStorage.getItem("atd_lowestQuality") === "true";
} catch (e) {}

function findTwitchPlayer() {
    try {
        const candidates = [
            document.querySelector(".video-player__container"),
            document.querySelector(".video-player"),
            document.querySelector("div[data-a-target='video-player']"),
            document.querySelector("video")
        ];

        for (const el of candidates) {
            if (!el) continue;
            const fiberKey = Object.keys(el).find(k => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$"));
            if (!fiberKey) continue;

            let curr = el[fiberKey];
            let depth = 0;
            while (curr && depth < 60) {
                if (curr.stateNode) {
                    if (curr.stateNode.mediaPlayerInstance) return curr.stateNode.mediaPlayerInstance;
                    if (curr.stateNode.player) return curr.stateNode.player;
                    if (curr.stateNode.props?.mediaPlayerInstance) return curr.stateNode.props.mediaPlayerInstance;
                }
                if (curr.memoizedProps) {
                    if (curr.memoizedProps.mediaPlayerInstance) return curr.memoizedProps.mediaPlayerInstance;
                    if (curr.memoizedProps.player) return curr.memoizedProps.player;
                }
                if (curr.memoizedState && curr.memoizedState.mediaPlayerInstance) {
                    return curr.memoizedState.mediaPlayerInstance;
                }
                curr = curr.return;
                depth++;
            }
        }
    } catch (e) {}
    return null;
}

function applyLowestQualityToPlayer(player) {
    if (!player || typeof player.getQualities !== "function") return false;
    const qualities = player.getQualities();
    if (!Array.isArray(qualities) || qualities.length === 0) return false;

    const nonAuto = qualities.filter(q => {
        const grp = (q.group || "").toLowerCase();
        const nm = (q.name || "").toLowerCase();
        return grp !== "auto" && !nm.includes("auto");
    });

    if (nonAuto.length === 0) return false;

    let lowest = nonAuto[0];
    let minHeight = Infinity;

    for (const q of nonAuto) {
        const str = `${q.name || ""} ${q.group || ""}`;
        const match = str.match(/(\d+)p?/);
        const height = match ? parseInt(match[1], 10) : Infinity;
        if (height < minHeight) {
            minHeight = height;
            lowest = q;
        } else if (height === minHeight && q.bitrate && lowest.bitrate && q.bitrate < lowest.bitrate) {
            lowest = q;
        }
    }

    if (typeof player.getQuality === "function") {
        const current = player.getQuality();
        if (current && (current.group === lowest.group || current.name === lowest.name)) {
            return true;
        }
    }

    try {
        if (typeof player.setQuality === "function") {
            player.setQuality(lowest);
            if (typeof player.getQuality === "function") {
                const check = player.getQuality();
                if (!check || (check.group !== lowest.group && check.name !== lowest.name)) {
                    player.setQuality(lowest.group);
                }
            }
        }
    } catch (err) {
        try {
            player.setQuality(lowest.group);
        } catch (e2) {}
    }

    try {
        localStorage.setItem("video-quality", JSON.stringify({ default: lowest.group || "160p30" }));
    } catch (e) {}

    return true;
}

async function trySelectLowestQualityViaUI() {
    const now = Date.now();
    if (now - lastUiAttemptTime < 30000) return false;
    lastUiAttemptTime = now;

    const settingsBtn = document.querySelector("button[data-a-target='player-settings-button']");
    if (!settingsBtn) return false;

    let menu = document.querySelector("div[data-a-target='player-settings-menu']");
    let openedMenu = false;
    if (!menu) {
        settingsBtn.click();
        openedMenu = true;
        await new Promise(r => setTimeout(r, 120));
        menu = document.querySelector("div[data-a-target='player-settings-menu']");
    }
    if (!menu) return false;

    const qualityBtn = menu.querySelector("button[data-a-target='player-settings-menu-item-quality']");
    if (qualityBtn) {
        qualityBtn.click();
        await new Promise(r => setTimeout(r, 120));
    }

    const options = Array.from(document.querySelectorAll("div[data-a-target='player-settings-menu'] input[type='radio'], div[data-a-target='player-settings-menu'] [role='menuitemradio']"));
    let lowestOption = null;
    for (const opt of options) {
        const text = opt.closest("label, button, div")?.textContent || "";
        if (text.includes("160p")) {
            lowestOption = opt;
            break;
        }
    }
    if (!lowestOption && options.length > 0) {
        const nonAuto = options.filter(opt => {
            const text = (opt.closest("label, button, div")?.textContent || "").toLowerCase();
            return !text.includes("auto") && !text.includes("automático");
        });
        if (nonAuto.length > 0) {
            lowestOption = nonAuto[nonAuto.length - 1];
        }
    }

    if (lowestOption) {
        const isChecked = lowestOption.checked || lowestOption.getAttribute("aria-checked") === "true";
        if (!isChecked) {
            lowestOption.click();
        }
    }

    if (openedMenu) {
        await new Promise(r => setTimeout(r, 120));
        const closeBtn = document.querySelector("button[data-a-target='player-settings-button']");
        if (closeBtn) closeBtn.click();
    }
    return true;
}

function enforceLowestQuality() {
    if (!lowestQualityActive) return;

    try {
        localStorage.setItem("video-quality", JSON.stringify({ default: "160p30" }));
    } catch (e) {}

    const player = findTwitchPlayer();
    if (player) {
        applyLowestQualityToPlayer(player);
    } else {
        const video = document.querySelector("video");
        if (video && !video.paused) {
            trySelectLowestQualityViaUI();
        }
    }
}

function disableLowestQuality() {
    try {
        localStorage.setItem("video-quality", JSON.stringify({ default: "auto" }));
    } catch (e) {}

    const player = findTwitchPlayer();
    if (player && typeof player.getQualities === "function") {
        const qualities = player.getQualities();
        const auto = qualities.find(q => (q.group || "").toLowerCase() === "auto" || (q.name || "").toLowerCase().includes("auto"));
        if (auto && typeof player.setQuality === "function") {
            try {
                player.setQuality(auto);
            } catch (e) {
                try { player.setQuality(auto.group || "auto"); } catch (e2) {}
            }
        }
    }
}

function setLowestQualityEnabled(enabled) {
    lowestQualityActive = !!enabled;
    if (lowestQualityActive) {
        startQualityMonitor();
    } else {
        stopQualityMonitor();
    }
}

function startQualityMonitor() {
    if (qualityIntervalId) return;
    enforceLowestQuality();
    qualityIntervalId = setInterval(enforceLowestQuality, 12000);
}

function stopQualityMonitor() {
    if (qualityIntervalId) {
        clearInterval(qualityIntervalId);
        qualityIntervalId = null;
    }
    disableLowestQuality();
}

window.addEventListener("message", (e) => {
    if (e.data && e.data.autoTwitchDropsConfig) {
        if (typeof e.data.autoTwitchDropsConfig.lowestQuality === "boolean") {
            setLowestQualityEnabled(e.data.autoTwitchDropsConfig.lowestQuality);
        }
    }
});

if (lowestQualityActive) {
    setLowestQualityEnabled(true);
}