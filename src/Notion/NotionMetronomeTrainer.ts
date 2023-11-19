import {
	BlockObjectResponse,
	DatabaseObjectResponse,
	NotionApi,
	getAllPages
} from "./NotionApi";
import jsYaml from "js-yaml";
import { BpmTableSpec } from "../models/BpmTable";
import { MetronomeTrainer } from "../models/MetronomeTrainer";
import { ExercisePage, ExercisePageDto } from "../models/ExercisePage";
import { Exercise, ExerciseDto, ExerciseSettings, ExerciseTask, parseExerciseSettings } from "../models/Exercise";
import _ from "lodash";
import { EventControl } from "../Event";
import { NotionBpmDatabase, NotionBpmDatabaseItem, refillDatabase } from "./NotionBpmDatabase";
import { APIErrorCode, APIResponseError } from "@notionhq/client";



export class NotionMetronomeTrainer implements MetronomeTrainer {

	constructor(readonly api: NotionApi) {
	}

	getPageIdFromUrl(url: string | undefined) {
		return NotionApi.getPageIdFromUrl(url);
	}

	createPage(pageId: string): ExercisePage {
		return new NotionPage(this.api, pageId);
	}
}

class NotionPage implements ExercisePage {
	constructor(
		readonly api: NotionApi,
		readonly pageId: string,
	) {
	}

	exportDto(): ExercisePageDto {
		return {
			type: "exercisePage",
			pageId: this.pageId,
			hasAccess: this.hasAccess,
			exercise: this.exercise?.exportDto(),
		};
	}

	readonly onChanged = new EventControl();

	hasAccess?: boolean;

	exercise?: NotionExercise;

	// todo: async locks
	async refreshPage(): Promise<void> {

		console.log(`refreshing page ${this.pageId}`);

		let blocks;
		try {
			blocks = await parsePage(this.api, this.pageId);
		} catch (ex) {
			if (ex instanceof APIResponseError && ex.code === APIErrorCode.ObjectNotFound) {
				this.hasAccess = false;
				this.exercise = undefined;

				console.log(`has no access to the page ${this.pageId}`, ex);
				console.warn({ ex });
				this.onChanged.invoke();
				return;
			}
			throw ex;
		}


		const bpmTable = blocks.bpmDatabase ? new NotionBpmDatabase(this.api, blocks.bpmDatabase) : undefined;

		let exercise;
		if (!blocks.settingsBlock && !bpmTable) {
			exercise = undefined;
		} else {
			exercise = this.exercise ?? new NotionExercise(this.api, this.onChanged, blocks);
			await bpmTable?.updateEmptyItems();

			exercise.doUpdate(blocks, blocks.settingsBlock, bpmTable);
		}

		this.hasAccess = true;
		this.exercise = exercise;

		console.log(`page ${this.pageId} refreshed, broadcasting event`);
		this.onChanged.invoke();
	}


	async createExercise(): Promise<void> {

		const defaultSettingContent = `
bpms: 60-70/2, 70-80
bar: 4/4
div: 2
accents: [3,1,2,1]
t: 1m
`.trim();

		const instructions = `
To the left is an exercise settings block, change them as you need.
All fields are optional, but you probably want to keep exercise duration 't'.
After changing 'bpms' you can also refill the BPM table using the button above metronome.

Recommended optional actions:
- In page properties enable "Full width".
- Drag "BPM table" database here and delete this block.
- Hide database title.
- Sort database view by "nBPM" property.
- Hide "nBPM" property from the view.
- Split rows into multiple pages by duplicating "Default view" and assigning each view advanced filter on the range of "nBPM" property (to enable '<' '>' filtration you might need to trigger "nBPM" formula update by adding trailing space).

💡 Duplicate configured exercise page and in future create new exercises by simply duplicating that page.
`.trim();

		const result = await this.api.client.blocks.children.append({
			block_id: this.pageId,
			children: [
				{
					column_list: {
						children: [
							{
								column: {
									children: [{
										paragraph: {
											rich_text: [{
												type: "text",
												text: {
													content: instructions,
												}
											}]
										}
									}]
								}
							},
							{
								column: {
									children: [{
										code: {
											language: "yaml",
											rich_text: [{
												type: "text",
												text: {
													content: defaultSettingContent
												}
											}]
										}
									}]
								}
							}
						]
					}
				}
			]
		});

		await this.refreshPage();
		if (!this.exercise) {
			throw new Error("Settings block have been created, but after the refresh is has not been found.");
		}

		const spec = this.exercise.bpmTableSpec ?? { groups: [{chunks: [{ from: 60, to: 60, step: 1}]}] };
		await this.exercise.refillDatabase(spec);
		await this.refreshPage();
	}
}



class NotionExercise implements Exercise {
	constructor(
		readonly api: NotionApi,
		readonly onChanged: EventControl,
		private pageBlocks: PageBlockStructure,
	) {

	}


	private currentTaskBpm?: NotionBpmDatabaseItem;

	currentTask?: ExerciseTask;
	bpmTableSpec?: BpmTableSpec;
	bpmTable?: NotionBpmDatabase;
	errors?: string[];

	async refreshTask(): Promise<void> {

		console.log(`refreshing task`);

		const bpmTableUpdatePromise = this.bpmTable?.updateEmptyItems();

		const settingsBlockId = this.pageBlocks.settingsBlock?.id;
		const settingsBlockRequestPromise = settingsBlockId && this.api.client.blocks.retrieve({ block_id: settingsBlockId });

		const [, newSettingsBlock] = await Promise.all([bpmTableUpdatePromise, settingsBlockRequestPromise]);

		this.doUpdate(undefined, newSettingsBlock as BlockObjectResponse, this.bpmTable);

		console.log(`task refreshed, broadcasting event`);
		this.onChanged.invoke();
	}


	doUpdate(
		blockStructure?: PageBlockStructure,
		settingsBlock?: BlockObjectResponse,
		bpmTable?: NotionBpmDatabase,
	) {
		const errors: string[] = [];

		let settings: ExerciseSettings | undefined;
		if (settingsBlock && settingsBlock.type === "code") {
			const settingText = settingsBlock.code.rich_text[0]?.plain_text;
			try {
				settings = jsYaml.load(settingText) as ExerciseSettings;
			} catch (ex) {
				errors.push("invalid yaml: ", settingText);
			}
		}

		const { metronomeOptions, duration, bpmTableSpec } = parseExerciseSettings(
			settings ?? {},
			error => errors.push(error)
		);

		if (errors.length > 0) {
			console.warn(`exercise parsing errors`, errors);
		}


		let task: ExerciseTask | undefined;
		let currentTaskBpm: NotionBpmDatabaseItem | undefined;
		if (bpmTable) {
			currentTaskBpm = bpmTable.tryGetNextCachedEmptyItem();
			const bpm = currentTaskBpm?.bpm;

			if (bpm !== undefined) {
				task = {
					metronomeOptions: {
						...metronomeOptions,
						bpm: bpm,
					},
					duration,
				};
			}
		}

		(() => {
			// synchronous update section

			this.bpmTableSpec = bpmTableSpec;
			this.errors = errors;
			this.bpmTable = bpmTable;

			if (blockStructure) {
				this.pageBlocks = blockStructure;
			}

			if (!_.isEqual(this.currentTask, task)) {
				this.currentTask = task;
			}
			this.currentTaskBpm = currentTaskBpm;

		})();
	}


	#toNextBpm(currentTask: ExerciseTask, nextBpm: NotionBpmDatabaseItem) {
		const task: ExerciseTask = {
			...currentTask,
			metronomeOptions: {
				...currentTask.metronomeOptions,
				bpm: nextBpm.bpm
			}
		};

		if (!_.isEqual(this.currentTask, task)) {
			this.currentTask = task;
		}
		this.currentTaskBpm = nextBpm;

		this.onChanged.invoke();
	}

	async finishTask(task: ExerciseTask): Promise<void> {
		if (this.currentTask && this.currentTaskBpm && task.metronomeOptions.bpm === this.currentTaskBpm.bpm) {

			console.log(`finishing task ${task.metronomeOptions.bpm} bpm`);

			await this.currentTaskBpm.setCurrentDate();
			const nextBpm = this.bpmTable?.tryGetNextCachedEmptyItem(this.currentTaskBpm);
			if (nextBpm?.bpm !== undefined) {
				console.log(`task ${task.metronomeOptions.bpm} bpm finished, using cached next task`);
				this.#toNextBpm(this.currentTask, nextBpm);
			} else {
				console.log(`task finished, refreshing current task`);
				await this.refreshTask();
			}

		} else {
			console.warn("current task bpm doesn't match");
		}
	}

	refillDatabase(spec: BpmTableSpec): Promise<void> {
		if (this.bpmTable) {
			return this.bpmTable.refill(spec);
		} else {
			return this.#createAndFillDatabase(spec);
		}
	}

	async #createAndFillDatabase(spec: BpmTableSpec): Promise<void> {
		let parent = this.pageBlocks.pageId;
		const settingsColumn = this.pageBlocks.settingsColumn;
		if (settingsColumn) {
			const otherColumn = settingsColumn.columnList.childrenBlocks?.[settingsColumn.columnIndex === 0 ? 1 : 0];
			if (otherColumn) {
				parent = otherColumn.id;
			}
		}

		// can not use parent because api does not support creation in specific block.

		const result = await this.api.client.databases.create({
			parent: {
				type: "page_id",
				page_id: this.pageBlocks.pageId,
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

		await refillDatabase(this.api, result.id, result.properties, spec);
	}

	exportDto(): ExerciseDto {
		return {
			type: "exercise",
			source: {
				type: "notion",
				bpmDatabaseId: this.bpmTable?.id,
				settingsBlockId: this.pageBlocks.settingsBlock?.id,
			},
			currentTask: this.currentTask,
			errors: this.errors,
			bpmTableSpec: this.bpmTableSpec,
			bpmTable: this.bpmTable?.exportDto(),
		}
	}

}

interface PageBlockStructure {
	pageId: string,
	settingsBlock?: HBlock,
	settingsColumn?: BlockColumnParent,
	bpmDatabaseBlock?: HBlock,
	bpmDatabaseColumn?: BlockColumnParent,
	bpmDatabase?: DatabaseObjectResponse,
}

interface BlockColumnParent {
	columnList: HBlock,
	columnIndex: number,
}

async function parsePage(api: NotionApi, pageId: string): Promise<PageBlockStructure> {
	const pageBlocksTree = await getBlockDescendants(api, pageId);
	const pageBlocksFlat = flattenBlocks(pageBlocksTree);
	const settingsBlock = pageBlocksFlat.find(b => b.type === "code" && b.code.language === "yaml");


	const dbBlocks = pageBlocksFlat.filter(b => b.type === "child_database");
	const databases = await Promise.all(dbBlocks.map(dbBlock => api.client.databases.retrieve({ database_id: dbBlock.id })));

	const bpmDatabaseIndex = databases.findIndex(db => "nBPM" in db.properties);
	const bpmDatabaseBlock = dbBlocks[bpmDatabaseIndex];
	const bpmDatabase = databases[bpmDatabaseIndex] as DatabaseObjectResponse | undefined;

	let settingsColumn = settingsBlock?.parentBlock;
	let settingsColumnList = settingsColumn?.parentBlock;
	if (settingsColumn?.type === "column" && settingsColumnList?.type === "column_list") {
	} else {
		settingsColumn = settingsColumnList = undefined;
	}

	return {
		pageId,
		settingsBlock,
		bpmDatabaseBlock,
		bpmDatabase,
		settingsColumn: getColumn(settingsBlock),
		bpmDatabaseColumn: getColumn(bpmDatabaseBlock),
	}


	function getColumn(block?: HBlock) {

		let column = block?.parentBlock;
		let columnList = settingsColumn?.parentBlock;
		if (column?.type === "column" && columnList?.type === "column_list" && columnList.childrenBlocks) {
			return { columnList, columnIndex: columnList.childrenBlocks.indexOf(column) };
		} else {
			return undefined;
		}
	}

	function getBlockParentId(block: BlockObjectResponse) {
		switch (block.parent.type) {
			case "block_id": return block.parent.block_id;
			case "database_id": return block.parent.database_id;
			case "page_id": return block.parent.page_id;
			default: return undefined;
		}
	}
}


type HBlock = BlockObjectResponse & {
	childrenBlocks?: HBlock[],
	parentBlock?: HBlock,
}

function flattenBlocks(blocks: HBlock[]): HBlock[] {
	return blocks.flatMap(b => b.childrenBlocks ? flattenBlocks(b.childrenBlocks) : b);
}

async function getBlockDescendants(api: NotionApi, blockId: string): Promise<HBlock[]> {

	// todo: convert to semiserial provider
	const response: HBlock[] = await getAllPages(api.getBlockChildren(blockId));


	const childrenRequests: [number, Promise<HBlock[]>][] = [];

	response.forEach((b, i) => {
		if (b.type === "column_list" || b.type === "column") {
			childrenRequests.push([i, getBlockDescendants(api, b.id)]);
		}
	});

	if (childrenRequests.length) {
		const childrenResponses = await Promise.all(childrenRequests.map(i => i[1]));
		for (let childrenRequestIndex = childrenRequests.length - 1; childrenRequestIndex >= 0; childrenRequestIndex--) {
			const childrenRequest = childrenRequests[childrenRequestIndex];
			const parent = response[childrenRequest[0]];
			const children = childrenResponses[childrenRequestIndex];
			parent.childrenBlocks = children;
			for (const child of children) {
				child.parentBlock = parent;
			}
		}
	}

	return response;
}
