// Simple Hungarian implementation for rectangular matrices (pads with dummy).
export function hungarian(cost: number[][]){
  const n = Math.max(cost.length, cost[0]?.length||0);
  const A = Array.from({ length:n },(_,i)=>Array.from({ length:n },(__,j)=> (cost[i]?.[j] ?? 1e9)));
  // 1) Row reduce
  for(let i=0;i<n;i++){ const min = Math.min(...A[i]); for(let j=0;j<n;j++) {A[i][j]-=min;} }
  // 2) Col reduce
  for(let j=0;j<n;j++){ let min=Infinity; for(let i=0;i<n;i++) {min=Math.min(min,A[i][j]);} for(let i=0;i<n;i++) {A[i][j]-=min;} }
  // 3) Cover zeros and star algorithm
  const starred = Array.from({ length:n },()=>Array(n).fill(false));
  const primed = Array.from({ length:n },()=>Array(n).fill(false));
  const rowCover = Array(n).fill(false), colCover = Array(n).fill(false);
  // star independent zeros
  for(let i=0;i<n;i++){
    for(let j=0;j<n;j++){
      if(A[i][j]===0 && !rowCover[i] && !colCover[j]){ starred[i][j]=true; rowCover[i]=colCover[j]=true; }
    }
  }
  rowCover.fill(false); colCover.fill(false);

  function coverColsWithStar(){ for(let i=0;i<n;i++) {for(let j=0;j<n;j++) {if(starred[i][j]) {colCover[j]=true;}}} }
  function findZero(){ for(let i=0;i<n;i++) {if(!rowCover[i]) {for(let j=0;j<n;j++) {if(!colCover[j] && A[i][j]===0) {return [i,j] as const;}}}} return null; }
  function findStarInRow(r:number){ for(let j=0;j<n;j++) {if(starred[r][j]) {return j;}} return -1; }
  function findStarInCol(c:number){ for(let i=0;i<n;i++) {if(starred[i][c]) {return i;}} return -1; }
  function findPrimeInRow(r:number){ for(let j=0;j<n;j++) {if(primed[r][j]) {return j;}} return -1; }

  coverColsWithStar();
  while(true){
    if(colCover.filter(Boolean).length===n) {break;}
    const z = findZero();
    if(!z){
      // adjust matrix
      let m=Infinity; for(let i=0;i<n;i++) {if(!rowCover[i]) {for(let j=0;j<n;j++) {if(!colCover[j]) {m=Math.min(m,A[i][j]);}}}}
      for(let i=0;i<n;i++){ if(rowCover[i]) {for(let j=0;j<n;j++) {A[i][j]+=m;}} }
      for(let j=0;j<n;j++){ if(!colCover[j]) {for(let i=0;i<n;i++) {A[i][j]-=m;}} }
      continue;
    }
    const [r,c]=z; primed[r][c]=true;
    const starCol = findStarInRow(r);
    if(starCol>=0){
      rowCover[r]=true; colCover[starCol]=false;
    }else{
      // augment path
      const path: [number,number][] = [[r,c]];
      while(true){
        const i = findStarInCol(path[path.length-1][1]);
        if(i<0) {break;}
        path.push([i, path[path.length-1][1]]);
        const j = findPrimeInRow(i);
        path.push([i, j]);
      }
      for(const [i,j] of path){ starred[i][j] = !starred[i][j]; }
      primed.forEach(row=>row.fill(false)); rowCover.fill(false); colCover.fill(false);
      coverColsWithStar();
    }
  }
  // Extract assignment
  const assign: number[] = Array(n).fill(-1);
  for(let i=0;i<n;i++) {for(let j=0;j<n;j++) {if(starred[i][j]) {assign[i]=j;}}}
  return assign.slice(0, cost.length).map((j,i)=> (j<cost[0].length? { row:i, col:j }: { row:i, col:-1 }));
}



