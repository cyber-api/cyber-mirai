const assets = require('@miraipr0ject/assets');
const crypto = require('crypto');
const os = require("os");
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

// --- CyberBot API System ---
class cyberBotApis {
    constructor() {
        // TODO: replace mahbub-shaon with your real API host.
        this.baseURL = "https://mahbub-shaon.cyberbot.top";
    }

    get exampleEndpoint() {
        return `${this.baseURL}/api/example`;
    }

    get userInfo() {
        return `${this.baseURL}/api/user/info`;
    }

    get download() {
        return `${this.baseURL}/api/download`;
    }

    get search() {
        return `${this.baseURL}/api/search`;
    }
}

module.exports.cyberBotApis = cyberBotApis;

// --- Mirai Original Functions ---

module.exports.getYoutube = async function(t, e, i) {
    require("ytdl-core");
    if ("search" == e) {
      const e = require("youtube-search-api");
      return t ? a = (await e.GetListByKeyword(t, !1, 6)).items : console.log("Missing data")
    }
    if ("getLink" == e) {
      var a = (await axios("https://aiovideodl.ml/wp-json/aio-dl/video-data/", {
        method: 'POST',
        data: {
          url: "https://www.youtube.com/watch?v=" + t
        }
      })).data;
        return "video" == i ? {
          title: a.title,
          duration: a.duration,
          download: {
            SD: a.medias[1].url,
            HD: a.medias[2].url
          }
        } : "audio" == i ? {
          title: a.title,
          duration: a.duration,
          download: a.medias[3].url
        } : void 0
      }
};

module.exports.throwError = function (command, threadID, messageID) {
	// Thread data is keyed inconsistently (string in some paths, number in
	// others); try both before falling back so a custom prefix is not ignored.
	const threadData = (global.data && global.data.threadData) || new Map();
	const threadSetting = threadData.get(threadID)
		|| threadData.get(String(threadID))
		|| threadData.get(parseInt(threadID, 10))
		|| {};
	const prefix = Object.prototype.hasOwnProperty.call(threadSetting, "PREFIX")
		? threadSetting.PREFIX
		: global.config.PREFIX;
	return global.client.api.sendMessage(
		global.getText("utils", "throwError", prefix, command),
		threadID,
		messageID
	);
}

module.exports.cleanAnilistHTML = function (text) {
	text = text
		.replace('<br>', '\n')
		.replace(/<\/?(i|em)>/g, '*')
		.replace(/<\/?b>/g, '**')
		.replace(/~!|!~/g, '||')
		.replace("&amp;", "&")
		.replace("&lt;", "<")
		.replace("&gt;", ">")
		.replace("&quot;", '"')
		.replace("&#039;", "'");
	return text;
}

module.exports.downloadFile = async function (url, destination) {
	const { createWriteStream } = require('fs');
	const fs = require('fs-extra');

	if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
		throw new Error("downloadFile: only http(s) URLs are allowed");
	}
	if (typeof destination !== "string" || !destination.trim()) {
		throw new Error("downloadFile: a destination path is required");
	}

	const root = path.resolve(process.cwd());
	const target = path.resolve(destination);
	const relative = path.relative(root, target);
	// Keep downloads inside the project; refuse traversal and executable-ish
	// replacements so a remote URL cannot overwrite bot code or credentials.
	if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
		throw new Error("downloadFile: destination is outside the project directory");
	}
	if (/(^|[\\/])(appstate\.json|config\.json|package\.json)$/i.test(target)
		|| /\.(js|cjs|mjs|sqlite|db)$/i.test(target)) {
		throw new Error("downloadFile: refusing to overwrite a sensitive file");
	}

	const MAX_BYTES = 25 * 1024 * 1024;
	const TIMEOUT_MS = 30 * 1000;

	fs.ensureDirSync(path.dirname(target));
	const partial = target + ".part";

	const response = await axios(url, {
		method: 'GET',
		responseType: 'stream',
		timeout: TIMEOUT_MS,
		maxContentLength: MAX_BYTES,
		maxBodyLength: MAX_BYTES,
		maxRedirects: 3,
	});

	const declaredLength = Number(response.headers && response.headers["content-length"]);
	if (Number.isFinite(declaredLength) && declaredLength > MAX_BYTES) {
		throw new Error("downloadFile: file exceeds the size limit");
	}

	const writer = createWriteStream(partial, { mode: 0o600 });
	let received = 0;

	return new Promise((resolve, reject) => {
		let settled = false;
		const fail = async (error) => {
			if (settled) return;
			settled = true;
			response.data.destroy();
			writer.destroy();
			try { await fs.remove(partial); } catch (cleanupError) { /* ignore */ }
			reject(error);
		};

		response.data.on("data", (chunk) => {
			received += chunk.length;
			if (received > MAX_BYTES) fail(new Error("downloadFile: file exceeds the size limit"));
		});
		response.data.on("error", fail);
		writer.on('error', fail);
		writer.on('finish', async () => {
			if (settled) return;
			settled = true;
			try {
				await fs.move(partial, target, { overwrite: true });
				resolve();
			} catch (error) {
				reject(error);
			}
		});

		response.data.pipe(writer);
	});
};

module.exports.getContent = async function(url) {
	try {
		const response = await axios(url, {
			method: 'GET',
			timeout: 30 * 1000,
			maxContentLength: 10 * 1024 * 1024,
			maxBodyLength: 10 * 1024 * 1024,
			maxRedirects: 3,
		});
		return response;
	} catch (e) {
		// Never swallow with `console.log(e)` (undefined return): callers need to
		// see the failure and the log must go through redaction.
		require("./log.js").warn("getContent failed: " + (e && e.message ? e.message : e));
		return null;
	}
};

module.exports.randomString = function (length) {
	var result           = '';
	var characters       = 'ABCDKCCzwKyY9rmBJGu48FrkNMro4AWtCkc1flmnopqrstuvwxyz';
	var charactersLength = characters.length || 5;
	for ( var i = 0; i < length; i++ ) result += characters.charAt(Math.floor(Math.random() * charactersLength));
	return result;
}

module.exports.assets = {
	async font (name) {
		if (!assets.font.loaded) await assets.font.load();
		return assets.font.get(name);
	},
	async image (name) {
		if (!assets.image.loaded) await assets.image.load();
		return assets.image.get(name);
	},
	async data (name) {
		if (!assets.data.loaded) await assets.data.load();
		return assets.data.get(name);
	}
}

module.exports.AES = {
	encrypt (cryptKey, crpytIv, plainData) {
		var encipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(cryptKey), Buffer.from(crpytIv));
        var encrypted = encipher.update(plainData);
		encrypted = Buffer.concat([encrypted, encipher.final()]);
		return encrypted.toString('hex');
	},
	decrypt (cryptKey, cryptIv, encrypted) {
		encrypted = Buffer.from(encrypted, "hex");
		var decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(cryptKey), Buffer.from(cryptIv, 'binary'));
		var decrypted = decipher.update(encrypted);
	
		decrypted = Buffer.concat([decrypted, decipher.final()]);
	
		return String(decrypted);
	},
	makeIv () { return Buffer.from(crypto.randomBytes(16)).toString('hex').slice(0, 16); }
}

module.exports.homeDir = function () {
	var returnHome, typeSystem;
	const home = process.env["HOME"];
	const user = process.env["LOGNAME"] || process.env["USER"] || process.env["LNAME"] || process.env["USERNAME"];

	switch (process.platform) {
		case "win32": {
			returnHome = process.env.USERPROFILE || process.env.HOMEDRIVE + process.env.HOMEPATH || home || null;
			typeSystem = "win32"
			break;
		}
		case "darwin": {
			returnHome = home || (user ? '/Users/' + user : null);
			typeSystem = "darwin";
			break;
		}
		case "linux": {
			returnHome =  home || (process.getuid() === 0 ? '/root' : (user ? '/home/' + user : null));
			typeSystem = "linux"
			break;
		}
		default: {
			returnHome = home || null;
			typeSystem = "unknow"
			break;
		}
	}

	return [typeof os.homedir === 'function' ? os.homedir() : returnHome, typeSystem];
}

// --- Goat Bot Migrated Functions ---

module.exports.getStreamFromURL = async function (url = "", pathName = "", options = {}) {
    try {
        if (!url || typeof url !== "string")
            throw new Error(`The first argument (url) must be a string`);
        const response = await axios(url, {
            method: "GET",
            responseType: "stream",
            ...options
        });
        if (!pathName)
            pathName = Math.random().toString(36).substring(7) + (response.headers["content-type"] ? '.' + (response.headers["content-type"].split('/')[1] || 'png') : ".png");
        response.data.path = pathName;
        return response.data;
    }
    catch (err) {
        throw err;
    }
};

module.exports.isAdmin = function (senderID) {
    if (!senderID) return false;
    const sender = String(senderID);
    // includes() on the original arrays keeps the remote-admin Proxy working.
    const isBot = Array.isArray(global.config.ADMINBOT) && global.config.ADMINBOT.includes(sender);
    const isOwner = Array.isArray(global.config.NDH) && global.config.NDH.includes(sender);
    return isBot || isOwner;
};

module.exports.getRole = function (threadData, senderID) {
    if (!senderID) return 0;
    if (this.isAdmin(senderID)) return 2;
    const adminBox = threadData && Array.isArray(threadData.adminIDs) ? threadData.adminIDs : [];
    // adminIDs entries are objects ({id}); compare as strings.
    return adminBox.some((item) => String(item && item.id != null ? item.id : item) === String(senderID)) ? 1 : 0;
};
