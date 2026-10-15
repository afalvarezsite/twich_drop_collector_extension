let tempVar = [];

export class Client {

    constructor(options) {
        this.clientId = options?.clientId ?? "kimne78kx3ncx6brgo4mv6wki5h1ko";
        this.oauthToken = options?.oauthToken;
        this.userId = options?.userId;
        this.deviceId = options?.deviceId;
        this.uuid = options?.uuid

        this.integrity = {
            token: "",
            expiration: 0,
            request_id: ""
        }

        this.getIntegFromStorage();

        if (!this.userId) {
            this.getUserId();
        }
    }

    async postWraper(data, headers) {
        let post = await fetch("https://gql.twitch.tv/gql", {
            headers: headers,
            method: "POST",
            body: JSON.stringify(data)
        }).then((res) => {
            return res.json();
        })
        if (!Array.isArray(post)) {
            if ("error" in post) {
                if ("message" in post) {
                    throw new Error(`API Error: ${post.message}\n${JSON.stringify(headers)}`)
                } else {
                    throw new Error(`API Error: ${post}`);
                }
            }
            console.log(post);
            if ("errors" in post) {
                for (const error of post["errors"]) {
                    if ("message" in error) {
                        const messages = ["service timeout", "service error", "failed integrity check"];

                        if (messages.includes(error.message)) {
                            console.error(`API error: ${error.message}`);
                        }
                    }
                }

                console.error(`API error: ${JSON.stringify(post.errors)}`);
                console.log(post)
            }
        }
        return Array.isArray(post) ? post : post.data;
    }

    async post(data) {
        console.log(data);
        return this.postWraper(data, {
            "Content-Type": "text/plain;charset=UTF-8",
            "Client-Id": this.clientId
        });
    }

    async postAuthorized(data, headers) {
        if (!headers) headers = {}
        headers["Content-Type"] = "text/plain;charset=UTF-8";
        headers["Client-Id"] = this.clientId;
        headers["Authorization"] = `OAuth ${this.oauthToken}`;
        if (this.integrity.token !== undefined && this.integrity.token != "") {
            headers["Client-Integrity"] = this.integrity.token;
            headers["X-Device-Id"] = this.deviceId
        } else {
            console.error("Token is not saved!");
        }
        return await this.postWraper(data, headers)
    }

    async postIntegrity() {
        console.log("post integ");
        if (!this.deviceId) return console.error("Missing device Id");
        let headers = {
            "Client-Id": "ue6666qo983tsx6so1t0vnawi233wa",
            "Authorization": `OAuth ${this.oauthToken}`,
            "X-Device-Id": this.deviceId,
            "Client-Session-Id": this.uuid,
            "Client-Version": "da69d5f2-ac48-4169-9574-48fee4a96513",
            "User-Agent": "Mozilla/5.0 (Linux; Android 7.1; Smart Box C1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
        }
        console.log(headers)
        let post = await fetch("https://gql.twitch.tv/integrity", {
            headers,
            method: "POST"
        }).then((res) => {
            console.log(res.headers);
            return res.json();
        })
        console.log(`Integ response: ${JSON.stringify(post)}`);
        return post;
    }

    async ensureIntegrity() {
        console.log(`EXP: ${this.integrity.expiration} NOW: ${new Date().getTime()}`);
        if (this.integrity && this.integrity.expiration > new Date().getTime()) {
            console.log("integ still valid");
            return true;
        } else {
            return false;
        }
    }

    async getIntegFromStorage() {
        const data = await chrome.storage.sync.get(["twitchInteg"]);
        console.log(data);
        if (data.twitchInteg.token !== undefined)
            this.integrity = data.twitchInteg;
        return this.integrity;
    }

    async setInteg(integ) {
        this.integrity = integ;
        console.log("Updated integrity");
        chrome.storage.sync.set({ twitchInteg: integ });
    }

    async updateUserInfo(options) {
        console.log(options)
        this.clientId = options?.clientId ?? this.clientId;
        this.oauthToken = options?.oauthToken ?? this.oauthToken;
        this.deviceId = options?.deviceId ?? this.deviceId;
        this.userId = options?.userId ?? this.userId;
        this.uuid = options?.uuid ?? this.uuid;
        console.log(this)
    }

    async getUserId() {
        await this.autoDetectUserId();
    }

    async autoDetectUserId() {
        let data = await this.postAuthorized({
            "operationName": "CoreActionsCurrentUser",
            "extensions": {
                "persistedQuery": {
                    "version": 1,
                    "sha256Hash": "6b5b63a013cf66a995d61f71a508ab5c8e4473350c5d4136f846ba65e8101e95"
                }
            }
        })
        this.userId = data.currentUser.id;
        chrome.storage.sync.set({ userId: data.currentUser.id });
        return this.userId;
    }

    async getGameIdFromName(name) {
        const data = await this.post({
            "operationName": "DirectoryRoot_Directory",
            "variables": {
                "name": name
            },
            "extensions": {
                "persistedQuery": {
                    "version": 1,
                    "sha256Hash": "99d3c9b5ceaadb36f77c8bc2d576a737c83d2e9f06c4d6190cf2c6b4f214cccb"
                }
            }
        })
        const game = data.game;
        if (game) {
            return game.id
        }
        return null;
    }

    async getDropCampaigns() {
        try {
            const data = await this.postAuthorized({
                "operationName": "ViewerDropsDashboard",
                "variables": {
                    "fetchRewardCampaigns": true
                },
                "extensions": {
                    "persistedQuery": {
                        "version": 1,
                        "sha256Hash": "69750554e0a81492f2d343558f84bdf3e324767650a2dbb6e79a3c629b4548cf"
                    }
                }
            });
            if (!data || !data.currentUser || !Array.isArray(data.currentUser.dropCampaigns)) {
                return "noclient";
            }
            return data.currentUser.dropCampaigns;
        } catch (error) {
            console.error(`Error in function getDropCampaigns!`, error);
            return "noclient";
        }
    }

    async getConnectedGames() {
        try {
            const campaigns = await this.getDropCampaigns();
            if (campaigns == "noclient" || !Array.isArray(campaigns) || this.integrity.expiration < new Date().getTime())
                return "noclient";
            let games = [];
            for (const campaign of campaigns) {
                if (campaign && campaign.self && campaign.self.isAccountConnected && campaign.status != "EXPIRED") {
                    games.push(campaign);
                }
            }
            return games;
        } catch (error) {
            console.error(`Error in function getConnectedGames!`, error);
            return "noclient";
        }
    }

    /**
     * Get drop campaign details
     * @param {string} dropId 
     * @returns 
     */

    async getDropCampaignDetails(dropId) {
        if (typeof dropId == "string") {
            const data = await this.postAuthorized({
                "operationName": "DropCampaignDetails",
                "extensions": {
                    "persistedQuery": {
                        "version": 1,
                        "sha256Hash": "039277bf98f3130929262cc7c6efd9c141ca3749cb6dca442fc8ead9a53f77c1"
                    }
                },
                "variables": {
                    "dropID": dropId,
                    "channelLogin": this.userId
                }
            });
            try {
                return data.user.dropCampaign
            } catch (error) {
                console.error(`Error in function getDropCampaignDetails! Response: ${JSON.stringify(data)}`);
                throw error;
            }
        } else {
            let dataAry = [];
            for (const camp of dropId) {
                dataAry.push({
                    "operationName": "DropCampaignDetails",
                    "extensions": {
                        "persistedQuery": {
                            "version": 1,
                            "sha256Hash": "039277bf98f3130929262cc7c6efd9c141ca3749cb6dca442fc8ead9a53f77c1"
                        }
                    },
                    "variables": {
                        "dropID": camp,
                        "channelLogin": this.userId
                    }
                });
            }
            let data = await this.postAuthorized(dataAry);
            return data;
        }
    }

    async getInventory() {
        const data = await this.postAuthorized({
            "operationName": "Inventory",
            "extensions": {
                "persistedQuery": {
                    "version": 1,
                    "sha256Hash": "d86775d0ef16a63a33ad52e80eaff963b2d5b72fada7c991504a57496e1d8e4b"
                }
            }
        });
        try {
            return data.currentUser.inventory;
        } catch (error) {
            console.error(`Error in function getInventory! Response: ${JSON.stringify(data)}`);
            throw error;
        }
    }

    async getInventoryWithData() {
        const data = await this.postAuthorized({
            "operationName": "Inventory",
            "variables": {
                "fetchRewardCampaigns": true
            },
            "extensions": {
                "persistedQuery": {
                    "version": 1,
                    "sha256Hash": "e7197a7e03be13e423118005966d097a2f44045b3642bfdb70820e01c8129fd6"
                }
            }
        });
        try {
            return data.currentUser.inventory;
        } catch (error) {
            console.error(`Error in function getInventory! Response: ${JSON.stringify(data)}`);
            throw error;
        }
    }

    async getActiveStreams(gameName, slug) {
        const data = await this.post({
            "operationName": "DirectoryPage_Game",
            "variables": {
                "game": gameName.toLowerCase(),
                "slug": slug == null ? gameName.toLowerCase().replaceAll(" ", "-") : slug,
                "options": {
                    "includeRestricted": [
                        "SUB_ONLY_LIVE"
                    ],
                    "sort": "VIEWER_COUNT",
                    "recommendationsContext": {
                        "platform": "web"
                    },
                    "requestID": "JIRA-VXP-2397", // TODO: what is this for???
                    "tags": ["c2542d6d-cd10-4532-919b-3d19f30a768b"]
                },
                "sortTypeIsRecency": false,
                "includeCostreaming": true,
                "limit": 30
            },
            "extensions": {
                "persistedQuery": {
                    "version": 1,
                    "sha256Hash": "76cb069d835b8a02914c08dc42c421d0dafda8af5b113a3f19141824b901402f"
                }
            }
        })

        const streams = data.game.streams;
        if (streams == null) return [];
        const result = [];
        for (const stream of streams.edges) {
            result.push(stream.node);
        }
        return result;
    }

    async claimDropReward(dropId) {
        if (dropId == null) return null
        return await this.postAuthorized({
            "operationName": "DropsPage_ClaimDropRewards",
            "variables": {
                "input": {
                    "dropInstanceID": dropId
                }
            },
            "extensions": {
                "persistedQuery": {
                    "version": 1,
                    "sha256Hash": "a455deea71bdc9015b78eb49f4acfbce8baa7ccbedd28e549bb025bd0f751930"
                }
            }
        })
    }

    async claimChannelPoints(claimId, channelId) {
        const data = await this.postAuthorized({
            "operationName": "ClaimCommunityPoints",
            "variables": {
                "input": {
                    "channelID": channelId,
                    "claimID": claimId
                }
            },
            "extensions": {
                "persistedQuery": {
                    "version": 1,
                    "sha256Hash": "46aaeebe02c99afdf4fc97c7c0cba964124bf6b0af229395f1f6d1feed05b3d0"
                }
            }
        })
        console.log(data);
        if (data.claimCommunityPoints.error == null)
            return { success: true, points: data.claimCommunityPoints.claim.pointsEarnedTotal };
        else
            return false
    }

    async getStream(username) {
        if (typeof username == "string") {
            const data = await this.post({
                "operationName": "ChannelShell",
                "variables": {
                    "login": username
                },
                "extensions": {
                    "persistedQuery": {
                        "version": 1,
                        "sha256Hash": "580ab410bcd0c1ad194224957ae2241e5d252b2c5173d8e0cce9d32d5bb14efe"
                    }
                }
            });
            return data.userOrError.stream;
        } else {
            let dataAry = [];
            for (const user of username) {
                dataAry.push({
                    "operationName": "ChannelShell",
                    "variables": {
                        "login": user
                    },
                    "extensions": {
                        "persistedQuery": {
                            "version": 1,
                            "sha256Hash": "580ab410bcd0c1ad194224957ae2241e5d252b2c5173d8e0cce9d32d5bb14efe"
                        }
                    }
                });
            }
            let data = await this.post(dataAry);
            return data;
        }

    }

    async getStreamMetadata(channelLogin) {
        if (typeof channelLogin == "string") {
            const data = await this.postAuthorized({
                "operationName": "StreamMetadata",
                "variables": {
                    "channelLogin": channelLogin
                },
                "extensions": {
                    "persistedQuery": {
                        "version": 1,
                        "sha256Hash": "ad022ca32220d5523d03a23cbcb5beaa1e0999889c1f8f78f9f2520dafb5cae6"
                    }
                }
            });
            return data.user;
        } else {
            let dataAry = [];
            for (const user of channelLogin) {
                dataAry.push({
                    "operationName": "StreamMetadata",
                    "variables": {
                        "channelLogin": user
                    },
                    "extensions": {
                        "persistedQuery": {
                            "version": 1,
                            "sha256Hash": "ad022ca32220d5523d03a23cbcb5beaa1e0999889c1f8f78f9f2520dafb5cae6"
                        }
                    }
                });
            }
            let data = await this.postAuthorized(dataAry);
            tempVar.push(data);
            return data;
        }
    }

    async getStreamTags(channelLogin) {
        const data = await this.post({
            "operationName": "RealtimeStreamTagList",
            "variables": {
                "channelLogin": channelLogin
            },
            "extensions": {
                "persistedQuery": {
                    "version": 1,
                    "sha256Hash": "a4747cac9d8e8bf6cf80969f6da6363ca1bdbd80fe136797e71504eb404313fd"
                }
            }
        });
        return data.user;
    }

    async getAvailableCampaigns(channelId) {
        const data = await this.postAuthorized({
            "operationName": "DropsHighlightService_AvailableDrops",
            "variables": {
                "channelID": channelId
            },
            "extensions": {
                "persistedQuery": {
                    "version": 1,
                    "sha256Hash": "e589e213f16d9b17c6f0a8ccd18bdd6a8a6b78bc9db67a75efd43793884ff4e5"
                }
            }
        });
        return data.channel.viewerDropCampaigns;
    }

    async getUserLoginFromId(id) {
        const data = this.post({
            "operationName": "ChannelLeaderboards",
            "variables": {
                "first": 1,
                "channelID": id
            },
            "extensions": {
                "persistedQuery": {
                    "version": 1,
                    "sha256Hash": "226807519d6ef966dc5a74e8d5dbad3d4d1a46b135511f1dd69e4f0b417aaf9c"
                }
            }
        });
        return data.user.login;
    }

    async getUserNotifications() {
        const data = await this.postAuthorized({
            "operationName": "OnsiteNotifications_ListNotifications",
            "variables": {
                "shouldLoadLastBroadcast": false,
                "limit": 100,
                "cursor": "",
                "language": "en",
                "displayType": "VIEWER"
            }, "extensions": {
                "persistedQuery": {
                    "version": 1,
                    "sha256Hash": "65bdc7f01ed3082f4382a154d190e23ad5459771c61318265cfdb59f63aad492"
                }
            }
        });
        return data.currentUser.notifications.edges;
    }

    async getChannelWithDrops(game, campaignId, slug) {
        let streams = await this.getActiveStreams(game, slug);
        let campaignDetails = await this.getDropCampaignDetails(campaignId)
        if (campaignDetails.allow.channels != null) {
            for (const stream of streams) {
                let potStream = campaignDetails.allow.channels.find(s => s.name == stream.broadcaster.login)
                if (potStream !== undefined) {
                    console.log(potStream)
                    return stream
                } else return "nostream";
            }
        } else {
            for (const stream of streams) {
                let dropsEn = false;
                for (const tag of stream.freeformTags) {
                    if (tag.name == "DropsEnabled") dropsEn = true;
                }
                if (dropsEn)
                    return stream;
            }
            return "nostream"
        }
    }

    async getAllLiveForGame(game) {
        tempVar = [];
        let campaigns = await this.getDropCampaigns()
        campaigns = campaigns.filter(c => c.game.displayName == game && c.status == "ACTIVE");
        let campAry = []
        for (const camp of campaigns) {
            campAry.push(camp.id);
        }
        let campDeets = await this.getDropCampaignDetails(campAry);
        let allStreams = [];
        for (const campDeet of campDeets) {
            if (campDeet.data.user.dropCampaign.allow != null && campDeet.data.user.dropCampaign.allow.channels != null) {
                for (const stream of campDeet.data.user.dropCampaign.allow.channels) {
                    allStreams.push(stream.name);
                }
            }
        }
        console.log(allStreams)
        let allStreamsSend = [];
        let allStreamsFinal = [];
        if (allStreams.length >= 25) {
            for (var i = 0; i < allStreams.length; i++) {
                allStreamsSend.push(allStreams[i]);
                if ((i + 1) % 25 == 0) {
                    console.log(allStreamsSend)
                    tempVar = await this.getStream(allStreamsSend);
                    console.log(tempVar)
                    allStreamsSend = [];
                    allStreamsFinal.push(tempVar);
                }
            }
        } else {
            tempVar = await this.getStream(allStreams);
            allStreamsFinal.push(tempVar)
        }
        allStreamsFinal = allStreamsFinal.flat(4).filter(s => s.data.userOrError.stream !== null);
        return allStreamsFinal;
    }

    async testingAPI() {
        let data = this.postWraper({
            "operationName": "Inventory",
            "extensions": {
                "persistedQuery": {
                    "version": 1,
                    "sha256Hash": "37fea486d6179047c41d0f549088a4c3a7dd60c05c70956a1490262f532dccd9"
                }
            }
        }, {
            "Content-Type": "text/plain;charset=UTF-8",
            "Client-Id": this.clientId,
            "Authorization": `OAuth ti2gj69a7f6nws7adna7rmga37xski`, //Valid Token ti2gj69a7f6nws7adna7rmga37xski
            "Client-Integrity": this.integrity.token,
            "X-Device-Id": this.deviceId
        });
        console.log(data);
    }
}

export function getInventoryDrop(dropId, inventory, campaignId) {
    const campaigns = inventory.dropCampaignsInProgress;
    if (campaigns == null) return null;
    for (const campaign of campaigns) {
        if (!campaignId || campaign.id === campaignId) {
            const drops = campaign.timeBasedDrops;
            for (const drop of drops) {
                if (drop.id === dropId) {
                    return drop;
                }
            }
        }
    }
    return null;
}

export function isDropCompleted(drop, inventory) {
    const dropCampaignsInProgress = inventory.dropCampaignsInProgress;
    if (dropCampaignsInProgress != null) {
        for (const campaign of dropCampaignsInProgress) {
            const timeBasedDrops = campaign.timeBasedDrops;
            if (timeBasedDrops) {
                for (const d of campaign.timeBasedDrops) {
                    if (d.id === drop.id) {
                        if (d.self.isClaimed) {
                            return true
                        }
                        return Date.now() > Date.parse(d.endAt);
                    }
                }
            }
        }
    }
    return false;
}