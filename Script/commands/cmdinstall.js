const fs = require("fs-extra");
const path = require("path");
const axios = require("../../utils/httpClient");
const vm = require("vm");

module.exports.config = {
  name: "cmd",
  version: "3.0.0",
  hasPermssion: 2,
  credits: "MAHBUB MAHBUB-SHAON",
  description: "Command Manager (Install/Load/Unload)",
  commandCategory: "System",
  usages: "[load/unload/loadAll/unloadAll/install/del/info/count]",
  cooldowns: 3
};

function box(title, content) {
  return (
`┌─❖
│ ${title}
├─•
${content}
└─❖`
  );
}

module.exports.run = async function ({ api, event, args }) {

  const { threadID, messageID } = event;
  const commandFolder = __dirname;

  if (!args[0]) {
    return api.sendMessage(box(
      "📦 CMD MANAGER",
`│ • cmd load <name>
│ • cmd unload <name>
│ • cmd loadAll
│ • cmd unloadAll
│ • cmd install <file.js> <url/code>
│ • cmd del <name>
│ • cmd info <name>
│ • cmd count`
    ), threadID, messageID);
  }

  const action = args[0].toLowerCase();

  try {

    // COUNT
    if (action === "count") {
      return api.sendMessage(box(
        "📊 TOTAL COMMANDS",
        `│ ${global.client.commands.size} commands loaded`
      ), threadID, messageID);
    }

    // INFO
    if (action === "info") {
      const cmdName = args[1];
      const command = global.client.commands.get(cmdName);

      if (!command)
        return api.sendMessage(box("❌ ERROR", "│ Command not found"), threadID, messageID);

      const cfg = command.config;

      return api.sendMessage(box(
        "📄 COMMAND INFO",
`│ Name: ${cfg.name}
│ Version: ${cfg.version}
│ Author: ${cfg.credits}
│ Permission: ${cfg.hasPermssion}
│ Cooldown: ${cfg.cooldowns}
│ Category: ${cfg.commandCategory}`
      ), threadID, messageID);
    }

    // LOAD
    if (action === "load") {
      const name = args[1];
      if (!name)
        return api.sendMessage(box("❌ ERROR", "│ Missing command name"), threadID, messageID);

      const dir = path.join(commandFolder, name.endsWith(".js") ? name : name + ".js");
      if (!fs.existsSync(dir))
        return api.sendMessage(box("❌ ERROR", "│ File not found"), threadID, messageID);

      delete require.cache[require.resolve(dir)];
      const command = require(dir);
      if (!command || !command.config || !command.config.name)
        return api.sendMessage(box("❌ ERROR", "│ Invalid command file"), threadID, messageID);

      global.client.commands.set(command.config.name, command);

      return api.sendMessage(box(
        "✅ LOAD SUCCESS",
        `│ Command: ${name}\n│ Status: Active`
      ), threadID, messageID);
    }

    // UNLOAD
    if (action === "unload") {
      const name = args[1];
      if (!name)
        return api.sendMessage(box("❌ ERROR", "│ Missing command name"), threadID, messageID);

      global.client.commands.delete(name);

      return api.sendMessage(box(
        "✅ UNLOAD SUCCESS",
        `│ Command: ${name}\n│ Status: Inactive`
      ), threadID, messageID);
    }

    // LOAD ALL
    if (action === "loadall") {
      const files = fs.readdirSync(commandFolder).filter(f => f.endsWith(".js"));

      for (const file of files) {
        const dir = path.join(commandFolder, file);
        delete require.cache[require.resolve(dir)];
        const command = require(dir);
        global.client.commands.set(command.config.name, command);
      }

      return api.sendMessage(box(
        "✅ LOAD ALL SUCCESS",
        `│ Loaded: ${files.length} commands`
      ), threadID, messageID);
    }

    // UNLOAD ALL
    if (action === "unloadall") {
      const files = fs.readdirSync(commandFolder).filter(f => f.endsWith(".js"));
      let unloaded = 0;

      for (const file of files) {
        const dir = path.join(commandFolder, file);
        try {
          delete require.cache[require.resolve(dir)];
          const command = require(dir);
          if (command && command.config && command.config.name) {
            global.client.commands.delete(command.config.name);
            unloaded++;
          }
        } catch (e) {
          // Skip files that cannot be required (they were never loaded either).
        }
      }

      return api.sendMessage(box(
        "✅ UNLOAD ALL SUCCESS",
        `│ Unloaded: ${unloaded} commands`
      ), threadID, messageID);
    }

    // DELETE
    if (action === "del") {
      const name = args[1];
      if (!name)
        return api.sendMessage(box("❌ ERROR", "│ Missing command name"), threadID, messageID);

      const file = path.join(commandFolder, name + ".js");

      if (!fs.existsSync(file))
        return api.sendMessage(box("❌ ERROR", "│ File not found"), threadID, messageID);

      fs.unlinkSync(file);
      global.client.commands.delete(name);

      return api.sendMessage(box(
        "🗑️ DELETE SUCCESS",
        `│ Deleted: ${name}.js`
      ), threadID, messageID);
    }

    // INSTALL
    if (action === "install") {

      const fileName = args[1];
      const input = args.slice(2).join(" ");

      if (!fileName || !input)
        return api.sendMessage(box("❌ ERROR", "│ Usage: cmd install file.js <url/code>"), threadID, messageID);

      if (!fileName.endsWith(".js"))
        return api.sendMessage(box("❌ ERROR", "│ Only .js allowed"), threadID, messageID);

      if (fileName.includes(".."))
        return api.sendMessage(box("❌ ERROR", "│ Invalid filename"), threadID, messageID);

      let code;

      if (input.startsWith("http")) {
        const res = await axios.get(input);
        code = res.data;
      } else {
        code = input;
      }

      // syntax check
      try {
        new vm.Script(code);
      } catch (err) {
        return api.sendMessage(box("❌ SYNTAX ERROR", `│ ${err.message}`), threadID, messageID);
      }

      const filePath = path.join(commandFolder, fileName);

      // ⚠️ FILE EXISTS → REACT CONFIRM
      if (fs.existsSync(filePath)) {
        return api.sendMessage(
`┌─❖
│ ⚠️ WARNING
├─•
│ 📁 FILE ALREADY EXISTS!
│ 🎯 Command: ${fileName}
│ 📝 Overwrite existing file?
│ 💡 React to this message to confirm
└─❖`,
          threadID,
          (err, info) => {
            global.client.handleReaction.set(info.messageID, {
              name: this.config.name,
              author: event.senderID,
              messageID: info.messageID,
              fileName,
              code,
              path: filePath,
              createdAt: Date.now(),
              once: true
            });
          },
          messageID
        );
      }

      // NEW INSTALL
      fs.writeFileSync(filePath, code);

      delete require.cache[require.resolve(filePath)];
      const command = require(filePath);
      global.client.commands.set(command.config.name, command);

      return api.sendMessage(
`┌─❖
│ ✅ INSTALLED SUCCESS
├─•
│ 📁 Command: ${fileName.replace(".js","")}
│ 📍 Path: ${filePath}
│ 🎯 Status: Active
└─❖`,
        threadID,
        messageID
      );
    }

  } catch (err) {
    return api.sendMessage(box("❌ ERROR", `│ ${err.message}`), threadID, messageID);
  }
};


// 🔥 REACTION HANDLER
module.exports.handleReaction = async function ({ api, event, handleReaction }) {

  const { author, fileName, code, path } = handleReaction;

  if (event.userID != author) return;

  try {
    const fs = require("fs-extra");

    fs.writeFileSync(path, code);

    delete require.cache[require.resolve(path)];
    const command = require(path);

    global.client.commands.set(command.config.name, command);

    return api.sendMessage(
`┌─❖
│ ✅ OVERWRITE SUCCESS
├─•
│ 📁 Command: ${fileName.replace(".js","")}
│ 🎯 Status: Replaced & Active
└─❖`,
      event.threadID
    );

  } catch (err) {
    return api.sendMessage("❌ Error: " + err.message, event.threadID);
  }
};