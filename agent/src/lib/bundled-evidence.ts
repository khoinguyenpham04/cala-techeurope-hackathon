import type { GraphCalaRecord } from './knowledge-graph.ts';

/**
 * A tiny, source-preserving Cala snapshot for the demo path.
 *
 * These are intentionally operator-only records. Ownership and purpose remain
 * unknown unless a live Cala lookup returns stronger sourced evidence.
 */
export const BUNDLED_CALA_RECORDS: Record<string, GraphCalaRecord> = {
	'constellation:ISS': {
		entityId: 'c45e3fec-c0fc-4633-a6d5-509f6dd8e678',
		entityName: 'International Space Station',
		entityType: 'Facility',
		operator: {
			value: 'Japan Aerospace Exploration Agency (JAXA)',
			sources: [
				{
					name: 'JAXA',
					url: 'https://global.jaxa.jp/projects/iss_human/kibo',
					date: '2026-01-10',
				},
				{
					name: 'NASA',
					url: 'https://www.nasa.gov/international-space-station/japanese-experiment-module-kibo/',
					date: '2023-06-20',
				},
			],
		},
		sources: [
			{
				name: 'JAXA',
				url: 'https://global.jaxa.jp/projects/iss_human/kibo',
				date: '2026-01-10',
			},
			{
				name: 'NASA',
				url: 'https://www.nasa.gov/international-space-station/japanese-experiment-module-kibo/',
				date: '2023-06-20',
			},
		],
		evidenceState: 'partial',
		colorKey: 'japan-aerospace-exploration-agency-jaxa',
		matchKind: 'satellite',
		fetchedAt: '2026-08-29T11:16:18.039Z',
	},
	'constellation:SENTINEL': {
		entityId: 'fc4e592a-e2c6-4681-9c88-3209122d0b14',
		entityName: 'Sentinel-2',
		entityType: 'Product',
		operator: {
			value: 'European Space Agency (ESA)',
			sources: [
				{
					name: 'MLQ.ai',
					url: 'https://mlq.ai/news/spanish-startup-xoople-raises-130m-series-b-for-ai-powered-earth-mapping',
					date: '2026-05-03',
				},
			],
		},
		sources: [
			{
				name: 'MLQ.ai',
				url: 'https://mlq.ai/news/spanish-startup-xoople-raises-130m-series-b-for-ai-powered-earth-mapping',
				date: '2026-05-03',
			},
		],
		evidenceState: 'partial',
		colorKey: 'european-space-agency-esa',
		matchKind: 'constellation',
		fetchedAt: '2026-08-29T11:57:10.618Z',
	},
	'constellation:ORBCOMM': {
		entityId: 'fb6e4720-b431-46d1-ac3d-288eaf563839',
		entityName: 'ORBCOMM INC',
		entityType: 'Company',
		operator: {
			value: 'ORBCOMM INC',
			sources: [
				{
					name: 'U.S. Securities and Exchange Commission',
					url: 'https://www.sec.gov/Archives/edgar/data/1364742/000083423720005872/us68555p1003_020520.txt',
					date: '2020-02-05',
				},
			],
		},
		sources: [
			{
				name: 'U.S. Securities and Exchange Commission',
				url: 'https://www.sec.gov/Archives/edgar/data/1364742/000083423720005872/us68555p1003_020520.txt',
				date: '2020-02-05',
			},
		],
		evidenceState: 'partial',
		colorKey: 'orbcomm-inc',
		matchKind: 'operator',
		fetchedAt: '2026-08-29T13:19:07.943Z',
	},
};
