# ably-test

## requirements

-   NodeJS > 14.0.0
-   NPM > 7.0.0
-   An Ably API Key

## build

```sh
npm i
npm run build
```

## run

Set your Key as an environment variable:

```sh
export API_KEY=the_key
```

Then run the built program:

```text
node build/index.js [options]

Options:
  -c, --channel <name>          channel name to use
  -i, --initial-count <amount>  how many initial messages to send (default: 3)
  -w, --initial-wait <amount>   how long to wait between sending messages (s) (default: 5)
  -l, --listen-time <time>      how long to listen for responses (s) (default: 30)
  -h, --help                    display help for command
```
