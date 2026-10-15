let maniData = chrome.runtime.getManifest();
let curDropsGame = "";
let settings = {};
let premiumStatus = { email: "", premium: true }
let gameSelectOpen = false;
let dropdownOpen = false;
let userUUID = "";

$(() => {
    i18n.applyStatic();
    let exEnabled = false;

    function updateEnableSwitch(enabled) {
        $(".enableEx").prop("checked", enabled);
        if (enabled) {
            $("#enableExStatus").text("ON").addClass("on").removeClass("off");
        } else {
            $("#enableExStatus").text("OFF").addClass("off").removeClass("on");
        }
    }

    chrome.storage.local.get().then((val) => {
        console.log(val);
    })
    chrome.storage.local.get(["exEnabled", "settings", "updated", "curBadgeDrops"]).then((val) => {
        exEnabled = val.exEnabled;
        updateEnableSwitch(exEnabled);
        if (!exEnabled) {
            $(".sideBtn").removeClass("active");
            changePage("extDisabled");
        }
        for (var i in val.settings) {
            $(`#set${i}`).prop("checked", val.settings[i])
        }
        settings = val.settings || {};
        if (val.updated === undefined || val.updated.noti === undefined) {
            chrome.storage.local.set({ updated: { curVersion: maniData.version, noti: false } })
            chrome.action.setBadgeText({ text: "" })
        }
    })
    $(".enableEx").on("click", (ev) => {
        exEnabled = $(ev.target).prop("checked");
        updateEnableSwitch(exEnabled);
        chrome.storage.local.set({ exEnabled });
        chrome.runtime.sendMessage({ type: "toggleExt", data: exEnabled });
        if (exEnabled) {
            changePage("mainPage")
            $("#homeBtn").addClass("active");
            chrome.runtime.sendMessage({ type: "p:getConnectedGames" })
        } else {
            changePage("extDisabled");
            $(".sideBtn").removeClass("active");
        }
    })
    $(".sideBtn").on("click", (ev) => {
        $(".sideBtn").removeClass("active");
        let btn = $(ev.currentTarget);
        switch (btn.attr("id")) {
            case "homeBtn":
                if (exEnabled) {
                    changePage("mainPage");
                    btn.addClass("active");
                }
                break;
            case "autoDropsBtn":
                if (exEnabled) {
                    createAutoDropsPage();
                    changePage("autoDropsPage");
                    btn.addClass("active");
                }
                break;
            case "viewDropsBtn":
                if (exEnabled) {
                    changePage("dropsPage");
                    btn.addClass("active");
                }
                break;
            case "statsBtn":
                if (exEnabled) {
                    changePage("statsPage");
                    btn.addClass("active");
                }
                break;
            case "settingsBtn":
                if (exEnabled) {
                    changePage("settingsPage");
                    btn.addClass("active");
                }
                break;
        }
    })
    $("#conGames").on("change", (ev) => {
        console.log($(ev.target).val());
        chrome.runtime.sendMessage({ type: "p:startCampaign", data: { campaign: $(ev.target).val() } })
    })
    $(".setting .left input").on("change", (ev) => {
        console.log(`${ev.target.id.substring(3)}: ${ev.target.checked}`);
        settings[ev.target.id.substring(3)] = ev.target.checked;
        chrome.storage.local.set({ settings })
        chrome.runtime.sendMessage({ type: "p:settingsChanged", data: { settings } })
        if (ev.target.id.substring(3) == "connectedGames") {
            chrome.runtime.sendMessage({ type: "p:getConnectedGames" })
        } else if (ev.target.id.substring(3) == "setShowBadges") {
            chrome.action.setBadgeText({ text: "" })
        } else if (ev.target.id.substring(3) == "autoGetToken") {
            createAutoDropsPage();
        }
    })
    $("#selGame").on("click", (ev) => {
        if (exEnabled) {
            if ($(ev.target).closest(".dropdownSearch").length > 0) {
                return;
            }
            if (ev.target.localName == "li") {
                let game = $(ev.target).data("game") || ev.target.innerText || ev.target.innerHTML;
                if (game === "noclient") return;
                $("#selGame .selectedGame").html(game);
                console.log(game);
                chrome.runtime.sendMessage({ type: "p:startCampaign", data: { campaign: game } })
                $(".selectDropdown").addClass("hidden");
                $("#selGame").attr("aria-expanded", false);
                gameSelectOpen = false;
                $("#gameSearchInput").val("");
                $("#selGame .selectDropdownList li").show();
            } else {
                if (gameSelectOpen) {
                    $(".selectDropdown").addClass("hidden");
                    $("#selGame").attr("aria-expanded", false);
                    gameSelectOpen = false;
                    $("#gameSearchInput").val("");
                    $("#selGame .selectDropdownList li").show();
                } else {
                    $("#selGame").find(".selectDropdown").removeClass("hidden");
                    $("#selGame").attr("aria-expanded", true);
                    gameSelectOpen = true;
                    setTimeout(() => {
                        $("#gameSearchInput").focus();
                    }, 50);
                }
            }
        }
    })

    $("#gameSearchInput").on("input", function() {
        let query = $(this).val().toLowerCase().trim();
        $("#selGame .selectDropdownList li").each(function() {
            let text = $(this).text().toLowerCase();
            $(this).toggle(text.includes(query));
        });
    });

    $("#gameSearchInput").on("keydown", function(e) {
        if (e.key === "Enter") {
            let firstMatch = $("#selGame .selectDropdownList li:visible").first();
            if (firstMatch.length > 0) {
                firstMatch.trigger("click");
            }
        } else if (e.key === "Escape") {
            $(".selectDropdown").addClass("hidden");
            $("#selGame").attr("aria-expanded", false);
            gameSelectOpen = false;
            $("#gameSearchInput").val("");
            $("#selGame .selectDropdownList li").show();
        }
    });

    $(document).on("click", (ev) => {
        if (gameSelectOpen || dropdownOpen) {
            if ($(ev.target).closest("#selGame").length > 0 || $(ev.target).closest(".dropDown").length > 0)
                return;
            $(".selectDropdown").addClass("hidden");
            $("#selGame").attr("aria-expanded", false);
            $(".dropDown").attr("aria-expanded", false);
            gameSelectOpen = false;
            dropdownOpen = false;
            $("#gameSearchInput").val("");
            $("#selGame .selectDropdownList li").show();
        }
    })

    chrome.storage.local.get(["activeStream"]).then((val) => {
        if (val.activeStream) {
            console.log(val);
            $("#dropGame").html(val.activeStream.campaign.game.name)
            curDropsGame = val.activeStream.campaign.game.name;
            chrome.runtime.sendMessage({ type: "p:getCurrentDrops" });
        } else {
            $("#dropGame").html(i18n.t("not_getting_drops"))
        }
    })
    chrome.runtime.sendMessage({ type: "p:getConnectedGames" });
    chrome.storage.local.get(["claimedDrops", "claimedPoints"]).then((val) => {
        let claimedDrops = (val && val.claimedDrops != null) ? val.claimedDrops.toLocaleString() : "0";
        let claimedPoints = (val && val.claimedPoints != null) ? val.claimedPoints.toLocaleString() : "0";
        $("#totalClaimedDrops").html(i18n.t("drops_claimed_count", { n: claimedDrops }));
        $("#totalClaimedPoints").html(i18n.t("channel_points_count", { n: claimedPoints }));
        createDropdownEv();
        createAutoDropsPage();
        chrome.runtime.sendMessage({ type: "getAutoDropGames" });
    });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type == "p:connectedGames") {
            let gamesAry = []
            if (message.data == "noclient") {
                $("#selGame .selectDropdownList").html(`<li data-game="noclient">${i18n.t("signin_twitch")}</li>`);
                return;
            };
            let selectHtml = `<li data-game="none">none</li>`;
            console.log(message)
            message.data = message.data.filter(v => v.game != null)
            message.data.sort((a, b) => a.game.displayName.localeCompare(b.game.displayName))
            for (const game of message.data) {
                let selected = "";
                if (game.game.displayName == curDropsGame) selected = "selected"
                if (gamesAry.includes(game.game.displayName)) continue;
                if (game.status != "ACTIVE") continue;
                selectHtml += `<li data-game="${game.game.displayName}" class="${selected}">${game.game.displayName}</li>`;
                gamesAry.push(game.game.displayName);
            }
            $("#selGame .selectDropdownList").html(selectHtml);
        } else if (message.type == "p:sendCurrentDrops") {
            $(".current").css("background-image", `url("assets/img/atd-128-gray.png")`);
            $(".current").css("aspect-ratio", "1 / 1");
            $(".current").addClass("wopac");
            $(".current .progressbar").css("display", "none");
            $("#dropGame").html(i18n.t("not_getting_drops"));
            let totalDrops = 0;
            let claimedDrops = 0;
            console.log(message.data.activeStream)
            if (message.data.activeStream.campaign == "none") return;
            console.log(message.data)
            let currentCampaign = message.data.activeStream.campaigns != null ? message.data.activeStream.campaigns[message.data.activeStream.campaign.onCamp] : message.data.activeStream.campaign;
            let curDrop = {
                id: "",
                name: "",
                picture: "",
                reqTime: 0
            };
            let sortedDrops = currentCampaign.items.sort((a, b) => a.reqTime - b.reqTime);
            for (var drop of sortedDrops) {
                if (currentCampaign.minutesWatched < drop.reqTime && curDrop.name == "") {
                    curDrop = drop;
                    break;
                }
            }
            if (curDrop.name == "" && sortedDrops.length > 0) {
                curDrop = sortedDrops[sortedDrops.length - 1];
            }
            if (message.data.activeStream.campaigns !== undefined) {
                for (const c of message.data.activeStream.campaigns) {
                    for (const d of c.items) {
                        totalDrops++;
                        if (d.reqTime <= c.minutesWatched) claimedDrops++;
                    }
                }
            } else if (message.data.activeStream.campaigns === undefined) {
                for (const d of message.data.activeStream.campaign.items) {
                    totalDrops++;
                    if (d.reqTime <= message.data.activeStream.campaign.minutesWatched) claimedDrops++
                }
            }
            if (curDrop.picture) {
                let img = new Image();
                img.onload = function() {
                    if (this.naturalWidth && this.naturalHeight) {
                        $(".current").css("aspect-ratio", `${this.naturalWidth} / ${this.naturalHeight}`);
                    }
                };
                img.src = curDrop.picture;
                $(".current").css("background-image", `url(${curDrop.picture})`);
                $(".current").attr("title", curDrop.name);
                $(".current").removeClass("wopac");
            } else {
                $(".current").css("aspect-ratio", "1 / 1");
            }
            let isAllDone = currentCampaign.minutesNeeded > 0 && currentCampaign.minutesWatched >= currentCampaign.minutesNeeded;
            let progress = isAllDone ? 100 : Math.min(100, Math.max(0, Math.floor((currentCampaign.minutesWatched / curDrop.reqTime) * 100)));
            let minutes = isAllDone ? 0 : Math.max(0, Math.floor(curDrop.reqTime - currentCampaign.minutesWatched));
            $(".current .progressbar").css("display", "block")
            $(".current .progressbar div").css("width", `${progress}%`);
            $(".current .progressbar div").html(`${progress}%`)
            $(".current .progressbar div").attr("title", i18n.t("minutes_remaining", { m: minutes }))
            curDropsGame = message.data.activeStream.campaign.game.name;
            let curWatching = message.data.activeStream.campaign.curWatching;
            let noLiveText = i18n.t("no_live_stream");
            let streamerText = (message.data.activeStream.campaign.status === "waiting" || !curWatching)
                ? noLiveText
                : curWatching;

            let streamerHtml = (streamerText !== noLiveText)
                ? `<a class="dropInfoStreamer" href="https://twitch.tv/${streamerText}" target="_blank" title="Watch ${streamerText}">${streamerText}</a>`
                : `<span class="dropInfoStreamer" style="color:var(--tw-text-muted); cursor:default;">${streamerText}</span>`;

            $("#dropGame").html(
                `<span class="dropInfoGame" title="${curDropsGame}">${curDropsGame}</span>` +
                `<span class="dropInfoSep">|</span>` +
                `${streamerHtml}` +
                `<span class="dropInfoSep">|</span>` +
                `<span class="dropInfoCount">${claimedDrops}/${totalDrops} ${i18n.t("drops_word")}</span>`
            );

            $(".dropInfoStreamer").off("click").on("click", (e) => {
                let href = $(e.currentTarget).attr("href");
                if (href) {
                    chrome.tabs.create({ url: href, active: true });
                }
            });

            //Drops Page
            if (message.data.activeStream.campaign != null) {
                let injectHTML = "";
                let rawCamps = message.data.activeStream.campaigns || (message.data.activeStream.campaign ? [message.data.activeStream.campaign] : []);
                let camps = [...rawCamps];
                let curCampObj = message.data.activeStream.campaigns != null && message.data.activeStream.campaign.onCamp != null
                    ? message.data.activeStream.campaigns[message.data.activeStream.campaign.onCamp]
                    : message.data.activeStream.campaign;

                camps.sort((a, b) => {
                    let aCompleted = a.minutesNeeded > 0 && a.minutesWatched >= a.minutesNeeded;
                    let bCompleted = b.minutesNeeded > 0 && b.minutesWatched >= b.minutesNeeded;
                    if (aCompleted !== bCompleted) {
                        return aCompleted ? 1 : -1;
                    }
                    let aPrio = a.priority || 999;
                    let bPrio = b.priority || 999;
                    return aPrio - bPrio;
                });

                for (const c of camps) {
                    let streamsText = i18n.t("streams_label") + " ";
                    if (c.streamers.length == 0) {
                        streamsText = i18n.t("generic_drop");
                    } else {
                        c.streamers.forEach((v, i) => {
                            if (i < 3) {
                                streamsText += `<a href="https://twitch.tv/${v}">${v}</a>, `;
                            }
                        });
                        if (c.streamers.length > 3) {
                            streamsText += i18n.t("and_more", { n: c.streamers.length - 3 });
                        }
                        if (c.streamers.length <= 3) {
                            streamsText = streamsText.substring(0, streamsText.length - 2);
                        }
                    }
                    let dropItems = "";
                    c.items.sort((a, b) => a.reqTime - b.reqTime);
                    for (const i of c.items) {
                        let progress = Math.floor((c.minutesWatched / i.reqTime) * 100);
                        if (progress > 100) progress = 100;
                        let minutes = Math.floor(i.reqTime - c.minutesWatched);
                        if (minutes < 1) minutes = 0;
                        dropItems += `<div class="dropBoxCont"><div class="dropBox" style="background-image:url(${i.picture})" title="${i.name}"><div class="progressbar" style="display: block;"><div style="width:${progress}%" title="${i18n.t("minutes_remaining", { m: minutes })}">${progress}%</div></div></div></div>`;
                    }
                    let dataCamp = "";
                    if (c.streamers.length == 0)
                        dataCamp = "gen";
                    else
                        dataCamp = c.streamers[0];

                    let priority = c.priority || (camps.indexOf(c) + 1);
                    let isCurrent = curCampObj && curCampObj.id === c.id;
                    let isCompleted = c.minutesNeeded > 0 && c.minutesWatched >= c.minutesNeeded;
                    let badgeHtml = isCompleted ? 
                        `<span class="dropStatusBadge completed">${i18n.t("badge_completed")}</span>` : 
                        (isCurrent ? `<span class="dropStatusBadge active">${i18n.t("badge_earning")}</span>` : `<span class="dropStatusBadge queued">${i18n.t("badge_queued")}</span>`);

                    let priorityOptions = "";
                    for (let p = 1; p <= camps.length; p++) {
                        let label = `${p}`;
                        if (p === 1 && camps.length > 1) {
                            label = `${p} (${i18n.t("priority_max")})`;
                        } else if (p === camps.length && camps.length > 1) {
                            label = `${p} (${i18n.t("priority_min")})`;
                        }
                        priorityOptions += `<option value="${p}" ${priority == p ? "selected" : ""}>${label}</option>`;
                    }

                    let headerHtml = camps.length > 1 ? `
                        <div class="dropHeader">
                            <div class="dropPriorityCont" title="${i18n.t("priority_tooltip")}">
                                <span>${i18n.t("priority_label")}</span>
                                <select class="dropPrioritySelect" data-campid="${c.id}" data-current="${priority}">
                                    ${priorityOptions}
                                </select>
                            </div>
                            ${badgeHtml}
                        </div>
                    ` : `
                        <div class="dropHeader">
                            <div class="dropPriorityCont" title="${i18n.t("priority_tooltip")}">
                                <span>${i18n.t("priority_single")}</span>
                            </div>
                            ${badgeHtml}
                        </div>
                    `;

                    injectHTML += `
                        <div class="drop ${isCurrent ? "current-earning" : ""} ${isCompleted ? "is-completed" : ""}">
                            ${headerHtml}
                            <div class="drops">${dropItems}</div>
                            ${camps.length > 1 && !isCurrent && !isCompleted ? `<div class="divBtn" data-camp="${dataCamp}">${i18n.t("switch_to_drops")}</div>` : ""}
                            <p>${streamsText}</p>
                        </div>
                    `;
                }
                $("#allDrops").html(injectHTML);
            }
            $(".drop .divBtn").on("click", ((e) => {
                chrome.runtime.sendMessage({ type: "p:changeToStream", data: $(e.target).data("camp") })
            }))
            $(".drop a").on("click", ((e) => {
                chrome.tabs.create({ url: $(e.target).attr("href"), active: true });
            }));
            $(".dropPrioritySelect").off("change").on("change", function(e) {
                let $this = $(this);
                let campId = $this.data("campid");
                let newPriority = parseInt($this.val(), 10);
                let oldPriority = parseInt($this.attr("data-current") || $this.data("current"), 10);

                if (newPriority === oldPriority) return;

                // Immediately swap with the other select that currently has newPriority
                let $other = $(".dropPrioritySelect").not($this).filter(function() {
                    return parseInt($(this).val(), 10) === newPriority;
                });

                if ($other.length > 0) {
                    $other.val(oldPriority);
                    $other.attr("data-current", oldPriority);
                    $other.data("current", oldPriority);
                }
                $this.attr("data-current", newPriority);
                $this.data("current", newPriority);

                chrome.runtime.sendMessage({
                    type: "p:setDropPriority",
                    data: {
                        campId: campId,
                        priority: newPriority
                    }
                });
            });
        } else if (message.type == "setAutoDropGames") {
            let autoDropGamesHtml = "";
            message.data.allConnected.sort((a, b) => a.localeCompare(b))
            for (var i in message.data.allConnected) {
                autoDropGamesHtml += `<div class="setting"><div class="left"><label class="switch"><input class="autoDropToggle" type="checkbox" data-game="${message.data.allConnected[i]}" ${message.data.enabled.includes(message.data.allConnected[i]) ? "checked" : ""}><span class="slider"></span></label></div><div class="right">${message.data.allConnected[i]}</div></div>`
            }
            $("#autoDropBody").html(autoDropGamesHtml)
            $(".autoDropToggle").on("change", (ev) => {
                chrome.runtime.sendMessage({ type: "toggleAutoDropGame", data: [$(ev.target).data("game"), $(ev.target).prop("checked")] })
            })
        }
    })
})

function createAutoDropsPage() {
    if (settings && settings.autoGetToken) {
        $("#autoDropsPage").html(`<h2>TWICH DROP COLLECTOR</h2><p class="pageDescription adTitle">${i18n.t("auto_drops_desc")}</p><div id="autoDropBody"></div>`)
        chrome.runtime.sendMessage({ type: "getAutoDropGames" });
    } else {
        $("#autoDropsPage").html(`<h2>TWICH DROP COLLECTOR</h2><p class="pageDescription adTitle">${i18n.t("auto_drops_no_token")}</p>`)
    }
}

function createDropdownEv() {
    $(".dropDown").on("click", (ev) => {
        if ($(ev.currentTarget).hasClass("dropDown") && ev.target.localName == "li" || $(ev.currentTarget).hasClass("dropDown") && ev.target.localName == "ul") {
            if ($(ev.currentTarget).hasClass("dropDown") && ev.target.localName == "ul") return;
            let selVal = ev.target.innerHTML;
            $(ev.currentTarget).find(".selectedGame").html(selVal);
            switch (ev.currentTarget.id) {
                case "viewData":
                    let splitVal = selVal.split("_");
                    chrome.storage[splitVal[0]].get(splitVal[1]).then(val => {
                        console.log(val[splitVal[1]]);
                        $(ev.currentTarget.parentElement).find(".outputText").html(`${splitVal[1]} logged to console!`);
                    })
                    break;
            }
            $(".selectDropdown").addClass("hidden");
            $(".dropDown").attr("aria-expanded", false);
            dropdownOpen = false;
        } else {
            if (dropdownOpen) {
                $(".selectDropdown").addClass("hidden");
                $(".dropDown").attr("aria-expanded", false);
                dropdownOpen = false;
            } else {
                $(ev.currentTarget).find(".selectDropdown").removeClass("hidden");
                $(".dropDown").attr("aria-expanded", true);
                dropdownOpen = true;
            }
        }
    })
}

function changePage(page) {
    $("#main").children().css("display", "none");
    if (page === "mainPage") {
        $("#mainPage").css("display", "flex");
    } else {
        $(`#${page}`).css("display", "block");
    }
}

function formatDate(time) {
    let date = new Date(time);
    let ampm = date.getHours() >= 12 ? "pm" : "am";
    let dateStr = `${date.getMonth() + 1}/${date.getDate()}/${("" + date.getFullYear()).slice(2)} at ${date.getHours() > 12 ? date.getHours() - 12 : date.getHours() == 0 ? 12 : date.getHours()}:${("0" + date.getMinutes()).slice(-2)} ${ampm}`;
    return dateStr;
}