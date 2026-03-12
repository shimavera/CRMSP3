import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Loader2, Video, X, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { UserProfile, CalendarEvent } from '../lib/supabase';

interface CalendarViewProps {
    authUser: UserProfile;
}

// ─── MODAL DE EVENTO ─────────────────────────────────────────────────────────

function EventModal({ event, onClose, onSave, onDelete, authUser, defaultDate }: {
    event: CalendarEvent | null;
    onClose: () => void;
    onSave: (data: Partial<CalendarEvent>) => Promise<void>;
    onDelete?: (id: number) => Promise<void>;
    authUser: UserProfile;
    defaultDate?: Date;
}) {
    const isNew = !event;
    const now = defaultDate || new Date();

    const defaultStart = new Date(now);
    defaultStart.setMinutes(0, 0, 0);
    if (defaultStart.getHours() < 8) defaultStart.setHours(9, 0, 0, 0);
    const defaultEnd = new Date(defaultStart);
    defaultEnd.setMinutes(defaultEnd.getMinutes() + 30);

    const [form, setForm] = useState({
        title: event?.title || '',
        description: event?.description || '',
        start_time: event?.start_time
            ? new Date(event.start_time).toISOString().slice(0, 16)
            : defaultStart.toISOString().slice(0, 16),
        end_time: event?.end_time
            ? new Date(event.end_time).toISOString().slice(0, 16)
            : defaultEnd.toISOString().slice(0, 16),
        status: event?.status || 'scheduled' as CalendarEvent['status'],
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        if (!form.title.trim()) { setError('Informe o título'); return; }
        if (!form.start_time || !form.end_time) { setError('Informe horário início e fim'); return; }
        if (new Date(form.end_time) <= new Date(form.start_time)) { setError('Horário fim deve ser após o início'); return; }

        setSaving(true);
        setError('');
        try {
            await onSave({
                ...(event?.id ? { id: event.id } : {}),
                title: form.title.trim(),
                description: form.description.trim() || undefined,
                start_time: new Date(form.start_time).toISOString(),
                end_time: new Date(form.end_time).toISOString(),
                status: form.status as CalendarEvent['status'],
                company_id: authUser.company_id!,
            });
        } catch (e: any) {
            setError(e.message || 'Erro ao salvar');
        } finally {
            setSaving(false);
        }
    };

    const labelStyle: React.CSSProperties = { fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' };
    const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-soft)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' };

    return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
            <div style={{ background: 'var(--bg-secondary)', borderRadius: '16px', padding: '2rem', width: '440px', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)', margin: 0 }}>
                        {isNew ? 'Novo Agendamento' : 'Editar Agendamento'}
                    </h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Título */}
                    <div>
                        <label style={labelStyle}>Título *</label>
                        <input
                            style={inputStyle}
                            placeholder="Ex: Consulta inicial com paciente"
                            value={form.title}
                            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                            autoFocus
                        />
                    </div>

                    {/* Descrição */}
                    <div>
                        <label style={labelStyle}>Descrição</label>
                        <textarea
                            style={{ ...inputStyle, minHeight: '70px', resize: 'vertical', fontFamily: 'inherit' }}
                            placeholder="Detalhes do agendamento (opcional)"
                            value={form.description}
                            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        />
                    </div>

                    {/* Horários */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <label style={labelStyle}>Início *</label>
                            <input
                                type="datetime-local"
                                style={inputStyle}
                                value={form.start_time}
                                onChange={e => {
                                    const newStart = e.target.value;
                                    setForm(f => {
                                        const s = new Date(newStart);
                                        const oldEnd = new Date(f.end_time);
                                        const diff = oldEnd.getTime() - new Date(f.start_time).getTime();
                                        const newEnd = new Date(s.getTime() + (diff > 0 ? diff : 30 * 60000));
                                        return { ...f, start_time: newStart, end_time: newEnd.toISOString().slice(0, 16) };
                                    });
                                }}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Fim *</label>
                            <input
                                type="datetime-local"
                                style={inputStyle}
                                value={form.end_time}
                                onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                            />
                        </div>
                    </div>

                    {/* Status (só para edição) */}
                    {!isNew && (
                        <div>
                            <label style={labelStyle}>Status</label>
                            <select
                                style={inputStyle}
                                value={form.status}
                                onChange={e => setForm(f => ({ ...f, status: e.target.value as CalendarEvent['status'] }))}
                            >
                                <option value="scheduled">Agendado</option>
                                <option value="completed">Realizado</option>
                                <option value="cancelled">Cancelado</option>
                                <option value="no_show">No Show</option>
                            </select>
                        </div>
                    )}

                    {/* Google sync badge (só para edição) */}
                    {event?.google_event_id && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#4285F4', padding: '8px 12px', background: 'rgba(66,133,244,0.1)', borderRadius: '8px' }}>
                            <Video size={14} /> Sincronizado com Google Calendar
                        </div>
                    )}

                    {/* Erro */}
                    {error && (
                        <div style={{ padding: '10px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#ef4444', fontSize: '0.85rem' }}>
                            {error}
                        </div>
                    )}

                    {/* Ações */}
                    <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                        {!isNew && onDelete && (
                            <button
                                onClick={async () => {
                                    if (confirm('Remover este agendamento?')) {
                                        setSaving(true);
                                        await onDelete(event!.id);
                                    }
                                }}
                                style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                                <Trash2 size={14} /> Remover
                            </button>
                        )}
                        <div style={{ flex: 1 }} />
                        <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border-soft)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem' }}>
                            Cancelar
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={saving}
                            className="btn-primary"
                            style={{ padding: '10px 24px', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', opacity: saving ? 0.7 : 1 }}
                        >
                            {saving ? <Loader2 size={14} className="spin" /> : null}
                            {isNew ? 'Criar Agendamento' : 'Salvar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────

export default function CalendarView({ authUser }: CalendarViewProps) {
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [modalEvent, setModalEvent] = useState<CalendarEvent | null | 'new'>(null);
    const [modalDefaultDate, setModalDefaultDate] = useState<Date | undefined>();

    useEffect(() => {
        fetchEvents();
    }, [currentDate]);

    const fetchEvents = async () => {
        setIsLoading(true);
        try {
            const startOfWeek = new Date(currentDate);
            startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
            startOfWeek.setHours(0, 0, 0, 0);

            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(endOfWeek.getDate() + 6);
            endOfWeek.setHours(23, 59, 59, 999);

            const { data, error } = await supabase
                .from('sp3_calendar_events')
                .select('*')
                .eq('company_id', authUser.company_id!)
                .gte('start_time', startOfWeek.toISOString())
                .lte('start_time', endOfWeek.toISOString());

            if (!error && data) {
                setEvents(data);
            }
        } catch (err) {
            console.error('Erro ao buscar eventos:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveEvent = async (data: Partial<CalendarEvent>) => {
        if (data.id) {
            // Update
            const { error } = await supabase
                .from('sp3_calendar_events')
                .update({
                    title: data.title,
                    description: data.description,
                    start_time: data.start_time,
                    end_time: data.end_time,
                    status: data.status,
                })
                .eq('id', data.id);
            if (error) throw error;
        } else {
            // Insert
            const { error } = await supabase
                .from('sp3_calendar_events')
                .insert({
                    company_id: data.company_id,
                    title: data.title,
                    description: data.description,
                    start_time: data.start_time,
                    end_time: data.end_time,
                    status: data.status || 'scheduled',
                });
            if (error) throw error;
        }
        setModalEvent(null);
        fetchEvents();
    };

    const handleDeleteEvent = async (id: number) => {
        const { error } = await supabase.from('sp3_calendar_events').delete().eq('id', id);
        if (error) { alert('Erro ao remover: ' + error.message); return; }
        setModalEvent(null);
        fetchEvents();
    };

    const handlePrevWeek = () => {
        const d = new Date(currentDate);
        d.setDate(d.getDate() - 7);
        setCurrentDate(d);
    };

    const handleNextWeek = () => {
        const d = new Date(currentDate);
        d.setDate(d.getDate() + 7);
        setCurrentDate(d);
    };

    const handleToday = () => {
        setCurrentDate(new Date());
    };

    const getDaysOfWeek = () => {
        const days = [];
        const start = new Date(currentDate);
        start.setDate(currentDate.getDate() - currentDate.getDay());
        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            days.push(d);
        }
        return days;
    };

    const weekDays = getDaysOfWeek();
    const monthName = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const hours = Array.from({ length: 11 }, (_, i) => i + 8);

    // Clicar em slot vazio do calendário para criar evento nesse horário
    const handleSlotClick = (date: Date, hour: number) => {
        const d = new Date(date);
        d.setHours(hour, 0, 0, 0);
        setModalDefaultDate(d);
        setModalEvent('new');
    };

    return (
        <div style={{ padding: '0 2rem 2rem 2rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CalendarIcon size={28} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.4rem', fontWeight: '500', margin: 0, color: 'var(--text-primary)' }}>
                            {monthName}
                        </h1>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '4px', border: '1px solid var(--border-soft)' }}>
                        <button onClick={handlePrevWeek} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px', color: 'var(--text-secondary)' }}>
                            <ChevronLeft size={18} />
                        </button>
                        <button onClick={handleToday} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 12px', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                            Hoje
                        </button>
                        <button onClick={handleNextWeek} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px', color: 'var(--text-secondary)' }}>
                            <ChevronRight size={18} />
                        </button>
                    </div>
                    <button
                        className="btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        onClick={() => { setModalDefaultDate(undefined); setModalEvent('new'); }}
                    >
                        <Plus size={18} />
                        <span>Novo Agendamento</span>
                    </button>
                </div>
            </div>

            {/* Calendar Grid Container */}
            <div className="glass-card" style={{ flex: 1, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {isLoading && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(var(--bg-primary-rgb), 0.5)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}>
                        <Loader2 size={32} className="spin" style={{ color: 'var(--accent)' }}/>
                    </div>
                )}

                {/* Headers da Semana */}
                <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', borderBottom: '1px solid var(--border-soft)', background: 'var(--bg-primary)' }}>
                    <div style={{ borderRight: '1px solid var(--border-soft)' }}></div>
                    {weekDays.map((date, i) => {
                        const isToday = new Date().toDateString() === date.toDateString();
                        return (
                            <div key={i} style={{ padding: '8px 12px', borderRight: i < 6 ? '1px solid var(--border-soft)' : 'none', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', color: isToday ? 'var(--accent)' : 'var(--text-muted)', marginBottom: '4px' }}>
                                    {date.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3)}
                                </div>
                                <div style={{
                                    width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    borderRadius: '50%',
                                    backgroundColor: isToday ? 'var(--accent)' : 'transparent',
                                    color: isToday ? 'white' : 'var(--text-primary)',
                                    fontSize: '1.1rem', fontWeight: 500
                                }}>
                                    {date.getDate()}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Grade de Horas */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', position: 'relative' }}>
                    {/* Renderizando as linhas das horas */}
                    <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateRows: `repeat(${hours.length}, 60px)`, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
                        {hours.map((hour) => (
                             <div key={hour} style={{ borderBottom: '1px solid var(--border-soft)', position: 'relative' }}></div>
                         ))}
                    </div>

                    {/* Coluna das legendas de hora */}
                    <div style={{ borderRight: '1px solid var(--border-soft)', background: 'var(--bg-secondary)', zIndex: 2 }}>
                        {hours.map((hour) => (
                            <div key={hour} style={{ height: '60px', display: 'flex', justifyContent: 'center', paddingTop: '8px' }}>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '-8px', background: 'var(--bg-secondary)', padding: '0 4px' }}>
                                    {String(hour).padStart(2, '0')}:00
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Colunas dos dias */}
                    {weekDays.map((date, dayIdx) => (
                        <div key={dayIdx} style={{ borderRight: dayIdx < 6 ? '1px solid var(--border-soft)' : 'none', position: 'relative' }}>
                            {/* Slots clicáveis para criar evento */}
                            {hours.map((hour) => (
                                <div
                                    key={hour}
                                    style={{ height: '60px', cursor: 'pointer' }}
                                    onClick={() => handleSlotClick(date, hour)}
                                    title={`Criar agendamento às ${String(hour).padStart(2, '0')}:00`}
                                />
                            ))}

                            {/* Eventos renderizados por cima */}
                            {events
                                .filter(e => new Date(e.start_time).toDateString() === date.toDateString())
                                .map(event => {
                                    const eventStart = new Date(event.start_time);
                                    const eventEnd = new Date(event.end_time);
                                    const startMin = (eventStart.getHours() - 8) * 60 + eventStart.getMinutes();
                                    const lengthMin = (eventEnd.getTime() - eventStart.getTime()) / 60000;

                                    if (startMin < 0 || startMin > hours.length * 60) return null;

                                    return (
                                        <div
                                            key={event.id}
                                            onClick={(e) => { e.stopPropagation(); setModalEvent(event); }}
                                            style={{
                                                position: 'absolute',
                                                top: `${startMin}px`,
                                                height: `${Math.max(lengthMin, 24)}px`,
                                                left: '2px',
                                                right: '2px',
                                                background: event.status === 'cancelled' ? '#f1f3f4' : (event.status === 'completed' ? '#e6f4ea' : 'var(--accent)'),
                                                color: event.status === 'cancelled' ? '#70757a' : (event.status === 'completed' ? '#1e8e3e' : 'white'),
                                                border: 'none',
                                                borderRadius: '4px',
                                                padding: '2px 6px',
                                                overflow: 'hidden',
                                                zIndex: 5,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                fontSize: '0.75rem',
                                                boxShadow: '0 1px 2px rgba(60,64,67,0.3)',
                                                opacity: event.status === 'cancelled' ? 0.7 : 1,
                                                transition: 'all 0.1s',
                                            }}
                                            onMouseEnter={e => {
                                                e.currentTarget.style.boxShadow = '0 1px 3px 1px rgba(60,64,67,0.15)';
                                                e.currentTarget.style.filter = 'brightness(0.95)';
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.boxShadow = '0 1px 2px rgba(60,64,67,0.3)';
                                                e.currentTarget.style.filter = 'none';
                                            }}
                                        >
                                            <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {event.title}
                                            </div>
                                            {lengthMin > 40 && (
                                                <div style={{ fontSize: '0.65rem', opacity: 0.9 }}>
                                                    {eventStart.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                        </div>
                    ))}
                </div>
            </div>

            {/* Modal de Criar/Editar Evento */}
            {modalEvent && (
                <EventModal
                    event={modalEvent === 'new' ? null : modalEvent}
                    onClose={() => setModalEvent(null)}
                    onSave={handleSaveEvent}
                    onDelete={handleDeleteEvent}
                    authUser={authUser}
                    defaultDate={modalDefaultDate}
                />
            )}
        </div>
    );
}
