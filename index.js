const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionFlagsBits
} = require('discord.js');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let data = {};
let triggerSource = {};

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

function saveData() {
  console.log("Data Saved");
}

// ================== SLASH COMMAND REGISTER ==================
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

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );
})();

// ================== MESSAGE COMMAND ==================
client.on("messageCreate", async (message) => {

  if (message.author.bot) return;

  const content = message.content.toLowerCase();
  const userId = message.author.id;

  ensureUser(userId);

  if (content === "online") {

    if (triggerSource[userId] === "slash") return;
    if (data[userId].start) return;

    triggerSource[userId] = "message";
    data[userId].start = Date.now();
    saveData();

    return message.channel.send(`🟢 <@${userId}> is now ONLINE`);
  }

  if (content === "offline") {

    if (triggerSource[userId] === "slash") return;
    if (!data[userId].start) return;

    const end = Date.now();
    const duration = end - data[userId].start;

    data[userId].total += duration;
    data[userId].start = null;
    saveData();
    triggerSource[userId] = null;

    return message.channel.send(`🔴 <@${userId}> is now OFFLINE\n⏱ Duration: ${format(duration)}`);
  }
});

// ================== SLASH COMMAND ==================
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
    saveData();
    triggerSource[userId] = null;

    return interaction.reply(`🔴 ${interaction.user.username} is now OFFLINE\n⏱ Duration: ${format(duration)}`);
  }

  if (interaction.commandName === 'resetall') {
    data = {};
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

client.login(TOKEN);