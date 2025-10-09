import * as FileSystem from "expo-file-system";
import { Team, Approval } from "./types";

const DIR = "/tmp/";
const TEAMS = DIR + "teams.json";
const APPROVALS = DIR + "approvals.json";

export async function listTeams(): Promise<Team[]>{
  const ex = await FileSystem.getInfoAsync(TEAMS);
  if(!ex.exists) {return [];}
  try{ return JSON.parse(await FileSystem.readAsStringAsync(TEAMS)); }catch{ return []; }
}
async function saveTeams(list: Team[]){ await FileSystem.writeAsStringAsync(TEAMS, JSON.stringify(list)); }

export async function upsertTeam(t: Team){
  const list = await listTeams();
  const i = list.findIndex(x=>x.teamId===t.teamId);
  if(i<0) {list.push(t);} else {list[i]=t;}
  await saveTeams(list); return t;
}

export async function listApprovals(now=Date.now()): Promise<Approval[]>{
  const ex = await FileSystem.getInfoAsync(APPROVALS);
  if(!ex.exists) {return [];}
  try{
    const arr = JSON.parse(await FileSystem.readAsStringAsync(APPROVALS)) as Approval[];
    return arr.filter(a => (now - a.createdTs) <= a.ttlSec*1000);
  }catch{ return []; }
}
async function saveApprovals(list: Approval[]){ await FileSystem.writeAsStringAsync(APPROVALS, JSON.stringify(list)); }

export async function upsertApproval(a: Approval, teams?: Team[]){
  const list = await listApprovals();
  const i = list.findIndex(x=>x.id===a.id);
  if(i<0) {list.push(a);} else {list[i]=a;}
  // recompute status based on quorum (if team known)
  const T = teams || await listTeams();
  const team = T.find(t=>t.teamId===a.teamId);
  if(team){
    const uniq = Array.from(new Set(a.signers));
    const valid = uniq.filter(s => team.members.some(m=>m.didShort===s));
    a.signers = valid;
    if(valid.length >= team.quorum.m) {a.status="approved";}
  }
  await saveApprovals(list);
  return a;
}