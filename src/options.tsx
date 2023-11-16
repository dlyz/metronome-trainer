import { Input, Label, makeStyles, shorthands, useId } from "@fluentui/react-components";
import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { renderApp } from "./components/App";


const useClasses = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    // Use 2px gap below the label (per the design system)
    ...shorthands.gap("2px"),
  },
});

const Options = () => {
  const [notionToken, setNotionToken] = useState<string>("");

  const inputId = useId("toke-input");
  const classes = useClasses();

  useEffect(() => {
    // Restores select box and checkbox state using the preferences
    // stored in chrome.storage.
    chrome.storage.sync.get(
      {
        notionToken: "",
      },
      (items) => {
        setNotionToken(items.notionToken);
      }
    );
  }, []);

  const updateToken = useCallback((value: string) => {
    setNotionToken(value);

    // Saves options to chrome.storage.sync.
    chrome.storage.sync.set(
      {
        notionToken: value,
      },
      () => {

      }
    );
  }, []);

  return (
      <div className={classes.root}>
        <Label htmlFor={inputId}>Notion token:</Label>
        <Input id={inputId} type="password" value={notionToken} onChange={e => updateToken(e.target.value)} />
      </div>
  );
};

const root = createRoot(document.getElementById("root")!);

renderApp(root, <Options />);