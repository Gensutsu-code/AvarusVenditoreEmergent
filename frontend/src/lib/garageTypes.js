export const GARAGE_TYPES = [
  ['truck', 'Грузовой автомобиль', 'Авто'],
  ['trailer', 'Прицеп', 'Прицеп'],
  ['car', 'Легковой автомобиль', 'Легковой'],
  ['special', 'Спецтехника', 'Спецтехника'],
];
export const garageTypeLabel = (type, short = false) => (GARAGE_TYPES.find(([id]) => id === type) || GARAGE_TYPES[0])[short ? 2 : 1];
