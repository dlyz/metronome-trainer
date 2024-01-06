import { FluentProvider, webDarkTheme, webLightTheme } from "@fluentui/react-components";
import React, { useEffect, useState } from "react";
import { Root } from "react-dom/client";
import { ObservableValue } from "../primitives/Event";


export function renderApp(root: Root, children: React.ReactNode, options?: { transparent?: boolean, darkTheme?: ObservableValue<boolean> }) {
	root.render(
		<React.StrictMode>
  			<Root
				transparent={options?.transparent}
				darkTheme={options?.darkTheme}
			>
				{children}
			</Root>
		</React.StrictMode>
	);
}


function Root({ children, transparent, darkTheme: darkThemeWatcher }: React.PropsWithChildren<{
	transparent?: boolean,
	darkTheme?: ObservableValue<boolean>
}>) {
	const [isDarkTheme, setIsDarkTheme] = useState(darkThemeWatcher?.value ?? false);

	useEffect(() => {

		setIsDarkTheme(darkThemeWatcher?.value ?? false);

		return darkThemeWatcher?.subscribe(() => {
			setIsDarkTheme(darkThemeWatcher.value);
		});

	}, [darkThemeWatcher]);


	return <FluentProvider
		theme={ isDarkTheme ? webDarkTheme : webLightTheme }
		style={ transparent ? { backgroundColor: "transparent"} : undefined}
	>
		{children}
	</FluentProvider>
}
