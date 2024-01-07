const express = require('express');
const { Boom } = require('@hapi/boom');
const NodeCache = require('node-cache');
const fs = require('fs');
const Pino = require('pino');
const axios = require('axios');
const baileys = require('@whiskeysockets/baileys');

const app = express();
const port = 3000; // You can change the port as needed

app.use(express.json());

const { useMultiFileAuthState, DisconnectReason, makeInMemoryStore, jidNormalizedUser, makeCacheableSignalKeyStore, PHONENUMBER_MCC, delay } = baileys;

const styledText = (text, fgColorCode, bgColorCode, isBold) => {
  const attributes = [fgColorCode, bgColorCode, isBold];
  const attributeString = attributes.join(';');
  return `\x1b[${attributeString}m${text}\x1b[0m`;
};

const getInput = (text = 'Enter Your Phone number: ') => {
  let input = prompt(styledText(text, 32, 40, 1));
  let res = input ? input.replace(/[^0-9]/g, '') : '';
  if (res && !isNaN(res) && res.length > 7) {
    return res;
  } else {
    console.log(styledText('YOU ENYERED AN INVALID PHONE NUMBER ', 31, 40, 1));
    process.exit(0);
  }
};

const remove = async (dir) => {
  try {
    if (fs.existsSync(dir)) {
      await fs.rmdirSync(dir, { recursive: true });
    }
  } catch {}
};

var phoneNumber = getInput();

let dirName = `sessions/${phoneNumber}'s_info`;

const store = makeInMemoryStore({ logger: Pino({ level: 'silent' }).child({ level: 'silent' }) });

async function start() {
  process.on('unhandledRejection', (err) => console.error(err));

  const { state, saveCreds } = await useMultiFileAuthState(`./${dirName}`);
  const msgRetryCounterCache = new NodeCache();

  const gss = baileys.default({
    logger: Pino({ level: 'silent' }).child({ level: 'silent' }),
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, Pino({ level: 'silent' }).child({ level: 'silent' })),
    },
    browser: ['Chrome (Linux)', '', ''],
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: true,
    getMessage: async (key) => {
      let jid = jidNormalizedUser(key.remoteJid);
      let msg = await store.loadMessage(jid, key.id);
      return msg?.message || '';
    },
    msgRetryCounterCache,
    defaultQueryTimeoutMs: undefined,
  });

  store.bind(gss.ev);

  if (!gss.authState.creds.registered) {
    setTimeout(async () => {
      let code = await gss.requestPairingCode(phoneNumber);
      code = code?.match(/.{1,4}/g)?.join('-') || code;
      console.log(styledText(`\n\nYour Pairing Code:`, 37, 33, 1) + '\t' + styledText(code, 31, 46, 1) + '\n');
      console.log();
    }, 3000);
  }

  gss.ev.on('connection.update', async (update) => {
    const { lastDisconnect, connection, qr } = update;
    if (connection) {
      //console.info(`Connection Status : ${connection}`)
    }

    if (connection === 'close') {
      let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
      if (reason === DisconnectReason.badSession) {
        console.log(`Bad Session File, Please Delete Session and Scan Again`);
        process.exit(0);
      } else if (reason === DisconnectReason.connectionClosed) {
        console.log('Connection closed, reconnecting....');
        await start();
      } else if (reason === DisconnectReason.connectionLost) {
        console.log('Connection Lost from Server, Please run again!');
        process.exit(1);
      } else if (reason === DisconnectReason.connectionReplaced) {
        console.log('Connection Replaced, Another New Session Opened, Please Close Current Session First');
        process.exit(1);
      } else if (reason === DisconnectReason.loggedOut) {
        console.log(`Device Logged Out, Please Scan Again And Run.`);
        process.exit(1);
      } else if (reason === DisconnectReason.restartRequired) {
        await start();
      } else if (reason === DisconnectReason.timedOut) {
        console.log('Connection TimedOut, Reconnecting...');
        await start();
      } else if (reason === DisconnectReason.multideviceMismatch) {
        console.log('Multi device mismatch, please scan again');
        process.exit(0);
      } else {
        console.log(reason);
        process.exit(0);
      }
    }

    if (connection === 'open') {
      console.log('Connected');
      console.log(styledText('DEVICE LOGGED IN 100% ', 31, 40, 1));
      let user = gss.user.id;

      await delay(3000);
      let unique = await fs.readFileSync(__dirname + '/' + dirName + '/creds.json');
      let Scan_ID = Buffer.from(unique).toString('base64');

      console.log(`
  ====================  SESSION ID  ===========================                   
  SESSION-ID ==> ${Scan_ID}\n\n`);
      console.log(styledText(`Don't provide your SESSION_ID to anyone otherwise that user can access your account.
Thanks.`, 32, 40, 1), '\n-------------------  SESSION CLOSED   -----------------------');

      let MESSAGES = `╔════◇
  ║『 *THANKS FOR CHOOSING GSS_BOTWA* 』
  ║ _The Upper text is your session id._
  ╚════════════════════════╝
  
╭──────────────────────⦿   
│       *⎙ S E S S I O N . O S 乂*
╰┬─────────────────────⦿
┌┤
│♤ *Vɪsɪᴛ:* https://sid-bhai.vercel.app
│♤ *Yᴛᴜʙᴇ:* _youtube.com/@SinghaniyaTech0744_
│
╰─────────────────────⦿
  `;
      await gss.sendMessage(user, { text: Scan_ID });
      await gss.sendMessage(user, { text: MESSAGES });
      try {
        remove(dirName);
      } catch {}
      process.exit(1);
    }
  });

  gss.ev.on('creds.update', saveCreds);
}

app.get('/login/:phoneNumber', async (req, res) => {
  const { phoneNumber } = req.params;

  try {
    // Start the login process
    await start();
    res.status(200).send('Login process started. Check the console for details.');
  } catch (error) {
    res.status(500).send(`Error: ${error.message}`);
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
