import { useRescueMode } from "../state/rescueMode";
import { useProfile } from "../state/profileStore";
import { useAttestPolicy } from "../state/attestPolicy";
import { paramsFor } from "../profile/params";
import { useRole } from "../state/roleStore";
import { startCarrierMode, stopCarrierMode } from "../transports/carrierCtl"; // create thin control

export function getRescueTuning(mode: ReturnType<typeof useRescueMode.getState>["mode"]){
  switch(mode){
    case "life_saving":
      return { profile:"normal" as const, carrier:true, msgPriority:["sos","e2ee","normal"] as const, beaconMinSec:60, proximityMs:4000, role:"leader" as const };
    case "search":
      return { profile:"low_power" as const, carrier:true, msgPriority:["sos","normal","e2ee"] as const, beaconMinSec:90, proximityMs:4000, role:"coordinator" as const };
    case "logistics":
      return { profile:"normal" as const, carrier:false, msgPriority:["task_notice","normal","e2ee"] as const, beaconMinSec:120, proximityMs:6000, role:"coordinator" as const };
    case "coordination":
    default:
      return { profile:"normal" as const, carrier:false, msgPriority:["e2ee","normal","sos"] as const, beaconMinSec:120, proximityMs:6000, role:"coordinator" as const };
  }
}

export function applyRescueMode(){
  const m = useRescueMode.getState().mode;
  const tune = getRescueTuning(m);
  // set runtime profile
  useProfile.getState().setProfile(tune.profile);
  // (optional) role hint
  useRole.getState().setRole(tune.role);
  // carrier control
  if(tune.carrier) {startCarrierMode();} else {stopCarrierMode();}
  // Further: you may wire msgCourier priority if `task_notice` is present; already SOS/E2EE prioritized.
  // Proximity watcher & beacon repeat values are already fed by profile params; ensure beaconMinSec acts as clamp (phase 47 did).
  return tune;
}



