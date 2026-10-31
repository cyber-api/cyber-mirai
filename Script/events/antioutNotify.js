const { getFbAppToken } = require("../../utils/credentials.js");
const { sanitizeCanvasText, safeId, fetchImageBuffer } = require("../../utils/canvasSafety.js");
const fs = require("fs-extra");
const Canvas = require("canvas");
const path = require("path");

module.exports.config = {
	name: "antioutNotify",
	eventType: ["log:unsubscribe"],
	version: "2.1.2",
	credits: "rX Abdullah",
	description: "Send goodbye image with name replacing frame text"
};

function unlinkQuiet(file) {
	try { if (file && fs.existsSync(file)) fs.unlinkSync(file); } catch (error) { /* ignore */ }
}

module.exports.run = async ({ event, api }) => {
	const logData = event.logMessageData || {};
	const userID = logData.leftParticipantFbId != null ? String(logData.leftParticipantFbId) : "";
	const threadID = event.threadID;

	if (!/^\d{5,20}$/.test(userID)) return;
	if (userID === String(api.getCurrentUserID())) return;

	let imgPath = null;
	try {
		const resUser = await api.getUserInfo(userID);
		const rawName = resUser && resUser[userID] && resUser[userID].name ? resUser[userID].name : "Unknown User";
		// Canvas text is user-controlled; strip controls and bound length (F-18).
		const userName = sanitizeCanvasText(rawName, 36);

		const profilePicURL = `https://graph.facebook.com/${userID}/picture?width=512&height=512&access_token=${encodeURIComponent(getFbAppToken())}`;
		const profileBuffer = await fetchImageBuffer(profilePicURL, {
			allowedHosts: ["graph.facebook.com"],
			maxBytes: 5 * 1024 * 1024
		});

		const frameURL = "https://i.postimg.cc/BQ5bdybC/retouch-2025100422414510.jpg";
		const frameBuffer = await fetchImageBuffer(frameURL, {
			allowedHosts: ["i.postimg.cc"],
			maxBytes: 5 * 1024 * 1024
		});

		const base = await Canvas.loadImage(frameBuffer);
		const avatar = await Canvas.loadImage(profileBuffer);
		const canvas = Canvas.createCanvas(base.width, base.height);
		const ctx = canvas.getContext("2d");

		ctx.drawImage(base, 0, 0, canvas.width, canvas.height);

		const pX = 191;
		const pY = 150;
		const pSize = 160;
		ctx.save();
		ctx.beginPath();
		ctx.arc(pX + pSize / 2, pY + pSize / 2, pSize / 2, 0, Math.PI * 2, true);
		ctx.closePath();
		ctx.clip();
		ctx.drawImage(avatar, pX, pY, pSize, pSize);
		ctx.restore();

		ctx.font = "bold 36px Sans";
		ctx.fillStyle = "#FFFFFF";
		ctx.textAlign = "left";
		ctx.fillText(userName, 420, 290);

		const cacheDir = path.join(__dirname, "cache");
		fs.ensureDirSync(cacheDir);
		// Digit-only ID keeps the output inside the cache directory.
		imgPath = path.join(cacheDir, `goodbye_${safeId(userID)}_${Date.now()}.png`);
		fs.writeFileSync(imgPath, canvas.toBuffer(), { mode: 0o600 });

		api.sendMessage({
			body: `👋 Goodbye, ${userName}!`,
			attachment: fs.createReadStream(imgPath)
		}, threadID, () => unlinkQuiet(imgPath));

	} catch (err) {
		unlinkQuiet(imgPath);
		console.error("antioutNotify error:", err && err.message ? err.message : err);
		api.sendMessage("❌ Error creating goodbye image.", threadID);
	}
};
