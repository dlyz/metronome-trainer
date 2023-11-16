import { FluentProvider, teamsLightTheme } from "@fluentui/react-components";
import React from "react";
import { Root } from "react-dom/client";


export function renderApp(root: Root, children: React.ReactNode, options?: { transparent?: boolean }) {
	root.render(
		<React.StrictMode>
  			<FluentProvider theme={teamsLightTheme} style={options?.transparent ? { backgroundColor: "transparent"} : undefined}>
				{children}
			</FluentProvider>
		</React.StrictMode>
	);
}