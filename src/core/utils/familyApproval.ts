import type { FamilyMember } from '../types/family';

export function isApprovedFamilyMember(member: Partial<FamilyMember> | null | undefined): boolean {
  if (!member?.uid) return false;
  const legacy = member as Partial<FamilyMember> & {
    relationshipStatus?: string;
    isMutual?: boolean;
  };

  return member.approvalState === 'mutual'
    || legacy.relationshipStatus === 'accepted'
    || legacy.isMutual === true;
}
