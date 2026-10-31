import {
  ActionRowBuilder,
  AutocompleteInteraction,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ColorResolvable,
  ComponentType,
  EmbedBuilder,
  GuildMember,
  MessageFlags,
  Role,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from '../types/command.js';
import { getRoleHistory, recordColorChange } from '../services/history.js';
import { getColorBannerUrl, hexToRgb, PRESET_COLORS } from '../utils/color.js';

const TOP_ELEMENT_ROLE_NAME = 'Орбий';
const BOTTOM_ELEMENT_ROLE_NAME = 'Магний';
const PROTECTED_ROLES = ['Протон', '@everyone'];

export const roleColorCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('role-color')
    .setDescription('Изменить цвет своего элемента (личной роли)')
    .addStringOption((option) =>
      option
        .setName('hex')
        .setDescription('HEX код цвета (начните вводить или выберите из списка)')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addRoleOption((option) =>
      option
        .setName('role')
        .setDescription('Указать роль вручную (по умолчанию красится самая верхняя)')
        .setRequired(false)
    ),

  async autocomplete(interaction: AutocompleteInteraction) {
    const focusedValue = interaction.options.getFocused().trim().toLowerCase();
    const member = interaction.member as GuildMember;
    const guild = interaction.guild;

    const choices: { name: string; value: string }[] = [];

    if (member && guild) {
      const topRole = guild.roles.cache.find((r) => r.name === TOP_ELEMENT_ROLE_NAME);
      const bottomRole = guild.roles.cache.find((r) => r.name === BOTTOM_ELEMENT_ROLE_NAME);

      if (topRole && bottomRole) {
        // Находим самую верхнюю роль элемента
        const userElement = member.roles.cache
          .filter(
            (r) =>
              r.position >= bottomRole.position &&
              r.position <= topRole.position &&
              !PROTECTED_ROLES.includes(r.name) &&
              !r.managed
          )
          .sort((a, b) => b.position - a.position)
          .first();

        if (userElement) {
          const currentHex = userElement.hexColor.toUpperCase();
          choices.push({
            name: `Текущий цвет (${userElement.name}: ${currentHex})`,
            value: currentHex,
          });

          const history = getRoleHistory(userElement.id, 3);
          for (const h of history) {
            if (!choices.some((c) => c.value === h.oldHex.toUpperCase())) {
              choices.push({
                name: `Из истории: ${h.oldHex.toUpperCase()}`,
                value: h.oldHex.toUpperCase(),
              });
            }
          }
        }
      }
    }

    for (const preset of PRESET_COLORS) {
      choices.push({
        name: `${preset.name} (${preset.hex})`,
        value: preset.hex,
      });
    }

    const filtered = choices
      .filter(
        (c) =>
          c.name.toLowerCase().includes(focusedValue) ||
          c.value.toLowerCase().includes(focusedValue)
      )
      .slice(0, 25);

    await interaction.respond(filtered);
  },

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

    if (!botMember.permissions.has('ManageRoles')) {
      await interaction.reply({
        content: '❌ У бота нет права **Управлять ролями** (Manage Roles)!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const topElementRole = guild.roles.cache.find((r) => r.name === TOP_ELEMENT_ROLE_NAME);
    const bottomElementRole = guild.roles.cache.find((r) => r.name === BOTTOM_ELEMENT_ROLE_NAME);

    if (!topElementRole || !bottomElementRole) {
      await interaction.reply({
        content: `❌ Ошибка конфигурации: не найдены граничные роли «${TOP_ELEMENT_ROLE_NAME}» или «${BOTTOM_ELEMENT_ROLE_NAME}».`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    let hexInput = interaction.options.getString('hex', true).trim();
    if (!hexInput.startsWith('#')) {
      hexInput = `#${hexInput}`;
    }

    const hexRegex = /^#([0-9A-Fa-f]{6})$/;
    if (!hexRegex.test(hexInput)) {
      await interaction.reply({
        content: '❌ Неверный формат цвета! Укажи 6-значный HEX-код, например `#FF5500` или выбери из подсказок.',
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
      // Ищем все роли в диапазоне элементов и сортируем по высоте (от самых верхних к нижним)
      const elementRoles = member.roles.cache
        .filter((r) => {
          const inRange =
            r.position >= bottomElementRole.position &&
            r.position <= topElementRole.position;
          return inRange && !PROTECTED_ROLES.includes(r.name) && !r.managed;
        })
        .sort((a, b) => b.position - a.position);

      if (elementRoles.size === 0) {
        await interaction.reply({
          content: '❌ У тебя не найдено роли элемента для изменения цвета!',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Берём самую верхнюю роль (которая определяет реальный цвет никнейма в Discord)
      targetRole = elementRoles.first()!;
    }

    if (PROTECTED_ROLES.includes(targetRole.name)) {
      await interaction.reply({
        content: `❌ Роль **${targetRole.name}** защищена от изменений!`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (targetRole.position >= botMember.roles.highest.position) {
      await interaction.reply({
        content: `❌ Бот не может изменить роль **${targetRole.name}**, так как она выше роли бота в настройках сервера.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const oldHex = targetRole.hexColor.toUpperCase();
    const finalHex = hexInput.toUpperCase();
    const rgb = hexToRgb(finalHex);

    try {
      recordColorChange({
        roleId: targetRole.id,
        roleName: targetRole.name,
        userId: member.id,
        userTag: interaction.user.tag,
        oldHex: oldHex,
        newHex: finalHex,
      });

      await targetRole.setColors({ primaryColor: finalHex as ColorResolvable });

      const embed = new EmbedBuilder()
        .setTitle(`🎨 Цвет элемента «${targetRole.name}» обновлён`)
        .setColor(finalHex as ColorResolvable)
        .setImage(getColorBannerUrl(finalHex))
        .addFields(
          { name: 'HEX', value: `\`${finalHex}\``, inline: true },
          { name: 'RGB', value: `\`${rgb.r}, ${rgb.g}, ${rgb.b}\``, inline: true },
          { name: 'Предыдущий', value: `\`${oldHex}\``, inline: true }
        );

      const rollbackButton = new ButtonBuilder()
        .setCustomId(`undo_${targetRole.id}`)
        .setLabel(`↩️ Вернуть ${oldHex}`)
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(rollbackButton);

      await interaction.reply({
        embeds: [embed],
        components: [row],
      });

      const replyMessage = await interaction.fetchReply();
      const collector = replyMessage.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 5 * 60 * 1000,
      });

      collector.on('collect', async (btnInteraction) => {
        if (btnInteraction.user.id !== interaction.user.id) {
          await btnInteraction.reply({
            content: '❌ Только автор команды может отменить действие.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        try {
          await targetRole?.setColors({ primaryColor: oldHex as ColorResolvable });
          await btnInteraction.update({
            content: `↩️ Цвет элемента **${targetRole?.name}** возвращён на \`${oldHex}\`!`,
            embeds: [],
            components: [],
          });
        } catch (err) {
          console.error('Ошибка при откате цвета:', err);
          await btnInteraction.reply({
            content: '❌ Не удалось откатить цвет роли.',
            flags: MessageFlags.Ephemeral,
          });
        }
      });

      collector.on('end', async (_, reason) => {
        if (reason === 'time') {
          try {
            const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
              rollbackButton.setDisabled(true)
            );
            await replyMessage.edit({ components: [disabledRow] });
          } catch {
            // Игнорируем
          }
        }
      });
    } catch (error) {
      console.error('Ошибка при смене цвета роли:', error);
      await interaction.reply({
        content: '❌ Произошла ошибка при изменении цвета роли. Проверь права бота.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};