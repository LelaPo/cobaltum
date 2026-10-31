import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../types/command.js';

export const pingCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Проверка задержки и отклика бота'),

  async execute(interaction) {
    // Отправляем ответ и сразу запрашиваем объект сообщения через fetchReply()
    await interaction.reply({ content: 'Pinging...' });
    const sent = await interaction.fetchReply();

    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    const apiPing = interaction.client.ws.ping;

    await interaction.editReply(
      `🏓 **Pong!**\n⏱️ Задержка ответа: \`${latency}ms\`\n💓 WebSocket API: \`${apiPing}ms\``
    );
  },
};