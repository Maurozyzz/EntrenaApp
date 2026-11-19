import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useLanguage } from '../lib/i18n';
import { formatDate } from '../lib/format';
import { translateExerciseName } from '../lib/catalogTranslations';
import { applyRoutineChanges, routineProposalOf } from '../lib/routineRequests';
import type { ChangeRequest, RoutineChange } from '../lib/routineRequests';
import { Button } from './ui/Button';
import './Chat.css';

interface Props {
  studentId: string;
  trainerId: string;
  /** Avisa al padre que cambió algo (para refrescar badges o la rutina). */
  onChange?: () => void;
}

/** Pedidos de cambio del alumno con la propuesta del asistente; el entrenador aprueba o rechaza. */
export function RequestsInbox({ studentId, trainerId, onChange }: Props) {
  const { t, lang } = useLanguage();
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [exerciseNames, setExerciseNames] = useState<Record<number, string>>({});
  const [rowExercise, setRowExercise] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error: loadErr } = await supabase
      .from('adaptation_requests')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(30);
    if (loadErr) {
      setError(t('requests.unavailable'));
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as ChangeRequest[];
    // Pendientes primero, después el resto por fecha.
    rows.sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending'));
    setRequests(rows);

    const changes = rows.flatMap((r) => routineProposalOf(r.parsed_action)?.changes ?? []);
    const rowIds = [...new Set(changes.map((c) => c.routine_exercise_id))];
    const newIds = changes.flatMap((c) => (c.type === 'replace_exercise' ? [c.new_exercise_id] : []));
    const rowMap: Record<number, number> = {};
    if (rowIds.length > 0) {
      const { data: reRows } = await supabase.from('routine_exercises').select('id, exercise_id').in('id', rowIds);
      for (const r of reRows ?? []) rowMap[r.id as number] = r.exercise_id as number;
    }
    const exIds = [...new Set([...Object.values(rowMap), ...newIds])];
    const names: Record<number, string> = {};
    if (exIds.length > 0) {
      const { data: exRows } = await supabase.from('exercises').select('id, name').in('id', exIds);
      for (const e of exRows ?? []) names[e.id as number] = translateExerciseName(e.name as string, lang);
    }
    setRowExercise(rowMap);
    setExerciseNames(names);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  function nameOfRow(routineExerciseId: number) {
    const exId = rowExercise[routineExerciseId];
    return (exId != null && exerciseNames[exId]) || t('requests.removedExercise');
  }

  function describe(change: RoutineChange): string {
    const name = change.exercise_name ? translateExerciseName(change.exercise_name, lang) : nameOfRow(change.routine_exercise_id);
    if (change.type === 'replace_exercise') {
      return t('requests.replace', { from: name, to: exerciseNames[change.new_exercise_id] ?? `#${change.new_exercise_id}` });
    }
    if (change.type === 'add_note') return t('requests.note', { name, note: change.note });
    const parts: string[] = [];
    if (change.sets != null) parts.push(t('requests.sets', { n: change.sets }));
    if (change.reps != null) parts.push(t('requests.reps', { reps: change.reps }));
    if (change.weight_target != null) parts.push(`${String(change.weight_target).replace('.', ',')} kg`);
    if (change.rest_seconds != null) parts.push(t('requests.rest', { s: change.rest_seconds }));
    return t('requests.adjust', { name, details: parts.join(' · ') });
  }

  async function notifyStudent(body: string) {
    // Si el chat todavía no existe en la base, el aviso simplemente no se manda.
    await supabase.from('messages').insert({ student_id: studentId, trainer_id: trainerId, body });
  }

  async function decide(request: ChangeRequest, approve: boolean) {
    setBusy(request.id);
    setError(null);
    setNotice(null);
    const proposal = routineProposalOf(request.parsed_action);
    let notes = approve ? t('requests.notesApproved') : t('requests.notesRejected');
    if (approve && proposal && proposal.changes.length > 0) {
      const result = await applyRoutineChanges(supabase, studentId, proposal.changes);
      if (result.error) {
        setBusy(null);
        setError(t('common.saveFailed', { message: result.error.message }));
        return;
      }
      notes = t('requests.appliedCount', { applied: result.applied, skipped: result.skipped });
      setNotice(notes);
    }
    const { error: updErr } = await supabase
      .from('adaptation_requests')
      .update({ status: approve ? 'applied' : 'rejected', resolution_notes: notes, resolved_at: new Date().toISOString() })
      .eq('id', request.id);
    if (updErr) {
      setBusy(null);
      setError(t('common.saveFailed', { message: updErr.message }));
      return;
    }
    await notifyStudent(
      approve
        ? proposal && proposal.changes.length > 0
          ? t('requests.msgApproved')
          : t('requests.msgSeen')
        : t('requests.msgRejected'),
    );
    setBusy(null);
    await load();
    onChange?.();
  }

  if (loading) return <p style={{ color: 'var(--oc-text-muted)' }}>{t('common.loading')}</p>;
  if (error && requests.length === 0) return <p style={{ color: 'var(--oc-danger)', fontSize: 13 }}>{error}</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-3)' }}>
      {error && <p style={{ color: 'var(--oc-danger)', fontSize: 13, margin: 0 }}>{error}</p>}
      {notice && <p style={{ color: 'var(--oc-energy)', fontSize: 13, margin: 0 }}>{notice}</p>}
      {requests.length === 0 && <p style={{ color: 'var(--oc-text-muted)', fontSize: 13, margin: 0 }}>{t('requests.none')}</p>}
      {requests.map((r) => {
        const proposal = routineProposalOf(r.parsed_action);
        const pending = r.status === 'pending';
        return (
          <div key={r.id} className="oc-req">
            <div className="oc-req__head">
              <span>{formatDate(r.created_at, lang)}</span>
              <span className={`oc-badge ${pending ? 'oc-badge--warning' : r.status === 'applied' ? 'oc-badge--energy' : 'oc-badge--muted'}`}>
                {t(`requests.status.${r.status}`)}
              </span>
            </div>
            <p className="oc-req__text">“{r.request_text}”</p>
            {proposal?.summary && <p className="oc-req__summary">{proposal.summary}</p>}
            {proposal && proposal.changes.length > 0 ? (
              <>
                <strong style={{ fontSize: 13 }}>{t('requests.proposal')}</strong>
                <ul className="oc-req__changes">
                  {proposal.changes.map((c, i) => (
                    <li key={i}>
                      {describe(c)}
                      {c.reason && (
                        <>
                          <br />
                          <small>{c.reason}</small>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              pending && <p className="oc-req__summary">{t('requests.noProposal')}</p>
            )}
            {pending && (
              <div className="oc-req__actions">
                <Button onClick={() => decide(r, true)} disabled={busy === r.id}>
                  {proposal && proposal.changes.length > 0 ? t('requests.approve') : t('requests.markSeen')}
                </Button>
                {proposal && proposal.changes.length > 0 && (
                  <Button variant="ghost" onClick={() => decide(r, false)} disabled={busy === r.id}>
                    {t('requests.reject')}
                  </Button>
                )}
              </div>
            )}
            {!pending && r.resolution_notes && <p className="oc-req__summary">{r.resolution_notes}</p>}
          </div>
        );
      })}
    </div>
  );
}
