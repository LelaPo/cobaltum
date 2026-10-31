// Широкий горизонтальный баннер (600x140) для наглядного превью в чате
export function getColorBannerUrl(hex: string): string {
  const clean = hex.replace('#', '').toUpperCase();
  return `https://singlecolorimage.com/get/${clean}/600x140`;
}

// Преобразование в RGB для наглядности
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

// Популярные сбалансированные пресеты для подсказок
export const PRESET_COLORS = [
  { name: 'Ледяной кристалл', hex: '#D8FFFF' },
  { name: 'Неоновый бирюзовый', hex: '#00F5D4' },
  { name: 'Морская волна', hex: '#06D6A0' },
  { name: 'Кислотно-зеленый', hex: '#39FF14' },
  { name: 'Солнечный янтарь', hex: '#FFB703' },
  { name: 'Неоновый оранжевый', hex: '#FF5F1F' },
  { name: 'Коралловый закат', hex: '#FF4365' },
  { name: 'Сакура пастельная', hex: '#FFB7B2' },
  { name: 'Глубокий аметист', hex: '#9D4EDD' },
  { name: 'Электрик ультрамарин', hex: '#0038FF' },
  { name: 'Лавандовый туман', hex: '#B5A6FF' },
  { name: 'Графитовый темный', hex: '#2B2D42' },
];