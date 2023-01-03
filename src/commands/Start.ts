import fs from 'fs';
import { HttpServer } from '../HttpServer';
import { RelayServer } from '../RelayServer';
import { KeyManager } from '../KeyManager';
import { TxStoreManager, TXSTORE_FILENAME } from '../TxStoreManager';

import log from 'loglevel';
import {
  getServerConfig,
  ServerDependencies,
} from '../../src/ServerConfigParams';

function error(err: string): void {
  log.error(err);
  process.exit(1);
}

async function run(): Promise<void> {
  try {
    log.info('Starting Enveloping Relay Server process...\n');
    const { contracts, app, blockchain } = getServerConfig();
    log.setLevel(app.logLevel);
    if (!blockchain.rskNodeUrl) {
      error('missing rskNodeUrl');
    }
    const trustedVerifiers = contracts.trustedVerifiers;

    log.debug('runServer() - provider done');
    // config = await resolveServerConfig(conf, provider);
    log.debug('runServer() - config done');
    if (trustedVerifiers && trustedVerifiers.length > 0) {
      contracts.trustedVerifiers = trustedVerifiers;
    }
    const devMode: boolean = app.devMode;
    const workdir: string = app.workdir;
    if (devMode) {
      if (fs.existsSync(`${workdir}/${TXSTORE_FILENAME}`)) {
        fs.unlinkSync(`${workdir}/${TXSTORE_FILENAME}`);
      }
    }

    const managerKeyManager = new KeyManager(1, workdir + '/manager');
    const workersKeyManager = new KeyManager(1, workdir + '/workers');
    log.debug('runServer() - manager and workers configured');
    const txStoreManager = new TxStoreManager({ workdir });

    const dependencies: ServerDependencies = {
      txStoreManager,
      managerKeyManager,
      workersKeyManager,
    };

    const relayServer = new RelayServer(dependencies);
    await relayServer.init();
    log.debug('runServer() - Relay Server initialized');
    const httpServer = new HttpServer(app.port, relayServer);
    httpServer.start();
    log.debug('runServer() - Relay Server started');
  } catch (e) {
    if (e instanceof Error) {
      error(e.message);
    } else {
      log.error(e);
    }
  }
}

run()
  .then(() => {
    log.debug('runServer() - Relay Server running');
  })
  .catch((error) => {
    log.error('runServer() - Error running server', error);
  });
