import { ExercisePageContentScriptApiFactory, ExercisePageContentScriptApiUpdater, ExercisePageDto } from "../models/ExercisePage";
import { NotionExercisePageDto, NotionNextExerciseInfo } from "./NotionExercisePageDto";
import { createNotionPageUrl } from "./notionUrl";


export const notionContentScriptApiFactory: ExercisePageContentScriptApiFactory = (dto) => {
	if (dto.sourceType !== ("notion" satisfies NotionExercisePageDto["sourceType"])) {
		return undefined;
	}

	return new NotionContentScriptApi(dto);
}

class NotionContentScriptApi implements ExercisePageContentScriptApiUpdater {

	#nextExerciseInfo?: NotionNextExerciseInfo;

	constructor(dto: ExercisePageDto) {
		const notionDto = dto as NotionExercisePageDto;
		this.#nextExerciseInfo = notionDto.nextExerciseInfo;
	}

	update(dto: ExercisePageDto): void {
		const notionDto = dto as NotionExercisePageDto;
		if (notionDto.nextExerciseInfo) {
			this.#nextExerciseInfo = notionDto.nextExerciseInfo;
		}
	}

	get hasNextExercise() { return !!this.#nextExerciseInfo?.nextExercisePageWithAncestorsIds; }

	toNextExercise(): void {

		const nextExercisePageId = this.#nextExerciseInfo?.nextExercisePageWithAncestorsIds;
		if (!nextExercisePageId) return;

		for (let index = 0; index < nextExercisePageId.length; index++) {
			const pageId = nextExercisePageId[index];
			const link = findLink(pageId);
			if (link) {
				clickSequence(link, nextExercisePageId.slice(0, index));
				return;
			}
		}

		fallbackNavigate();

		function clickSequence(link: { a: HTMLElement, expander?: HTMLElement }, sequence: string[]) {

			if (sequence.length === 0) {
				link.a.click();
				return;
			} else {
				if (link.expander) {
					link.expander.click();
				} else {
					return fallbackNavigate();
				}
			}

			setTimeout(() => {
				const pageId = sequence.pop();
				const link = findLink(pageId!);
				if (!link) {
					return fallbackNavigate();
				}

				clickSequence(link, sequence);
			}, 100);
		}

		function findLink(pageId: string) {
			const div = document.body.querySelector(`div[data-block-id="${pageId}"]`);
			if (div) {
				const a = div.querySelector("a");
				if (a) {
					const expander = a.querySelector(`div[aria-expanded="false"]`) as HTMLElement;
					return { a, expander };
				}
			}
			return undefined;
		}

		function fallbackNavigate() {
			const pageId = nextExercisePageId?.[0];
			if (pageId) {
				window.location.href = createNotionPageUrl(pageId);
			}
		}

	}


}