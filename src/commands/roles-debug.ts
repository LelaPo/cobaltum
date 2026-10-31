import { EmbedBuilder, GuildMember, SlashCommandBuilder } from 'discord.js';
import { Command } from '../types/command.js';

export const rolesDebugCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('roles-debug')
    .setDescription('Дебаг: показывает твои роли и права бота'),

  async execute(interaction) {
    const member = interaction.member as GuildMember;
    const botMember = interaction.guild?.members.me;

    if (!member || !botMember) {
      await interaction.reply({ content: 'Ошибка получения данных участника.', ephemeral: true });
      return;
    }

    const botHighestRole = botMember.roles.highest;

    // Сортируем роли пользователя по позиции (сверху вниз)
    const userRoles = member.roles.cache
      .filter((r) => r.id !== interaction.guildId) // убираем @everyone
      .sort((a, b) => b.position - a.position);

    const rolesList = userRoles.map((r) => {
      const isManageable = r.position < botHighestRole.position;
      const hex = r.hexColor;
      return `• **${r.name}** (pos: ${r.position}) | Цвет: \`${hex}\` | Редактируема ботом: ${isManageable ? '✅' : '❌'}`;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setTitle('🧪 Дебаг ролей участника')
      .setColor(0x5865F2)
      .addFields(
        {
          name: '🤖 Роль бота и позиция',
          value: `**${botHighestRole.name}** (pos: ${botHighestRole.position})`,
        },
        {
          name: '📋 Твои роли',
          value: rolesList || 'Нет ролей',
        }
      )
      .setFooter({ text: 'Роли с ❌ бот не сможет покрасить из-за иерархии Discord' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};