import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ChannelType,
  CategoryChannel,
  GuildChannel,
  MessageFlags,
} from 'discord.js';
import { Command } from '../types/command.js';

interface RenameTask {
  categoryId: string;
  channelMap: Map<string, string>; // oldName -> newName
  executeAt: Date;
  guildId: string;
}

// Хранилище задач (в памяти, при перезагрузке потеряются)
const scheduledTasks = new Map<string, NodeJS.Timeout>();

function parseTimeInput(timeStr: string): Date | null {
  // Поддерживаем форматы: "4 утра", "4:00", "04:00", "4am", "4 am"
  const now = new Date();
  const lower = timeStr.toLowerCase().trim();
  
  // "4 утра", "4 утра следующего дня", "в 4 утра"
  const matchRu = lower.match(/(?:в\s+)?(\d{1,2})\s*(?:утра|утро|am)?/);
  // "4:00", "04:00"
  const matchTime = lower.match(/^(\d{1,2}):(\d{2})$/);
  
  let hours: number;
  let minutes = 0;
  
  if (matchRu) {
    hours = parseInt(matchRu[1], 10);
  } else if (matchTime) {
    hours = parseInt(matchTime[1], 10);
    minutes = parseInt(matchTime[2], 10);
  } else {
    return null;
  }
  
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  
  const target = new Date(now);
  target.setHours(hours, minutes, 0, 0);
  
  // Если время уже прошло сегодня — планируем на завтра
  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }
  
  return target;
}

export const autoRenameCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('auto-rename')
    .setDescription('Запланировать автоматическое переименование категории и каналов')
    .addChannelOption((option) =>
      option
        .setName('category')
        .setDescription('Категория для переименования')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('current-names')
        .setDescription('Текущие названия каналов (через пробел или запятую)')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('new-names')
        .setDescription('Новые названия каналов (через пробел или запятую, в том же порядке)')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('time')
        .setDescription('Время выполнения (например: "4 утра", "04:00", "4am")')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('new-category-name')
        .setDescription('Новое название категории (опционально)')
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({
        content: 'Команда доступна только на сервере.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const category = interaction.options.getChannel('category', true) as CategoryChannel;
    const currentNamesStr = interaction.options.getString('current-names', true);
    const newNamesStr = interaction.options.getString('new-names', true);
    const timeStr = interaction.options.getString('time', true);
    const newCategoryName = interaction.options.getString('new-category-name');

    // Парсим время
    const executeAt = parseTimeInput(timeStr);
    if (!executeAt) {
      await interaction.reply({
        content: 'Неверный формат времени. Используйте: "4 утра", "04:00", "4am" и т.д.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Парсим списки названий
    const currentNames = currentNamesStr.split(/[\s,]+/).filter(Boolean);
    const newNames = newNamesStr.split(/[\s,]+/).filter(Boolean);

    if (currentNames.length !== newNames.length) {
      await interaction.reply({
        content: `Количество текущих названий (${currentNames.length}) не совпадает с количеством новых (${newNames.length}).`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Проверяем, что каналы существуют в категории
    const channelMap = new Map<string, string>();
    const notFound: string[] = [];
    
    for (let i = 0; i < currentNames.length; i++) {
      const channel = category.children.cache.find(
        (c) => c.name.toLowerCase() === currentNames[i].toLowerCase()
      );
      if (channel) {
        channelMap.set(channel.id, newNames[i]);
      } else {
        notFound.push(currentNames[i]);
      }
    }

    if (notFound.length > 0) {
      await interaction.reply({
        content: `Каналы не найдены в категории: ${notFound.join(', ')}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Создаём задачу
    const taskId = `${guild.id}-${category.id}-${Date.now()}`;
    const delay = executeAt.getTime() - Date.now();

    const timeout = setTimeout(async () => {
      try {
        // Переименовываем каналы
        for (const [channelId, newName] of channelMap) {
          const channel = guild.channels.cache.get(channelId) as GuildChannel;
          if (channel) {
            await channel.setName(newName, 'Автопереименование по расписанию');
          }
        }

        // Переименовываем категорию, если указано
        if (newCategoryName) {
          await category.setName(newCategoryName, 'Автопереименование по расписанию');
        }

        console.log(`[AutoRename] Выполнена задача ${taskId} на сервере ${guild.name}`);
      } catch (error) {
        console.error(`[AutoRename] Ошибка выполнения задачи ${taskId}:`, error);
      } finally {
        scheduledTasks.delete(taskId);
      }
    }, delay);

    scheduledTasks.set(taskId, timeout);

    // Формируем ответ
    const timeStrFormatted = executeAt.toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });

    let response = `✅ **Задача запланирована на ${timeStrFormatted}**\n\n`;
    response += `📁 Категория: **${category.name}**${newCategoryName ? ` → **${newCategoryName}**` : ''}\n`;
    response += `📋 Каналов к переименованию: **${channelMap.size}**\n\n`;
    
    for (const [channelId, newName] of channelMap) {
      const channel = guild.channels.cache.get(channelId);
      if (channel) {
        response += `#${channel.name} → #${newName}\n`;
      }
    }

    response += `\n⏰ Задача ID: \`${taskId}\``;

    await interaction.reply({ content: response });
  },
};
