import { SetMetadata } from '@nestjs/common';
export const THROTTLE_KEY='throttle';
export interface ThrottleOptions {limit:number;ttlMs:number;}
export const Throttle=(limit:number,ttlMs:number)=>SetMetadata(THROTTLE_KEY,{limit,ttlMs} satisfies ThrottleOptions);
