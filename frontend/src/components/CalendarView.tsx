import { useState, useEffect, Fragment, type CSSProperties } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Loader2, X, Clock, AlignLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { UserProfile, CalendarEvent } from '../lib/supabase';

interface CalendarViewProps {
    authUser: UserProfile;
    readOnly?: boolean;
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
    const [confirmDelete, setConfirmDelete] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [form]);

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

    const inputStyle: CSSProperties = {
        width: '100%',
        padding: '12px 14px',
        border: '1px solid var(--border-soft)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-secondary)',
        color: 'var(--text-primary)',
        fontSize: '0.95rem',
        outline: 'none',
        transition: 'border-color 0.2s',
        marginBottom: '4px',
        boxSizing: 'border-box' as const
    };

    return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }} onClick={onClose}>
            <div className="fade-in" style={{ padding: '0', width: '480px', maxHeight: '95vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', boxShadow: 'var(--shadow-xl)', borderRadius: 'var(--radius-xl)', backgroundColor: 'var(--bg-primary)' }} onClick={e => e.stopPropagation()}>
                {/* Drag Handle & Close */}
                <div style={{ padding: '8px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-soft)' }}>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '6px', borderRadius: '50%', display: 'flex' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {error && <div style={{ color: 'var(--error)', fontSize: '0.85rem', padding: '10px', backgroundColor: 'var(--error-soft)', borderRadius: 'var(--radius-md)' }}>{error}</div>}
                    
                    {/* Título */}
                    <div style={{ marginBottom: '8px' }}>
                        <input
                            style={{ ...inputStyle, fontSize: '1.2rem', color: 'var(--text-primary)', fontWeight: '600' }}
                            placeholder="Título do evento"
                            value={form.title}
                            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                            autoFocus
                        />
                    </div>

                    {/* Horários / Clock */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                        <div style={{ color: 'var(--text-muted)', marginTop: '8px' }}><Clock size={20} /></div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '0.9rem', color: 'var(--text-primary)', border: '1px solid var(--border-soft)', fontWeight: '500' }}>
                                    {new Date(form.start_time).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                                </div>
                                <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '8px 12px', border: '1px solid var(--border-soft)' }}>
                                    <input
                                        type="time"
                                        value={form.start_time.split('T')[1]}
                                        onChange={e => {
                                            const time = e.target.value;
                                            const date = form.start_time.split('T')[0];
                                            setForm(f => ({ ...f, start_time: `${date}T${time}` }));
                                        }}
                                        style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', fontSize: '0.9rem', fontWeight: '600', colorScheme: 'auto' }}
                                    />
                                </div>
                                <span style={{ color: 'var(--text-muted)', fontWeight: '500' }}>ate</span>
                                <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '8px 12px', border: '1px solid var(--border-soft)' }}>
                                    <input
                                        type="time"
                                        value={form.end_time.split('T')[1]}
                                        onChange={e => {
                                            const time = e.target.value;
                                            const date = form.end_time.split('T')[0];
                                            setForm(f => ({ ...f, end_time: `${date}T${time}` }));
                                        }}
                                        style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', fontSize: '0.9rem', fontWeight: '600', colorScheme: 'auto' }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Descrição */}
                    <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                            <AlignLeft size={14} /> Descrição
                        </label>
                        <textarea
                            placeholder="Adicionar descrição (opcional)"
                            value={form.description}
                            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            style={{
                                width: '100%',
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-soft)',
                                padding: '12px 14px',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--text-primary)',
                                fontSize: '0.9rem',
                                outline: 'none',
                                minHeight: '70px',
                                resize: 'none',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    {/* Status de Confirmação */}
                    {!isNew && event?.confirmation_status && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Confirmação:</span>
                            <span style={{
                                padding: '4px 12px', borderRadius: '100px', fontSize: '0.75rem', fontWeight: 700,
                                backgroundColor: event.confirmation_status === 'confirmed' ? 'rgba(16,185,129,0.1)'
                                    : event.confirmation_status === 'unconfirmed' ? 'rgba(239,68,68,0.1)' : 'rgba(99,102,241,0.1)',
                                color: event.confirmation_status === 'confirmed' ? '#10b981'
                                    : event.confirmation_status === 'unconfirmed' ? '#ef4444' : 'var(--accent)',
                            }}>
                                {event.confirmation_status === 'confirmed' ? 'Confirmado'
                                    : event.confirmation_status === 'unconfirmed' ? 'Não confirmado' : 'Pendente'}
                            </span>
                        </div>
                    )}

                    {/* Ações Finais */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px', borderTop: '1px solid var(--border-soft)', paddingTop: '20px' }}>
                        {!isNew && onDelete && event?.id && !confirmDelete && (
                            <button onClick={() => setConfirmDelete(true)} style={{ background: 'none', border: 'none', color: 'var(--error)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', marginRight: 'auto' }}>Excluir</button>
                        )}
                        {confirmDelete && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: 'auto' }}>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Remover?</span>
                                <button onClick={() => onDelete!(event!.id!)} style={{ background: 'none', border: 'none', color: 'var(--error)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>Sim</button>
                                <button onClick={() => setConfirmDelete(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>Não</button>
                            </div>
                        )}
                        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', padding: '10px 16px' }}>Cancelar</button>
                        <button
                            onClick={handleSubmit}
                            disabled={saving}
                            style={{ 
                                padding: '10px 28px', 
                                borderRadius: '100px', 
                                border: 'none',
                                background: 'var(--accent)', 
                                color: 'white', 
                                cursor: 'pointer', 
                                fontSize: '0.9rem', 
                                fontWeight: 700,
                                transition: 'all 0.2s',
                                boxShadow: '0 4px 10px rgba(99, 102, 241, 0.2)'
                            }}
                            onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
                            onMouseLeave={e => e.currentTarget.style.filter = 'none'}
                        >
                            {saving ? <Loader2 size={18} className="animate-spin" /> : 'Salvar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────

export default function CalendarView({ authUser, readOnly = false }: CalendarViewProps) {
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [modalEvent, setModalEvent] = useState<CalendarEvent | null | 'new'>(null);
    const [modalDefaultDate, setModalDefaultDate] = useState<Date | undefined>();
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && modalEvent) {
                setModalEvent(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [modalEvent]);

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
        if (readOnly) return;
        if (data.id) {
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
            const { error } = await supabase
                .from('sp3_calendar_events')
                .insert(data);
            if (error) throw error;
        }
        setModalEvent(null);
        fetchEvents();
    };

    const handleDeleteEvent = async (id: number) => {
        if (readOnly) return;
        const { error } = await supabase
            .from('sp3_calendar_events')
            .delete()
            .eq('id', id);
        if (error) throw error;
        setModalEvent(null);
        fetchEvents();
    };

    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(currentDate);
        d.setDate(currentDate.getDate() - currentDate.getDay() + i);
        return d;
    });

    const hours = Array.from({ length: 24 }, (_, i) => i);

    const changeWeek = (offset: number) => {
        const d = new Date(currentDate);
        d.setDate(currentDate.getDate() + offset * 7);
        setCurrentDate(d);
    };

    return (
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', overflow: 'hidden', backgroundColor: 'var(--bg-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <CalendarIcon className="text-accent" /> Agenda
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <button onClick={() => setCurrentDate(new Date())} style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>Hoje</button>
                        <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border)', margin: '0 4px' }} />
                        <button onClick={() => changeWeek(-1)} style={{ padding: '6px', borderRadius: '8px', border: 'none', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}><ChevronLeft size={20} /></button>
                        <button onClick={() => changeWeek(1)} style={{ padding: '6px', borderRadius: '8px', border: 'none', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}><ChevronRight size={20} /></button>
                    </div>
                    <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                    </span>
                </div>

                {!readOnly && (
                    <button
                        onClick={() => { setModalDefaultDate(new Date()); setModalEvent('new'); }}
                        style={{
                            padding: '10px 20px',
                            borderRadius: '12px',
                            background: 'var(--accent)',
                            color: 'white',
                            border: 'none',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                    >
                        <Plus size={20} /> Criar Evento
                    </button>
                )}
            </div>

            <div style={{ 
                flex: 1, 
                overflow: 'auto', 
                backgroundColor: 'var(--bg-primary)', 
                borderRadius: 'var(--radius-xl)', 
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '80px repeat(7, 1fr)', 
                    borderBottom: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-secondary)',
                    position: 'sticky',
                    top: 0,
                    zIndex: 10
                }}>
                    <div style={{ height: '60px' }} />
                    {weekDays.map((day, i) => (
                        <div key={i} style={{ 
                            height: '60px', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            borderLeft: '1px solid var(--border-soft)'
                        }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{day.toLocaleDateString('pt-BR', { weekday: 'short' })}</span>
                            <span style={{ 
                                fontSize: '1.25rem', 
                                fontWeight: 800, 
                                color: day.toDateString() === new Date().toDateString() ? 'var(--accent)' : 'var(--text-primary)',
                                background: day.toDateString() === new Date().toDateString() ? 'var(--accent-soft)' : 'transparent',
                                width: '36px',
                                height: '36px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '50%',
                                marginTop: '2px'
                            }}>{day.getDate()}</span>
                        </div>
                    ))}
                </div>

                <div style={{ flex: 1, position: 'relative', display: 'grid', gridTemplateColumns: '80px repeat(7, 1fr)' }}>
                    {isLoading && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
                            <Loader2 className="animate-spin text-accent" size={40} />
                        </div>
                    )}

                    {hours.map(hour => (
                        <Fragment key={hour}>
                            <div style={{ 
                                height: '80px', 
                                display: 'flex', 
                                justifyContent: 'center', 
                                alignItems: 'flex-start', 
                                fontSize: '0.7rem', 
                                color: 'var(--text-muted)', 
                                padding: '10px 0', 
                                borderRight: '1px solid var(--border-soft)', 
                                borderBottom: '1px solid var(--border-soft)',
                                backgroundColor: 'var(--bg-primary)',
                                position: 'relative'
                            }}>
                                <span style={{ position: 'relative', top: '-10px' }}>{hour}:00</span>
                            </div>

                            {weekDays.map((_, i) => (
                                <div
                                    key={`${hour}-${i}`}
                                    onClick={() => {
                                        const d = new Date(weekDays[i]);
                                        d.setHours(hour, 0, 0, 0);
                                        setModalDefaultDate(d);
                                        setModalEvent('new');
                                    }}
                                    style={{ 
                                        height: '80px', 
                                        borderBottom: i === 23 ? 'none' : '1px solid var(--border-soft)', 
                                        borderRight: i < 6 ? '1px solid var(--border-soft)' : 'none', 
                                        cursor: 'cell',
                                        transition: 'background 0.2s'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                />
                            ))}
                        </Fragment>
                    ))}

                    <div style={{ position: 'absolute', top: 0, left: '80px', right: 0, bottom: 0, pointerEvents: 'none' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', height: '100%' }}>
                            {weekDays.map((day, i) => {
                                const isToday = day.toDateString() === now.toDateString();
                                const dayEvents = events.filter(e => new Date(e.start_time).toDateString() === day.toDateString())
                                    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

                                return (
                                    <div key={i} style={{ position: 'relative', height: '100%', pointerEvents: 'none', borderRight: i < 6 ? '1px solid transparent' : 'none' }}>
                                        {/* Current Time Indicator */}
                                        {isToday && (
                                            <div style={{
                                                position: 'absolute',
                                                top: `${((now.getHours() * 60) + now.getMinutes()) * (80/60)}px`,
                                                left: 0,
                                                right: 0,
                                                height: '2px',
                                                backgroundColor: '#ea4335',
                                                zIndex: 50,
                                                display: 'flex',
                                                alignItems: 'center'
                                            }}>
                                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ea4335', marginLeft: '-6px' }} />
                                            </div>
                                        )}

                                        {dayEvents.map((event, idx) => {
                                            const eventStart = new Date(event.start_time);
                                            const eventEnd = new Date(event.end_time);
                                            const startMin = (eventStart.getHours() * 60) + eventStart.getMinutes();
                                            const endMin = (eventEnd.getHours() * 60) + eventEnd.getMinutes();
                                            const lengthMin = Math.max(endMin - startMin, 30);
                                            const pixelsPerMin = 80 / 60;

                                            // Improved overlap logic using percentages
                                            const overlappingBefore = dayEvents.slice(0, idx).filter(e => {
                                                const eStart = new Date(e.start_time);
                                                const eEnd = new Date(e.end_time);
                                                return (eStart < eventEnd && eEnd > eventStart);
                                            });

                                            const totalOverlapping = dayEvents.filter(e => {
                                                const eStart = new Date(e.start_time);
                                                const eEnd = new Date(e.end_time);
                                                return (eStart < eventEnd && eEnd > eventStart);
                                            }).length;

                                            const width = 100 / totalOverlapping;
                                            const leftOffset = overlappingBefore.length * width;

                                            return (
                                                <div
                                                    key={event.id}
                                                    onClick={(e) => { e.stopPropagation(); setModalEvent(event); }}
                                                    style={{
                                                        position: 'absolute',
                                                        top: `${startMin * pixelsPerMin}px`,
                                                        height: `${lengthMin * pixelsPerMin}px`,
                                                        left: `${leftOffset}%`,
                                                        width: `${width}%`,
                                                        background: event.status === 'cancelled' ? 'var(--bg-tertiary)'
                                                            : event.status === 'completed' ? '#e6f4ea'
                                                            : event.confirmation_status === 'confirmed' ? '#10b981'
                                                            : event.confirmation_status === 'unconfirmed' ? '#ef4444'
                                                            : 'var(--accent)',
                                                        color: event.status === 'cancelled' ? 'var(--text-muted)' : (event.status === 'completed' ? '#1e8e3e' : 'white'),
                                                        border: '1px solid rgba(255,255,255,0.2)',
                                                        borderRadius: '6px',
                                                        padding: '4px 6px',
                                                        overflow: 'hidden',
                                                        zIndex: 10 + idx,
                                                        cursor: 'pointer',
                                                        fontSize: '0.7rem',
                                                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                                        pointerEvents: 'auto',
                                                        transition: 'all 0.1s ease-in-out',
                                                        boxSizing: 'border-box'
                                                    }}
                                                    onMouseEnter={e => {
                                                        e.currentTarget.style.zIndex = '100';
                                                        e.currentTarget.style.filter = 'brightness(1.05)';
                                                        e.currentTarget.style.transform = 'scale(1.02)';
                                                    }}
                                                    onMouseLeave={e => {
                                                        e.currentTarget.style.zIndex = (10 + idx).toString();
                                                        e.currentTarget.style.filter = 'none';
                                                        e.currentTarget.style.transform = 'none';
                                                    }}
                                                >
                                                    <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {event.title}
                                                    </div>
                                                    <div style={{ fontSize: '0.65rem', opacity: 0.9 }}>
                                                        {eventStart.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                    {event.confirmation_status && event.confirmation_status !== 'pending' && event.status === 'scheduled' && (
                                                        <div style={{ fontSize: '0.55rem', fontWeight: 700, opacity: 0.9, marginTop: '1px' }}>
                                                            {event.confirmation_status === 'confirmed' ? '✓ Confirmado' : '✗ Não confirmado'}
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
