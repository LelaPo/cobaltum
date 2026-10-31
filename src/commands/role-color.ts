import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ColorResolvable,
  ComponentType,
  GuildMember,
  MessageFlags,
  Role,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from '../types/command.js';

// Границы диапазона элементов и исключения
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
        .setDescription('HEX код цвета (например, #ff5500 или 00ffaa)')
        .setRequired(true)
    )
    .addRoleOption((option) =>
      option
        .setName('role')
        .setDescription('Указать роль вручную (если у вас несколько элементов)')
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

    if (!botMember.permissions.has('ManageRoles')) {
      await interaction.reply({
        content: '❌ У бота нет права **Управлять ролями** (Manage Roles)!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Ищем граничные роли
    const topElementRole = guild.roles.cache.find((r) => r.name === TOP_ELEMENT_ROLE_NAME);
    const bottomElementRole = guild.roles.cache.find((r) => r.name === BOTTOM_ELEMENT_ROLE_NAME);

    if (!topElementRole || !bottomElementRole) {
      await interaction.reply({
        content: `❌ Ошибка конфигурации: не найдены граничные роли «${TOP_ELEMENT_ROLE_NAME}» или «${BOTTOM_ELEMENT_ROLE_NAME}».`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Валидация HEX
    let hexInput = interaction.options.getString('hex', true).trim();
    if (!hexInput.startsWith('#')) {
      hexInput = `#${hexInput}`;
    }

    const hexRegex = /^#([0-9A-Fa-f]{6})$/;
    if (!hexRegex.test(hexInput)) {
      await interaction.reply({
        content: '❌ Неверный формат цвета! Укажи валидный 6-значный HEX-код, например `#FF5500` или `2ecc71`.',
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
      // Ищем роли, попадающие строго в диапазон [Магний ... Орбий]
      const elementRoles = member.roles.cache.filter((r) => {
        const inRange =
          r.position >= bottomElementRole.position &&
          r.position <= topElementRole.position;
        return inRange && !PROTECTED_ROLES.includes(r.name) && !r.managed;
      });

      if (elementRoles.size === 0) {
        await interaction.reply({
          content: '❌ У тебя не найдено роли элемента для изменения цвета!',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (elementRoles.size > 1) {
        const names = elementRoles.map((r) => `\`${r.name}\``).join(', ');
        await interaction.reply({
          content: `⚠️ У тебя несколько элементов в диапазоне: ${names}.\nУкажи нужный через параметр \`role\`.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      targetRole = elementRoles.first()!;
    }

    // Дополнительная проверка на защищенные роли и иерархию Discord
    if (PROTECTED_ROLES.includes(targetRole.name)) {
      await interaction.reply({
        content: `❌ Роль **${targetRole.name}** защищена от изменений!`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (targetRole.position >= botMember.roles.highest.position) {
      await interaction.reply({
        content: `❌ Бот не может изменить роль **${targetRole.name}**, так как она выше или равна роли бота в настройках сервера.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const oldHex = targetRole.hexColor;

    try {
      // Применяем новый цвет
      await targetRole.setColor(hexInput as ColorResolvable);

      // Кнопка быстрого отката цвета
      const rollbackButton = new ButtonBuilder()
        .setCustomId(`undo_${targetRole.id}`)
        .setLabel(`↩️ Вернуть предыдущий цвет (${oldHex.toUpperCase()})`)
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(rollbackButton);

      await interaction.reply({
        content: `🧪 Цвет элемента **${targetRole.name}** успешно изменён с \`${oldHex.toUpperCase()}\` на \`${hexInput.toUpperCase()}\`!`,
        components: [row],
      });

      // Ловим нажатие кнопки отката (в течение 5 минут)
      const replyMessage = await interaction.fetchReply();
      const collector = replyMessage.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 5 * 60 * 1000,
      });

      collector.on('collect', async (btnInteraction) => {
        if (btnInteraction.user.id !== interaction.user.id) {
          await btnInteraction.reply({
            content: '❌ Только тот, кто менял цвет, может отменить действие.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        try {
          await targetRole?.setColor(oldHex as ColorResolvable);
          await btnInteraction.update({
            content: `↩️ Цвет элемента **${targetRole?.name}** возвращён обратно на \`${oldHex.toUpperCase()}\`!`,
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
          // По истечении времени аккуратно отключаем кнопку
          try {
            const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
              rollbackButton.setDisabled(true)
            );
            await replyMessage.edit({ components: [disabledRow] });
          } catch {
            // Сообщение могло быть удалено, игнорируем ошибку
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