import {
	BlockObjectResponse,
	DatabaseObjectResponse,
	NotionApi,
	getAllPages
} from "./NotionApi";
import jsYaml from "js-yaml";
import { BpmTableSpec } from "../models/BpmTable";
import { DrumTrainer } from "../models/DrumTrainer";
import { ExercisePage, ExercisePageDto } from "../models/ExercisePage";
import { Exercise, ExerciseDto, ExerciseSettings, ExerciseTask, parseExerciseSettings } from "../models/Exercise";
import _ from "lodash";
import { EventControl } from "../Event";
import { NotionBpmDatabase, NotionBpmDatabaseItem } from "./NotionBpmDatabase";



export class NotionDrumTrainer implements DrumTrainer {

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
			exercise: this.exercise?.exportDto(),
		};
	}

	readonly onChanged = new EventControl();

	exercise?: NotionExercise;

	// todo: async locks
	async refreshPage(): Promise<void> {

		console.log(`refreshing page ${this.pageId}`);
		const pageBlocks = await getBlockChildrenUnwrapColumns(this.api, this.pageId);
		const dbBlocks = pageBlocks.filter(b => b.type === "child_database");
		const databases = await Promise.all(dbBlocks.map(db => this.api.client.databases.retrieve({ database_id: db.id })));

		const bpmDatabase = databases.find(db => "nBPM" in db.properties) as DatabaseObjectResponse | undefined;

		const settingsBlock = pageBlocks.find(b => b.type === "code" && b.code.language === "yaml");
		const bpmTable = bpmDatabase ? new NotionBpmDatabase(this.api, bpmDatabase) : undefined;

		let exercise;
		if (!settingsBlock && !bpmTable) {
			exercise = undefined;
		} else {
			exercise = this.exercise ?? new NotionExercise(this.api, this.onChanged);
			await bpmTable?.updateEmptyItems();

			exercise.doUpdate(settingsBlock, bpmTable);
		}

		this.exercise = exercise;

		console.log(`page ${this.pageId} refreshed, broadcasting event`);
		this.onChanged.invoke();
	}

}


class NotionExercise implements Exercise {
	constructor(
		readonly api: NotionApi,
		readonly onChanged: EventControl,
	) {

	}

	private settingsBlock?: BlockObjectResponse;
	private currentTaskBpm?: NotionBpmDatabaseItem;

	currentTask?: ExerciseTask;
	bpmTableSpec?: BpmTableSpec;
	bpmTable?: NotionBpmDatabase;
	errors?: string[];

	async refreshTask(): Promise<void> {

		console.log(`refreshing task`);

		const bpmTableUpdatePromise = this.bpmTable?.updateEmptyItems();
		const settingsBlockRequestPromise = this.settingsBlock && this.api.client.blocks.retrieve({ block_id: this.settingsBlock.id });

		const [, newSettingsBlock] = await Promise.all([bpmTableUpdatePromise, settingsBlockRequestPromise]);

		this.doUpdate(newSettingsBlock as BlockObjectResponse, this.bpmTable);

		console.log(`task refreshed, broadcasting event`);
		this.onChanged.invoke();
	}


	doUpdate(
		settingsBlock?: BlockObjectResponse,
		bpmTable?: NotionBpmDatabase,
	) {

		let settings: ExerciseSettings | undefined;
		if (settingsBlock && settingsBlock.type === "code") {
			const settingText = settingsBlock.code.rich_text[0]?.plain_text;
			try {
				settings = jsYaml.load(settingText) as ExerciseSettings;
			} catch (ex) {
				console.warn("can not parse yaml block as yaml:", settingText);
			}
		}

		const errors: string[] = [];

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

			if (settings) {
				this.settingsBlock = settingsBlock;
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

	exportDto(): ExerciseDto {
		return {
			type: "exercise",
			source: {
				type: "notion",
				bpmDatabaseId: this.bpmTable?.id,
				settingsBlockId: this.settingsBlock?.id,
			},
			currentTask: this.currentTask,
			errors: this.errors,
			bpmTableSpec: this.bpmTableSpec,
			bpmTable: this.bpmTable?.exportDto(),
		}
	}

}

async function getBlockChildrenUnwrapColumns(api: NotionApi, blockId: string): Promise<BlockObjectResponse[]> {

	// todo: convert to semiserial provider
	const response = await getAllPages(api.getBlockChildren(blockId));

	const inner: [number, Promise<BlockObjectResponse[]>][] = [];

	response.forEach((b, i) => {
		if (b.type === "column_list" || b.type === "column") {
			inner.push([i, getBlockChildrenUnwrapColumns(api, b.id)]);
		}
	});

	if (inner.length) {
		const innerResults = await Promise.all(inner.map(i => i[1]));
		for (let index = inner.length - 1; index >= 0; index--) {
			const element = inner[index];
			response.splice(element[0], 1, ...innerResults[index]);
		}
	}

	return response;
}
