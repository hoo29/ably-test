import { Command, InvalidArgumentError } from 'commander';
import { logger } from './logger';

const program = new Command();

export interface Config {
    apiKey: string;
    channelName: string;
    initialMessageCount: number;
    initialMessageWait: number;
    listenTime: number;
}

const cliParseInt = (value: string, _: any) => {
    const parsedValue = parseInt(value, 10);
    if (isNaN(parsedValue)) {
        throw new InvalidArgumentError('not a number');
    }
    return parsedValue;
};

export const constructConfig: () => Config = () => {
    program
        .requiredOption('-c, --channel <name>', 'channel name to use')
        .option<number>('-i, --initial-count <amount>', 'how many initial messages to send', cliParseInt, 3)
        .option<number>('-w, --initial-wait <amount>', 'how long to wait between sending messages (s)', cliParseInt, 5)
        .option<number>('-l, --listen-time <time>', 'how long to listen for responses (s)', cliParseInt, 30)
        .parse();

    const apiKey = process.env.API_KEY;
    if (typeof apiKey !== 'string') {
        throw new Error('env var API_KEY needs to be set');
    }
    const options = program.opts();

    return {
        apiKey,
        channelName: options.channel,
        initialMessageCount: options.initialCount,
        initialMessageWait: options.initialWait,
        listenTime: options.listenTime,
    };
};

export const safelyPrintConfig = (config: Config) => {
    const safeConfig: Partial<Config> = { ...config };
    delete safeConfig.apiKey;
    logger.debug(safeConfig, 'config');
};
