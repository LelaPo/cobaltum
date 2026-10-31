# Этап 1: Сборка TypeScript
FROM node:22-alpine AS builder
WORKDIR /app

# Копируем манифесты зависимостей
COPY package*.json tsconfig.json ./
RUN npm ci

# Копируем исходники и компилируем
COPY src/ ./src/
RUN npm run build

# Этап 2: Продакшн рантайм
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Копируем манифесты и ставим ТОЛЬКО продакшн зависимости
COPY package*.json ./
RUN npm ci --omit=dev

# Копируем скомпилированный код из первого этапа
COPY --from=builder /app/dist ./dist

# Папка для постоянного хранения истории цветов
VOLUME ["/app/data"]

# Запуск бота
CMD ["node", "dist/index.js"]