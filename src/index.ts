import { Client, Collection, Events, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import { pingCommand } from './commands/ping.js';

dotenv.config();

const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error('CRITICAL: DISCORD_TOKEN is missing in .env!');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

// Инициализируем хранилище команд
client.commands = new Collection();
client.commands.set(pingCommand.data.name, pingCommand);

client.once(Events.ClientReady, (c) => {
  console.log(`[Cobaltum] Готов! Авторизован как ${c.user.tag}`);
});

// Обработчик слеш-команд
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`Команда ${interaction.commandName} не найдена.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Ошибка выполнения команды ${interaction.commandName}:`, error);

    const errorMessage = 'Произошла ошибка при выполнении этой команды!';
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
});

client.login(token);