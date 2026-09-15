export type ShareMetric={key:string;label?:string;score:number;assessed?:boolean};
export type ShareCardInput={type:"form"|"posture";score:number;confidence:number;metrics:ShareMetric[];change?:number|null;language?:"zh"|"en"};
export function shareCardCopy(input:Pick<ShareCardInput,"type"|"score"|"change"|"language">):{title:string;progress:string;shareText:string};
export function generateShareCard(input:ShareCardInput):Promise<File>;
export function shareOrDownloadCard(input:ShareCardInput):Promise<"shared"|"downloaded">;
