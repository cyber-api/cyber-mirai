const { writeFileSync } = require("fs-extra");

module.exports.config = {
	name: "ignoreonlyad",
	version: "1.0.0",
	hasPermssion: 2,
	credits: "CYBER BOT TEAM",
	description: "Manage commands that are exempt from admin-only mode",
	commandCategory: "Admin",
	usages: "ignoreonlyad add <commandName> | del <commandName> | list",
	cooldowns: 2,
	dependencies: {
		"fs-extra": ""
	}
};

module.exports.languages = {
	en: {
		missingCommandNameToAdd: '⚠️ Please enter the command name you want to add to the ignore list.',
		missingCommandNameToDelete: '⚠️ Please enter the command name you want to remove from the ignore list.',
		commandNotFound: '❌ Command "%1" was not found in the bot command list.',
		commandAlreadyInList: '❌ Command "%1" is already in the ignore list.',
		commandAdded: '✅ Added command "%1" to the admin-only ignore list.',
		commandNotInList: '❌ Command "%1" is not in the ignore list.',
		commandDeleted: '✅ Removed command "%1" from the admin-only ignore list.',
		ignoreList: '📑 Admin-only ignore list:\n%1',
		emptyIgnoreList: '📑 The admin-only ignore list is empty.',
		invalidListType: '❌ adminOnly.ignoreCommand in config.json is not an array. Please fix it first.'
	},
	bn: {
		missingCommandNameToAdd: '⚠️ অনুগ্রহ করে যে কমান্ডটি বাদ দিতে চান তার নাম লিখুন।',
		missingCommandNameToDelete: '⚠️ অনুগ্রহ করে যে কমান্ডটি তালিকা থেকে সরাতে চান তার নাম লিখুন।',
		commandNotFound: '❌ "%1" কমান্ডটি বটের কমান্ড তালিকায় পাওয়া যায়নি।',
		commandAlreadyInList: '❌ "%1" কমান্ডটি ইতিমধ্যেই বাদ দেওয়া তালিকায় আছে।',
		commandAdded: '✅ "%1" কমান্ডটি অ্যাডমিন-অনলি বাদ দেওয়া তালিকায় যোগ করা হয়েছে।',
		commandNotInList: '❌ "%1" কমান্ডটি বাদ দেওয়া তালিকায় নেই।',
		commandDeleted: '✅ "%1" কমান্ডটি অ্যাডমিন-অনলি বাদ দেওয়া তালিকা থেকে সরানো হয়েছে।',
		ignoreList: '📑 অ্যাডমিন-অনলি বাদ দেওয়া তালিকা:\n%1',
		emptyIgnoreList: '📑 অ্যাডমিন-অনলি বাদ দেওয়া তালিকা খালি।',
		invalidListType: '❌ config.json-এ adminOnly.ignoreCommand একটি অ্যারে নয়। আগে সেটি ঠিক করুন।'
	},
	hi: {
		missingCommandNameToAdd: '⚠️ कृपया उस कमांड का नाम लिखें जिसे बाहर रखना है।',
		missingCommandNameToDelete: '⚠️ कृपया उस कमांड का नाम लिखें जिसे सूची से हटाना है।',
		commandNotFound: '❌ "%1" कमांड बॉट की कमांड सूची में नहीं मिला।',
		commandAlreadyInList: '❌ "%1" कमांड पहले से बाहर रखी गई सूची में है।',
		commandAdded: '✅ "%1" कमांड को एडमिन-ओनली बाहर रखी गई सूची में जोड़ा गया।',
		commandNotInList: '❌ "%1" कमांड बाहर रखी गई सूची में नहीं है।',
		commandDeleted: '✅ "%1" कमांड को एडमिन-ओनली बाहर रखी गई सूची से हटाया गया।',
		ignoreList: '📑 एडमिन-ओनली बाहर रखी गई सूची:\n%1',
		emptyIgnoreList: '📑 एडमिन-ओनली बाहर रखी गई सूची खाली है।',
		invalidListType: '❌ config.json में adminOnly.ignoreCommand एक ऐरे नहीं है। पहले उसे ठीक करें।'
	},
	vi: {
		missingCommandNameToAdd: '⚠️ Vui lòng nhập tên lệnh bạn muốn thêm vào danh sách bỏ qua.',
		missingCommandNameToDelete: '⚠️ Vui lòng nhập tên lệnh bạn muốn xóa khỏi danh sách bỏ qua.',
		commandNotFound: '❌ Không tìm thấy lệnh "%1" trong danh sách lệnh của bot.',
		commandAlreadyInList: '❌ Lệnh "%1" đã có trong danh sách bỏ qua.',
		commandAdded: '✅ Đã thêm lệnh "%1" vào danh sách bỏ qua admin-only.',
		commandNotInList: '❌ Lệnh "%1" không có trong danh sách bỏ qua.',
		commandDeleted: '✅ Đã xóa lệnh "%1" khỏi danh sách bỏ qua admin-only.',
		ignoreList: '📑 Danh sách bỏ qua admin-only:\n%1',
		emptyIgnoreList: '📑 Danh sách bỏ qua admin-only đang trống.',
		invalidListType: '❌ adminOnly.ignoreCommand trong config.json không phải là mảng. Vui lòng sửa trước.'
	}
};

function resolveCommand(name) {
	const commands = (global.client && global.client.commands) || new Map();
	const lower = String(name || "").toLowerCase();
	if (!lower) return null;
	const direct = commands.get(name) || commands.get(lower);
	if (direct) return direct;
	for (const command of commands.values()) {
		if (!command || !command.config) continue;
		if (String(command.config.name || "").toLowerCase() === lower) return command;
		const aliases = command.config.aliases;
		if (Array.isArray(aliases) && aliases.some((alias) => String(alias).toLowerCase() === lower)) return command;
		if (typeof aliases === "string" && aliases.toLowerCase() === lower) return command;
	}
	return null;
}

module.exports.run = async function ({ api, event, args, getText }) {
	const { threadID, messageID } = event;
	const action = String(args[0] || "").toLowerCase();

	const reloadConfig = () => {
		const configPath = global.client && global.client.configPath;
		if (!configPath) return null;
		try {
			delete require.cache[require.resolve(configPath)];
			return require(configPath);
		} catch (error) {
			return null;
		}
	};

	const config = reloadConfig();
	if (!config) return api.sendMessage("❌ config.json could not be loaded.", threadID, messageID);

	if (!config.adminOnly || typeof config.adminOnly !== "object" || Array.isArray(config.adminOnly)) {
		config.adminOnly = { enable: false, ignoreCommand: [] };
	}
	if (config.adminOnly.ignoreCommand === undefined) config.adminOnly.ignoreCommand = [];
	if (!Array.isArray(config.adminOnly.ignoreCommand)) {
		return api.sendMessage(getText("invalidListType"), threadID, messageID);
	}

	const ignoreList = config.adminOnly.ignoreCommand;
	const lowerList = ignoreList.map((name) => String(name).toLowerCase());

	const persist = () => {
		writeFileSync(global.client.configPath, JSON.stringify(config, null, 4));
		// Keep the running bot in sync without waiting for a restart.
		if (global.config) {
			if (!global.config.adminOnly || typeof global.config.adminOnly !== "object") global.config.adminOnly = {};
			global.config.adminOnly.enable = config.adminOnly.enable;
			global.config.adminOnly.ignoreCommand = ignoreList;
		}
	};

	const canonicalName = (input) => {
		const command = resolveCommand(input);
		return command ? String(command.config.name).toLowerCase() : null;
	};

	if (action === "add") {
		if (!args[1]) return api.sendMessage(getText("missingCommandNameToAdd"), threadID, messageID);
		const name = canonicalName(args[1]);
		if (!name) return api.sendMessage(getText("commandNotFound", args[1]), threadID, messageID);
		if (lowerList.includes(name)) return api.sendMessage(getText("commandAlreadyInList", name), threadID, messageID);
		ignoreList.push(name);
		persist();
		return api.sendMessage(getText("commandAdded", name), threadID, messageID);
	}

	if (["del", "delete", "remove", "rm", "-d"].includes(action)) {
		if (!args[1]) return api.sendMessage(getText("missingCommandNameToDelete"), threadID, messageID);
		const name = canonicalName(args[1]) || String(args[1]).toLowerCase();
		const index = lowerList.indexOf(name);
		if (index === -1) return api.sendMessage(getText("commandNotInList", name), threadID, messageID);
		ignoreList.splice(index, 1);
		persist();
		return api.sendMessage(getText("commandDeleted", name), threadID, messageID);
	}

	if (action === "list" || action === "") {
		if (!ignoreList.length) return api.sendMessage(getText("emptyIgnoreList"), threadID, messageID);
		return api.sendMessage(getText("ignoreList", ignoreList.join(", ")), threadID, messageID);
	}

	return global.utils.throwError(this.config.name, threadID, messageID);
};
