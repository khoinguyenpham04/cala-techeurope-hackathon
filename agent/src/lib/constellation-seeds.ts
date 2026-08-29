/**
 * Small static map so Starlink / OneWeb / ISS / Sentinel paint without a
 * live Cala round-trip. Not evidence — overwrite only when Cala returns
 * sourced fields. Keep in sync with `web/lib/orbit/constellation.ts`.
 */

export type MatchKind = 'satellite' | 'constellation' | 'operator';

export interface MegaSeed {
	operator: string;
	ultimateParent: string;
	purpose: string;
	colorKey: string;
	matchKind: MatchKind;
}

export const MEGA_SEEDS: Record<string, MegaSeed> = {
	STARLINK: {
		operator: 'SpaceX',
		ultimateParent: 'SpaceX',
		purpose: 'Satellite broadband',
		colorKey: 'spacex-starlink',
		matchKind: 'constellation',
	},
	ONEWEB: {
		operator: 'Eutelsat OneWeb',
		ultimateParent: 'Eutelsat',
		purpose: 'Satellite broadband',
		colorKey: 'eutelsat-oneweb',
		matchKind: 'constellation',
	},
	ISS: {
		operator: 'International Space Station',
		ultimateParent: 'International Space Station',
		purpose: 'Space station',
		colorKey: 'iss-facility',
		matchKind: 'satellite',
	},
	SENTINEL: {
		operator: 'European Space Agency',
		ultimateParent: 'European Space Agency',
		purpose: 'Earth observation',
		colorKey: 'esa-sentinel',
		matchKind: 'constellation',
	},
};

export function seedFromGroupKey(groupKey: string): MegaSeed | undefined {
	const match = /^constellation:([A-Z0-9]+)$/.exec(groupKey);
	if (!match) return undefined;
	return MEGA_SEEDS[match[1]!];
}
