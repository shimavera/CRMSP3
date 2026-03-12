import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Loader2, Video, X, Clock, AlignLeft, Users, MapPin, Calendar, Globe } from 'lucide-react';
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

    const inputStyle: React.CSSProperties = { 
        width: '100%', 
        padding: '12px 0', 
        border: 'none', 
        borderBottom: '1px solid #3c4043', 
        background: 'transparent', 
        color: '#e8eaed', 
        fontSize: '0.95rem', 
        outline: 'none', 
        transition: 'border-color 0.2s',
        marginBottom: '4px'
    };

    const buttonGhostStyle: React.CSSProperties = {
        background: 'transparent',
        border: 'none',
        color: '#8ab4f8',
        fontSize: '0.85rem',
        fontWeight: 500,
        cursor: 'pointer',
        padding: '8px 12px',
        borderRadius: '4px'
    };

    return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
            <div style={{ background: '#202124', borderRadius: '12px', padding: '0', width: '520px', maxHeight: '95vh', overflow: 'hidden', boxShadow: '0 12px 32px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                {/* Header Actions */}
                <div style={{ padding: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ color: '#9aa0a6', cursor: 'grab', padding: '4px' }}><AlignLeft size={16} /></div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9aa0a6', padding: '8px', borderRadius: '50%' }}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ padding: '0 24px 24px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {error && <div style={{ color: '#f28b82', fontSize: '0.85rem', padding: '0 40px' }}>{error}</div>}
                    {/* Título */}
                    <div style={{ marginLeft: '40px' }}>
                        <input
                            style={{ ...inputStyle, fontSize: '1.4rem', borderBottom: '1px solid #8ab4f8', color: '#e8eaed' }}
                            placeholder="Adicionar título"
                            value={form.title}
                            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                            autoFocus
                        />
                    </div>

                    {/* Tabs / Type */}
                    <div style={{ marginLeft: '40px', display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <div style={{ background: '#174ea6', color: '#d2e3fc', padding: '6px 16px', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 500 }}>Evento</div>
                        <div style={{ color: '#9aa0a6', padding: '6px 16px', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 500 }}>Tarefa</div>
                        <div style={{ color: '#9aa0a6', padding: '6px 16px', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            Agendamento de horários <span style={{ background: '#3c4043', color: '#e8eaed', padding: '1px 6px', borderRadius: '100px', fontSize: '0.65rem' }}>Novo</span>
                        </div>
                    </div>

                    {/* Horários / Clock */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                        <div style={{ color: '#9aa0a6', marginTop: '12px' }}><Clock size={20} /></div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ background: '#3c4043', borderRadius: '4px', padding: '8px 12px', fontSize: '0.9rem', color: '#e8eaed', cursor: 'pointer' }}>
                                    {new Date(form.start_time).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                                </div>
                                <div style={{ background: '#3c4043', borderRadius: '4px', padding: '8px 12px', fontSize: '0.9rem', color: '#e8eaed' }}>
                                    <input 
                                        type="time" 
                                        value={form.start_time.split('T')[1]} 
                                        onChange={e => {
                                            const time = e.target.value;
                                            const date = form.start_time.split('T')[0];
                                            setForm(f => ({ ...f, start_time: `${date}T${time}` }));
                                        }}
                                        style={{ background: 'transparent', border: 'none', color: 'inherit', outline: 'none' }}
                                    />
                                </div>
                                <span style={{ color: '#9aa0a6' }}>–</span>
                                <div style={{ background: '#3c4043', borderRadius: '4px', padding: '8px 12px', fontSize: '0.9rem', color: '#e8eaed' }}>
                                    <input 
                                        type="time" 
                                        value={form.end_time.split('T')[1]} 
                                        onChange={e => {
                                            const time = e.target.value;
                                            const date = form.end_time.split('T')[0];
                                            setForm(f => ({ ...f, end_time: `${date}T${time}` }));
                                        }}
                                        style={{ background: 'transparent', border: 'none', color: 'inherit', outline: 'none' }}
                                    />
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.85rem' }}>
                                <label style={{ color: '#e8eaed', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input type="checkbox" style={{ accentColor: '#8ab4f8' }} /> Dia inteiro
                                </label>
                                <span style={{ color: '#8ab4f8', cursor: 'pointer' }}>Fuso horário</span>
                            </div>
                        </div>
                    </div>

                    {/* Guests / Users */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: '#9aa0a6', cursor: 'pointer' }}>
                        <Users size={20} />
                        <span style={{ fontSize: '0.9rem' }}>Adicionar convidados</span>
                    </div>

                    {/* Video / Google Meet */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: '#9aa0a6', cursor: 'pointer' }}>
                        <Video size={20} color="#8ab4f8" />
                        <span style={{ fontSize: '0.9rem' }}>Adicionar videoconferência do Google Meet</span>
                    </div>

                    {/* Location / MapPin */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: '#9aa0a6', cursor: 'pointer' }}>
                        <MapPin size={20} />
                        <span style={{ fontSize: '0.9rem' }}>Adicionar local</span>
                    </div>

                    {/* Description / AlignLeft */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: '#9aa0a6', cursor: 'pointer' }}>
                        <AlignLeft size={20} />
                        <span style={{ fontSize: '0.9rem' }}>Adicionar descrição ou um anexo</span>
                    </div>

                    {/* User Profile / Calendar */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                        <div style={{ color: '#9aa0a6' }}><Calendar size={20} /></div>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '0.9rem', color: '#e8eaed' }}>{authUser.nome}</span>
                                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#8ab4f8' }} />
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#9aa0a6' }}>
                                Ocupado • Visibilidade padrão • Notificar 30 minutos antes
                            </div>
                        </div>
                    </div>

                    {/* Recordings / Globe */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }}>
                        <div style={{ background: '#3f11d1', padding: '2px', borderRadius: '4px' }}><Globe size={14} color="white" /></div>
                        <span style={{ fontSize: '0.85rem', color: '#8ab4f8', textDecoration: 'underline' }}>Configure automações de gravação aqui</span>
                    </div>

                    {/* Ações Finais */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                        {!isNew && onDelete && event?.id && (
                            <button onClick={() => { if (confirm('Remover este evento?')) onDelete(event.id!); }} style={{ ...buttonGhostStyle, color: '#f28b82', marginRight: 'auto' }}>Excluir</button>
                        )}
                        <button onClick={onClose} style={buttonGhostStyle}>Mais opções</button>
                        <button
                            onClick={handleSubmit}
                            disabled={saving}
                            style={{ 
                                padding: '10px 32px', 
                                borderRadius: '100px', 
                                border: 'none',
                                background: '#8ab4f8', 
                                color: '#202124', 
                                cursor: 'pointer', 
                                fontSize: '0.9rem', 
                                fontWeight: 600
                            }}
                        >
                            {saving ? <Loader2 size={18} className="spin" /> : (isNew ? 'Salvar' : 'Atualizar')}
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

    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(currentDate);
        d.setDate(currentDate.getDate() - currentDate.getDay() + i);
        return d;
    });

    const hours = Array.from({ length: 24 }, (_, i) => i);

    const monthName = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    if (isLoading && events.length === 0) {
        return (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Loader2 className="animate-spin" size={32} color="var(--accent)" />
            </div>
        );
    }

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
                    <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border)', padding: '4px' }}>
                        <button onClick={handlePrevWeek} style={{ background: 'none', border: 'none', padding: '6px', cursor: 'pointer', color: 'var(--text-secondary)' }}><ChevronLeft size={20} /></button>
                        <button onClick={handleToday} style={{ background: 'none', border: 'none', padding: '0 12px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', color: 'var(--text-primary)' }}>Hoje</button>
                        <button onClick={handleNextWeek} style={{ background: 'none', border: 'none', padding: '6px', cursor: 'pointer', color: 'var(--text-secondary)' }}><ChevronRight size={20} /></button>
                    </div>
                    <button
                        onClick={() => { setModalEvent('new'); setModalDefaultDate(undefined); }}
                        style={{ background: 'var(--accent)', color: 'var(--bg-primary)', border: 'none', borderRadius: '8px', padding: '10px 16px', fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                    >
                        <Plus size={18} /> Novo
                    </button>
                </div>
            </div>

            <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
                {isLoading && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'var(--accent)', zIndex: 100, animation: 'pulse 1.5s infinite' }} />
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

                {/* Grid de Horários */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', position: 'relative' }}>
                    {/* Time labels */}
                    {hours.map(hour => (
                        <div key={hour} style={{ height: '60px', fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', padding: '4px', borderRight: '1px solid var(--border-soft)', position: 'relative' }}>
                            {hour}:00
                        </div>
                    ))}

                    {/* Background grid */}
                    {hours.map(hour => (
                        weekDays.map((_, i) => (
                            <div
                                key={`${hour}-${i}`}
                                onClick={() => {
                                    const d = new Date(weekDays[i]);
                                    d.setHours(hour, 0, 0, 0);
                                    setModalDefaultDate(d);
                                    setModalEvent('new');
                                }}
                                style={{ height: '60px', borderBottom: '1px solid var(--border-soft)', borderRight: i < 6 ? '1px solid var(--border-soft)' : 'none', cursor: 'pointer' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            />
                        ))
                    ))}

                    {/* Events layer */}
                    <div style={{ position: 'absolute', top: 0, left: '60px', right: 0, bottom: 0, pointerEvents: 'none' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', height: '100%' }}>
                            {weekDays.map((day, i) => {
                                const dayEvents = events.filter(e => new Date(e.start_time).toDateString() === day.toDateString());
                                return (
                                    <div key={i} style={{ position: 'relative', height: '100%', pointerEvents: 'none' }}>
                                        {dayEvents.map(event => {
                                            const eventStart = new Date(event.start_time);
                                            const eventEnd = new Date(event.end_time);
                                            const startMin = (eventStart.getHours() * 60) + eventStart.getMinutes();
                                            const endMin = (eventEnd.getHours() * 60) + eventEnd.getMinutes();
                                            const lengthMin = endMin - startMin;

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
                                                        pointerEvents: 'auto'
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
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {modalEvent && (
                <EventModal
                    event={modalEvent === 'new' ? null : modalEvent}
                    defaultDate={modalDefaultDate}
                    authUser={authUser}
                    onClose={() => setModalEvent(null)}
                    onSave={handleSaveEvent}
                    onDelete={handleDeleteEvent}
                />
            )}
        </div>
    );
}
