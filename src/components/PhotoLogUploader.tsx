import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useLanguage } from '../lib/i18n';
import { Card } from './ui/Card';
import type { PhotoLog } from '../lib/types';
import './PhotoLogUploader.css';

interface PhotoWithUrl extends PhotoLog {
  url: string | null;
}

interface PhotoLogUploaderProps {
  bucket: string;
  table: 'progress_photos' | 'meal_photos';
  studentId: string;
  uploadLabel: string;
  emptyLabel: string;
  onUploaded?: () => void;
}

export function PhotoLogUploader({ bucket, table, studentId, uploadLabel, emptyLabel, onUploaded }: PhotoLogUploaderProps) {
  const { t } = useLanguage();
  const [photos, setPhotos] = useState<PhotoWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from(table)
      .select('*')
      .eq('student_id', studentId)
      .order('taken_at', { ascending: false });

    const rows = (data ?? []) as PhotoLog[];
    const withUrls = await Promise.all(
      rows.map(async (photo) => {
        const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(photo.storage_path, 60 * 60);
        return { ...photo, url: signed?.signedUrl ?? null };
      }),
    );
    setPhotos(withUrls);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, table]);

  async function handleSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError(null);
    setUploading(true);

    const path = `${studentId}/${Date.now()}-${file.name}`;
    const { error: uploadErr } = await supabase.storage.from(bucket).upload(path, file);
    if (uploadErr) {
      setError(uploadErr.message);
      setUploading(false);
      return;
    }

    const { error: insertErr } = await supabase.from(table).insert({ student_id: studentId, storage_path: path });
    if (insertErr) setError(insertErr.message);

    setUploading(false);
    load();
    onUploaded?.();
  }

  return (
    <div>
      <Card style={{ marginBottom: 'var(--oc-space-4)' }}>
        <label className="oc-photo-upload">
          <input type="file" accept="image/*" onChange={handleSelected} disabled={uploading} hidden />
          <span>{uploading ? t('common.uploading') : uploadLabel}</span>
        </label>
        {error && <p style={{ color: 'var(--oc-danger)', fontSize: 13, marginTop: 'var(--oc-space-2)' }}>{error}</p>}
      </Card>

      {loading ? (
        <p style={{ color: 'var(--oc-text-muted)' }}>{t('common.loading')}</p>
      ) : photos.length === 0 ? (
        <p style={{ color: 'var(--oc-text-muted)' }}>{emptyLabel}</p>
      ) : (
        <div className="oc-photo-grid">
          {photos.map((photo) => (
            <figure key={photo.id} className="oc-photo-thumb">
              {photo.url ? <img src={photo.url} alt={`${photo.taken_at}`} /> : <div className="oc-photo-thumb__fallback" />}
              <figcaption>{photo.taken_at}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
