import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import { pingCommand } from './commands/ping.js';

dotenv.config();

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId || !guildId) {
  console.error('CRITICAL: Missing DISCORD_TOKEN, CLIENT_ID or GUILD_ID in .env');
  process.exit(1);
}

// Список команд для регистрации
const commands = [pingCommand.data.toJSON()];

const rest = new REST().setToken(token);

(async () => {
  try {
    console.log(`[Deploy] Начинаем обновление ${commands.length} команд(ы)...`);

    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands },
    );

    console.log('[Deploy] Команды успешно зарегистрированы на сервере!');
  } catch (error) {
    console.error('[Deploy] Ошибка регистрации:', error);
  }
})();