const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionFlagsBits
} = require('discord.js');

const fs = require('fs');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const DB_FILE = './attendance.json';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let data = {};
let triggerSource = {};

// ================= AUTO JSON CREATE =================
function loadData() {

  if (!fs.existsSync(DB_FILE)) {

    fs.writeFileSync(DB_FILE, JSON.stringify({
      users:{},
      triggerSource:{}
    }, null, 2));

    console.log("attendance.json created automatically");
  }

  try {

    const raw = fs.readFileSync(DB_FILE);
    const parsed = JSON.parse(raw);

    data = parsed.users || {};
    triggerSource = parsed.triggerSource || {};

  } catch {

    console.log("JSON corrupt — repairing...");

    data = {};
    triggerSource = {};

    saveData();
  }
}

function saveData() {
  fs.writeFileSync(DB_FILE, JSON.stringify({
    users:data,
    triggerSource:triggerSource
  }, null, 2));
}

// ================== FUNCTIONS ==================
function ensureUser(id) {
  if (!data[id]) {
    data[id] = {
      start: null,
      total: 0
    };
  }
}

function format(ms) {
  let sec = Math.floor(ms / 1000);
  let min = Math.floor(sec / 60);
  let hr = Math.floor(min / 60);
  sec %= 60;
  min %= 60;
  return `${hr}h ${min}m ${sec}s`;
}

// ================== SLASH COMMAND ==================
const commands = [
  new SlashCommandBuilder()
    .setName('online')
    .setDescription('Mark yourself online'),

  new SlashCommandBuilder()
    .setName('offline')
    .setDescription('Mark yourself offline'),

  new SlashCommandBuilder()
    .setName('resetall')
    .setDescription('Reset all attendance')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('troubleshoot')
    .setDescription('Check bot health')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

// ================= SAFE START =================
client.once("ready", async () => {

  console.log(`Logged in as ${client.user.tag}`);

  loadData();

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );
});

// ================= MESSAGE =================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.guild || message.guild.id !== TARGET_SERVER_ID) return;
  if (message.channel.id !== TARGET_CHANNEL_ID) return;

  const content = message.content.toLowerCase();
  const userId = message.author.id;
  ensureUser(userId);

  // ONLINE
  if (content === "online") {
    await message.delete().catch(() => {});
    if (data[userId].start) return;

    data[userId].start = Date.now();
    saveData();

    return message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor("Green")
          .setDescription(`🟢 <@${userId}> is now **ONLINE**`)
          .setTimestamp()
      ]
    });
  }

  // OFFLINE
  if (content === "offline") {
    await message.delete().catch(() => {});
    if (!data[userId].start) return;

    const end = Date.now();
    const duration = end - data[userId].start;

    data[userId].total += duration;
    data[userId].sessions.push({
      start: data[userId].start,
      end,
      duration
    });

    data[userId].start = null;
    saveData();

    return message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor("Red")
          .setDescription(
            `🔴 <@${userId}> is now **OFFLINE**\n\n` +
            `🟢 Online: ${time(data[userId].sessions.at(-1).start)}\n` +
            `🔴 Offline: ${time(end)}\n` +
            `⏱ Duration: ${format(duration)}`
          )
          .setTimestamp()
      ]
    });
  }
});

// ================= SLASH =================
client.on('interactionCreate', async interaction => {

  if (!interaction.isChatInputCommand()) return;

  const userId = interaction.user.id;
  ensureUser(userId);

  if (interaction.commandName === 'online') {

    if (triggerSource[userId] === "message")
      return interaction.reply({ content: "❌ Started via message.", ephemeral: true });

    if (data[userId].start)
      return interaction.reply({ content: "Already online", ephemeral: true });

    triggerSource[userId] = "slash";
    data[userId].start = Date.now();
    saveData();

    return interaction.reply(`🟢 ${interaction.user.username} is now ONLINE`);
  }

  if (interaction.commandName === 'offline') {

    if (triggerSource[userId] === "message")
      return interaction.reply({ content: "❌ Started via message.", ephemeral: true });

    if (!data[userId].start)
      return interaction.reply({ content: "You are not online", ephemeral: true });

    const end = Date.now();
    const duration = end - data[userId].start;

    data[userId].total += duration;
    data[userId].start = null;
    triggerSource[userId] = null;
    saveData();

    return interaction.reply(`🔴 ${interaction.user.username} is now OFFLINE\n⏱ Duration: ${format(duration)}`);
  }

  if (interaction.commandName === 'resetall') {
    data = {};
    triggerSource = {};
    saveData();
    return interaction.reply("All attendance data reset.");
  }

  if (interaction.commandName === 'troubleshoot') {

    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;
    const totalUsers = Object.keys(data).length;
    const ping = client.ws.ping;

    return interaction.reply({
      content:
`🛠 BOT REPORT
Users: ${totalUsers}
Ping: ${ping}ms
RAM: ${memoryUsage.toFixed(2)} MB
Uptime: ${Math.floor(uptime)} sec`,
      ephemeral: true
    });
  }

});

// ================= CRASH PROTECTION =================
process.on('uncaughtException', err => {
  console.log('CRASH ERROR:', err);
});

process.on('unhandledRejection', err => {
  console.log('PROMISE ERROR:', err);
});

client.login(TOKEN);