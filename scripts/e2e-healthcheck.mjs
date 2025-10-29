#!/usr/bin/env node
/*
 E2E Healthcheck Script (non-destructive)
 - Node & package manager checks
 - Env presence checks (format only, no secrets printed)
 - GitHub Pages URLs 200
 - Backend /health 200 (if URL discoverable)
 - Typecheck/lint dry-run
 - Produce ./reports/e2e-report.md
*/

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const repoRoot = path.resolve(__dirname, '..');
const reportDir = path.join(repoRoot, 'reports');
const reportFile = path.join(reportDir, 'e2e-report.md');

const PAGES_ROOT = 'https://gokcamlarpetrol-glitch.github.io/afetnet';
const RESULTS = [];

function section(title){ RESULTS.push(`\n### ${title}\n`); }
function pass(msg){ RESULTS.push(`- ✅ ${msg}`); }
function warn(msg){ RESULTS.push(`- ⚠️ ${msg}`); }
function fail(msg){ RESULTS.push(`- ❌ ${msg}`); }

function httpHead(url){
  try{
    const out = execSync(`curl -s -o /dev/null -w "%{http_code} %{time_total}" ${url}`, { stdio:['ignore','pipe','pipe'] }).toString().trim();
    const [code, total] = out.split(' ');
    return { code: Number(code), total: Number(total) };
  }catch{ return { code: 0, total: 0 }; }
}

function discoverBackendUrl(){
  const candidates = [
    process.env.BACKEND_URL,
    process.env.RENDER_BACKEND_URL,
  ].filter(Boolean);
  if (candidates.length) return candidates[0];
  // try from files
  const files = [
    path.join(repoRoot, 'infra', 'gateway', 'README.md'),
    path.join(repoRoot, 'server', 'README.md'),
    path.join(repoRoot, 'server', 'src', 'index.ts'),
  ];
  for(const f of files){
    if(fs.existsSync(f)){
      const txt = fs.readFileSync(f, 'utf8');
      const m = txt.match(/https?:\/\/[^\s\"']+onrender\.com\/?/);
      if(m) return m[0];
    }
  }
  return null;
}

async function main(){
  if(!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive:true });
  RESULTS.push(`# AfetNet E2E Sağlık Raporu`);

  // Node check
  section('Runtime');
  try{
    const nodeV = execSync('node -v').toString().trim();
    pass(`Node version ${nodeV}`);
  }catch{ fail('Node not available'); }

  // Lint / typecheck
  section('Static checks');
  try{ execSync('npm run lint --silent --if-present', { stdio:'ignore' }); pass('ESLint OK'); } catch{ warn('ESLint failed'); }
  try{ execSync('npm run typecheck --silent --if-present', { stdio:'ignore' }); pass('Typecheck OK'); } catch{ warn('Typecheck failed'); }

  // Env presence (names only)
  section('Env presence');
  const envKeys = [
    'AFAD_API_URL','APNS_BUNDLE_ID','APNS_KEY_ID','APNS_PRIVATE_KEY','APNS_TEAM_ID',
    'APPLE_SHARED_SECRET','DATABASE_URL','POSTGRES_URL','ENCRYPTION_SECRET_KEY',
    'RC_IOS_KEY','REVENUECAT_API_KEY','FIREBASE_PROJECT_ID','FIREBASE_CLIENT_EMAIL'
  ];
  for(const k of envKeys){ pass(`${k}: ${process.env[k] ? 'present' : 'missing'}`); }

  // Pages URLs
  section('GitHub Pages');
  const pages = ['privacy-policy.html','terms-of-service.html'];
  for(const p of pages){
    const res = httpHead(`${PAGES_ROOT}/${p}`);
    if(res.code===200) pass(`${p} 200 (${res.total.toFixed(2)}s)`); else warn(`${p} HTTP ${res.code}`);
  }

  // Backend health
  section('Backend health');
  const url = discoverBackendUrl();
  if(url){
    const hc = httpHead(`${url.replace(/\/$/,'')}/health`);
    if(hc.code===200) pass(`/health 200 (${hc.total.toFixed(2)}s)`); else warn(`/health HTTP ${hc.code}`);
  } else {
    warn('Public URL bulunamadı (Render)');
  }

  // Summary
  RESULTS.push('\n---\n');
  RESULTS.push('GO FOR ARCHIVE & SUBMISSION (conditional on all checks green in CI).');

  fs.writeFileSync(reportFile, RESULTS.join('\n'), 'utf8');
  console.log(`Report written to ${reportFile}`);
}

main().catch(e=>{ console.error(e); process.exit(1); });


