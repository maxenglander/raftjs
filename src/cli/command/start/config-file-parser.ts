import * as fs from 'fs';
import * as path from 'path';

import { ICluster } from '../../../cluster';
import * as logger from '../../../logger';
import { ICreateServerOptions } from '../../../server';
import { IEndpoint, createEndpoint } from '../../../net/endpoint';

// A config file parser that accepts a file path,
// validates the contents, and returns a configuration
// object to be used for creating and starting a
// raft server. An example config file is:
// ```
// {
//   "cluster": {
//     "servers": {
//       "server-a": { "host": "127.0.0.1", "port": 9080 },
//       "server-b": { "host": "127.0.0.1", "port": 9081 },
//       "server-c": { "host": "127.0.0.1", "port": 9082 }
//     }
//   },
//   "dataDir": "../data/server-a",
//   "id": "server-a",
//   "logger": {
//     "level": "debug",
//     "pretty": true
//   }
// }
// ```
export function parseConfigFile(configFile: string): ICreateServerOptions {
  const config = JSON.parse(fs.readFileSync(configFile).toString());

  if (!config['id']) throw new Error(`Config is missing required key 'id'.`);

  const id: string = config['id'];

  if (!config['cluster'])
    throw new Error(`Config is missing required key 'cluster'.`);

  const cluster: ICluster = parseCluster(config['cluster']);

  if (!(id in cluster.servers))
    throw new Error(
      `Config defines a server 'id' not present in 'cluster.servers'.`
    );

  if (!config['dataDir'])
    throw new Error(`Config is missing required key 'dataDir'.`);

  const dataDir = parseDataDir(configFile, config['dataDir']);

  const logger = parseLogger(config['logger']);

  return {
    cluster,
    dataDir,
    id,
    logger
  };
}

// Parses the cluster configuration.
function parseCluster(
  config: any // eslint-disable-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
): ICluster {
  if (!config['servers'])
    throw new Error(`Config is missing required key 'cluster.servers'.`);

  const servers: { [id: string]: IEndpoint } = parseClusterServers(
    config['servers']
  );

  return {
    servers
  };
}

// Parses the cluster members.
function parseClusterServers(
  config: any // eslint-disable-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
): { [id: string]: IEndpoint } {
  const result: { [id: string]: IEndpoint } = {};

  return Object.keys(config).reduce(function(result, key) {
    result[key] = createEndpoint({
      host: config[key]['host'],
      port: config[key]['port']
    });
    return result;
  }, result);
}

// Parses the absolute path to the directory where
// persistent state such as the current vote and
// term are stored.
function parseDataDir(configFile: string, dataDir: string): string {
  if (path.isAbsolute(dataDir)) {
    return dataDir;
  } else {
    return path.resolve(path.dirname(configFile), dataDir);
  }
}

// Parses the logger level.
function parseLogLevel(
  level: any // eslint-disable-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
): logger.Level {
  if (!(typeof level == 'string'))
    throw new Error("Config 'logger.level' must be a string: " + level);
  if (!['fatal', 'error', 'warn', 'info', 'debug', 'trace'].includes(level))
    throw new Error(
      "Config 'logger.level' must be one of [fatal, error, warn, info, debug, trace]: " +
        level
    );
  return level as logger.Level;
}

// Parses the logger machine-readable flag.
function parseLogMachineReadable(
  machineReadable: any // eslint-disable-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
): boolean {
  if (!(typeof machineReadable == 'boolean'))
    throw new Error(
      "Config 'logger.machineReadable' must be a boolean: " + machineReadable
    );
  return machineReadable as boolean;
}

// Parses the logger configuration.
function parseLogger(
  config: any // eslint-disable-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
): logger.ILogger {
  if (config && !(typeof config == 'object'))
    throw new Error("Config 'logger' must be an objct: " + config);

  const level: logger.Level =
    config && config['level'] ? parseLogLevel(config['level']) : 'error';

  const machineReadable: boolean =
    config && config['machineReadable']
      ? parseLogMachineReadable(config['machineReadable'])
      : false;

  return logger.createLogger({
    level,
    machineReadable
  });
}
