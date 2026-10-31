import {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  MessageFlags,
} from 'discord.js';
import dotenv from 'dotenv';
import { pingCommand } from './commands/ping.js';
import { serverIconCommand } from './commands/server-icon.js';
import { rolesDebugCommand } from './commands/roles-debug.js';
import { roleColorCommand } from './commands/role-color.js';
import { roleHistoryCommand } from './commands/role-history.js';

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

// Инициализируем коллекцию команд
client.commands = new Collection();
client.commands.set(pingCommand.data.name, pingCommand);
client.commands.set(serverIconCommand.data.name, serverIconCommand);
client.commands.set(rolesDebugCommand.data.name, rolesDebugCommand);
client.commands.set(roleColorCommand.data.name, roleColorCommand);
client.commands.set(roleHistoryCommand.data.name, roleHistoryCommand);

client.once(Events.ClientReady, (c) => {
  console.log(`[Cobaltum] Готов! Авторизован как ${c.user.tag}`);
});

// Обработчик всех взаимодействий
client.on(Events.InteractionCreate, async (interaction) => {
  // 1. Автодополнение вариантов при наборе команды
  if (interaction.isAutocomplete()) {
    const command = interaction.client.commands.get(interaction.commandName);
    if (!command || !command.autocomplete) return;

    try {
      await command.autocomplete(interaction);
    } catch (error) {
      console.error(`Ошибка автокомплита для ${interaction.commandName}:`, error);
    }
    return;
  }

  // 2. Выполнение слеш-команд
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
      await interaction.followUp({ content: errorMessage, flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
    }
  }
});

client.login(token);