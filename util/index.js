import { getPort } from './port.js';
import { createDbAndTable } from './database.js';
import { dockerBack, backCode } from './backend.js';
import { dockerFront, frontCode } from './frontend.js';

export default {
  getPort,
  createDbAndTable,
  dockerBack,
  backCode,
  dockerFront,
  frontCode
};
