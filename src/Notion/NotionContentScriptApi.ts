import { ExercisePageContentScriptApi, ExercisePageContentScriptApiFactory, ExercisePageDto } from "../models/ExercisePage";
import { NotionExercisePageDto } from "./NotionExercisePageDto";


export const notionContentScriptApiFactory: ExercisePageContentScriptApiFactory = (dto) => {
	if (dto.sourceType !== ("notion" satisfies NotionExercisePageDto["sourceType"])) {
		return undefined;
	}

	return new NotionContentScriptApi(dto);
}

class NotionContentScriptApi implements ExercisePageContentScriptApi  {

	#dto: NotionExercisePageDto;

	constructor(dto: ExercisePageDto) {
		this.#dto = dto as NotionExercisePageDto;
	}

	update(dto: ExercisePageDto): void {
		this.#dto = dto as NotionExercisePageDto;
	}

	get hasNextExercise() { return !!this.#dto.nextExercisePageId; }

	toNextExercise(): void {

		const { nextExercisePageId } = this.#dto;
		if (!nextExercisePageId) return;

		// todo: replace with abstraction, incapsulate notion specifics
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

			window.location.href = `https://www.notion.so/${nextExercisePageId?.[0].replaceAll("-", "")}`;
		}

	}


}