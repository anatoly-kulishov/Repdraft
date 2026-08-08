export type TechniqueClip = {
	id: string;
	exerciseId: string;
	userId: string;
	title: string;
	authorLabel: string;
	gifPath: string;
	gifUrl: string;
	createdAt: string;
	hidden?: boolean;
	reportCount?: number;
};

/** Soft moderation knobs (enforced in DB too). */
export const CLIP_MODERATION = {
	maxPerDay: 5,
	reportsToHide: 3
} as const;
