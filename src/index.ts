const { printTable } = require('console-table-printer');

import { initAbly, Instance, MessageData } from './instance';
import { logger } from './logger';
import { constructConfig, safelyPrintConfig } from './util';

interface TableRow {
    sender: string;
    receiver: string;
    max: number;
    min: number;
    mean: number;
}

(async () => {
    logger.info('starting');

    const config = constructConfig();
    safelyPrintConfig(config);

    // how many clients to create and what they are called
    const clients = ['client1', 'client2', 'client3'];
    // init instances
    logger.info('creating clients');
    const initProms = clients.map(async id => {
        const ably = await initAbly(config.apiKey);
        return new Instance(ably, id);
    });

    const instances = await Promise.all(initProms);

    // sub to channels and set unsub timers
    logger.info('subscribing to channels');
    const timerWaitProms: Promise<void>[] = [];
    const subProms = instances.map(async instance => {
        await instance.subToChannel(config.channelName);
        const timerProm = new Promise<void>(resolve =>
            setTimeout(() => {
                instance.unsubscribe(config.channelName);
                resolve();
            }, config.listenTime * 1000)
        );
        timerWaitProms.push(timerProm);
    });
    await Promise.all(subProms);

    // send messages
    logger.info('sending messages');
    const sendProms = instances.map(async instance => {
        for (let count = 0; count < config.initialMessageCount; ++count) {
            const message: MessageData = {
                senderId: instance.id,
                senderTimestamp: process.hrtime.bigint().toString(),
            };
            instance.pubMessage(config.channelName, message);
            await new Promise<void>(resolve => setTimeout(resolve, config.initialMessageWait * 1000));
        }
    });
    await Promise.all(sendProms);

    // wait for all messages to be received
    logger.info('waiting for all messages to be received');
    await Promise.all(timerWaitProms);
    logger.info('all messages received');

    // print
    const tableRows: TableRow[] = [];
    instances.forEach(instance => {
        const messages = instance.messageStore as Required<MessageData>[];
        const stats = messages.reduce<{ [receiverId: string]: number[] }>((acc, cur) => {
            // we lose precision here but as it's a diff we should be okay in this context, maybe?
            const diff = Number(BigInt(cur.receivedTimestamp) - BigInt(cur.senderTimestamp));
            if (typeof acc[cur.receiverId] === 'undefined') {
                acc[cur.receiverId] = [diff];
            } else {
                acc[cur.receiverId].push(diff);
            }
            return acc;
        }, {});

        for (const [receiverId, diffs] of Object.entries(stats)) {
            const sum = diffs.reduce((acc, cur) => acc + cur, 0);
            tableRows.push({
                sender: instance.id,
                receiver: receiverId,
                min: Math.min(...diffs),
                max: Math.max(...diffs),
                mean: Math.round(sum / diffs.length),
            });
        }
    });

    printTable(tableRows);
})()
    .then(() => logger.debug('done'))
    .catch(err => logger.error({ message: err.message, stack: err.stack }, 'program error'));
