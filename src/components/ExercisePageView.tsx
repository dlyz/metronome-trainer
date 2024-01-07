import React, { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { Exercise } from "../models/Exercise";
import { ExercisePage } from "../models/ExercisePage";
import { ExerciseView } from "./ExerciseView";
import { Button, Tooltip, makeStyles, shorthands } from "@fluentui/react-components";
import mtIcon from "../../public/icon32.png";
import { useStorageValue } from "./storage";


const useStyles = makeStyles({
	wrapper: {
		display: "flex",
		justifyContent: "right",
		"@media (max-width: 500px)": {
			justifyContent: "stretch",
		}
	},
	root: {
		...shorthands.margin("6px"),
		width: "410px",
		pointerEvents: "initial",
		"@media (max-width: 500px)": {
			width: "100%",
			...shorthands.margin("0"),
		}
	},
	collapsedWrapper: {
		display: "flex",
		justifyContent: "right",
	},
	collapsedRoot: {
		pointerEvents: "initial",
		...shorthands.margin("6px"),
	}
});



export function ExercisePageView({ page, homepageUrl }: {
	page: ExercisePage,
	homepageUrl?: string,
}) {

	const [exercise, setExercise] = useState<Exercise | undefined>(page.exercise);
	const styles = useStyles();

	useLayoutEffect(() => {
		setExercise(page.exercise);
		return page.onChanged.subscribe(() => {
			setExercise(page.exercise);
		});
	}, [page]);


	const [visible, setVisible] = useStorageValue("ExercisePageViewVisible", true);
	const handleHideMetronomeTrainer = useCallback(() => {
		setVisible(false);
	}, []);

	const handleShowMetronomeTrainer = useCallback(() => {
		setVisible(true);
	}, []);

	if (!exercise) return null;

	return <>
		<div className={styles.wrapper} style={!visible && { display: "none" } || undefined}>
			<div className={styles.root}>
				<ExerciseView
					page={page}
					exercise={exercise}
					onHideMetronomeTrainer={handleHideMetronomeTrainer}
					homepageUrl={homepageUrl}
				/>
			</div>
		</div>
		{ !visible && (
			<div className={styles.collapsedWrapper}>
				<div className={styles.collapsedRoot}>
					<Tooltip content="Show Metronome Trainer" relationship="description">
						<Button onClick={handleShowMetronomeTrainer} icon={<img src={mtIcon} />} appearance="subtle" />
					</Tooltip>
				</div>
			</div>
		)}
	</>;
}
