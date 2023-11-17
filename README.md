# Metronome trainer

Chromium-compatible extension (also tested on Android in Yandex browser).
Helps drummers and other musicians to exercise and track progress in Notion pages.
Use metronome to practice a task with current BPM.
Use BPM table to keep track of completed tasks.

![example notion page](./example-notion-page.jpg)

## Getting started

It may take some time for the first time, but once you set it up, workflow becomes pretty efortless.

1. Login to [Notion](https://www.notion.so/).
2. Create an internal integration [here](https://www.notion.so/my-integrations).
3. Install the extension, open its options and paste the secret from created integration.
   The secret will be stored in browser cloud storage and will be used only to access official Notion API.
4. Create an exercise Notion page.
   1. Add a connection for the page to the created integration (Page menu -> Add connections).
      Easiest way is to create a "folder" page, connect only this page to the integration
      and store all the exercises as a nested pages.
      Do not connect your important private pages to the integration
      in order to reduce security and data loss risks.
   2. Open the extension popup and click "Create exercise on current page" button.
      Wait for it to finish and follow instructions on the page.

5. You may need to reload the page in order for metronome to appear
   (it might have a delay due to Notion API speed).
6. Enjoy!

> :bulb: You can create a "template" page with configured database view and typical settings
> and duplicate it whenever you need to create a new exercise.

## Build

```cmd
node --version
corepack enable
yarn --version
yarn
yarn build
```

node version should be >= 18
yarn version should be >= 4

## Useful links

Metronome development:

- <https://meowni.ca/posts/metronomes/>
- <https://github.com/ctrager/metronome.html/blob/master/metronome.html> (<https://ctrager.github.io/metronome.html>)
- <https://webaudiodemos.appspot.com/metronome/index.html>
- <https://codepen.io/ganderzz/pen/poOQbJ>
- <https://seanwayland.github.io/waylonome/>

Speed control:

- <https://github.com/polywock/globalSpeed/tree/master>
- <https://transpose.video/>

Chrome extensions development:

- <https://github.com/chibat/chrome-extension-typescript-starter>

Notion:

- <https://github.com/dlyz/notion-embedded> (`https://dlyz.github.io/notion-embedded`)
