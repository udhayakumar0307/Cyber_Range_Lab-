/**
 * purchasedLabsService.ts
 * ======================
 * Shared enterprise service layer for purchased lab allocation.
 * All enterprise pages consume this — single source of truth.
 *
 * Events dispatched after payment:
 *   window.dispatchEvent(new CustomEvent('PURCHASED_LABS_UPDATED'))
 */

import { useState, useEffect, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────

export interface PurchasedLabRecord {
  id: number;
  lab_id: string;
  lab_title: string;
  license_key: string;
  total_seats: number;
  assigned_seats: number;
  remaining_seats: number;
  status: string;
  expiry_date: string;
  purchased_date?: string;
  organization_id?: number;
  groups?: { id: number; name: string; member_count: number }[];
}

export interface OrgInventory {
  organization_id: number;
  summary: {
    total_purchased: number;
    total_allocated: number;
    total_remaining: number;
    total_labs: number;
  };
  labs: PurchasedLabRecord[];
}

export interface AllocationRecord {
  id: string;
  purchased_lab_id: number;
  labId: string;
  labTitle: string;
  groupName: string;
  groupId: string;
  assignedSeats: number;
  totalSeats: number;
  remainingSeats: number;
  allocatedDate: string;
  expiryDate: string;
  status: string;
}

// ── Auth helper ────────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

// ── Core API fetchers ──────────────────────────────────────────────────────

export async function fetchPurchasedLabs(): Promise<PurchasedLabRecord[]> {
  const res = await fetch('/api/v1/admin/purchased-labs', { headers: authHeaders() });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function fetchPurchasedLabsMatrix(): Promise<PurchasedLabRecord[]> {
  const res = await fetch('/api/v1/admin/purchased-labs/matrix', { headers: authHeaders() });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function fetchAllocations(): Promise<AllocationRecord[]> {
  const res = await fetch('/api/v1/admin/allocations', { headers: authHeaders() });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function fetchInventory(): Promise<OrgInventory | null> {
  const res = await fetch('/api/v1/admin/inventory', { headers: authHeaders() });
  if (!res.ok) return null;
  return res.json();
}

export async function allocateSeatToUser(labId: string, userEmail: string, seatCount = 1) {
  const res = await fetch('/api/v1/admin/allocations/user', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ lab_id: labId, user_email: userEmail, seat_count: seatCount })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to allocate seat.');
  return data;
}

export async function allocateSeatsToGroup(labId: string, groupId: number, seatCount: number) {
  const res = await fetch('/api/v1/admin/allocations/group', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ lab_id: labId, group_id: groupId, seat_count: seatCount })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to allocate seats to group.');
  return data;
}

export async function revokeSeats(labId: string, seatCount: number) {
  const res = await fetch('/api/v1/admin/licenses/revoke', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ lab_id: labId, seat_count: seatCount })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to revoke seats.');
  return data;
}

// ── Global Event Bus ────────────────────────────────────────────────────────

export const PURCHASED_LABS_UPDATED = 'PURCHASED_LABS_UPDATED';

/** Call this after a successful payment to invalidate all enterprise caches. */
export function dispatchPurchasedLabsUpdated() {
  window.dispatchEvent(new CustomEvent(PURCHASED_LABS_UPDATED));
}

/** Subscribe to post-payment cache invalidation events. Returns cleanup fn. */
export function onPurchasedLabsUpdated(cb: () => void): () => void {
  window.addEventListener(PURCHASED_LABS_UPDATED, cb);
  return () => window.removeEventListener(PURCHASED_LABS_UPDATED, cb);
}

// ── React Hooks ─────────────────────────────────────────────────────────────

/**
 * usePurchasedLabs
 * Fetches the purchased labs matrix (seat breakdown per lab).
 * Automatically re-fetches when PURCHASED_LABS_UPDATED fires.
 */
export function usePurchasedLabs() {
  const [labs, setLabs] = useState<PurchasedLabRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPurchasedLabsMatrix();
      setLabs(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load purchased labs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
    return onPurchasedLabsUpdated(refetch);
  }, [refetch]);

  return { labs, loading, error, refetch };
}

/**
 * useInventory
 * Fetches organization-level seat inventory summary.
 * Re-fetches on PURCHASED_LABS_UPDATED event.
 */
export function useInventory() {
  const [inventory, setInventory] = useState<OrgInventory | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchInventory();
      setInventory(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
    return onPurchasedLabsUpdated(refetch);
  }, [refetch]);

  return { inventory, loading, refetch };
}

/**
 * useAllocations
 * Fetches current allocation records.
 * Re-fetches on PURCHASED_LABS_UPDATED event.
 */
export function useAllocations() {
  const [allocations, setAllocations] = useState<AllocationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllocations();
      setAllocations(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
    return onPurchasedLabsUpdated(refetch);
  }, [refetch]);

  return { allocations, loading, refetch };
}

/**
 * useSeatAllocation
 * Provides allocateSeat function with loading/error state.
 */
export function useSeatAllocation(onSuccess?: () => void) {
  const [allocating, setAllocating] = useState(false);
  const [allocationError, setAllocationError] = useState<string | null>(null);

  const allocateSeat = async (labId: string, userEmail: string, seatCount = 1) => {
    setAllocating(true);
    setAllocationError(null);
    try {
      const result = await allocateSeatToUser(labId, userEmail, seatCount);
      dispatchPurchasedLabsUpdated();
      onSuccess?.();
      return result;
    } catch (e: any) {
      setAllocationError(e.message || 'Allocation failed.');
      throw e;
    } finally {
      setAllocating(false);
    }
  };

  return { allocateSeat, allocating, allocationError, setAllocationError };
}

/**
 * useGroupAllocation
 * Provides allocateGroup function with loading/error state.
 */
export function useGroupAllocation(onSuccess?: () => void) {
  const [allocating, setAllocating] = useState(false);
  const [allocationError, setAllocationError] = useState<string | null>(null);

  const allocateGroup = async (labId: string, groupId: number, seatCount: number) => {
    setAllocating(true);
    setAllocationError(null);
    try {
      const result = await allocateSeatsToGroup(labId, groupId, seatCount);
      dispatchPurchasedLabsUpdated();
      onSuccess?.();
      return result;
    } catch (e: any) {
      setAllocationError(e.message || 'Group allocation failed.');
      throw e;
    } finally {
      setAllocating(false);
    }
  };

  return { allocateGroup, allocating, allocationError, setAllocationError };
}
