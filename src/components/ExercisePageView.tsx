import React, { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { Exercise } from "../models/Exercise";
import { ExercisePage } from "../models/ExercisePage";
import { ExerciseView } from "./ExerciseView";
import { Button, Tooltip, makeStyles, shorthands } from "@fluentui/react-components";
import mtIcon from "../../public/icon32.png";
import { ComponentSettingsStorage, useStorageValue } from "./storage";


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



export function ExercisePageView({ page, settingsStorage, homepageUrl }: {
	page: ExercisePage,
	settingsStorage: ComponentSettingsStorage,
	homepageUrl?: string,
}) {

	const [exercise, setExercise] = useState<Exercise>();
	const styles =  useStyles();

	useLayoutEffect(() => {
		const handler = () => {
			setExercise(page.exercise);
		};
		page.onChanged.add(handler);
		setExercise(page.exercise);
		return () => page.onChanged.remove(handler);
	}, [page]);



	const [visible, setVisible] = useStorageValue(settingsStorage, "ExercisePageViewVisible", true);
	const onHideMetronomeTrainer = useCallback(() => {
		setVisible(false);
	}, []);

	const onShowMetronomeTrainer = useCallback(() => {
		setVisible(true);
	}, []);

	if (!exercise) return null;

	return <>
		<div className={styles.wrapper} style={!visible && { display: "none" } || undefined}>
			<div className={styles.root}>
				<ExerciseView
					page={page}
					exercise={exercise}
					onHideMetronomeTrainer={onHideMetronomeTrainer}
					homepageUrl={homepageUrl}
				/>
			</div>
		</div>
		{ !visible && (
			<div className={styles.collapsedWrapper}>
				<div className={styles.collapsedRoot}>
					<Tooltip content="Show Metronome Trainer" relationship="description">
						<Button onClick={onShowMetronomeTrainer} icon={<img src={mtIcon} />} appearance="subtle" />
					</Tooltip>
				</div>
			</div>
		)}
	</>;
}
