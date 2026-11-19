import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useLanguage } from '../lib/i18n';
import { formatDate } from '../lib/format';
import { Button } from './ui/Button';
import './Chat.css';

export interface ChatMessage {
  id: string;
  student_id: string;
  trainer_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

interface Props {
  studentId: string;
  trainerId: string;
  meId: string;
  /** Se llama cuando cambia la cantidad de no leídos (para badges). */
  onRead?: () => void;
}

const PAGE = 200;

function timeLabel(iso: string, lang: 'es' | 'en') {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString(lang === 'es' ? 'es-AR' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  return sameDay ? time : `${formatDate(iso, lang)} ${time}`;
}

/** Conversación entre un alumno y su entrenador (tabla messages). */
export function ChatThread({ studentId, trainerId, meId, onRead }: Props) {
  const { t, lang } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  async function markRead() {
    await supabase.rpc('mark_messages_read', { conversation_student_id: studentId });
    onRead?.();
  }

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const { data, error: loadErr } = await supabase
        .from('messages')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(PAGE);
      if (!active) return;
      if (loadErr) setError(t('chat.unavailable'));
      setMessages(((data ?? []) as ChatMessage[]).reverse());
      setLoading(false);
      if (!loadErr) markRead();
    }
    load();

    // Mensajes nuevos en vivo; si Realtime no está activo, se ven al volver a entrar.
    const channel = supabase
      .channel(`messages:${studentId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `student_id=eq.${studentId}` },
        (payload) => {
          const msg = payload.new as ChatMessage;
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
          if (msg.sender_id !== meId) markRead();
        },
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    const { data, error: sendErr } = await supabase
      .from('messages')
      .insert({ student_id: studentId, trainer_id: trainerId, body })
      .select()
      .single();
    setSending(false);
    if (sendErr) {
      setError(t('common.saveFailed', { message: sendErr.message }));
      return;
    }
    setText('');
    setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data as ChatMessage]));
  }

  return (
    <div className="oc-chat">
      <div className="oc-chat__list" aria-live="polite">
        {loading ? (
          <p className="oc-chat__empty">{t('common.loading')}</p>
        ) : messages.length === 0 ? (
          <p className="oc-chat__empty">{t('chat.empty')}</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`oc-msg${m.sender_id === meId ? ' oc-msg--me' : ''}`}>
              <p className="oc-msg__body">{m.body}</p>
              <span className="oc-msg__time">{timeLabel(m.created_at, lang)}</span>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
      {error && <p className="oc-chat__error">{error}</p>}
      <form className="oc-chat__form" onSubmit={send}>
        <textarea
          className="oc-input oc-chat__input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder={t('chat.placeholder')}
          aria-label={t('chat.placeholder')}
          maxLength={2000}
          rows={1}
        />
        <Button type="submit" disabled={sending || !text.trim()}>
          {t('chat.send')}
        </Button>
      </form>
    </div>
  );
}
