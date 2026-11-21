/**
 * Operator details for /privacy, /terms and /legal/requisites.
 * REQUIRED before public production / store release - set all PUBLIC_PRIVACY_* in the host `.env`.
 * Do not invent fake INN/address in the repo; empty fields render an explicit placeholder.
 */
const email = (import.meta.env.PUBLIC_PRIVACY_CONTACT_EMAIL as string | undefined)?.trim();
const name = (import.meta.env.PUBLIC_PRIVACY_OPERATOR_NAME as string | undefined)?.trim();
const inn = (import.meta.env.PUBLIC_PRIVACY_OPERATOR_INN as string | undefined)?.trim();
const ogrn = (import.meta.env.PUBLIC_PRIVACY_OPERATOR_OGRN as string | undefined)?.trim();
const address = (import.meta.env.PUBLIC_PRIVACY_OPERATOR_ADDRESS as string | undefined)?.trim();

export const PRIVACY_CONTACT_EMAIL = email || 'privacy@repdraft.app';

/** Shown instead of a requisites value until the host env is filled. */
export const REQUISITES_PLACEHOLDER = 'не указан';

export type LegalIdentity = {
	name: string;
	inn: string;
	ogrn: string;
	address: string;
	email: string;
};

export function legalIdentity(): LegalIdentity {
	return {
		name: name || 'Repdraft',
		inn: inn || REQUISITES_PLACEHOLDER,
		ogrn: ogrn || REQUISITES_PLACEHOLDER,
		address: address || REQUISITES_PLACEHOLDER,
		email: PRIVACY_CONTACT_EMAIL
	};
}

export function privacyPolicyVars(): Record<string, string> {
	const parts: string[] = [];
	if (name) parts.push(name);
	if (inn) parts.push(`ИНН ${inn}`);
	if (address) parts.push(address);
	const operator = parts.length > 0 ? parts.join(', ') : 'Repdraft';
	return {
		operator,
		email: PRIVACY_CONTACT_EMAIL
	};
}
