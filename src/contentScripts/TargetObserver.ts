

// const targetObserver = new MutationObserver((mutations: MutationRecord[]) => {
// 	if (!targetBlockId || target) return;
// 	for (const mutation of mutations) {
// 		if (mutation.type === "childList") {
// 			for (const node of mutation.addedNodes.values()) {

// 				if (dfsAddedNode(node)) {
// 					return;
// 				}
// 			}
// 		} else if (mutation.type === "attributes") {
// 			console.log(mutation);
// 			if (trySetTarget(mutation.target)) {
// 				return;
// 			}
// 		}
// 	}


// 	function dfsAddedNode(node: Node) {
// 		if (trySetTarget(node)) return true;
// 		for (const child of node.childNodes.values()) {
// 			if (dfsAddedNode(child)) return true;
// 		}
// 		return false;
// 	}

// 	function trySetTarget(node: Node) {
// 		if (node.nodeType !== Node.ELEMENT_NODE || node.nodeName !== "DIV") return false;

// 		const element = node as HTMLDivElement;
// 		const elementBlockId = element.getAttribute("data-block-id");

// 		// if (elementBlockId) {
// 		// 	console.log(elementBlockId, element.textContent);
// 		// }

// 		if (elementBlockId === targetBlockId) {
// 			console.log(`drum trainer: target found for block ${targetBlockId}`);
// 			setTarget(element);
// 			//positionObserver.observe(target);
// 			updateExercise();
// 			return true;
// 		}
// 		return false;
// 	}
// });


// function updateExercise() {
// 	if (!exercise) return;

// 	const dto = exercise.exportDto();
// 	const actualBlockId = dto.source.settingsBlockId ?? dto.source.bpmDatabaseId;


// 	if (!target || targetBlockId !== actualBlockId) {
// 		console.log("drum trainer: new blockId: " + actualBlockId);

// 		targetBlockId = actualBlockId;
// 		if (actualBlockId) {
// 			setTarget(document.querySelector(`div[data-block-id="${actualBlockId}"]`) as HTMLDivElement | undefined);
// 			if (target) {
// 				//positionObserver.observe(target);
// 			} else {
// 				console.log(`drum trainer: target block ${actualBlockId} not found, listening to dom changes`);

// 				targetObserver.observe(
// 					document.querySelector(`div#notion-app`) ?? document.body,
// 					{
// 						subtree: true,
// 						childList: true,
// 						//attributeFilter: ["data-block-id"],
// 					}
// 				);
// 			}
// 		} else {
// 			setTarget(undefined);
// 		}
// 	}

// 	if (!target) {
// 		//positionObserver.disconnect();

// 		if (reactRoot) {
// 			console.log("drum trainer: unmounting popup");
// 			reactRoot.unmount();
// 			reactRoot = undefined;
// 		}

// 		if (container) {
// 			//container.setAttribute("style", `position: absolute; top: 0; left: 0`);
// 		}

// 	} else {

// 		targetObserver.disconnect();

// 		if (!container) {
// 			container = document.createElement('div');
// 			container.id = "drum-trainer-container";
// 			document.body.appendChild(container);
// 			// document.addEventListener("scroll", e => {
// 			// 	if (target && container) {
// 			// 		console.log("onscroll");
// 			// 		const rect = target.getBoundingClientRect();
// 			// 		container.setAttribute("style", `position: fixed; top: ${rect.top}px; left: ${rect.left}px; z-index: 1000;`);
// 			// 	}
// 			// })
// 		}

// 		const rect = target.getBoundingClientRect();
// 		container.style.zIndex = "1000";
// 		container.style.position = "absolute";
// 		container.style.bottom = "8px";
// 		container.style.right = "8px";

// 		if (!reactRoot) {
// 			console.log("drum trainer: rendering popup");
// 			reactRoot = createRoot(container);
// 			renderApp(reactRoot, <Popup exercise={exercise} />);
// 		}
// 	}
// }



