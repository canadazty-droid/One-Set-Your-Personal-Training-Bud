export type ProductEventName="scan_opened"|"scan_started"|"scan_completed"|"scan_failed"|"share_card_created"|"corrective_plan_built"|"correction_cycle_started"|"correction_cycle_workout_completed"|"correction_cycle_rescanned"|"workout_started"|"workout_completed"|"paywall_viewed"|"pricing_plan_selected"|"founding_price_reserved"|"pro_feature_tapped"|"pro_access_granted";
export function getPricingVariant():"control"|"coach_anchor";
export function trackProductEvent(eventName:ProductEventName,properties?:Record<string,string|number|boolean|null|undefined>):void;
