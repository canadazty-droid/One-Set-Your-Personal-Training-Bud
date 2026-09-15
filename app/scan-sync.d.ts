export type ScanMetricRecord={key:string;score:number;assessed:boolean};
export type ScanRecord={id:string;date:string;type:"form"|"posture";score:number;confidence:number;metrics:ScanMetricRecord[];pending:boolean;repCount?:number;photoCount?:number};
export const SCAN_RECORDS_KEY:string;
export const PENDING_SCANS_KEY:string;
export function readScanRecords():ScanRecord[];
export function queueScanRecord(record:Omit<ScanRecord,"pending">):void;
export function syncPendingScans():Promise<{records:ScanRecord[];pending:number}>;
export function loadSyncedScans():Promise<ScanRecord[]>;
