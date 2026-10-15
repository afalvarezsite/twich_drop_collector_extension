/** 
@typedef {import("./types").activeStream} activeStream
**/
import { Client } from "./background/twitchApi.js"

let client = null;
let settings = {
    connectedGames: false,
    autoGetToken: false,
    watchPopout: false,
    autoMute: false,
    setShowBadges: false,
    lowestQuality: false
};
let listOfConnected = [];
let autoDropGames = [];
let windowId = 0;
let premiumStatus = {
    email: "",
    premium: true
}
let config = {
    claimpoints: true,
    badgesGameNames: ""
}
let extEnabled = false;
/** @type {activeStream} */
let activeStream = {
    campaign: "none"
}
let curWindow = {
    id: 0,
    type: "none"
}
let gettingStreamObj = {
    allStreamers: [],
    notPlayingGame: [],
    lastPull: 0
}
let stagnantCooldowns = {};

function isStreamerStagnant(login) {
    if (!login || !stagnantCooldowns[login]) return false;
    if (Date.now() > stagnantCooldowns[login]) {
        delete stagnantCooldowns[login];
        return false;
    }
    return true;
}

function addStagnantStreamer(login, minutes = 10) {
    if (login) {
        stagnantCooldowns[login] = Date.now() + (minutes * 60 * 1000);
    }
}

function clearStagnantStreamers() {
    stagnantCooldowns = {};
}
let autoGetTokenWindow = 0;
let currentBadgeDrops = [];
let cfdInterval, agtInterval, startupTimeout, recheckCampTimeout, ssdInterval;
startupTimeout = setTimeout(startup, 1500)

const keepAlive = () => setInterval(chrome.runtime.getPlatformInfo, 20e3);
chrome.runtime.onStartup.addListener(keepAlive);
keepAlive();

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (extEnabled) {
        if (message.type == "clientInfo") {
            if (message.data.oauthToken && message.data.deviceId) {
                if (client == null)
                    client = new Client(message.data);
                else
                    client.updateUserInfo(message.data);
                chrome.storage.local.set({ oauthToken: message.data.oauthToken, deviceId: message.data.deviceId, userId: message.data.userId })
            }
        } else if (message.type == "sendInteg") {
            if (client == null) {
                chrome.storage.sync.set({ twitchInteg: message.data });
                chrome.storage.local.get(["clientId", "oauthToken", "deviceId", "userId"]).then((data) => {
                    console.log(message);
                    if (data.oauthToken && extEnabled) {
                        client = new Client({ clientId: data.clientId, oauthToken: data.oauthToken, deviceId: data.deviceId, userId: data.userId });
                    }
                })
            } else
                client.setInteg(message.data);
            if (autoGetTokenWindow != 0) {
                chrome.windows.remove(autoGetTokenWindow);
                autoGetTokenWindow = 0;
            }
        } else if (message.type == "claim-points") {
            console.log("Claim points");
            console.log(message.data);
            let success = await client.claimChannelPoints(message.data.claimID, message.data.channelID);
            if (success && success.success) {
                chrome.storage.local.get(["claimedPoints"]).then((res) => {
                    let pts = (res.claimedPoints || 0) + (success.points || 0);
                    chrome.storage.local.set({ claimedPoints: pts });
                });
            }
        } else if (message.type == "points-earned") {
            chrome.storage.local.get(["claimedPoints"]).then((res) => {
                let pts = (res.claimedPoints || 0) + (message.data?.points || 0);
                chrome.storage.local.set({ claimedPoints: pts });
            });
        } else if (message.type == "claim-drop") {
            console.log("Claim Drop event received from page/pubsub");
            await checkClaimDrop();
            if (activeStream && activeStream.campaign && activeStream.campaign.status == "watching" && activeStream.campaigns && activeStream.campaigns.length > 0) {
                let inventory = await client.getInventory().catch(() => null);
                let curCamp = activeStream.campaigns[activeStream.campaign.onCamp];
                if (curCamp && inventory && Array.isArray(inventory.dropCampaignsInProgress)) {
                    let inProgressCampaign = inventory.dropCampaignsInProgress.find(c => c.id == curCamp.id);
                    if (inProgressCampaign && Array.isArray(inProgressCampaign.timeBasedDrops)) {
                        let allClaimed = inProgressCampaign.timeBasedDrops.every(d => d.self && d.self.isClaimed);
                        let calculatedMinutes = allClaimed ? curCamp.minutesNeeded : Math.max(0, ...inProgressCampaign.timeBasedDrops.map(d => {
                            let m = d.self?.currentMinutesWatched || 0;
                            return d.self?.isClaimed ? Math.max(m, d.requiredMinutesWatched) : m;
                        }));
                        curCamp.minutesWatched = calculatedMinutes;
                        if (allClaimed || curCamp.minutesWatched >= curCamp.minutesNeeded) {
                            console.log(`Drop campaign ${curCamp.id} finished upon claiming! Advancing...`);
                            clearStagnantStreamers();
                            gettingStreamObj.notPlayingGame = [];
                            clearInterval(activeStream.campaign.interval);
                            activeStream.campaign.reOpening = true;
                            chrome.storage.local.set({ activeStream });
                            chrome.runtime.sendMessage({ type: "p:sendCurrentDrops", data: { activeStream: activeStream } });
                            runCampaign();
                            return;
                        }
                    } else if (!inProgressCampaign) {
                        console.log(`Drop campaign ${curCamp.id} was completed and archived by Twitch! Advancing...`);
                        curCamp.minutesWatched = curCamp.minutesNeeded;
                        clearStagnantStreamers();
                        gettingStreamObj.notPlayingGame = [];
                        clearInterval(activeStream.campaign.interval);
                        activeStream.campaign.reOpening = true;
                        chrome.storage.local.set({ activeStream });
                        chrome.runtime.sendMessage({ type: "p:sendCurrentDrops", data: { activeStream: activeStream } });
                        runCampaign();
                        return;
                    }
                    chrome.storage.local.set({ activeStream });
                    chrome.runtime.sendMessage({ type: "p:sendCurrentDrops", data: { activeStream: activeStream } });
                }
            }
        } else if (message.type == "p:getConnectedGames") {
            if (client == null) {
                chrome.runtime.sendMessage({ type: "p:connectedGames", data: "noclient" });
            } else {
                let gamePromise = settings.connectedGames ? client.getConnectedGames() : client.getDropCampaigns();
                gamePromise.then((data) => {
                    if (data == "noclient" || !Array.isArray(data)) {
                        chrome.runtime.sendMessage({ type: "p:connectedGames", data: "noclient" });
                    } else {
                        chrome.runtime.sendMessage({ type: "p:connectedGames", data });
                        let updatedList = false;
                        for (const c of data) {
                            if (!c || !c.game || !c.game.displayName) continue;
                            if (c.self && c.self.isAccountConnected && !listOfConnected.includes(c.game.displayName)) {
                                listOfConnected.push(c.game.displayName);
                                updatedList = true;
                            }
                        }
                        if (updatedList) {
                            chrome.storage.local.set({ connectedGamesList: listOfConnected });
                        }
                    }
                }).catch((err) => {
                    console.error("Error fetching games list:", err);
                    chrome.runtime.sendMessage({ type: "p:connectedGames", data: "noclient" });
                });
            }
        } else if (message.type == "p:startCampaign") {
            if (message.data.campaign == "none") {
                if (activeStream.campaign != "none" && curWindow.id != 0) {
                    endCampaign();
                }
                activeStream = { campaign: "none" }
                chrome.storage.local.remove(["drops", "activeStream"]);
                chrome.runtime.sendMessage({ type: "p:startedCampaign", data: { drops: "none" } });
                chrome.runtime.sendMessage({ type: "p:sendCurrentDrops", data: { activeStream: activeStream } })
                return;
            }
            createCampaign(message.data.campaign);
        } else if (message.type == "p:getCurrentDrops") {
            let inventory = await client.getInventory();
            chrome.runtime.sendMessage({ type: "p:sendCurrentDrops", data: { activeStream: activeStream } })
        } else if (message.type == "setAutoDrops") {
            chrome.storage.local.set({ autoDrops: activeStream.campaign.game.name });
        } else if (message.type == "p:setDropPriority") {
            let { campId, priority } = message.data;
            priority = parseInt(priority, 10);
            if (activeStream && activeStream.campaigns && activeStream.campaigns.length > 0) {
                normalizePriorities(activeStream.campaigns);
                let targetCamp = activeStream.campaigns.find(c => c.id == campId);
                if (targetCamp && targetCamp.priority !== priority) {
                    let oldPriority = targetCamp.priority;
                    let otherCamp = activeStream.campaigns.find(c => c.id !== campId && c.priority === priority);
                    if (otherCamp) {
                        otherCamp.priority = oldPriority;
                    }
                    targetCamp.priority = priority;

                    normalizePriorities(activeStream.campaigns);

                    let savedPrioritiesKey = `dropPriorities_${activeStream.campaign.game.name}`;
                    let savedPriorities = {};
                    activeStream.campaigns.forEach(c => {
                        savedPriorities[c.id] = c.priority;
                    });
                    await chrome.storage.local.set({ [savedPrioritiesKey]: savedPriorities, activeStream });
                    chrome.runtime.sendMessage({ type: "p:sendCurrentDrops", data: { activeStream: activeStream } });

                    let activeCamp = activeStream.campaigns[activeStream.campaign.onCamp];
                    if (activeCamp && targetCamp.id !== activeCamp.id && priority < activeCamp.priority && targetCamp.minutesWatched < targetCamp.minutesNeeded) {
                        let stream = await findStreamForCampaign(targetCamp);
                        if (stream) {
                            console.log(`Drop priority increased for ${campId}. Live stream found, switching immediately.`);
                            clearInterval(activeStream.campaign.interval);
                            activeStream.campaign.reOpening = true;
                            runCampaign();
                        }
                    }
                }
            }
        } else if (message.type == "p:settingsChanged") {
            settings = message.data.settings;
        } else if (message.type == "p:changeToStream") {
            if (activeStream && activeStream.campaigns) {
                let targetIdx = -1;
                activeStream.campaigns.forEach((v, i) => {
                    if (v.streamers.includes(message.data) && message.data != "gen") {
                        targetIdx = i;
                    } else if (message.data == "gen" && (v.streamers.length == 0 || v.streamers == "gen")) {
                        targetIdx = i;
                    }
                });
                if (targetIdx !== -1) {
                    normalizePriorities(activeStream.campaigns);
                    let targetCamp = activeStream.campaigns[targetIdx];
                    let oldPriority = targetCamp.priority;
                    let otherCamp = activeStream.campaigns.find(c => c.id !== targetCamp.id && c.priority === 1);
                    if (otherCamp) {
                        otherCamp.priority = oldPriority;
                    }
                    targetCamp.priority = 1;

                    normalizePriorities(activeStream.campaigns);

                    let savedPrioritiesKey = `dropPriorities_${activeStream.campaign.game.name}`;
                    let savedPriorities = {};
                    activeStream.campaigns.forEach(c => {
                        savedPriorities[c.id] = c.priority;
                    });
                    await chrome.storage.local.set({ [savedPrioritiesKey]: savedPriorities, activeStream });

                    activeStream.campaign.reOpening = true;
                    clearInterval(activeStream.campaign.interval);
                    runCampaign();
                }
            }
        } else if (message.type == "p:deleteDrop") {
            activeStream.campaigns.forEach((v, i) => {
                if (v.streamers.includes(message.data) && message.data != "gen") {
                    activeStream.campaigns.splice(i, 1);
                } else if (message.data == "gen" && v.streamers == "gen") {
                    activeStream.campaigns.splice(i, 1);
                }
            })
        } else if (message.type == "p:recheckPrem") {
            getPremiumStatus();
        } else if (message.type == "getAutoDropGames") {
            chrome.runtime.sendMessage({
                type: "setAutoDropGames", data: {
                    allConnected: listOfConnected,
                    enabled: autoDropGames
                }
            })
        } else if (message.type == "toggleAutoDropGame") {
            if (message.data[1] == true) {
                autoDropGames.push(message.data[0])
                chrome.storage.local.set({ autoDropGames: autoDropGames });
            } else {
                autoDropGames.splice(autoDropGames.indexOf(message.data[0]), 1);
                chrome.storage.local.set({ autoDropGames: autoDropGames });
            }
        } else if (message.type == "getPremiumStatus") {
            getPremiumStatus();
        } else if (message.type == "minute-watched") {
            if (activeStream.campaign == "none") {
                console.log(message.data)
                let data = await client.postAuthorized(message.data.spade);
            }
        }
    }
    if (message.type == "toggleExt") {
        extEnabled = message.data;
        if (extEnabled) {
            createClient();
            setTimeout(checkForDrops, 7500);
            cfdInterval = setInterval(checkForDrops, 300000);
            ssdInterval = setInterval(displayBadgeDrops, 1800000)
            agtInterval = setInterval(autoGetToken, 960000);
            setTimeout(autoGetToken, 5000);
        } else {
            clearInterval(cfdInterval);
            clearInterval(ssdInterval);
            clearInterval(agtInterval);

            //Stop Drops
            if (activeStream.campaign != "none" && curWindow.id != 0) {
                endCampaign();
            }
            activeStream = { campaign: "none" }
            chrome.storage.local.remove(["drops", "activeStream"]);
            chrome.runtime.sendMessage({ type: "p:startedCampaign", data: { drops: "none" } });
            chrome.runtime.sendMessage({ type: "p:sendCurrentDrops", data: { activeStream: activeStream } })
        }
    }
})

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    if (activeStream.campaign != "none" && extEnabled) {
        if (tabId == curWindow.id && !activeStream.campaign.reOpening) {
            clearInterval(activeStream.interval);
            endCampaign();
        }
    }
})

chrome.runtime.onStartup.addListener(startup)

chrome.runtime.onInstalled.addListener(startup)

if (chrome.runtime.onSuspendCanceled) {
    chrome.runtime.onSuspendCanceled.addListener(startup);
}

chrome.runtime.onUpdateAvailable.addListener(() => {
    if (activeStream.campaign == "none") {
        chrome.runtime.reload();
    } else {
        setInterval(() => {
            if (activeStream.campaign == "none") {
                chrome.runtime.reload();
            }
        }, 30000)
    }
})

async function startup() {
    clearTimeout(startupTimeout)
    console.log("Startup")
    chrome.storage.local.remove(["activeStream"]);
    chrome.storage.local.set({ curBadgeDrops: [] });
    chrome.storage.local.get(["settings", "autoDropGames", "exEnabled"], (val) => {
        if (!val.settings) {
            chrome.storage.local.set({ settings: { connectedGames: false, autoGetToken: false, watchPopout: false, autoMute: false, setShowBadges: false, lowestQuality: false } });
        } else if (val.settings) {
            settings = val.settings;
            if (settings.showAllGames !== undefined && settings.connectedGames === undefined) {
                settings.connectedGames = !settings.showAllGames;
                delete settings.showAllGames;
            }
            if (settings.connectedGames === undefined) settings.connectedGames = false;
            if (settings.lowestQuality === undefined) settings.lowestQuality = false;
            if (settings.autoGetToken && extEnabled) {
                setTimeout(autoGetToken, 7500);
            }
            console.log(Object.keys(settings).length);
            console.log(settings)
            if (!settings.autoGetToken) settings.autoGetToken = false;
            if (!settings.watchPopout) settings.watchPopout = false;
            if (!settings.autoMute) settings.autoMute = false;
            if (!settings.setShowBadges) settings.setShowBadges = false;
            if (settings.lowestQuality === undefined) settings.lowestQuality = false;
            chrome.storage.local.set({ settings });
        }
        if (!val.autoDropGames) {
            chrome.storage.local.set({ autoDropGames: [] });
        } else {
            autoDropGames = val.autoDropGames;
        }
        if (val.exEnabled === undefined) {
            chrome.storage.local.set({ exEnabled: true })
            extEnabled = true;
        } else {
            extEnabled = val.exEnabled
        }
        if (extEnabled) {
            chrome.storage.local.get(["connectedGamesList"]).then(cVal => {
                if (cVal && Array.isArray(cVal.connectedGamesList)) {
                    listOfConnected = cVal.connectedGamesList;
                }
                if (!listOfConnected.includes("Badges")) {
                    listOfConnected.push("Badges");
                }
            });
            createClient();
            setTimeout(autoGetToken, 5000);
            setTimeout(checkForDrops, 7500);
            setTimeout(displayBadgeDrops, 15000);
            cfdInterval = setInterval(checkForDrops, 300000);
            agtInterval = setInterval(autoGetToken, 960000);
            ssdInterval = setInterval(displayBadgeDrops, 1800000);
        }
    })
}

function createClient() {
    chrome.storage.local.get(["clientId", "oauthToken", "deviceId", "userId"]).then((data) => {
        if (data.oauthToken && extEnabled) {
            client = new Client({ clientId: data.clientId, oauthToken: data.oauthToken, deviceId: data.deviceId, userId: data.userId });
            setTimeout(async () => {
                let test = await client.getUserNotifications();
                console.log(test);
            }, 1500);
        }
    })
}



function normalizePriorities(campaigns) {
    if (!campaigns || campaigns.length === 0) return;
    let n = campaigns.length;
    let used = new Set();
    let duplicatesOrInvalid = [];

    campaigns.forEach(c => {
        let p = parseInt(c.priority, 10);
        if (!isNaN(p) && p >= 1 && p <= n && !used.has(p)) {
            c.priority = p;
            used.add(p);
        } else {
            duplicatesOrInvalid.push(c);
        }
    });

    let available = [];
    for (let i = 1; i <= n; i++) {
        if (!used.has(i)) available.push(i);
    }

    duplicatesOrInvalid.forEach((c, idx) => {
        c.priority = available[idx];
    });
}

async function findStreamForCampaign(camp) {
    if (!camp) return null;
    if (camp.streamers.length == 0) {
        // Generic drop - find live channels with drops enabled, skipping any stagnant ones
        let streams = await client.getActiveStreams(activeStream.campaign.game.name, activeStream.campaign.slug);
        let campaignDetails = await client.getDropCampaignDetails(camp.id);
        if (campaignDetails && campaignDetails.allow && campaignDetails.allow.channels != null) {
            for (const stream of streams) {
                if (gettingStreamObj.notPlayingGame.includes(stream.broadcaster.login)) continue;
                let potStream = campaignDetails.allow.channels.find(s => s.name == stream.broadcaster.login);
                if (potStream !== undefined) {
                    return {
                        curWatching: stream.broadcaster.login,
                        broadcast_id: stream.id,
                        channel_id: stream.broadcaster.id,
                        channel: stream.broadcaster.login
                    };
                }
            }
        } else {
            for (const stream of streams) {
                if (gettingStreamObj.notPlayingGame.includes(stream.broadcaster.login)) continue;
                let dropsEn = false;
                if (stream.freeformTags) {
                    for (const tag of stream.freeformTags) {
                        if (tag.name == "DropsEnabled") dropsEn = true;
                    }
                }
                if (dropsEn) {
                    return {
                        curWatching: stream.broadcaster.login,
                        broadcast_id: stream.id,
                        channel_id: stream.broadcaster.id,
                        channel: stream.broadcaster.login
                    };
                }
            }
        }
        return null;
    } else {
        // Drop with specific streamers list
        if (activeStream.campaign.game.name == "Badges") {
            for (const streamer of camp.streamers) {
                if (gettingStreamObj.notPlayingGame.includes(streamer)) continue;
                let curStream = await client.getStreamMetadata(streamer);
                if (curStream && curStream.stream != null) {
                    return {
                        curWatching: streamer,
                        broadcast_id: curStream.stream.id,
                        channel_id: curStream.id,
                        channel: streamer
                    };
                }
            }
            return null;
        } else {
            if (gettingStreamObj.lastPull + 60 <= new Date().getTime() / 1000) {
                console.log("Pulling streams...");
                gettingStreamObj.allStreamers = await client.getAllLiveForGame(activeStream.campaign.game.name);
                gettingStreamObj.lastPull = new Date().getTime() / 1000;
            }
            if (!gettingStreamObj.allStreamers || gettingStreamObj.allStreamers.length == 0) {
                return null;
            }
            for (const stream of gettingStreamObj.allStreamers) {
                if (!stream || !stream.data || !stream.data.userOrError) continue;
                let streamerLogin = stream.data.userOrError.login;
                if (camp.streamers.includes(streamerLogin) && stream.data.userOrError.stream != null && !gettingStreamObj.notPlayingGame.includes(streamerLogin) && !isStreamerStagnant(streamerLogin)) {
                    let currentStreamInfo = await client.getStreamMetadata(streamerLogin);
                    if (currentStreamInfo && currentStreamInfo.stream && currentStreamInfo.stream.game && currentStreamInfo.stream.game.name == activeStream.campaign.game.name) {
                        return {
                            curWatching: streamerLogin,
                            broadcast_id: currentStreamInfo.stream.id,
                            channel_id: currentStreamInfo.id,
                            channel: streamerLogin
                        };
                    } else {
                        gettingStreamObj.notPlayingGame.push(streamerLogin);
                    }
                }
            }
            return null;
        }
    }
}

async function runCampaign() {
    if (activeStream.campaign.reOpening)
        activeStream.campaign.reOpening = false;
    console.log(activeStream.campaign);

    // 1. Check if all campaigns are already completed
    let pendingCamps = activeStream.campaigns.filter(c => c.minutesWatched < c.minutesNeeded);
    if (pendingCamps.length === 0) {
        console.log("All drop campaigns are completed!");
        endCampaign();
        return;
    }

    // 2. Sort pending campaigns by priority ascending (1 = highest priority)
    pendingCamps.sort((a, b) => (a.priority || 999) - (b.priority || 999));

    // 3. Find the highest priority campaign that has an active live stream
    let targetCamp = null;
    let streamFound = null;

    for (const camp of pendingCamps) {
        let stream = await findStreamForCampaign(camp);
        if (stream) {
            targetCamp = camp;
            streamFound = stream;
            break;
        }
    }

    // 4. If no live streams for any pending campaign, enter wait mode and retry in 60s
    if (!targetCamp || !streamFound) {
        activeStream.campaign.status = "nostream";
        console.log("No active streams found for any drop campaign. Waiting 60s to recheck...");
        chrome.storage.local.set({ activeStream });
        gettingStreamObj.notPlayingGame = [];
        chrome.runtime.sendMessage({ type: "p:sendCurrentDrops", data: { activeStream: activeStream } });
        windowManager("wait");
        clearTimeout(recheckCampTimeout);
        recheckCampTimeout = setTimeout(() => {
            runCampaign();
        }, 60000);
        return;
    }

    // 5. Select this campaign and stream
    activeStream.campaign.onCamp = activeStream.campaigns.findIndex(c => c.id === targetCamp.id);
    activeStream.campaigns[activeStream.campaign.onCamp].noProgress = 0;
    activeStream.campaign.curWatching = streamFound.curWatching;
    activeStream.campaign.spadeData.broadcast_id = streamFound.broadcast_id;
    activeStream.campaign.spadeData.channel_id = streamFound.channel_id;
    activeStream.campaign.spadeData.channel = streamFound.channel;

    windowManager("open", { active: true, url: `https://www.twitch.tv/${activeStream.campaign.curWatching}` }).then(async tab => {
        if (settings.autoMute) {
            setTimeout(() => {
                chrome.tabs.update(tab.id, { muted: true });
            }, 500);
        }
        activeStream.campaign.status = "watching";
        chrome.storage.local.set({ activeStream });
        chrome.runtime.sendMessage({ type: "p:sendCurrentDrops", data: { activeStream: activeStream } });

        clearInterval(activeStream.campaign.interval);
        activeStream.campaign.interval = setInterval(async () => {
            console.log(activeStream.campaign.curWatching);

            // Periodic check 1: Check if any higher priority drop is now live
            let curCamp = activeStream.campaigns[activeStream.campaign.onCamp];
            let higherPrioCamps = activeStream.campaigns.filter(c => c.minutesWatched < c.minutesNeeded && (c.priority || 999) < (curCamp.priority || 999));
            higherPrioCamps.sort((a, b) => (a.priority || 999) - (b.priority || 999));

            for (const higherCamp of higherPrioCamps) {
                let higherStream = await findStreamForCampaign(higherCamp);
                if (higherStream) {
                    console.log(`Higher priority drop (${higherCamp.id}, Prio ${higherCamp.priority}) is now live! Switching...`);
                    clearInterval(activeStream.campaign.interval);
                    activeStream.campaign.reOpening = true;
                    runCampaign();
                    return;
                }
            }

            // Periodic check 2: Check current stream health
            let stream = await client.getStreamMetadata(activeStream.campaign.curWatching);
            if (stream.stream == null || (activeStream.campaign.game.name != "Badges" && stream.stream.game && stream.stream.game.name != activeStream.campaign.game.name)) {
                console.log("Current stream ended or changed game. Re-evaluating priority streams...");
                clearInterval(activeStream.campaign.interval);
                activeStream.campaign.reOpening = true;
                runCampaign();
                return;
            }

            // Send spade events for minute watched
            let spadeSend = await client.postAuthorized({
                query: "\n  mutation SendEvents($input: SendSpadeEventsInput!) {\n    sendSpadeEvents(input: $input) {\n      statusCode\n    }\n  }\n",
                variables: {
                    input: {
                        data: await encodeGzipBase64(JSON.stringify({
                            event: "minute-watched",
                            properties: {
                                broadcast_id: activeStream.campaign.spadeData.broadcast_id,
                                channel_id: activeStream.campaign.spadeData.channel_id,
                                channel: activeStream.campaign.spadeData.channel,
                                client_time: new Date().toISOString(),
                                game: activeStream.campaign.game.name,
                                game_id: activeStream.campaign.spadeData.game_id,
                                hidden: false,
                                is_live: true,
                                live: true,
                                logged_in: true,
                                minutes_logged: 100,
                                muted: false,
                                user_id: activeStream.campaign.spadeData.user_id,
                            }
                        })),
                        encoding: "GZIP_B64",
                        repository: "twilight"
                    }
                }
            });
            console.log(spadeSend);

            let inventory = await client.getInventory().catch(() => null);
            console.log(inventory);
            console.log(activeStream);

            curCamp = activeStream.campaigns ? activeStream.campaigns[activeStream.campaign.onCamp] : null;
            if (!curCamp) return;

            let inProgressCampaign = null;
            if (inventory && Array.isArray(inventory.dropCampaignsInProgress)) {
                inProgressCampaign = inventory.dropCampaignsInProgress.find(c => c.id == curCamp.id);
            }

            if (inProgressCampaign && inProgressCampaign.status == "ACTIVE") {
                if (Array.isArray(inProgressCampaign.timeBasedDrops)) {
                    for (const drop of inProgressCampaign.timeBasedDrops) {
                        if (drop.requiredMinutesWatched > curCamp.minutesNeeded)
                            curCamp.minutesNeeded = drop.requiredMinutesWatched;
                    }
                }
                await checkClaimDrop();

                let allClaimed = Array.isArray(inProgressCampaign.timeBasedDrops) && inProgressCampaign.timeBasedDrops.every(d => d.self && d.self.isClaimed);
                let newMinutes = 0;

                if (allClaimed) {
                    newMinutes = curCamp.minutesNeeded;
                } else if (Array.isArray(inProgressCampaign.timeBasedDrops)) {
                    newMinutes = Math.max(0, ...inProgressCampaign.timeBasedDrops.map(d => {
                        let m = d.self?.currentMinutesWatched || 0;
                        return (d.self && d.self.isClaimed) ? Math.max(m, d.requiredMinutesWatched) : m;
                    }));
                }

                let oldMinutes = curCamp.minutesWatched || 0;

                if (newMinutes > oldMinutes) {
                    console.log(`Drop progress verified (+${newMinutes - oldMinutes}m). Total: ${newMinutes}/${curCamp.minutesNeeded}`);
                    curCamp.minutesWatched = newMinutes;
                    curCamp.noProgress = 0;
                } else if (allClaimed || newMinutes >= curCamp.minutesNeeded) {
                    curCamp.minutesWatched = curCamp.minutesNeeded;
                    curCamp.noProgress = 0;
                } else {
                    let hasClaimedOrReady = inProgressCampaign.timeBasedDrops.some(d => d.self && (d.self.isClaimed || d.self.dropInstanceID || (d.self.currentMinutesWatched >= d.requiredMinutesWatched - 1)));
                    if (!hasClaimedOrReady) {
                        curCamp.noProgress = (curCamp.noProgress || 0) + 1;
                        console.log(`No progress on ${activeStream.campaign.curWatching} (Check ${curCamp.noProgress}/3). Current minutes: ${newMinutes}`);
                        if (curCamp.noProgress >= 3) {
                            console.log(`Streamer ${activeStream.campaign.curWatching} stalled for 3 checks (~3 mins). Placing on 10m cooldown and switching stream...`);
                            addStagnantStreamer(activeStream.campaign.curWatching, 10);
                            curCamp.noProgress = 0;
                            clearInterval(activeStream.campaign.interval);
                            activeStream.campaign.reOpening = true;
                            chrome.storage.local.set({ activeStream });
                            chrome.runtime.sendMessage({ type: "p:sendCurrentDrops", data: { activeStream: activeStream } });
                            runCampaign();
                            return;
                        }
                    } else {
                        console.log(`Drop ready to claim or claiming in flight on ${activeStream.campaign.curWatching}. Waiting for claim confirmation...`);
                        await checkClaimDrop();
                    }
                }

                if (allClaimed || curCamp.minutesWatched >= curCamp.minutesNeeded) {
                    console.log(`Current drop campaign ${curCamp.id} finished! Moving to next priority drop.`);
                    curCamp.minutesWatched = curCamp.minutesNeeded;
                    clearStagnantStreamers();
                    gettingStreamObj.notPlayingGame = [];
                    clearInterval(activeStream.campaign.interval);
                    activeStream.campaign.reOpening = true;
                    chrome.storage.local.set({ activeStream });
                    chrome.runtime.sendMessage({ type: "p:sendCurrentDrops", data: { activeStream: activeStream } });
                    runCampaign();
                    return;
                }
                chrome.storage.local.set({ activeStream });
                chrome.runtime.sendMessage({ type: "p:sendCurrentDrops", data: { activeStream: activeStream } });
                return;
            } else if (inProgressCampaign && inProgressCampaign.status != "ACTIVE") {
                console.log("Drop campaign expired before completion. Moving to next priority drop.");
                clearInterval(activeStream.campaign.interval);
                activeStream.campaign.reOpening = true;
                runCampaign();
                return;
            } else if (!inProgressCampaign) {
                let isCompletedAndArchived = false;
                if (curCamp.minutesWatched >= curCamp.minutesNeeded * 0.95 || curCamp.minutesWatched > 0) {
                    let invWithData = await client.getInventoryWithData().catch(() => null);
                    if (invWithData && invWithData.earnedDropRewards && Array.isArray(invWithData.earnedDropRewards.edges)) {
                        isCompletedAndArchived = invWithData.earnedDropRewards.edges.some(e => e.node.campaign && e.node.campaign.id == curCamp.id);
                    }
                    if (!isCompletedAndArchived && curCamp.minutesWatched >= curCamp.minutesNeeded * 0.95) {
                        isCompletedAndArchived = true;
                    }
                }

                if (isCompletedAndArchived) {
                    console.log(`Campaign ${curCamp.id} was completed/claimed on Twitch and archived. Advancing...`);
                    curCamp.minutesWatched = curCamp.minutesNeeded;
                    clearStagnantStreamers();
                    gettingStreamObj.notPlayingGame = [];
                    clearInterval(activeStream.campaign.interval);
                    activeStream.campaign.reOpening = true;
                    chrome.storage.local.set({ activeStream });
                    chrome.runtime.sendMessage({ type: "p:sendCurrentDrops", data: { activeStream: activeStream } });
                    runCampaign();
                    return;
                }

                curCamp.noProgress = (curCamp.noProgress || 0) + 1;
                console.log(`Drop campaign has not registered in Twitch inventory yet on ${activeStream.campaign.curWatching} (Check ${curCamp.noProgress}/3)`);
                if (curCamp.noProgress >= 3) {
                    console.log(`Streamer ${activeStream.campaign.curWatching} failed to register drop progress after 3 checks. Placing on 10m cooldown and switching stream...`);
                    addStagnantStreamer(activeStream.campaign.curWatching, 10);
                    curCamp.noProgress = 0;
                    clearInterval(activeStream.campaign.interval);
                    activeStream.campaign.reOpening = true;
                    chrome.storage.local.set({ activeStream });
                    chrome.runtime.sendMessage({ type: "p:sendCurrentDrops", data: { activeStream: activeStream } });
                    runCampaign();
                    return;
                }
            }

            console.log("Checking if drop is done via all items claimed");
            let allDropsClaimed = true;
            if (activeStream.campaigns && activeStream.campaigns[activeStream.campaign.onCamp] && Array.isArray(activeStream.campaigns[activeStream.campaign.onCamp].items)) {
                for (const item of activeStream.campaigns[activeStream.campaign.onCamp].items) {
                    if (item.badge) {
                        let notifications = await client.getUserNotifications().catch(() => []);
                        if (!Array.isArray(notifications) || !notifications.some(n => n.node?.thumbnailURL == item.picture)) {
                            allDropsClaimed = false;
                        }
                    } else {
                        let inProg = inventory?.dropCampaignsInProgress?.find(c => c.id == activeStream.campaigns[activeStream.campaign.onCamp].id);
                        let dItem = inProg?.timeBasedDrops?.find(i => i.id == item.id);
                        if (dItem && dItem.self?.isClaimed === false) {
                            allDropsClaimed = false;
                        }
                    }
                }
            }
            if (allDropsClaimed) {
                clearStagnantStreamers();
                gettingStreamObj.notPlayingGame = [];
                clearInterval(activeStream.campaign.interval);
                activeStream.campaign.reOpening = true;
                activeStream.campaigns[activeStream.campaign.onCamp].minutesWatched = activeStream.campaigns[activeStream.campaign.onCamp].minutesNeeded;
                await checkClaimDrop();
                runCampaign();
                return;
            }

            if (inventory && Array.isArray(inventory.dropCampaignsInProgress) && inventory.dropCampaignsInProgress.some((v) => v.game && v.game.name == activeStream.campaign.game.name && v.status == "ACTIVE")) {
                clearInterval(activeStream.campaign.interval);
                activeStream.campaign.reOpening = true;
                runCampaign();
            } else {
                console.log("Done getting drops!");
                endCampaign();
                await checkClaimDrop();
            }
        }, 65000);
    });
}



function endCampaign() {
    console.log("Done!");
    clearInterval(activeStream.campaign.interval);
    clearTimeout(recheckCampTimeout);
    windowManager("close");
    activeStream = { campaign: "none" };
    clearStagnantStreamers();
    gettingStreamObj = {
        allStreamers: [],
        notPlayingGame: [],
        lastPull: 0
    }
    chrome.runtime.sendMessage({ type: "p:sendCurrentDrops", data: { activeStream: activeStream } })
    chrome.storage.local.remove(["activeStream", "drops"]);
    checkClaimDrop();
}

async function createCampaign(game) { //Use picture to find notification
    let campaigns = await client.getDropCampaigns();
    if (game == "Badges")
        campaigns = campaigns.filter(c => c.detailsURL.includes("twitch-chat-badges"))
    else
        campaigns = campaigns.filter(c => c.game != null && c.game.displayName == game && c.status == "ACTIVE")
    console.log(campaigns)

    let campAry = [];
    activeStream.campaign = {
        game: {
            name: game == "Badges" ? "Badges" : campaigns[0].game.displayName
        },
        onCamp: 0,
        curWatching: "",
        lastLoop: 0,
        interval: 0,
        allowGen: true,
        slug: null,
        status: "starting",
        reOpening: false,
        spadeData: {
            broadcast_id: "",
            channel_id: "",
            channel: "",
            game_id: campaigns[0].game.id,
            user_id: 0
        }
    };
    activeStream.campaigns = [];
    for (const campaign of campaigns) {
        campAry.push(campaign.id);
    }
    console.log(campAry)
    let campDeets = await client.getDropCampaignDetails(campAry);
    let inventory = await client.getInventoryWithData();
    console.log(campDeets)
    activeStream.campaign.spadeData.user_id = parseInt(campDeets[0].data.user.id)
    for (const campaign of campDeets) {
        let streams = [];
        if (activeStream.campaign.slug == null) {
            activeStream.campaign.slug = campaign.data.user.dropCampaign.game.slug
        }
        if (campaign.data.user.dropCampaign.allow.channels != null) {
            for (const stream of campaign.data.user.dropCampaign.allow.channels) {
                streams.push(stream.name);
            }
            activeStream.campaign.allowGen = false;
        }
        let maxTime = 0;
        let timeWatched = 0;
        let allDrops = [];
        let lastDropID = "";
        console.log(campaign)
        for (const drop of campaign.data.user.dropCampaign.timeBasedDrops) {
            if (drop.requiredMinutesWatched > maxTime) {
                maxTime = drop.requiredMinutesWatched;
                lastDropID = drop.benefitEdges[0].benefit.id
            }
            if (drop.requiredMinutesWatched != 0)
                allDrops.push({ name: `${drop.name} - ${drop.benefitEdges[0].benefit.name}`, picture: drop.benefitEdges[0].benefit.imageAssetURL, reqTime: drop.requiredMinutesWatched, id: drop.id, badge: campaign.data.user.dropCampaign.owner.name == "Twitch Gaming" ? true : false })
        }
        console.log(lastDropID)
        let dropStarted = inventory.dropCampaignsInProgress == null ? false : inventory.dropCampaignsInProgress.some(obj => obj.id == campaign.data.user.dropCampaign.id);
        if (dropStarted) {
            let inProg = inventory.dropCampaignsInProgress.find(obj => obj.id == campaign.data.user.dropCampaign.id);
            let allClaimed = Array.isArray(inProg.timeBasedDrops) && inProg.timeBasedDrops.every(d => d.self && d.self.isClaimed);
            if (allClaimed) {
                timeWatched = maxTime;
            } else if (Array.isArray(inProg.timeBasedDrops)) {
                timeWatched = Math.max(0, ...inProg.timeBasedDrops.map(d => {
                    let m = d.self?.currentMinutesWatched || 0;
                    return (d.self && d.self.isClaimed) ? Math.max(m, d.requiredMinutesWatched) : m;
                }));
            }
        } else {
            let lastClaimed = inventory.earnedDropRewards && Array.isArray(inventory.earnedDropRewards.edges)
                ? inventory.earnedDropRewards.edges.some(e => e.node.campaign && e.node.campaign.id == campaign.data.user.dropCampaign.id && (e.node.item.id == lastDropID || allDrops.every(i => inventory.earnedDropRewards.edges.some(e2 => e2.node.item && e2.node.item.id == i.id))))
                : false;
            if (lastClaimed) {
                timeWatched = maxTime;
            } else {
                timeWatched = 0;
            }
        }
        if (maxTime != 0) {
            activeStream.campaigns.push({
                game: campaign.data.user.dropCampaign.game.name,
                id: campaign.data.user.dropCampaign.id,
                minutesNeeded: maxTime,
                minutesWatched: timeWatched,
                noProgress: 0,
                streamers: streams,
                items: allDrops
            })
        }
    }

    // Place general drops (no specific streamers) at the end of the list
    activeStream.campaigns.sort((a, b) => {
        let aGen = (a.streamers.length === 0 || a.streamers === "gen") ? 1 : 0;
        let bGen = (b.streamers.length === 0 || b.streamers === "gen") ? 1 : 0;
        return aGen - bGen;
    });

    let savedPrioritiesKey = `dropPriorities_${activeStream.campaign.game.name}`;
    let storageData = await chrome.storage.local.get([savedPrioritiesKey]);
    let savedPriorities = storageData[savedPrioritiesKey] || {};

    activeStream.campaigns.forEach((camp, idx) => {
        if (savedPriorities[camp.id] !== undefined) {
            camp.priority = parseInt(savedPriorities[camp.id], 10);
        } else {
            camp.priority = idx + 1;
        }
    });

    normalizePriorities(activeStream.campaigns);

    console.log(activeStream)
    runCampaign();
    chrome.storage.local.set({ activeStream: activeStream });
}

async function checkForDrops() { //Update to use value from database for all connected games so it can sync between PCs
    if (autoDropGames.length != 0 || settings.setShowBadges) {
        if (client.integrity.expiration > new Date().getTime() && activeStream.campaign == "none") {
            let campaigns = await client.getDropCampaigns();
            let inventory = await client.getInventoryWithData();
            let notifications = await client.getUserNotifications();
            let gamesToRun = []
            currentBadgeDrops = [];
            console.log(campaigns);
            console.log(inventory)
            for (const campaign of campaigns) {
                if (campaign.game == null) continue;
                if (campaign.game.displayName == "SMITE 2") {
                    console.log(`Game: ${campaign.game.displayName}`);
                    console.log(`Auto drops includes: ${autoDropGames.includes(campaign.game.displayName)}`)
                    console.log(`Campaign active: ${campaign.status}`)
                }
                if (autoDropGames.includes(campaign.game.displayName) && campaign.status == "ACTIVE") {
                    let campaignDetails = await client.getDropCampaignDetails(campaign.id);
                    let endsAt = new Date(campaignDetails.endAt).getTime();
                    let finalDrop = { id: "", time: 0 };
                    let gotFinalDrop = false;
                    for (const drop of campaignDetails.timeBasedDrops) {
                        if (drop.requiredMinutesWatched > finalDrop.time) {
                            finalDrop = {
                                id: drop.benefitEdges[0].benefit.id,
                                time: drop.requiredMinutesWatched
                            }
                        }
                    }
                    for (const itemInv of inventory.earnedDropRewards.edges) {
                        if (itemInv.node.item.id == finalDrop.id && itemInv.node.campaign.id == campaign.id) {
                            gotFinalDrop = true;
                        }
                    }
                    if (!gotFinalDrop && finalDrop.time != 0) {
                        if (!gamesToRun.some((g) => g.game == campaign.game.displayName))
                            gamesToRun.push({ game: campaign.game.displayName, endsAt });
                    }
                }
                if (campaign.detailsURL.includes("twitch-chat-badges")) {
                    let campaignDetails = await client.getDropCampaignDetails(campaign.id);
                    let endsAt = new Date(campaignDetails.endAt).getTime();
                    let finalDrop = { id: "", time: 0 };
                    let gotFinalDrop = false;
                    console.log(campaignDetails)
                    for (const drop of campaignDetails.timeBasedDrops) {
                        if (drop.requiredMinutesWatched >= finalDrop.time) {
                            finalDrop = {
                                id: drop.benefitEdges[0].benefit.id,
                                time: drop.requiredMinutesWatched
                            }
                        }
                        if (!currentBadgeDrops.some(c => c.id == campaignDetails.id))
                            currentBadgeDrops.push({ id: campaignDetails.id, name: campaignDetails.game.displayName, sub: campaignDetails.timeBasedDrops[0].requiredSubs == 0 ? false : true });
                    }
                    chrome.storage.local.set({ curBadgeDrops: currentBadgeDrops })
                    gotFinalDrop = notifications.some(n => n.node.thumbnailURL == campaignDetails.timeBasedDrops.find(t => t.benefitEdges[0].benefit.id == finalDrop.id).benefitEdges[0].benefit.imageAssetURL);
                    if (!gotFinalDrop && finalDrop.time != 0 && autoDropGames.includes("Badges")) {
                        if (config.badgesGameNames.includes(campaign.game.displayName)) {
                            if (!gamesToRun.some((g) => g.game == "Badges"))
                                gamesToRun.push({ game: "Badges", endsAt });
                        } else {
                            if (!gamesToRun.some((g) => g.game == campaign.game.displayName))
                                gamesToRun.push({ game: campaign.game.displayName, endsAt });
                        }
                    }
                }
            }
            if (activeStream.campaign == "none" && gamesToRun.length != 0) {
                let gameToRun = "";
                let lowestTime = 0;
                for (const game of gamesToRun) {
                    if (lowestTime == 0) {
                        lowestTime = game.endsAt
                        gameToRun = game.game
                    } else if (lowestTime > game.endsAt) {
                        lowestTime = game.endsAt;
                        gameToRun = game.game
                    }
                }
                createCampaign(gameToRun)
            }
        }
    }
}



async function checkForUpdate() {
    let updated = { curVersion: chrome.runtime.getManifest().version, noti: false };
    chrome.storage.local.get(["updated"]).then(val => {
        if (!val.updated) {
            chrome.storage.local.set({ updated });
        } else {
            if (val.updated.curVersion != updated.curVersion) {
                updated.curVersion = val.updated.curVersion;
                updated.noti = true;
                chrome.storage.local.set({ updated })
            }
        }

        if (updated.noti) {
            chrome.action.setBadgeText({ text: "New" });
            chrome.action.setBadgeBackgroundColor({ color: "#00FFFF" })
        }
    })
}

async function displayBadgeDrops() {
    console.log(settings.setShowBadges);
    if (settings.setShowBadges) {
        chrome.action.getBadgeText({}).then((curBadge) => {
            console.log(curBadge);
            if (curBadge != "New") {
                let newText = currentBadgeDrops.length != 0 ? `${currentBadgeDrops.length} B` : "";
                console.log(newText);
                if (curBadge != newText) {
                    chrome.action.setBadgeText({ text: newText });
                    chrome.action.setBadgeBackgroundColor({ color: "#d14c4cff" })
                }
            }
        });
    }
}

async function checkClaimDrop() {
    if (!client) return;
    try {
        let inventory = await client.getInventory().catch(() => null);
        if (!inventory || !Array.isArray(inventory.dropCampaignsInProgress)) return;
        console.log("Attempting to claim pending drops...");
        for (const camp of inventory.dropCampaignsInProgress) {
            if (!Array.isArray(camp.timeBasedDrops)) continue;
            for (const drop of camp.timeBasedDrops) {
                if (drop.requiredMinutesWatched != 0 && !drop.self?.isClaimed && drop.self?.dropInstanceID) {
                    console.log("Claiming drop:", drop);
                    let dropClaim = await client.claimDropReward(drop.self.dropInstanceID);
                    if (dropClaim == null) continue;
                    console.log("Claimed Drop successfully");
                    drop.self.isClaimed = true;
                    chrome.storage.local.get(["claimedDrops"]).then((res) => {
                        let d = (res.claimedDrops || 0) + 1;
                        chrome.storage.local.set({ claimedDrops: d });
                    });
                }
            }
        }
    } catch (err) {
        console.error("Error in checkClaimDrop:", err);
    }
}

function autoGetToken() {
    if (settings.autoGetToken && autoGetTokenWindow == 0) {
        if (!client || client.integrity.expiration - 960000 < new Date().getTime()) {
            chrome.windows.create({ focused: false, type: "popup", url: "https://www.twitch.tv/drops/inventory/" }).then((window) => {
                autoGetTokenWindow = window.id;
            })
        } else {
            console.log("Token up to date. Will check again in 15 minutes");
        }
    }
}

async function windowManager(func, data) {
    console.log(func);
    console.log(data);
    console.log(curWindow)
    if (func == "open") {
        if (curWindow.id == 0) {
            console.log("Awaiting tab")
            let tab = await chrome.tabs.create(data)
            curWindow.id = tab.id;
            curWindow.type = "tab";
            setTimeout(() => {
                chrome.tabs.sendMessage(curWindow.id, { type: "setFavicon" });
            }, 5000);
            return tab;
        } else {
            let tab = await chrome.tabs.get(curWindow.id);
            if (data.url != tab.url)
                chrome.tabs.update(curWindow.id, { url: data.url });
            setTimeout(() => {
                chrome.tabs.sendMessage(tab.id, { type: "setFavicon" });
            }, 5000);
        }
    } else if (func == "close") {
        if (curWindow.id != 0) {
            chrome.tabs.remove(curWindow.id).catch(() => {
                curWindow.id = 0;
                curWindow.type = "none";
            });
            curWindow.id = 0;
            curWindow.type = "none";
        }
    } else if (func == "wait") {
        chrome.tabs.get(curWindow.id).then((t) => {
            let tab = t;
            let waitingURL = chrome.runtime.getURL("waiting.html");
            if (tab.url != waitingURL) {
                chrome.tabs.update(curWindow.id, { url: waitingURL });
            }
        }).catch(async () => {
            let waitingURL = chrome.runtime.getURL("waiting.html");
            let tab = await chrome.tabs.create({ active: true, url: waitingURL });
            curWindow.id = tab.id;
            curWindow.type = "tab"
        })

    }
}



async function getPremiumStatus() {
    premiumStatus = {
        email: "",
        premium: true
    };
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

async function encodeGzipBase64(text) {
    // 1. Convert text to a byte stream
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));

    // 2. Read the compressed stream into an ArrayBuffer
    const response = new Response(stream);
    const buffer = await response.arrayBuffer();

    // 3. Convert binary buffer to a Base64 string
    const binaryString = String.fromCharCode(...new Uint8Array(buffer));
    return btoa(binaryString);
}

setTimeout(checkForUpdate, 1000);