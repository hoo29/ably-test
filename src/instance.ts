import * as Ably from 'ably';

import { logger } from './logger';

export interface MessageData {
    senderId: string;
    senderTimestamp: string;
    receiverId?: string;
    receivedTimestamp?: string;
}

export interface MyMessage extends Ably.Types.Message {
    data: MessageData;
}

export class Instance {
    public readonly messageStore: MessageData[] = [];

    constructor(private readonly ably: Ably.Realtime, public readonly id: string) {}

    public async subToChannel(channelName: string) {
        const channel = this.ably.channels.get(channelName);
        // explicitly attach to avoid race conditions
        await new Promise<void>((resolve, reject) => channel.attach(err => (err ? reject(err) : resolve())));

        channel.subscribe((message: MyMessage) => {
            const respondedTo = typeof message.data.receiverId !== 'undefined';
            const sentByUs = message.data.senderId === this.id;
            if (!sentByUs && !respondedTo) {
                message.data.receiverId = this.id;
                message.data.receivedTimestamp = process.hrtime.bigint().toString();
                this.pubMessage(channelName, message.data);
            } else if (sentByUs && !respondedTo) {
                logger.trace(`${this.id} ignoring non replied message from self`);
            } else if (!sentByUs && respondedTo) {
                logger.trace(`${this.id} ignoring non replied message not for us`);
            } else if (sentByUs && respondedTo) {
                this.messageStore.push(message.data);
            } else {
                logger.fatal({ respondedTo, sentByUs }, 'unknown state');
                // TODO: remove this?
                process.exit(1);
            }
        });
    }

    public pubMessage(channelName: string, message: MessageData) {
        logger.debug({ message }, 'sending');
        const channel = this.ably.channels.get(channelName);
        channel.publish({ data: message });
    }

    public unsubscribe(channelName: string) {
        logger.debug({ id: this.id }, 'unsubscribing');

        const channel = this.ably.channels.get(channelName);
        channel.unsubscribe();
    }
}

export const initAbly = async (apiKey: string) => {
    const ably = new Ably.Realtime({
        key: apiKey,
    });

    // TODO: nicer way for this?
    await new Promise<void>((resolve, reject) => {
        // assume connected and failed event might occur more than once, ignore the initial connection promise if so
        let resolved = false;
        ably.connection.on('connected', () => {
            if (!resolved) {
                resolved = true;
                resolve();
            }
        });

        ably.connection.on('failed', message => {
            logger.fatal({ message }, 'ably failed');
            if (!resolved) {
                resolved = true;
                reject(new Error('initial connection failure'));
            }
        });
    });

    // TODO: check if ably handles this for us
    process.on('SIGTERM', handleServerShutdown('SIGTERM', ably));
    process.on('SIGINT', handleServerShutdown('SIGINT', ably));

    return ably;
};

const handleServerShutdown = (event: string, ably: Ably.Realtime) => () => {
    logger.debug({ event, clientId: ably.clientId }, 'got server shutdown event');
    ably.close();
};
