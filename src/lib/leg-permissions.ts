'use client';

/**
 * Who may hand a request on to the next person.
 *
 * Assignment used to be leads-and-admins only, which stalled the real
 * hand-off: the content writer finishes her part and then has to wait for a
 * lead to name the designer. Two kinds of people know who the work goes to
 * next — whoever holds (or has just closed) a part of the request, and whoever
 * raised it. They get the assignment dropdowns, and only on that request.
 * Delete, mark-complete and User Management stay with leads and the CMO.
 *
 * Note on ids: legs and request POCs carry the sample slug for bridged users
 * and the DB uuid for everyone else, so callers pass both (see `myLegIds`).
 */
import type { Request, RequestLeg } from '@/types';

/** The viewer in both id spaces the app uses: sample slug and DB uuid. */
export function myLegIds(meId?: string | null, myUiId?: string | null): string[] {
  return [meId, myUiId].filter(Boolean) as string[];
}

/** True when one of `myIds` owns a leg on this request that is active or done. */
export function ownsLegOn(legs: RequestLeg[] | undefined, myIds: string[]): boolean {
  if (!legs?.length || !myIds.length) return false;
  return legs.some(
    (l) => !!l.user_id && myIds.includes(l.user_id) && (l.status === 'active' || l.status === 'done'),
  );
}

/**
 * May this person name the next POC on this request?
 *
 * `isLeadOrAdmin` short-circuits; otherwise it is the requestor or a leg owner.
 * The requestor matters because a content writer who raises her own brief owns
 * no leg until someone names her as Social POC — which is exactly the hand-off
 * she is trying to make.
 */
export function canAssignOnRequest(
  request: Pick<Request, 'legs' | 'requestor_id'>,
  myIds: string[],
  isLeadOrAdmin: boolean,
): boolean {
  if (isLeadOrAdmin) return true;
  if (request.requestor_id && myIds.includes(request.requestor_id)) return true;
  return ownsLegOn(request.legs, myIds);
}
