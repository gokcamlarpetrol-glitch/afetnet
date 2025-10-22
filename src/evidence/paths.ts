// import * as FileSystem from 'expo-file-system'; // Not used
export const DIR = '/tmp/';
export const EV_DIR = DIR + 'evidence/';
export const ATTEST_DIR = EV_DIR + 'attest/';           // per-pack subfolders
export function attestFolder(packId:string){ return ATTEST_DIR + packId + '/'; }
