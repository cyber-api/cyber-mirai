const { getAdminInfo } = require("../../utils/adminInfo.js");
const admin = require("./admin.js");

module.exports.config = {
    name: "owner",
    version: "1.1.0",
    hasPermssion: 0,
    credits: getAdminInfo().name,
    description: "Show Owner Info",
    commandCategory: "prefix",
    usages: "",
    cooldowns: 5
};

// Keep the legacy `owner` command as an alias of the centralized `admin`
// command, so both names show exactly the same admin.json identity.
module.exports.run = admin.run;
