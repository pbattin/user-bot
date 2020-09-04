/* eslint-disable comma-dangle */
/* eslint-disable @typescript-eslint/indent */
import { Client as DiscordClient, Message } from 'discord.js';
import { timer } from 'rxjs';
import pgPromise from 'pg-promise';
import * as path from 'path';
import settings from '../settings.json';
import { IBumper } from './models/bumper';

// initializing the library:
const pgp = pgPromise(undefined);
pgp.pg.defaults.max = 20; // Max pool size
pgp.pg.defaults.ssl = process.env.DATABASE_URL
  ? {
      rejectUnauthorized: false
    }
  : false;
// database object:
const db = pgp(settings.localDb || process.env.DATABASE_URL || '');

// Helper for linking to external query files:
function sql(file: string) {
  const fullPath = path.join(__dirname, file);
  return new pgp.QueryFile(fullPath, { minify: true });
}
// Create a QueryFile globally, once per file:
const logExceptionSql = sql('./queries/log_exception.sql');
const getBumpChannelsSql = sql('./queries/get_bump_channels.sql');
const activeChannels: string[] = [];
let disboardChannels: IBumper[];
const botClient = new DiscordClient();

const logException = async (
  message: string,
  method: string,
  misc: string[]
) => {
  db.none(logExceptionSql, {
    message,
    method,
    misc
  });
};
const getDisboardBumpChannels = async () => {
  db.manyOrNone(getBumpChannelsSql).then((channels: IBumper[]) => {
    disboardChannels = channels;
  });
};

botClient.on('ready', () => {
  // eslint-disable-next-line no-console
  console.log('Ready!');
  botClient.user?.setActivity('bumps', {
    type: 'LISTENING'
  });
  getDisboardBumpChannels();
});
botClient.login(settings.token || process.env.token);

botClient.on('message', (msg: Message) => {
  if (msg.content.toLocaleLowerCase().startsWith('!auto bump')) {
    const bumper = disboardChannels.find(
      (d: IBumper) => d.bumperid === msg.author.id
    );
    if (
      msg.channel.id === bumper?.channelid &&
      !activeChannels.some((c) => c === bumper?.channelid)
    ) {
      timer(0, 7230000).subscribe(() => {
        msg.channel
          .send('!d bump')
          .then(() => activeChannels.push(bumper.channelid))
          .catch((err) => {
            logException(err, 'botClient.on', [
              "botClient.on('message', (msg: Message)",
              "msg.channel.send('!d bump')",
              'Line: 69'
            ]);
          });
      });
    }
  }
});
