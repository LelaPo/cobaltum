import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  ColorResolvable,
  ComponentType,
  EmbedBuilder,
  GuildMember,
  MessageFlags,
  Role,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { Command } from '../types/command.js';
import { getRoleHistory, recordColorChange } from '../services/history.js';
import { getColorBannerUrl, hexToRgb } from '../utils/color.js';

const TOP_ELEMENT_ROLE_NAME = 'Орбий';
const BOTTOM_ELEMENT_ROLE_NAME = 'Магний';
const PROTECTED_ROLES = ['Протон', '@everyone'];

export const roleHistoryCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('role-history')
    .setDescription('Посмотреть историю цветов своего элемента и откатиться на любой из них')
    .addRoleOption((option) =>
      option
        .setName('role')
        .setDescription('Указать роль вручную (по умолчанию выбирается самая верхняя)')
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;
    const member = interaction.member as GuildMember;
    const botMember = guild?.members.me;

    if (!guild || !member || !botMember) {
      await interaction.reply({
        content: 'Команда доступна только на сервере.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const topRole = guild.roles.cache.find((r) => r.name === TOP_ELEMENT_ROLE_NAME);
    const bottomRole = guild.roles.cache.find((r) => r.name === BOTTOM_ELEMENT_ROLE_NAME);

    if (!topRole || !bottomRole) {
      await interaction.reply({
        content: 'Ошибка конфигурации ролей сервера.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const selectedRole = interaction.options.getRole('role') as Role | null;
    let targetRole: Role | null = null;

    if (selectedRole) {
      if (!member.roles.cache.has(selectedRole.id)) {
        await interaction.reply({
          content: `❌ У тебя нет роли **${selectedRole.name}**!`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      targetRole = selectedRole;
    } else {
      const elementRoles = member.roles.cache
        .filter((r) => {
          const inRange =
            r.position >= bottomRole.position &&
            r.position <= topRole.position;
          return inRange && !PROTECTED_ROLES.includes(r.name) && !r.managed;
        })
        .sort((a, b) => b.position - a.position);

      if (elementRoles.size === 0) {
        await interaction.reply({
          content: '❌ У тебя не найдено элемента!',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      targetRole = elementRoles.first()!;
    }

    const history = getRoleHistory(targetRole.id, 10);

    if (history.length === 0) {
      await interaction.reply({
        content: `📜 Для роли **${targetRole.name}** пока нет сохранённой истории изменений.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const description = history.map((h, i) => {
      const date = new Date(h.timestamp).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
      return `\`${i + 1}.\` **${date}** — \`${h.oldHex}\` ➔ \`${h.newHex}\` (*${h.userTag}*)`;
    }).join('\n');

    const currentColor = targetRole.hexColor.toUpperCase();
    const currentRgb = hexToRgb(currentColor);

    const embed = new EmbedBuilder()
      .setTitle(`📜 История цветов: «${targetRole.name}»`)
      .setDescription(description)
      .setColor(targetRole.color || 0x5865F2)
      .setImage(getColorBannerUrl(currentColor))
      .addFields(
        { name: 'Текущий HEX', value: `\`${currentColor}\``, inline: true },
        { name: 'Текущий RGB', value: `\`${currentRgb.r}, ${currentRgb.g}, ${currentRgb.b}\``, inline: true }
      )
      .setFooter({ text: 'Выберите цвет в выпадающем меню ниже для отката' });

    const uniqueColors = Array.from(
      new Set(history.map((h) => h.oldHex.toUpperCase()))
    ).slice(0, 10);

    const selectOptions = uniqueColors.map((hex) =>
      new StringSelectMenuOptionBuilder()
        .setLabel(`Вернуть ${hex}`)
        .setValue(hex)
        .setDescription(`Откатить цвет на ${hex}`)
        .setEmoji('🎨')
    );

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`history_select_${targetRole.id}`)
      .setPlaceholder('Выберите цвет для возврата...')
      .addOptions(selectOptions);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    await interaction.reply({
      embeds: [embed],
      components: [row],
      flags: MessageFlags.Ephemeral,
    });

    const replyMessage = await interaction.fetchReply();
    const collector = replyMessage.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 3 * 60 * 1000,
    });

    collector.on('collect', async (menuInteraction) => {
      const chosenColor = menuInteraction.values[0];

      try {
        const prevColor = targetRole?.hexColor.toUpperCase() || '#000000';
        await targetRole?.setColors({ primaryColor: chosenColor as ColorResolvable });

        recordColorChange({
          roleId: targetRole!.id,
          roleName: targetRole!.name,
          userId: member.id,
          userTag: interaction.user.tag,
          oldHex: prevColor,
          newHex: chosenColor,
        });

        await menuInteraction.update({
          content: `✅ Цвет роли **${targetRole?.name}** успешно восстановлен на \`${chosenColor}\`!`,
          embeds: [],
          components: [],
        });
      } catch (err) {
        console.error('Ошибка применения цвета из истории:', err);
        await menuInteraction.reply({
          content: '❌ Не удалось вернуть выбранный цвет.',
          flags: MessageFlags.Ephemeral,
        });
      }
    });

    collector.on('end', async (_, reason) => {
      if (reason === 'time') {
        try {
          await replyMessage.edit({ components: [] });
        } catch {
          // Игнорируем
        }
      }
    });
  },
};