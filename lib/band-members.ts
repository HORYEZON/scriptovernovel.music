// lib/band-members.ts — limits + the public shape of a band member.
export const MAX_MEMBER_NAME = 80;
export const MAX_MEMBER_ROLE = 80;
export const MAX_MEMBER_BLURB = 600;

export interface PublicBandMember {
  id: string;
  name: string;
  role: string;
  photoUrl: string | null;
  blurb: string | null;
}
