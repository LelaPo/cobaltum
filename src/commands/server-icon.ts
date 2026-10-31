import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from '../types/command.js';

export const serverIconCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('server-icon')
    .setDescription('Получить иконку сервера в максимальном качестве (4096px)'),

  async execute(interaction) {
    const guild = interaction.guild;

    if (!guild) {
      await interaction.reply({
        content: 'Эту команду можно использовать только на сервере.',
        ephemeral: true,
      });
      return;
    }

    // dynamic: true вернет gif если аватарка анимированная, иначе png в максимальном качестве 4096px
    const iconUrl = guild.iconURL({ size: 4096, extension: 'png' });

    if (!iconUrl) {
      await interaction.reply({
        content: 'У этого сервера не установлена иконка!',
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`Иконка сервера: ${guild.name}`)
      .setImage(iconUrl)
      .setColor(0x00aaff)
      .setFooter({ text: 'Качество: 4096px • Без потерь' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('Открыть оригинал')
        .setStyle(ButtonStyle.Link)
        .setURL(iconUrl)
    );

    await interaction.reply({
      embeds: [embed],
      components: [row],
    });
  },
};