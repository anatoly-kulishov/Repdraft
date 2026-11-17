export const BOT_MOODS = ['idle', 'thinking', 'talking', 'happy', 'sad'] as const;

export type BotMood = (typeof BOT_MOODS)[number];
