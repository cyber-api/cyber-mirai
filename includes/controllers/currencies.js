module.exports = function ({ models }) {
	const Currencies = models.use('Currencies');
	const logger = require("../../utils/log.js");

	function fail(error, context) {
		const message = error && error.message ? error.message : String(error);
		logger.error(`${context}: ${message}`, "[ CURRENCIES ]");
		throw new Error(message);
	}

	function requireUserId(userID) {
		const id = userID == null ? "" : String(userID).trim();
		if (!id) throw new Error("userID is required");
		return id;
	}

	function requireOptions(options) {
		if (options === null || typeof options !== "object" || Array.isArray(options)) {
			throw global.getText("currencies", "needObject");
		}
		return options;
	}

	async function getAll(...data) {
		var where, attributes;
		for (const i of data) {
			if (i === null || typeof i !== 'object') throw global.getText("currencies", "needObjectOrArray");
			if (Array.isArray(i)) attributes = i;
			else where = i;
		}
		try {
			return (await Currencies.findAll({ where, attributes })).map(e => e.get({ plain: true }));
		} catch (error) {
			return fail(error, "getAll failed");
		}
	}

	async function getData(userID) {
		try {
			const data = await Currencies.findOne({ where: { userID: requireUserId(userID) } });
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
			const row = await Currencies.findOne({ where: { userID } });
			if (!row) return await createData(userID, options);
			await row.update(options);
			return true;
		} catch (error) {
			return fail(error, "setData failed");
		}
	}

	async function delData(userID) {
		try {
			const row = await Currencies.findOne({ where: { userID: requireUserId(userID) } });
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
			await Currencies.findOrCreate({ where: { userID }, defaults });
			return true;
		} catch (error) {
			return fail(error, "createData failed");
		}
	}

	// Atomic balance update. Read-modify-write loses updates when two transfers
	// run concurrently (F-32); a locked transaction serialises them.
	async function adjustMoney(userID, delta) {
		requireUserId(userID);
		if (typeof delta !== "number" || !Number.isFinite(delta) || delta === 0) {
			throw global.getText("currencies", "needNumber");
		}

		const sequelize = Currencies.sequelize;
		if (!sequelize || typeof sequelize.transaction !== "function") {
			// Fallback for a stubbed model in tests: best-effort single update.
			await createData(userID, { exp: 0, money: 0 });
			await Currencies.increment({ money: delta }, { where: { userID } });
			return true;
		}

		return sequelize.transaction(async (transaction) => {
			await Currencies.findOrCreate({
				where: { userID },
				defaults: { exp: 0, money: 0 },
				transaction,
			});
			const row = await Currencies.findOne({
				where: { userID },
				transaction,
				lock: transaction.LOCK.UPDATE,
			});
			if (!row) throw new Error("currency row disappeared");
			const current = Number(row.get("money")) || 0;
			const next = current + delta;
			if (next < 0) return false;
			await row.update({ money: next }, { transaction });
			return true;
		});
	}

	async function increaseMoney(userID, money) {
		if (typeof money !== "number" || !Number.isFinite(money) || money < 0) {
			throw global.getText("currencies", "needNumber");
		}
		try {
			return await adjustMoney(userID, money);
		} catch (error) {
			return fail(error, "increaseMoney failed");
		}
	}

	async function decreaseMoney(userID, money) {
		if (typeof money !== "number" || !Number.isFinite(money) || money < 0) {
			throw global.getText("currencies", "needNumber");
		}
		try {
			return await adjustMoney(userID, -money);
		} catch (error) {
			return fail(error, "decreaseMoney failed");
		}
	}

	return {
		getAll,
		getData,
		setData,
		delData,
		createData,
		increaseMoney,
		decreaseMoney
	};
};
