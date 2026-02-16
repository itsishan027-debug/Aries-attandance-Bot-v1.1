const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionFlagsBits,
  EmbedBuilder
} = require('discord.js');

const fs = require('fs');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const TARGET_SERVER_ID = "770004215678369883";
const TARGET_CHANNEL_ID = "1426247870495068343";

const DB_FILE = './attendance.json';

// Auto create JSON if not exists
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({}));
}

function loadData() {
  return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveData(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Helper to format duration (ms to HH:mm:ss)
function formatDuration(ms) {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor(ms / (1000 * 60 * 60));
  return `${hours}h ${minutes}m ${seconds}s`;
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ---------------- SLASH COMMAND REGISTRATION ----------------
const commands = [
  new SlashCommandBuilder()
    .setName('troubleshoot')
    .setDescription('Check bot system')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log("Slash command registered");
  } catch (err) {
    console.error("Error registering commands:", err);
  }
})();

// ---------------- MESSAGE TRIGGER ----------------
client.on('messageCreate', async message => {
  if (message.author.bot) return;
  if (!message.guild || message.guild.id !== TARGET_SERVER_ID) return;
  if (message.channel.id !== TARGET_CHANNEL_ID) return;

  const content = message.content.toLowerCase();
  const userId = message.author.id;
  let data = loadData();

  // Initialize user if they don't exist in DB
  if (!data[userId]) {
    data[userId] = { start: null, total: 0 };
  }

  // ONLINE TRIGGER
  if (content === "online") {
    if (data[userId].start) return; // Already online

    data[userId].start = Date.now();
    saveData(data);

    await message.delete().catch(() => {});

    message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor("Green")
          .setDescription(`🟢 <@${userId}> is now **ONLINE**`)
          .setTimestamp()
      ]
    });
  }

  // OFFLINE TRIGGER
  if (content === "offline") {
    if (!data[userId].start) return; // Wasn't online

    const startTime = data[userId].start;
    const endTime = Date.now();
    const duration = endTime - startTime;

    data[userId].total += duration;
    data[userId].start = null;
    saveData(data);

    await message.delete().catch(() => {});

    message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor("Red")
          .setDescription(
            `🔴 <@${userId}> is now **OFFLINE**\n\n` +
            `🟢 Online: <t:${Math.floor(startTime / 1000)}:t>\n` +
            `🔴 Offline: <t:${Math.floor(endTime / 1000)}:t>\n` +
            `⏱ Duration: **${formatDuration(duration)}**`
          )
          .setTimestamp()
      ]
    });
  }
});

// ---------------- SLASH RESPONSE ----------------
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "troubleshoot") {
    await interaction.reply({
      content: "Bot is working perfectly ✅",
      ephemeral: true
    });
  }
});

client.login(TOKEN);
