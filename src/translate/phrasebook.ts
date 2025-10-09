export type Lang = "tr"|"en"|"ar";
export type Pair = { tr:string; en:string; ar:string };

export const PHRASES: Pair[] = [
  { tr:"yardım lazım", en:"i need help", ar:"احتاج مساعدة" },
  { tr:"enkaz altındayım", en:"i am trapped under rubble", ar:"انا محاصر تحت الانقاض" },
  { tr:"nefes almakta zorlanıyorum", en:"i have trouble breathing", ar:"أواجه صعوبة في التنفس" },
  { tr:"su lazım", en:"need water", ar:"أحتاج ماء" },
  { tr:"ilaç lazım", en:"need medicine", ar:"أحتاج دواء" },
  { tr:"kaç kişisiniz", en:"how many people", ar:"كم عدد الاشخاص" },
  { tr:"yaralı var", en:"there are injured", ar:"هناك مصابون" },
  { tr:"konumunuz neresi", en:"what is your location", ar:"أين موقعك" },
  { tr:"bana doğru gelin", en:"come towards me", ar:"تعال نحوي" },
  { tr:"güvende misiniz", en:"are you safe", ar:"هل أنت آمن" }
];

export function translate(input:string, from:Lang, to:Lang){
  const s = input.trim().toLowerCase();
  for(const p of PHRASES){
    if(p[from]===s) {return p[to];}
  }
  // fuzzy prefix match
  const m = PHRASES.find(p=> p[from].startsWith(s));
  return m? m[to] : "";
}



