

export function getNotionPageIdFromUrl(url: string | undefined) {
	// https://www.notion.so/1-28400ef2f94c47fdb3d54142b137ce9b
	// https://www.notion.so/dlyz/Templates-252692a4825c4e9eac41538ae74fcfb2
	if (!url) return undefined;
	if (!url.startsWith("https://www.notion.so/")) return undefined;

	const parts = url.split('/');
	if (parts.length < 4) return undefined;
	const pagePart = parts.at(-1)!;
	const idStart = pagePart.lastIndexOf('-');

	if (idStart === -1) return undefined;

	let idEnd = pagePart.indexOf('?');
	if (idEnd === -1) {
		idEnd = pagePart.indexOf('#');
	}

	if (idEnd === -1) {
		idEnd = pagePart.length;
	}

	const id = pagePart.substring(idStart + 1, idEnd);

	// uuid string length without '-'
	if (id.length !== 32) return undefined;
	if (!/^[0123456789abcdef]{32}$/.test(id)) return undefined;

	return id;
}


export function createNotionPageUrl(pageId: string) {
	return `https://www.notion.so/${pageId.replaceAll("-", "")}`;
}

export const notionTabUrlFilter = "https://www.notion.so/*";

export const projectHomepageUrl = "https://dlyz.notion.site/dlyz/Metronome-Trainer-252692a4825c4e9eac41538ae74fcfb2";
