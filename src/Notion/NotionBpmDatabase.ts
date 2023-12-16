import {
	DatabaseItem,
	DatabaseObjectResponse,
	NotionApi,
	getAllPages
} from "./NotionApi";
import { BpmTableSpec, ExerciseBpmTable, ExerciseBpmTableDto, generateItemsBySpec } from "../models/BpmTable";
import { DateTime } from "luxon";



export class NotionBpmDatabase implements ExerciseBpmTable {

	readonly #database;

	constructor(
		readonly api: NotionApi,
		database: DatabaseObjectResponse
	) {
		this.#database = database;
	}

	exportDto(): ExerciseBpmTableDto {
		return { type: "exerciseBpmTable" };
	}

	get id() { return this.#database.id; }

	tryGetNextCachedEmptyItem(prevItem?: NotionBpmDatabaseItem): NotionBpmDatabaseItem | undefined {
		let item;
		if (!prevItem) {
			item = this.#cachedRawEmptyItems[0];
		} else if (prevItem.localRequestId === this.#localRequestId) {
			const index = this.#cachedRawEmptyItems.findIndex(i => i.id === prevItem.rawItem.id);
			if (index !== -1) {
				item = this.#cachedRawEmptyItems[index + 1];
			}
		}

		if (item) {
			return new NotionBpmDatabaseItem(this.api, this.#localRequestId, item);
		} else {
			return undefined;
		}
	}

	#localRequestId: {} = {};
	#cachedRawEmptyItems: DatabaseItem[] = [];

	async updateEmptyItems() {
		const response = await this.api.queryDatabase({
			database_id: this.#database.id,
			sorts: [{ property: "nBPM", direction: "ascending" }],
			filter: {
				property: "Date",
				date: {
					is_empty: true
				},
			},
		})();

		this.#cachedRawEmptyItems = response ?? [];
	}

	refill(spec: BpmTableSpec, options?: { removeExcessCompleted?: boolean }) {
		return refillDatabase(this.api, this.#database.id, this.#database.properties, spec, options);
	}

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

export class NotionBpmDatabaseItem {

	constructor(
		readonly api: NotionApi,
		readonly localRequestId: {},
		readonly rawItem: DatabaseItem
	) {
	}

	get bpm() {
		return getBpm(this.rawItem);
	}

	setCurrentDate() {
		this.api.client.pages.update({
			page_id: this.rawItem.id,
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

}


export async function refillDatabase(
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
