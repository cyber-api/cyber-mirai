module.exports = function (input) {
	// `force: false` is intentional: startup must never drop existing data.
	const force = false;

	const Users = require("./models/users")(input);
	const Threads = require("./models/threads")(input);
	const Currencies = require("./models/currencies")(input);

	// Sequelize's sync() returns a promise. The old code fired and forgot it, so
	// the first queries could race table creation and failures became unhandled
	// rejections. Expose `ready` and let the caller await it.
	const ready = Promise.all([
		Users.sync({ force }),
		Threads.sync({ force }),
		Currencies.sync({ force }),
	]);

	return {
		model: {
			Users,
			Threads,
			Currencies
		},
		ready,
		use: function (modelName) {
			return this.model[`${modelName}`];
		}
	}
}
