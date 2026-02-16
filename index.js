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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ---------------- SLASH COMMAND ----------------
const commands = [
  new SlashCommandBuilder()
    .setName('troubleshoot')
    .setDescription('Check bot system')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log("Slash command registered");
  } catch (err) {
    console.error(err);
  }
})();

// ---------------- MESSAGE TRIGGER ----------------
client.on('messageCreate', message => {
  if (message.author.bot) return;
  if (!message.guild || message.guild.id !== TARGET_SERVER_ID) return;
  if (message.channel.id !== TARGET_CHANNEL_ID) return;

  const msg = message.content.toLowerCase();
  let data = loadData();

  if (msg === "online") {
    data[message.author.id] = Date.now();
    saveData(data);

    const embed = new EmbedBuilder()
      .setTitle("Attendance Marked")
      .setDescription(`<@${message.author.id}> is now ONLINE`)
      .setColor("Green");

    message.reply({ embeds: [embed] });
  }

  if (msg === "offline") {
    if (!data[message.author.id]) return;

    let duration = Date.now() - data[message.author.id];
    delete data[message.author.id];
    saveData(data);

    const minutes = Math.floor(duration / 60000);

    const embed = new EmbedBuilder()
      .setTitle("Attendance Ended")
      .setDescription(`<@${message.author.id}> was online for ${minutes} mins`)
      .setColor("Red");

    message.reply({ embeds: [embed] });
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