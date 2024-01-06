import {
	DatabaseItem,
	DatabaseObjectResponse,
	NotionApi,
	getAllPages
} from "./NotionApi";
import { BpmTableSpec, generateItemsBySpec } from "../models/BpmTable";
import { DateTime } from "luxon";
import { ExerciseBpmTable } from "../models/Exercise";


export class NotionBpmDatabase {

	constructor(
		readonly api: NotionApi,
		readonly database: DatabaseObjectResponse
	) {
	}

	exportDto(): ExerciseBpmTable { return {}; }

	get id() { return this.database.id; }

	emptyItemSnapshot = new BpmDbEmptyItemSnapshot([]);

	async updateEmptyItems() {
		this.emptyItemSnapshot = await getBpmDbEmptyItemSnapshot(this.api, this.id);
	}

	setItemDateCurrent(itemId: string) {
		return setBpmDbItemDateCurrent(this.api, itemId);
	}

	refill(spec: BpmTableSpec, options?: { removeExcessCompleted?: boolean }) {
		return refillBpmDb(this.api, this.database.id, this.database.properties, spec, options);
	}

}



export class BpmDbEmptyItemSnapshot {

	constructor(private readonly emptyItems: DatabaseItem[]) {
	}

	tryGetNext(prevItem?: BpmDbItem): BpmDbItem | undefined {
		let rawNextItem;
		if (!prevItem) {
			rawNextItem = this.emptyItems[0];
		} else {
			const index = this.emptyItems.findIndex(i => i.id === prevItem.rawItem.id);
			if (index !== -1) {
				rawNextItem = this.emptyItems[index + 1];
			}
		}

		if (rawNextItem) {
			return {
				rawItem: rawNextItem,
				bpm: getBpm(rawNextItem),
			};
		} else {
			return undefined;
		}
	}
}

export interface BpmDbItem {
	bpm?: number,
	rawItem: DatabaseItem,
}



export async function getBpmDbEmptyItemSnapshot(api: NotionApi, databaseId: string) {

	const response = await api.queryDatabase({
		database_id: databaseId,
		sorts: [{ property: "nBPM", direction: "ascending" }],
		filter: {
			property: "Date",
			date: {
				is_empty: true
			},
		},
	})();

	return new BpmDbEmptyItemSnapshot(response ?? []);
}

export function setBpmDbItemDateCurrent(api: NotionApi, itemId: string) {
	return api.client.pages.update({
		page_id: itemId,
		properties: {
			Date: {
				type: "date",
				date: {
					start: DateTime.now().toISODate()!,
				}
			}
		}
	})
}



function getBpm(item: DatabaseItem) {
	const bpmProp = item.properties["nBPM"];
	if (bpmProp && bpmProp.type === "formula" && 'type' in bpmProp.formula && bpmProp.formula.type === "number" && typeof bpmProp.formula.number === 'number') {
		return bpmProp.formula.number;
	}
	return undefined;
}

function getDate(item: DatabaseItem) {
	const bpmProp = item.properties["Date"];
	if (bpmProp && bpmProp.type === "date") {
		return bpmProp.date?.start;
	}
	return undefined;
}


export function createBpmDb(
	api: NotionApi,
	pageId: string,
	parentId?: string,
) {

	// can not use parent because api does not support creation in specific block.

	return api.client.databases.create({
		parent: {
			type: "page_id",
			page_id: pageId,
		},
		is_inline: true,
		title: [{
			text: {
				content: "BPM table"
			}
		}],
		properties: {
			"BPM": {
				"type": "title",
				"title": {}
			},
			"Date": {
				"type": "date",
				"date": {}
			},
			"nBPM": {
				"type": "formula",
				"formula": {
					"expression": "toNumber({{notion:block_property:title}})",
				}
			},
		}
	});
}

export async function refillBpmDb(
	api: NotionApi,
	databaseId: string,
	databaseProperties: DatabaseObjectResponse["properties"],
	spec: BpmTableSpec,
	options?: { removeExcessCompleted?: boolean }
) {

	console.log(`refilling db ${databaseId} with`, spec);

	const existingItems = await getAllPages(api.queryDatabase({
		database_id: databaseId,
		sorts: [{ property: "nBPM", direction: "ascending" }, { property: "Date", direction: "ascending" }],
	}));

	const existingItemsMap = new Map<number | undefined, DatabaseItem[]>();
	for (const item of existingItems) {
		const bpm = getBpm(item);
		let list = existingItemsMap.get(bpm);
		if (!list) {
			list = [];
			existingItemsMap.set(bpm, list);
		}
		list.push(item);
	}
	const newItems = generateItemsBySpec(spec);

	const toAdd = [];

	for (const item of newItems) {
		const existing = existingItemsMap.get(item);
		if (existing?.length) {
			existing.shift();
		} else {
			toAdd.push(item);
		}
	}

	const toRemove = [];

	for (const item of existingItemsMap) {
		if (options?.removeExcessCompleted) {
			toRemove.push(...item[1]);
		} else {
			toRemove.push(...item[1].filter(i => !getDate(i)));
		}
	}

	const titleProp = Object.entries(databaseProperties).find(p => p[1].type === "title")?.[1];
	if (titleProp?.type !== 'title') {
		throw new Error(`title property not found in the database ${databaseId}`);
	}

	console.log('adding', toAdd, 'removing', toRemove.map(i => getBpm(i)));

	const addPromises = [];

	for (const item of toAdd) {
		addPromises.push(api.client.pages.create({
			parent: {
				type: "database_id",
				database_id: databaseId,
			},
			properties: {
				[titleProp.name]: {
					type: "title",
					title: [{
						type: "text",
						text: {
							content: item.toString(),
						}
					}],
				}
			}
		}));
	}

	const removePromises = [];

	for (const item of toRemove) {
		removePromises.push(api.client.blocks.delete({
			block_id: item.id,
		}));
	}

	await Promise.all([Promise.all(addPromises), Promise.all(removePromises)]);

	console.log(`refilling db ${databaseId} completed with`, spec);
}
