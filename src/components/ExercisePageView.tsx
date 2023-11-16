import React, { useLayoutEffect, useState } from "react";
import { Exercise } from "../models/Exercise";
import { ExercisePage } from "../models/ExercisePage";
import { ExerciseView } from "./ExerciseView";



export function ExercisePageView({ page }: { page: ExercisePage; }) {

	const [exercise, setExercise] = useState<Exercise>();

	useLayoutEffect(() => {
		const handler = () => {
			setExercise(page.exercise);
		};
		page.onChanged.add(handler);
		setExercise(page.exercise);
		return () => page.onChanged.remove(handler);
	}, [page]);

	return exercise && (
		<ExerciseView page={page} exercise={exercise} />
	);
}
