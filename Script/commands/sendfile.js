module.exports.config = {
	name: 'sendfile',
	version: '1.0.0',
	hasPermssion: 2,
	credits: '𝐂𝐘𝐁𝐄𝐑 ☢️_𖣘 -𝐁𝐎𝐓 ⚠️ 𝑻𝑬𝑨𝑴_ ☢️',
	description: '',
	commandCategory: 'Admin',
	usages: 'givefile',
	cooldowns: 0
};

const fs = require("fs-extra");
const path = require("path");
const os = require("os");

// Only direct children of Script/commands may be read. A symlink that points
// outside the directory is rejected as well.
function resolveCommandFile(input) {
	if (typeof input !== "string") return null;
	let name = input.trim();
	if (!name) return null;
	if (!name.endsWith(".js")) name += ".js";
	if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.js$/.test(name)) return null;

	const base = path.resolve(__dirname);
	const target = path.resolve(base, name);
	if (path.dirname(target) !== base) return null;

	try {
		const realBase = fs.realpathSync(base);
		const realTarget = fs.realpathSync(target);
		if (path.dirname(realTarget) !== realBase) return null;
		return realTarget;
	} catch (error) {
		return null;
	}
}

function copyToTemp(source) {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-sendfile-"));
	const tempFile = path.join(tempDir, path.basename(source, ".js") + ".txt");
	fs.copyFileSync(source, tempFile);
	return { tempFile, tempDir };
}

async function deliver(api, target, threadID, messageID, caption) {
	const { tempFile, tempDir } = copyToTemp(target);
	const cleanup = () => {
		try { fs.unlinkSync(tempFile); } catch (error) { /* ignore */ }
		try { fs.rmdirSync(tempDir); } catch (error) { /* ignore */ }
	};
	try {
		await api.sendMessage({
			body: caption,
			attachment: fs.createReadStream(tempFile)
		}, threadID, cleanup, messageID);
	} catch (error) {
		cleanup();
		throw error;
	}
}

function suggestFile(file) {
	const stringSimilarity = require('string-similarity');
	const available = fs.readdirSync(__dirname)
		.filter((entry) => entry.endsWith(".js"))
		.map((entry) => entry.replace(/\.js$/, ""));
	const checker = stringSimilarity.findBestMatch(String(file).replace(/\.js$/, ""), available);
	return checker.bestMatch.rating > 0 ? checker.bestMatch.target : undefined;
}

module.exports.run = async ({ args, api, event, Users }) => {
	const requested = args.join(" ").trim();
	if (!requested) return api.sendMessage('File name cannot be empty', event.threadID, event.messageID);

	const target = resolveCommandFile(requested);
	if (!target) {
		const suggestion = suggestFile(requested);
		if (!suggestion) return api.sendMessage('🔎 File not found: ' + requested, event.threadID, event.messageID);

		const isUser = event.type == "message_reply";
		let uid;
		let name;
		if (isUser) {
			uid = event.messageReply && event.messageReply.senderID;
			const data = uid ? await Users.getData(uid) : null;
			name = data && data.name ? data.name : String(uid || "");
		}

		return api.sendMessage('🔎 File not found: ' + requested + '\n🔎 The file is similar to: ' + suggestion + '.js\n» Drop your reaction in this message to give it.', event.threadID, (error, info) => {
			if (error || !info) return;
			global.client.handleReaction.push({
				type: isUser ? 'user' : 'thread',
				name: module.exports.config.name,
				author: String(event.senderID),
				messageID: info.messageID,
				file: suggestion,
				uid,
				namee: name,
				once: true,
				expiresAt: Date.now() + 10 * 60 * 1000
			});
		}, event.messageID);
	}

	if (event.type == "message_reply") {
		const uid = event.messageReply && event.messageReply.senderID;
		if (!uid) return api.sendMessage('Cannot find the user to send this file to.', event.threadID, event.messageID);
		const data = await Users.getData(uid);
		const name = data && data.name ? data.name : String(uid);

		await deliver(api, target, uid, undefined, '» File ' + path.basename(target) + ' here you are');
		return api.sendMessage('» Check your messages ' + name, event.threadID, (error) => {
			if (error) return api.sendMessage('» There was an error sending the file to ' + name, event.threadID, event.messageID);
		}, event.messageID);
	}

	return deliver(api, target, event.threadID, event.messageID, '» File ' + path.basename(target) + ' here you are');
};

module.exports.handleReaction = async ({ Users, api, event, handleReaction }) => {	const { file, author, type, uid, namee } = handleReaction || {};
	if (author == null || String(event.userID) !== String(author)) return;

	const target = resolveCommandFile(file);
	if (!target) return api.sendMessage('🔎 That file is no longer available.', event.threadID, event.messageID);

	try { api.unsendMessage(handleReaction.messageID); } catch (error) { /* ignore */ }

	if (type === "user" && uid) {
		await deliver(api, target, uid, undefined, '» File ' + path.basename(target) + ' here you are');
		return api.sendMessage('» Check your messages ' + (namee || uid), event.threadID, (error) => {
			if (error) return api.sendMessage('» There was an error sending the file to ' + (namee || uid), event.threadID, event.messageID);
		}, event.messageID);
	}

	return deliver(api, target, event.threadID, event.messageID, '» File ' + path.basename(target) + ' here you are');
};

module.exports._private = { resolveCommandFile, safeFilenameCheck: (name) => /^[A-Za-z0-9][A-Za-z0-9._-]*\.js$/.test(name) };
