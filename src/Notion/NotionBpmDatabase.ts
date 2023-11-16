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

	async refill(spec: BpmTableSpec) {

		console.log(`refilling db ${this.id} with`, spec);

		const existingItems = await getAllPages(this.api.queryDatabase({
			database_id: this.#database.id,
			sorts: [{ property: "nBPM", direction: "ascending" }],
		}));

		const existingItemsMap = new Map(existingItems.map(i => [getBpm(i), i] as const).filter(i => i[0] !== undefined));

		const newItems = generateItemsBySpec(spec);

		const toAdd = [];

		for (const item of newItems) {
			const existing = existingItemsMap.get(item);
			if (existing) {
				existingItemsMap.delete(item);
			} else {
				toAdd.push(item);
			}
		}


		const titleProp = Object.entries(this.#database.properties).find(p => p[1].type === "title")?.[1];
		if (titleProp?.type !== 'title') {
			throw new Error(`title property not found in the database ${this.#database.id}`);
		}

		console.log('adding', toAdd, 'removing', [...existingItemsMap.keys()]);

		const addPromises = [];

		for (const item of toAdd) {
			addPromises.push(this.api.client.pages.create({
				parent: {
					type: "database_id",
					database_id: this.#database.id,
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

		for (const item of existingItemsMap.values()) {
			removePromises.push(this.api.client.blocks.delete({
				block_id: item.id,
			}));
		}

		await Promise.all([Promise.all(addPromises), Promise.all(removePromises)]);

		console.log(`refilling db ${this.id} completed with`, spec);
	}

}



function getBpm(item: DatabaseItem) {
	const bpmProp = item.properties["nBPM"];
	if (bpmProp && bpmProp.type === "formula" && 'type' in bpmProp.formula && bpmProp.formula.type === "number") {
		return bpmProp.formula.number ?? undefined;
	}
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