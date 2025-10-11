// Minimal BLE state watchdog (stubbed to always attempt restart hook)
export async function restartBleIfNeeded(){
  try{
    // here you'd check native state; we just ping courier restart hook if available
    const fn = (global as typeof globalThis).__AFN_BLE_RESTART__;
    if(typeof fn==="function") {await fn();}
  }catch{}
}



