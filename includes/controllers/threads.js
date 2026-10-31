module.exports = function ({ models, api }) {
	const Threads = models.use('Threads');
	const logger = require("../../utils/log.js");

	function fail(error, context) {
		const message = error && error.message ? error.message : String(error);
		logger.error(`${context}: ${message}`, "[ THREADS ]");
		throw new Error(message);
	}

	function requireThreadId(threadID) {
		const id = threadID == null ? "" : String(threadID).trim();
		if (!id) throw new Error("threadID is required");
		return id;
	}

	function requireOptions(options) {
		if (options === null || typeof options !== "object" || Array.isArray(options)) {
			throw global.getText("threads", "needObject");
		}
		return options;
	}

	async function getInfo(threadID) {
		try {
			const result = await api.getThreadInfo(requireThreadId(threadID));
			return result;
		} catch (error) {
			return fail(error, "getInfo failed");
		}
	}

	async function getAll(...data) {
		var where, attributes;
		for (const i of data) {
			if (i === null || typeof i !== 'object') throw global.getText("threads", "needObjectOrArray");
			if (Array.isArray(i)) attributes = i;
			else where = i;
		}
		try {
			return (await Threads.findAll({ where, attributes })).map(e => e.get({ plain: true }));
		} catch (error) {
			return fail(error, "getAll failed");
		}
	}

	async function getData(threadID) {
		try {
			const data = await Threads.findOne({ where: { threadID: requireThreadId(threadID) } });
			if (data) return data.get({ plain: true });
			return false;
		} catch (error) {
			return fail(error, "getData failed");
		}
	}

	async function setData(threadID, options = {}) {
		requireThreadId(threadID);
		requireOptions(options);
		try {
			const row = await Threads.findOne({ where: { threadID } });
			if (!row) return await createData(threadID, options);
			await row.update(options);
			return true;
		} catch (error) {
			return fail(error, "setData failed");
		}
	}

	async function delData(threadID) {
		try {
			const row = await Threads.findOne({ where: { threadID: requireThreadId(threadID) } });
			if (!row) return false;
			await row.destroy();
			return true;
		} catch (error) {
			return fail(error, "delData failed");
		}
	}

	async function createData(threadID, defaults = {}) {
		requireThreadId(threadID);
		requireOptions(defaults);
		try {
			await Threads.findOrCreate({ where: { threadID }, defaults });
			return true;
		} catch (error) {
			return fail(error, "createData failed");
		}
	}

	return {
		getInfo,
		getAll,
		getData,
		setData,
		delData,
		createData
	};
};
