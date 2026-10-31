module.exports = function ({ models, api }) {
	const Users = models.use('Users');
	const logger = require("../../utils/log.js");

	function fail(error, context) {
		const message = error && error.message ? error.message : String(error);
		logger.error(`${context}: ${message}`, "[ USERS ]");
		throw new Error(message);
	}

	function requireUserId(userID) {
		const id = userID == null ? "" : String(userID).trim();
		if (!id) throw new Error("userID is required");
		return id;
	}

	function requireOptions(options) {
		if (options === null || typeof options !== "object" || Array.isArray(options)) {
			throw global.getText("users", "needObject");
		}
		return options;
	}

	async function getInfo(id) {
		const userID = requireUserId(id);
		try {
			const info = await api.getUserInfo(userID);
			return info ? info[userID] : undefined;
		} catch (error) {
			logger.warn(`getInfo failed for ${userID}: ${error && error.message ? error.message : error}`);
			return undefined;
		}
	}

	async function getNameUser(id) {
		const userID = id == null ? "" : String(id);
		try {
			if (global.data && global.data.userName && global.data.userName.has(userID)) {
				return global.data.userName.get(userID);
			}
			if (global.data && Array.isArray(global.data.allUserID) && global.data.allUserID.includes(userID)) {
				const record = await getData(userID);
				if (record && record.name) return record.name;
			}
			return "Facebook users";
		} catch (error) {
			return "Facebook users";
		}
	}

	async function getAll(...data) {
		var where, attributes;
		for (const i of data) {
			if (i === null || typeof i !== 'object') throw global.getText("users", "needObjectOrArray");
			if (Array.isArray(i)) attributes = i;
			else where = i;
		}
		try {
			return (await Users.findAll({ where, attributes })).map(e => e.get({ plain: true }));
		} catch (error) {
			return fail(error, "getAll failed");
		}
	}

	async function getData(userID) {
		try {
			const data = await Users.findOne({ where: { userID: requireUserId(userID) } });
			if (data) return data.get({ plain: true });
			return false;
		} catch (error) {
			return fail(error, "getData failed");
		}
	}

	async function setData(userID, options = {}) {
		requireUserId(userID);
		requireOptions(options);
		try {
			const row = await Users.findOne({ where: { userID } });
			if (!row) return await createData(userID, options);
			await row.update(options);
			return true;
		} catch (error) {
			return fail(error, "setData failed");
		}
	}

	async function delData(userID) {
		try {
			const row = await Users.findOne({ where: { userID: requireUserId(userID) } });
			if (!row) return false;
			await row.destroy();
			return true;
		} catch (error) {
			return fail(error, "delData failed");
		}
	}

	async function createData(userID, defaults = {}) {
		requireUserId(userID);
		requireOptions(defaults);
		try {
			await Users.findOrCreate({ where: { userID }, defaults });
			return true;
		} catch (error) {
			return fail(error, "createData failed");
		}
	}

	return {
		getInfo,
		getNameUser,
		getAll,
		getData,
		setData,
		delData,
		createData
	};
};
