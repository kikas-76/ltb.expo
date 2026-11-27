// Lien /publier : annonce préparée par un visiteur, publiée après la création
// de son compte.
//
// - Sur l'appareil : le brouillon (champs en localStorage, photos en IndexedDB)
//   pour reprendre là où la personne s'est arrêtée.
// - Sur le serveur (fonction listing-draft) : au moment de « Publier », le
//   brouillon et ses photos, retrouvés par un jeton secret. Le jeton est gardé
//   ici et dans user_metadata.publish_draft : le lien de confirmation de
//   l'email peut s'ouvrir dans un autre navigateur (appli Gmail…), qui n'a
//   pas ce brouillon local.

import { Platform } from 'react-native';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { GuestDraft, PhotoItem } from '@/components/screens/CreateListingScreen';

const FIELDS_KEY = 'ltb:publish:fields';
const TOKEN_KEY = 'ltb:publish:token';
const SOURCE_KEY = 'ltb:publish:source';
const DB_NAME = 'ltb-publish';
const STORE = 'kv';
const PHOTOS_KEY = 'photos';

const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';

function ls(): Storage | null {
  try {
    return isWeb ? window.localStorage : null;
  } catch {
    return null;
  }
}

// ─── Canal d'acquisition (?ref=) ───────────────────────────────────────────

export function rememberSource(ref: string | null | undefined) {
  const clean = (ref ?? '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
  if (clean) ls()?.setItem(SOURCE_KEY, clean);
}

export function getSource(): string | null {
  return ls()?.getItem(SOURCE_KEY) ?? null;
}

// ─── Jeton du brouillon serveur ────────────────────────────────────────────

export function getDraftToken(): string | null {
  return ls()?.getItem(TOKEN_KEY) ?? null;
}

export function setDraftToken(token: string) {
  ls()?.setItem(TOKEN_KEY, token);
}

export function clearDraftToken() {
  ls()?.removeItem(TOKEN_KEY);
}

/** Jeton à reprendre après connexion : cet appareil, sinon le compte (lien d'email). */
export function resolveDraftToken(userMetadata?: Record<string, any> | null): string | null {
  const meta = userMetadata?.publish_draft;
  return getDraftToken() ?? (typeof meta === 'string' && meta ? meta : null);
}

// ─── Brouillon local ───────────────────────────────────────────────────────

type StoredPhoto = { blob: Blob; name: string; type: string };
type StoredFields = Omit<GuestDraft, 'photos'>;

function openDb(): Promise<IDBDatabase | null> {
  if (!isWeb || !('indexedDB' in window)) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idb<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest | void): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, mode);
      const req = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req ? (req.result as T) : null);
      tx.onerror = () => resolve(null);
      tx.onabort = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

let lastSavedPhotos: PhotoItem[] | null = null;

export async function saveLocalDraft(draft: GuestDraft) {
  const { photos, ...fields } = draft;
  try {
    ls()?.setItem(FIELDS_KEY, JSON.stringify(fields));
  } catch {
    // stockage plein ou bloqué : le brouillon reste en mémoire
  }
  if (photos === lastSavedPhotos) return;
  lastSavedPhotos = photos;
  const stored: StoredPhoto[] = photos
    .filter((p) => p.file)
    .map((p) => ({ blob: p.file as Blob, name: (p.file as File).name || 'photo.jpg', type: p.file!.type }));
  await idb('readwrite', (s) => s.put(stored, PHOTOS_KEY));
}

export async function loadLocalDraft(): Promise<Partial<GuestDraft> | null> {
  let fields: Partial<StoredFields> | null = null;
  try {
    const raw = ls()?.getItem(FIELDS_KEY);
    fields = raw ? JSON.parse(raw) : null;
  } catch {
    fields = null;
  }
  const stored = (await idb<StoredPhoto[]>('readonly', (s) => s.get(PHOTOS_KEY))) ?? [];
  const photos: PhotoItem[] = stored.map((p) => {
    const file = new File([p.blob], p.name, { type: p.type });
    return { uri: URL.createObjectURL(file), file };
  });
  lastSavedPhotos = null;
  const hasContent = !!(fields?.name || fields?.description || fields?.category || photos.length);
  return hasContent ? { ...fields, photos } : null;
}

export async function clearLocalDraft() {
  lastSavedPhotos = null;
  ls()?.removeItem(FIELDS_KEY);
  await idb('readwrite', (s) => s.delete(PHOTOS_KEY));
}

// ─── Appels serveur ────────────────────────────────────────────────────────

type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; code: string; message?: string };

async function callDraftApi<T>(body: Record<string, unknown>): Promise<ApiResult<T>> {
  const { data, error } = await supabase.functions.invoke('listing-draft', { body });
  if (!error) return { ok: true, data: data as T };
  if (error instanceof FunctionsHttpError) {
    const res = error.context as Response;
    let payload: any = null;
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }
    return { ok: false, status: res.status, code: payload?.error ?? 'error', message: payload?.message };
  }
  return { ok: false, status: 0, code: 'network' };
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid_name: 'Le nom de l\'objet doit faire entre 3 et 80 caractères.',
  invalid_description: 'La description doit faire entre 10 et 500 caractères.',
  invalid_price: 'Indiquez un prix par jour valide.',
  invalid_deposit: 'Indiquez une caution valide (ou laissez vide).',
  invalid_category: 'Choisissez une catégorie.',
  invalid_location: 'Indiquez où se trouve l\'objet.',
  invalid_photos: 'Ajoutez entre 1 et 10 photos.',
  invalid_photo_type: 'Format de photo non pris en charge. Utilisez JPG, PNG ou WEBP.',
  rate_limited: 'Trop de tentatives depuis cette connexion. Réessayez dans une heure.',
  photos_missing: 'Une photo n\'a pas pu être envoyée. Réessayez.',
  network: 'Connexion impossible. Vérifiez votre réseau et réessayez.',
};

export function draftErrorMessage(code: string, message?: string): string {
  if (code === 'blocked_terms' || code === 'rejected' || code === 'account_inactive') {
    return message ?? 'Cette annonce ne peut pas être publiée.';
  }
  return ERROR_MESSAGES[code] ?? 'Une erreur est survenue. Réessayez dans un instant.';
}

/** Réduit la photo (1600 px max, JPEG) : envoi plus rapide sur mobile. */
async function compressPhoto(file: File): Promise<Blob> {
  if (!isWeb) return file;
  try {
    const url = URL.createObjectURL(file);
    try {
      const img = new window.Image();
      img.src = url;
      await img.decode();
      const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
      if (blob && blob.size > 0) return blob;
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    // format que le navigateur ne sait pas décoder : envoi tel quel
  }
  return file;
}

function normalizeType(type: string): string {
  return type === 'image/jpg' ? 'image/jpeg' : type;
}

/** Enregistre le brouillon sur le serveur avec ses photos. Renvoie le jeton. */
export async function uploadDraft(
  draft: GuestDraft,
  onProgress?: (done: number, total: number) => void,
): Promise<{ token: string } | { error: string }> {
  const files = draft.photos.map((p) => p.file).filter((f): f is File => !!f);
  if (files.length === 0 || !draft.category || !draft.location) {
    return { error: draftErrorMessage(files.length === 0 ? 'invalid_photos' : !draft.category ? 'invalid_category' : 'invalid_location') };
  }

  const blobs = await Promise.all(files.map(compressPhoto));
  const types = blobs.map((b, i) => normalizeType(b.type || files[i].type || 'image/jpeg'));

  const created = await callDraftApi<{ token: string; uploads: { path: string; token: string }[] }>({
    action: 'create',
    name: draft.name.trim(),
    description: draft.description.trim(),
    category_id: draft.category.id,
    subcategory_id: draft.subcategory?.id ?? null,
    price: draft.price,
    deposit: draft.deposit || 0,
    location: draft.location,
    photos: types.map((type) => ({ type })),
    source: getSource(),
  });
  if (!created.ok) return { error: draftErrorMessage(created.code, created.message) };

  const { token, uploads } = created.data;
  for (let i = 0; i < uploads.length; i++) {
    onProgress?.(i, uploads.length);
    const { error } = await supabase.storage
      .from('listing-drafts')
      .uploadToSignedUrl(uploads[i].path, uploads[i].token, blobs[i], { contentType: types[i] });
    if (error) return { error: draftErrorMessage('photos_missing') };
  }
  onProgress?.(uploads.length, uploads.length);

  const ready = await callDraftApi<{ status: string }>({ action: 'ready', token });
  if (!ready.ok) return { error: draftErrorMessage(ready.code, ready.message) };

  setDraftToken(token);
  return { token };
}

export interface DraftStatus {
  status: 'pending_photos' | 'ready' | 'publishing' | 'published' | 'failed';
  listing_id: string | null;
  name: string;
  price: number;
  city: string | null;
  address: string;
  photo_url: string | null;
}

/** État du brouillon ; null s'il n'existe plus (supprimé après 7 jours). */
export async function fetchDraftStatus(token: string): Promise<DraftStatus | null | 'error'> {
  const res = await callDraftApi<DraftStatus>({ action: 'status', token });
  if (res.ok) return res.data;
  return res.status === 404 || res.status === 400 ? null : 'error';
}

export type PublishResult =
  | { status: 'published'; listingId: string }
  | { status: 'publishing' }
  | { status: 'error'; code: string; message: string };

/** Publie le brouillon sur le compte connecté (une seule fois, même avec deux onglets). */
export async function publishDraft(token: string): Promise<PublishResult> {
  const res = await callDraftApi<{ status: string; listing_id?: string }>({ action: 'publish', token });
  if (!res.ok) return { status: 'error', code: res.code, message: draftErrorMessage(res.code, res.message) };
  if (res.data.status === 'published' && res.data.listing_id) {
    return { status: 'published', listingId: res.data.listing_id };
  }
  return { status: 'publishing' };
}

/** Tout oublier une fois l'annonce publiée. */
export async function forgetPublishDraft() {
  clearDraftToken();
  await clearLocalDraft();
}
