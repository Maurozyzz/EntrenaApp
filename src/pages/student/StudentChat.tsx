import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import { useLanguage } from '../../lib/i18n';
import { formatDate } from '../../lib/format';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ChatThread } from '../../components/ChatThread';
import type { ChangeRequest } from '../../lib/routineRequests';
import { STUDENT_NAV } from './nav';
import '../../components/Chat.css';
// Pestañas (.oc-tabs) compartidas con la ficha del alumno.
import '../coach/CoachStudents.css';

type Mode = 'coach' | 'assistant';

export function StudentChat() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [mode, setMode] = useState<Mode>('coach');

  if (!profile) return null;

  return (
    <AppShell links={STUDENT_NAV}>
      <h1 style={{ color: 'var(--oc-gold)', marginBottom: 'var(--oc-space-2)' }}>{t('chat.title')}</h1>
      <div className="oc-tabs" role="tablist" aria-label={t('chat.title')}>
        {(['coach', 'assistant'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`oc-tab${mode === m ? ' oc-tab--on' : ''}`}
          >
            {t(m === 'coach' ? 'chat.withCoach' : 'chat.askChange')}
          </button>
        ))}
      </div>

      {!profile.trainer_id ? (
        <p style={{ color: 'var(--oc-text-muted)' }}>{t('chat.noTrainer')}</p>
      ) : mode === 'coach' ? (
        <Card>
          <ChatThread studentId={profile.id} trainerId={profile.trainer_id} meId={profile.id} />
        </Card>
      ) : (
        <AssistantPanel studentId={profile.id} trainerId={profile.trainer_id} />
      )}
    </AppShell>
  );
}

function AssistantPanel({ studentId, trainerId }: { studentId: string; trainerId: string }) {
  const { t, lang } = useLanguage();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<ChangeRequest[]>([]);

  async function load() {
    const { data } = await supabase
      .from('adaptation_requests')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(10);
    setRequests((data ?? []) as ChangeRequest[]);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    setReply(null);

    // 1) El asistente arma una propuesta y la deja pendiente para el entrenador.
    const { data, error: fnErr } = await supabase.functions.invoke('routine-assistant', { body: { text: body } });
    if (!fnErr && data?.reply) {
      setReply(data.reply as string);
    } else if (fnErr && 'context' in fnErr && (fnErr.context as Response | undefined)?.status === 429) {
      setSending(false);
      setError(t('assistant.tooMany'));
      return;
    } else {
      // 2) Si el asistente no está disponible, el pedido igual le llega al entrenador.
      const { error: insErr } = await supabase
        .from('adaptation_requests')
        .insert({ student_id: studentId, trainer_id: trainerId, request_text: body, scope: 'training' });
      if (insErr) {
        setSending(false);
        setError(t('common.saveFailed', { message: insErr.message }));
        return;
      }
      setReply(t('assistant.sentToCoach'));
    }
    setSending(false);
    setText('');
    load();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-4)' }}>
      <Card>
        <p style={{ marginTop: 0, color: 'var(--oc-text-muted)', fontSize: 14 }}>{t('assistant.intro')}</p>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-3)' }}>
          <textarea
            className="oc-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('assistant.placeholder')}
            aria-label={t('assistant.placeholder')}
            maxLength={1000}
            rows={3}
            style={{ resize: 'vertical' }}
          />
          <div>
            <Button type="submit" disabled={sending || !text.trim()}>
              {sending ? t('assistant.thinking') : t('assistant.send')}
            </Button>
          </div>
        </form>
        {reply && <p className="oc-req__reply" style={{ marginTop: 'var(--oc-space-4)' }}>{reply}</p>}
        {error && <p style={{ color: 'var(--oc-danger)', fontSize: 13, marginBottom: 0 }}>{error}</p>}
      </Card>

      {requests.length > 0 && (
        <Card>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>{t('assistant.myRequests')}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-3)' }}>
            {requests.map((r) => (
              <div key={r.id} className="oc-req">
                <div className="oc-req__head">
                  <span>{formatDate(r.created_at, lang)}</span>
                  <span
                    className={`oc-badge ${r.status === 'pending' ? 'oc-badge--warning' : r.status === 'applied' ? 'oc-badge--energy' : 'oc-badge--muted'}`}
                  >
                    {t(`assistant.status.${r.status}`)}
                  </span>
                </div>
                <p className="oc-req__text">“{r.request_text}”</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
